// orchestrator/src/services/RateLimiter.ts
// Redis-based rate limiting service for external APIs

import { createClient, RedisClientType } from 'redis';
import pino, { Logger } from 'pino';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix?: string; // Optional prefix for Redis keys
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until next request allowed
}

export class RateLimiter {
  private redis: RedisClientType;
  private logger: Logger;
  
  // Default rate limits for different services
  private readonly DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
    // NOAA APIs
    'noaa_weather': { windowMs: 60000, maxRequests: 60 }, // 60/min
    'noaa_tides': { windowMs: 60000, maxRequests: 60 }, // 60/min
    'noaa_currents': { windowMs: 60000, maxRequests: 60 }, // 60/min
    
    // OpenWeatherMap
    'openweather_free': { windowMs: 60000, maxRequests: 60 }, // 60/min
    'openweather_pro': { windowMs: 60000, maxRequests: 600 }, // 600/min
    
    // Windy API
    'windy_point': { windowMs: 3600000, maxRequests: 1000 }, // 1000/hour
    'windy_map': { windowMs: 3600000, maxRequests: 100 }, // 100/hour
    
    // Marine Traffic
    'marinetraffic': { windowMs: 86400000, maxRequests: 100 }, // 100/day
    
    // Default for unknown services
    'default': { windowMs: 60000, maxRequests: 30 } // 30/min
  };
  
  constructor(redis: RedisClientType, logger: Logger) {
    this.redis = redis;
    this.logger = logger.child({ service: 'RateLimiter' });
  }
  
  /**
   * Check if request is allowed under rate limit
   */
  async checkLimit(
    identifier: string,
    service?: string,
    customConfig?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const config = customConfig || this.DEFAULT_LIMITS[service || 'default'] || this.DEFAULT_LIMITS.default;
    const key = this.generateKey(identifier, service, config.keyPrefix);
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    try {
      // Use Redis sorted set for sliding window rate limiting
      // Remove old entries outside the window
      await this.redis.zremrangebyscore(key, '-inf', windowStart.toString());
      
      // Count requests in current window
      const count = await this.redis.zcard(key);
      
      if (count < config.maxRequests) {
        // Add current request
        await this.redis.zadd(key, now, `${now}-${Math.random()}`);
        
        // Set expiry to clean up old keys
        await this.redis.expire(key, Math.ceil(config.windowMs / 1000));
        
        return {
          allowed: true,
          remaining: config.maxRequests - count - 1,
          resetAt: new Date(now + config.windowMs)
        };
      } else {
        // Get oldest request time to calculate retry after
        const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTime = oldestRequest.length > 1 ? parseInt(oldestRequest[1]) : now;
        const retryAfter = Math.ceil((oldestTime + config.windowMs - now) / 1000);
        
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(oldestTime + config.windowMs),
          retryAfter
        };
      }
    } catch (error) {
      this.logger.error({ error, identifier, service }, 'Rate limit check failed');
      
      // On error, allow request but log it
      return {
        allowed: true,
        remaining: -1,
        resetAt: new Date(now + config.windowMs)
      };
    }
  }
  
  /**
   * Consume a token from the rate limit bucket
   */
  async consume(
    identifier: string,
    service?: string,
    tokens: number = 1
  ): Promise<RateLimitResult> {
    if (tokens === 1) {
      return this.checkLimit(identifier, service);
    }
    
    // For multiple tokens, check if we have enough capacity
    const config = this.DEFAULT_LIMITS[service || 'default'] || this.DEFAULT_LIMITS.default;
    const key = this.generateKey(identifier, service);
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    try {
      await this.redis.zremrangebyscore(key, '-inf', windowStart.toString());
      const count = await this.redis.zcard(key);
      
      if (count + tokens <= config.maxRequests) {
        // Add all tokens
        const multi = this.redis.multi();
        for (let i = 0; i < tokens; i++) {
          multi.zadd(key, now, `${now}-${Math.random()}-${i}`);
        }
        multi.expire(key, Math.ceil(config.windowMs / 1000));
        await multi.exec();
        
        return {
          allowed: true,
          remaining: config.maxRequests - count - tokens,
          resetAt: new Date(now + config.windowMs)
        };
      } else {
        return {
          allowed: false,
          remaining: Math.max(0, config.maxRequests - count),
          resetAt: new Date(now + config.windowMs),
          retryAfter: Math.ceil(config.windowMs / 1000)
        };
      }
    } catch (error) {
      this.logger.error({ error, identifier, service, tokens }, 'Rate limit consume failed');
      return {
        allowed: true,
        remaining: -1,
        resetAt: new Date(now + config.windowMs)
      };
    }
  }
  
  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string, service?: string): Promise<void> {
    const key = this.generateKey(identifier, service);
    
    try {
      await this.redis.del(key);
      this.logger.info({ identifier, service }, 'Rate limit reset');
    } catch (error) {
      this.logger.error({ error, identifier, service }, 'Rate limit reset failed');
    }
  }
  
  /**
   * Get current usage for an identifier
   */
  async getUsage(
    identifier: string,
    service?: string
  ): Promise<{ used: number; limit: number; resetAt: Date }> {
    const config = this.DEFAULT_LIMITS[service || 'default'] || this.DEFAULT_LIMITS.default;
    const key = this.generateKey(identifier, service);
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    try {
      await this.redis.zremrangebyscore(key, '-inf', windowStart.toString());
      const count = await this.redis.zcard(key);
      
      return {
        used: count,
        limit: config.maxRequests,
        resetAt: new Date(now + config.windowMs)
      };
    } catch (error) {
      this.logger.error({ error, identifier, service }, 'Get usage failed');
      return {
        used: 0,
        limit: config.maxRequests,
        resetAt: new Date(now + config.windowMs)
      };
    }
  }
  
  /**
   * Create a rate limiter middleware for Express
   */
  middleware(service?: string, customConfig?: RateLimitConfig) {
    return async (req: any, res: any, next: any) => {
      const identifier = this.getIdentifier(req);
      const result = await this.checkLimit(identifier, service, customConfig);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', customConfig?.maxRequests || this.DEFAULT_LIMITS[service || 'default']?.maxRequests || 30);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
      
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 60);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter
        });
      }
      
      next();
    };
  }
  
  /**
   * Distributed rate limiting across multiple services
   */
  async checkDistributedLimit(
    identifier: string,
    service: string,
    instanceId: string
  ): Promise<RateLimitResult> {
    const config = this.DEFAULT_LIMITS[service] || this.DEFAULT_LIMITS.default;
    const key = `distributed:${this.generateKey(identifier, service)}`;
    const instanceKey = `${key}:${instanceId}`;
    const now = Date.now();
    
    try {
      // Use Redis transactions for atomic operations
      const multi = this.redis.multi();
      
      // Get current window count
      multi.get(`${key}:count`);
      multi.get(`${key}:window`);
      
      const results = await multi.exec();
      const currentCount = parseInt(results[0] as string) || 0;
      const windowStart = parseInt(results[1] as string) || now;
      
      // Check if we need to reset the window
      if (now - windowStart >= config.windowMs) {
        await this.redis.multi()
          .set(`${key}:count`, '1')
          .set(`${key}:window`, now.toString())
          .expire(`${key}:count`, Math.ceil(config.windowMs / 1000))
          .expire(`${key}:window`, Math.ceil(config.windowMs / 1000))
          .exec();
        
        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetAt: new Date(now + config.windowMs)
        };
      }
      
      if (currentCount < config.maxRequests) {
        await this.redis.incr(`${key}:count`);
        
        return {
          allowed: true,
          remaining: config.maxRequests - currentCount - 1,
          resetAt: new Date(windowStart + config.windowMs)
        };
      } else {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(windowStart + config.windowMs),
          retryAfter: Math.ceil((windowStart + config.windowMs - now) / 1000)
        };
      }
    } catch (error) {
      this.logger.error({ error, identifier, service, instanceId }, 'Distributed rate limit check failed');
      return {
        allowed: true,
        remaining: -1,
        resetAt: new Date(now + config.windowMs)
      };
    }
  }
  
  /**
   * Get rate limit statistics
   */
  async getStats(): Promise<Record<string, any>> {
    try {
      const keys = await this.redis.keys('rate_limit:*');
      const stats: Record<string, any> = {};
      
      for (const key of keys) {
        const count = await this.redis.zcard(key);
        const service = key.split(':')[2] || 'unknown';
        
        if (!stats[service]) {
          stats[service] = { requests: 0, identifiers: 0 };
        }
        
        stats[service].requests += count;
        stats[service].identifiers += 1;
      }
      
      return stats;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get rate limit stats');
      return {};
    }
  }
  
  // Private helper methods
  
  private generateKey(identifier: string, service?: string, prefix?: string): string {
    const parts = [
      prefix || 'rate_limit',
      service || 'default',
      identifier
    ];
    
    return parts.join(':');
  }
  
  private getIdentifier(req: any): string {
    // Try different methods to identify the requester
    // 1. API key
    if (req.headers['x-api-key']) {
      return `api:${req.headers['x-api-key']}`;
    }
    
    // 2. User ID from JWT
    if (req.user && req.user.id) {
      return `user:${req.user.id}`;
    }
    
    // 3. IP address (with proxy support)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
               req.headers['x-real-ip'] ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress;
    
    return `ip:${ip}`;
  }
} 