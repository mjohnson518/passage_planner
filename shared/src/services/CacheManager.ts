import { createClient, RedisClientType } from 'redis';
import pino from 'pino';
import crypto from 'crypto';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize?: number; // Max entries for this cache type
  compress?: boolean; // Whether to compress data
}

export interface CacheTypes {
  weather_current: CacheConfig;
  weather_forecast: CacheConfig;
  marine_forecast: CacheConfig;
  tide_predictions: CacheConfig;
  port_info: CacheConfig;
  route_calculations: CacheConfig;
  [key: string]: CacheConfig;
}

export class CacheManager {
  private redis: RedisClientType;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  
  private readonly cacheConfigs: CacheTypes = {
    weather_current: {
      ttl: 15 * 60, // 15 minutes
      compress: false,
    },
    weather_forecast: {
      ttl: 60 * 60, // 1 hour
      compress: true,
    },
    marine_forecast: {
      ttl: 60 * 60, // 1 hour
      compress: true,
    },
    tide_predictions: {
      ttl: 24 * 60 * 60, // 24 hours (tides are predictable)
      compress: true,
    },
    port_info: {
      ttl: 7 * 24 * 60 * 60, // 7 days (static data)
      compress: true,
    },
    route_calculations: {
      ttl: 30 * 60, // 30 minutes
      compress: true,
    },
  };
  
  private stats = {
    hits: 0,
    misses: 0,
    errors: 0,
  };
  
  constructor(redisUrl?: string) {
    this.redis = createClient({
      url: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    });
    
    this.redis.on('error', (err) => {
      this.logger.error('Redis Cache Error', err);
      this.stats.errors++;
    });
    
    this.redis.on('connect', () => {
      this.logger.info('Connected to Redis cache');
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
   * Generate a cache key
   */
  private generateKey(type: string, identifier: string): string {
    const hash = crypto.createHash('md5').update(identifier).digest('hex');
    return `cache:${type}:${hash}`;
  }
  
  /**
   * Get data from cache
   */
  async get<T>(type: string, identifier: string): Promise<T | null> {
    const key = this.generateKey(type, identifier);
    
    try {
      const data = await this.redis.get(key);
      
      if (!data) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      
      // Parse and decompress if needed
      const parsed = JSON.parse(data);
      
      if (parsed.compressed && this.cacheConfigs[type]?.compress) {
        // In production, would use zlib for compression
        return parsed.data;
      }
      
      return parsed.data;
      
    } catch (error) {
      this.logger.error({ error, type, key }, 'Cache get error');
      this.stats.errors++;
      return null;
    }
  }
  
  /**
   * Set data in cache
   */
  async set<T>(type: string, identifier: string, data: T, customTTL?: number): Promise<void> {
    const key = this.generateKey(type, identifier);
    const config = this.cacheConfigs[type] || { ttl: 300 };
    const ttl = customTTL || config.ttl;
    
    try {
      const cacheData = {
        data,
        compressed: false,
        cachedAt: new Date().toISOString(),
        type,
      };
      
      // In production, would compress if config.compress is true
      
      await this.redis.setEx(key, ttl, JSON.stringify(cacheData));
      
      this.logger.debug({ type, key, ttl }, 'Data cached');
      
    } catch (error) {
      this.logger.error({ error, type, key }, 'Cache set error');
      this.stats.errors++;
    }
  }
  
  /**
   * Delete data from cache
   */
  async delete(type: string, identifier: string): Promise<void> {
    const key = this.generateKey(type, identifier);
    
    try {
      await this.redis.del(key);
      this.logger.debug({ type, key }, 'Cache entry deleted');
    } catch (error) {
      this.logger.error({ error, type, key }, 'Cache delete error');
    }
  }
  
  /**
   * Clear all cache entries of a specific type
   */
  async clearType(type: string): Promise<void> {
    try {
      const pattern = `cache:${type}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        this.logger.info({ type, count: keys.length }, 'Cache type cleared');
      }
    } catch (error) {
      this.logger.error({ error, type }, 'Cache clear error');
    }
  }
  
  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await this.redis.keys('cache:*');
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        this.logger.info({ count: keys.length }, 'All cache cleared');
      }
    } catch (error) {
      this.logger.error({ error }, 'Cache clear all error');
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    hits: number;
    misses: number;
    errors: number;
    hitRate: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate,
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
    };
  }
  
  /**
   * Cache wrapper function for easy integration
   */
  async cached<T>(
    type: string,
    identifier: string,
    fetchFunction: () => Promise<T>,
    customTTL?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(type, identifier);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch fresh data
    const fresh = await fetchFunction();
    
    // Cache the result
    await this.set(type, identifier, fresh, customTTL);
    
    return fresh;
  }
  
  /**
   * Invalidate related caches when data changes
   */
  async invalidateRelated(type: string, identifier: string): Promise<void> {
    const invalidationMap: Record<string, string[]> = {
      'port_info': ['route_calculations'],
      'weather_current': ['route_calculations'],
      'weather_forecast': ['route_calculations'],
    };
    
    const relatedTypes = invalidationMap[type] || [];
    
    for (const relatedType of relatedTypes) {
      await this.clearType(relatedType);
    }
  }
  
  /**
   * Get cache info for monitoring
   */
  async getCacheInfo(): Promise<{
    memoryUsage: string;
    totalKeys: number;
    keysByType: Record<string, number>;
    configs: CacheTypes;
  }> {
    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';
      
      const keysByType: Record<string, number> = {};
      let totalKeys = 0;
      
      for (const type of Object.keys(this.cacheConfigs)) {
        const keys = await this.redis.keys(`cache:${type}:*`);
        keysByType[type] = keys.length;
        totalKeys += keys.length;
      }
      
      return {
        memoryUsage,
        totalKeys,
        keysByType,
        configs: this.cacheConfigs,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get cache info');
      return {
        memoryUsage: 'unknown',
        totalKeys: 0,
        keysByType: {},
        configs: this.cacheConfigs,
      };
    }
  }
  
  /**
   * Warm up cache with pre-fetched data
   */
  async warmUp(
    entries: Array<{
      type: string;
      identifier: string;
      data: any;
    }>
  ): Promise<void> {
    this.logger.info({ count: entries.length }, 'Warming up cache');
    
    for (const entry of entries) {
      await this.set(entry.type, entry.identifier, entry.data);
    }
  }
} 