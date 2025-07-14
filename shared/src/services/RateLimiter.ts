import { createClient, RedisClientType } from 'redis';
import pino from 'pino';

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Prefix for Redis keys
}

export interface APIRateLimits {
  openweather: RateLimitConfig;
  windy: RateLimitConfig;
  noaa: RateLimitConfig;
  [key: string]: RateLimitConfig;
}

export class RateLimiter {
  private redis: RedisClientType;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  
  private readonly defaultLimits: APIRateLimits = {
    openweather: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 calls per minute (free tier)
      keyPrefix: 'rl:openweather:',
    },
    windy: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 1000, // 1000 calls per hour
      keyPrefix: 'rl:windy:',
    },
    noaa: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // Conservative limit (no official limit)
      keyPrefix: 'rl:noaa:',
    },
  };
  
  constructor(redisUrl?: string) {
    this.redis = createClient({
      url: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    });
    
    this.redis.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
    });
    
    this.redis.on('connect', () => {
      this.logger.info('Connected to Redis for rate limiting');
    });
  }
  
  async connect(): Promise<void> {
    if (!this.redis.isOpen) {
      await this.redis.connect();
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.redis.isOpen) {
      await this.redis.disconnect();
    }
  }
  
  /**
   * Check if a request is allowed under the rate limit
   * @param api - The API identifier (e.g., 'openweather', 'windy')
   * @param identifier - Unique identifier for the rate limit (e.g., API key, user ID)
   * @returns Object with allowed status and metadata
   */
  async checkLimit(api: string, identifier: string = 'default'): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
  }> {
    const config = this.defaultLimits[api] || {
      windowMs: 60 * 1000,
      maxRequests: 100,
      keyPrefix: `rl:${api}:`,
    };
    
    const key = `${config.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    try {
      // Remove old entries
      await this.redis.zRemRangeByScore(key, '-inf', windowStart.toString());
      
      // Count requests in current window
      const count = await this.redis.zCard(key);
      
      if (count >= config.maxRequests) {
        // Get oldest request time to calculate retry after
        const oldestRequest = await this.redis.zRange(key, 0, 0, { 
          WITHSCORES: true 
        });
        
        const oldestTime = oldestRequest[0]?.score || now;
        const resetAt = new Date(oldestTime + config.windowMs);
        const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);
        
        this.logger.warn({
          api,
          identifier,
          count,
          limit: config.maxRequests,
          resetAt,
        }, 'Rate limit exceeded');
        
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter,
        };
      }
      
      // Add current request
      await this.redis.zAdd(key, {
        score: now,
        value: `${now}:${Math.random()}`,
      });
      
      // Set expiry on the key
      await this.redis.expire(key, Math.ceil(config.windowMs / 1000));
      
      const remaining = config.maxRequests - count - 1;
      const resetAt = new Date(now + config.windowMs);
      
      return {
        allowed: true,
        remaining,
        resetAt,
      };
      
    } catch (error) {
      this.logger.error({ error, api, identifier }, 'Rate limit check failed');
      
      // On error, allow the request but log it
      return {
        allowed: true,
        remaining: -1,
        resetAt: new Date(now + config.windowMs),
      };
    }
  }
  
  /**
   * Get current usage statistics for an API
   */
  async getUsageStats(api: string, identifier: string = 'default'): Promise<{
    current: number;
    limit: number;
    percentage: number;
    resetAt: Date;
  }> {
    const config = this.defaultLimits[api] || {
      windowMs: 60 * 1000,
      maxRequests: 100,
      keyPrefix: `rl:${api}:`,
    };
    
    const key = `${config.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    try {
      // Remove old entries
      await this.redis.zRemRangeByScore(key, '-inf', windowStart.toString());
      
      // Count requests in current window
      const current = await this.redis.zCard(key);
      const percentage = (current / config.maxRequests) * 100;
      
      return {
        current,
        limit: config.maxRequests,
        percentage,
        resetAt: new Date(now + config.windowMs),
      };
    } catch (error) {
      this.logger.error({ error, api }, 'Failed to get usage stats');
      return {
        current: 0,
        limit: config.maxRequests,
        percentage: 0,
        resetAt: new Date(now + config.windowMs),
      };
    }
  }
  
  /**
   * Reset rate limit for a specific API and identifier
   */
  async resetLimit(api: string, identifier: string = 'default'): Promise<void> {
    const config = this.defaultLimits[api];
    if (!config) return;
    
    const key = `${config.keyPrefix}${identifier}`;
    await this.redis.del(key);
    
    this.logger.info({ api, identifier }, 'Rate limit reset');
  }
  
  /**
   * Update rate limit configuration for an API
   */
  updateLimits(api: string, config: RateLimitConfig): void {
    this.defaultLimits[api] = {
      ...config,
      keyPrefix: config.keyPrefix || `rl:${api}:`,
    };
    
    this.logger.info({ api, config }, 'Rate limits updated');
  }
  
  /**
   * Middleware for Express routes
   */
  middleware(api: string) {
    return async (req: any, res: any, next: any) => {
      const identifier = req.user?.id || req.ip || 'anonymous';
      const result = await this.checkLimit(api, identifier);
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': this.defaultLimits[api]?.maxRequests || 100,
        'X-RateLimit-Remaining': Math.max(0, result.remaining),
        'X-RateLimit-Reset': result.resetAt.toISOString(),
      });
      
      if (!result.allowed) {
        res.set('Retry-After', result.retryAfter?.toString() || '60');
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded for ${api} API`,
          retryAfter: result.retryAfter,
          resetAt: result.resetAt,
        });
      }
      
      next();
    };
  }
  
  /**
   * Get all current rate limit statuses
   */
  async getAllStatuses(identifier: string = 'default'): Promise<Record<string, any>> {
    const statuses: Record<string, any> = {};
    
    for (const [api, config] of Object.entries(this.defaultLimits)) {
      statuses[api] = await this.getUsageStats(api, identifier);
    }
    
    return statuses;
  }
} 