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
} 