import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
import { Logger } from 'pino';

interface RateLimitRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  subscription?: {
    tier: string;
    status: string;
  };
}

export class RateLimiter {
  private redis: RedisClientType;
  private logger: Logger;

  private readonly LIMITS = {
    free: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
    },
    premium: {
      windowMs: 60 * 1000,
      maxRequests: 60,
    },
    pro: {
      windowMs: 60 * 1000,
      maxRequests: 300,
    },
    enterprise: {
      windowMs: 60 * 1000,
      maxRequests: -1, // unlimited
    },
  };

  // SECURITY: Stricter limits for auth endpoints to prevent brute force attacks
  private readonly AUTH_LIMITS = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5, // 5 attempts per 15 minutes
    blockDurationMs: 60 * 60 * 1000, // 1 hour block after exceeded
  };

  constructor(redis: RedisClientType, logger: Logger) {
    this.redis = redis;
    this.logger = logger.child({ middleware: 'rateLimiter' });
  }

  async limit(req: RateLimitRequest, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tier = req.subscription?.tier || 'free';
    const limits = this.LIMITS[tier as keyof typeof this.LIMITS] || this.LIMITS.free;

    // No limit for enterprise
    if (limits.maxRequests === -1) {
      return next();
    }

    const key = `rate_limit:${req.user.id}:${Math.floor(Date.now() / limits.windowMs)}`;

    try {
      const current = await this.redis.incr(key);
      
      // Set expiry on first request
      if (current === 1) {
        await this.redis.expire(key, Math.ceil(limits.windowMs / 1000));
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limits.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.maxRequests - current).toString());
      res.setHeader('X-RateLimit-Reset', new Date(Math.ceil(Date.now() / limits.windowMs) * limits.windowMs).toISOString());

      if (current > limits.maxRequests) {
        this.logger.warn({
          userId: req.user.id,
          tier,
          requests: current,
          limit: limits.maxRequests
        }, 'Rate limit exceeded');

        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(limits.windowMs / 1000),
          upgradeUrl: '/pricing'
        });
      }

      next();
    } catch (error) {
      this.logger.error({ error }, 'Rate limiting failed');
      // Continue on error - don't block requests due to Redis issues
      next();
    }
  }

  /**
   * SECURITY: Rate limit authentication endpoints (login, signup, password reset)
   * Uses IP-based limiting since requests are unauthenticated
   * Stricter limits to prevent brute force and credential stuffing attacks
   */
  async authRateLimit(req: Request, res: Response, next: NextFunction) {
    // Get client IP - prefer X-Forwarded-For for proxied requests
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0].trim()
      : req.ip || req.socket.remoteAddress || 'unknown';

    const windowKey = Math.floor(Date.now() / this.AUTH_LIMITS.windowMs);
    const attemptKey = `auth_rate:${clientIp}:${windowKey}`;
    const blockKey = `auth_block:${clientIp}`;

    try {
      // Check if IP is blocked
      const isBlocked = await this.redis.get(blockKey);
      if (isBlocked) {
        const ttl = await this.redis.ttl(blockKey);
        this.logger.warn({
          ip: clientIp,
          endpoint: req.path,
          remainingBlockTime: ttl
        }, 'Blocked IP attempted auth request');

        return res.status(429).json({
          error: 'Too many authentication attempts. Please try again later.',
          retryAfter: ttl,
        });
      }

      // Increment attempt counter
      const attempts = await this.redis.incr(attemptKey);

      // Set expiry on first attempt
      if (attempts === 1) {
        await this.redis.expire(attemptKey, Math.ceil(this.AUTH_LIMITS.windowMs / 1000));
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.AUTH_LIMITS.maxAttempts.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.AUTH_LIMITS.maxAttempts - attempts).toString());
      res.setHeader('X-RateLimit-Reset', new Date(
        Math.ceil(Date.now() / this.AUTH_LIMITS.windowMs) * this.AUTH_LIMITS.windowMs
      ).toISOString());

      if (attempts > this.AUTH_LIMITS.maxAttempts) {
        // Block the IP for an extended period
        await this.redis.setEx(
          blockKey,
          Math.ceil(this.AUTH_LIMITS.blockDurationMs / 1000),
          'blocked'
        );

        this.logger.warn({
          ip: clientIp,
          endpoint: req.path,
          attempts,
          limit: this.AUTH_LIMITS.maxAttempts
        }, 'Auth rate limit exceeded - IP blocked');

        return res.status(429).json({
          error: 'Too many authentication attempts. Please try again later.',
          retryAfter: Math.ceil(this.AUTH_LIMITS.blockDurationMs / 1000),
        });
      }

      next();
    } catch (error) {
      this.logger.error({ error, ip: clientIp }, 'Auth rate limiting failed');
      // Continue on error - don't block requests due to Redis issues
      // but log for monitoring
      next();
    }
  }

  /**
   * Record a failed authentication attempt for additional tracking
   * Call this after a failed login to track suspicious patterns
   */
  async recordFailedAuth(ip: string, email: string): Promise<void> {
    try {
      const key = `failed_auth:${ip}`;
      await this.redis.lPush(key, JSON.stringify({
        email,
        timestamp: Date.now(),
      }));
      // Keep last 100 failed attempts per IP
      await this.redis.lTrim(key, 0, 99);
      await this.redis.expire(key, 24 * 60 * 60); // 24 hour retention
    } catch (error) {
      this.logger.error({ error, ip, email }, 'Failed to record auth attempt');
    }
  }
} 