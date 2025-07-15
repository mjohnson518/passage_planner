import { RedisClientType } from 'redis';
import { Logger } from 'pino';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until retry
}

export class RateLimiter {
  private redis: RedisClientType;
  private logger: Logger;
  
  constructor(redis: RedisClientType, logger: Logger) {
    this.redis = redis;
    this.logger = logger;
  }
  
  async checkLimit(
    identifier: string,
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    const key = `${options.keyPrefix || 'ratelimit'}:${identifier}`;
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    try {
      // Use Redis sorted set for sliding window
      const multi = this.redis.multi();
      
      // Remove old entries
      multi.zRemRangeByScore(key, '-inf', windowStart.toString());
      
      // Count current entries
      multi.zCard(key);
      
      // Add current request
      multi.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      
      // Set expiry
      multi.expire(key, Math.ceil(options.windowMs / 1000));
      
      const results = await multi.exec();
      const count = results[1] as number;
      
      const allowed = count < options.max;
      const remaining = Math.max(0, options.max - count - 1);
      const resetAt = new Date(now + options.windowMs);
      
      if (!allowed) {
        // Calculate retry after
        const oldestEntry = await this.redis.zRange(key, 0, 0, { BY: 'SCORE' });
        if (oldestEntry.length > 0) {
          const oldestTime = parseInt(oldestEntry[0].split('-')[0]);
          const retryAfter = Math.ceil((oldestTime + options.windowMs - now) / 1000);
          
          return {
            allowed: false,
            limit: options.max,
            remaining: 0,
            resetAt,
            retryAfter,
          };
        }
      }
      
      return {
        allowed,
        limit: options.max,
        remaining,
        resetAt,
      };
      
    } catch (error) {
      this.logger.error({ error, key }, 'Rate limit check failed');
      
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        limit: options.max,
        remaining: options.max,
        resetAt: new Date(now + options.windowMs),
      };
    }
  }
  
  // Reset rate limit for an identifier
  async reset(identifier: string, keyPrefix?: string): Promise<void> {
    const key = `${keyPrefix || 'ratelimit'}:${identifier}`;
    
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error({ error, key }, 'Failed to reset rate limit');
    }
  }
  
  // Get current usage for an identifier
  async getUsage(
    identifier: string,
    windowMs: number,
    keyPrefix?: string
  ): Promise<number> {
    const key = `${keyPrefix || 'ratelimit'}:${identifier}`;
    const windowStart = Date.now() - windowMs;
    
    try {
      // Remove old entries and count
      await this.redis.zRemRangeByScore(key, '-inf', windowStart.toString());
      return await this.redis.zCard(key);
    } catch (error) {
      this.logger.error({ error, key }, 'Failed to get usage');
      return 0;
    }
  }
  
  // Create Express middleware
  middleware(options: RateLimitOptions) {
    return async (req: any, res: any, next: any) => {
      // Determine identifier
      const identifier = this.getIdentifier(req);
      
      // Check rate limit
      const result = await this.checkLimit(identifier, options);
      
      // Set headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
      
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 60);
        
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter: result.retryAfter,
            resetAt: result.resetAt,
          },
        });
      }
      
      next();
    };
  }
  
  // Determine identifier from request
  private getIdentifier(req: any): string {
    // Prefer authenticated user ID
    if (req.user?.userId) {
      return `user:${req.user.userId}`;
    }
    
    // Fall back to API key
    if (req.headers['x-api-key']) {
      return `apikey:${req.headers['x-api-key'].substring(0, 8)}`;
    }
    
    // Fall back to IP address
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }
  
  // Create tiered rate limiters based on subscription
  createTieredLimiter() {
    const tiers = {
      free: { windowMs: 60000, max: 10 }, // 10 per minute
      premium: { windowMs: 60000, max: 60 }, // 60 per minute
      pro: { windowMs: 60000, max: 300 }, // 300 per minute
      enterprise: { windowMs: 60000, max: 1000 }, // 1000 per minute
    };
    
    return async (req: any, res: any, next: any) => {
      const tier = req.user?.subscription?.tier || 'free';
      const options = {
        ...tiers[tier as keyof typeof tiers],
        keyPrefix: `ratelimit:${tier}`,
      };
      
      const middleware = this.middleware(options);
      return middleware(req, res, next);
    };
  }
} 