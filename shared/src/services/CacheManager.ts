import { createClient, RedisClientType } from 'redis';
import { Logger } from 'pino';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
}

export class CacheManager {
  private redis: RedisClientType;
  private logger: Logger;
  private defaultTTL = 3600; // 1 hour
  private connected = false;
  
  constructor(logger?: Logger) {
    this.logger = logger || console as any;
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    
    this.redis.on('error', (err) => {
      this.logger.error({ error: err }, 'Redis client error');
    });
    
    this.redis.on('connect', () => {
      this.connected = true;
      this.logger.info('Connected to Redis');
    });
    
    this.connectAsync();
  }
  
  private async connectAsync() {
    try {
      await this.redis.connect();
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to Redis');
    }
  }
  
  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;
    
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error({ error, key }, 'Cache get error');
      return null;
    }
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.connected) return;
    
    try {
      const serialized = JSON.stringify(value);
      const options = ttl ? { EX: ttl } : { EX: this.defaultTTL };
      
      await this.redis.set(key, serialized, options);
    } catch (error) {
      this.logger.error({ error, key }, 'Cache set error');
    }
  }
  
  async delete(key: string): Promise<void> {
    if (!this.connected) return;
    
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error({ error, key }, 'Cache delete error');
    }
  }
  
  async exists(key: string): Promise<boolean> {
    if (!this.connected) return false;
    
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error({ error, key }, 'Cache exists error');
      return false;
    }
  }
  
  async getTTL(key: string): Promise<number> {
    if (!this.connected) return -1;
    
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error({ error, key }, 'Cache TTL error');
      return -1;
    }
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.connected) return;
    
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      this.logger.error({ error, pattern }, 'Cache invalidate pattern error');
    }
  }
  
  async flush(): Promise<void> {
    if (!this.connected) return;
    
    try {
      await this.redis.flushAll();
    } catch (error) {
      this.logger.error({ error }, 'Cache flush error');
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.redis.quit();
      this.connected = false;
    }
  }
  
  // Helper method for caching function results
  async cacheable<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, options?.ttl);
    
    return result;
  }
} 