// orchestrator/src/services/CacheManager.ts
// Redis-based caching service for API responses

import { createClient, RedisClientType } from 'redis';
import pino, { Logger } from 'pino';
import crypto from 'crypto';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  compress?: boolean; // Whether to compress the data
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

export class CacheManager {
  private redis: RedisClientType;
  private logger: Logger;
  private stats: CacheStats;
  private defaultTTL: number = 3600; // 1 hour default
  
  // Cache key prefixes
  private readonly PREFIXES = {
    WEATHER: 'weather:',
    TIDE: 'tide:',
    PORT: 'port:',
    ROUTE: 'route:',
    CURRENT: 'current:',
    ANCHORAGE: 'anchorage:',
    FUEL: 'fuel:',
    STATS: 'stats:',
    TAG: 'tag:'
  };
  
  // TTL configurations by data type
  private readonly TTL_CONFIG = {
    // Weather data changes frequently
    WEATHER_CURRENT: 300, // 5 minutes
    WEATHER_FORECAST: 1800, // 30 minutes
    WEATHER_MARINE: 3600, // 1 hour
    
    // Tidal data is predictable
    TIDE_PREDICTIONS: 86400, // 24 hours
    TIDE_STATIONS: 604800, // 7 days
    
    // Port data rarely changes
    PORT_INFO: 2592000, // 30 days
    PORT_FACILITIES: 604800, // 7 days
    
    // Route calculations
    ROUTE_CALCULATION: 3600, // 1 hour
    ROUTE_OPTIMIZATION: 1800, // 30 minutes
    
    // Current predictions
    CURRENT_PREDICTIONS: 3600, // 1 hour
    CURRENT_STATIONS: 604800, // 7 days
    
    // Anchorage data
    ANCHORAGE_INFO: 604800, // 7 days
    ANCHORAGE_CONDITIONS: 1800, // 30 minutes
    
    // Fuel data
    FUEL_PRICES: 86400, // 24 hours
    FUEL_STATIONS: 604800 // 7 days
  };
  
  constructor(redis: RedisClientType, logger: Logger) {
    this.redis = redis;
    this.logger = logger.child({ service: 'CacheManager' });
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0
    };
    
    // Load stats from Redis on startup
    this.loadStats();
  }
  
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.normalizeKey(key);
      const value = await this.redis.get(fullKey);
      
      if (value) {
        this.stats.hits++;
        this.updateHitRate();
        
        // Parse and decompress if needed
        const data = JSON.parse(value);
        if (data.compressed) {
          return this.decompress(data.value);
        }
        return data.value;
      }
      
      this.stats.misses++;
      this.updateHitRate();
      return null;
      
    } catch (error) {
      this.logger.error({ error, key }, 'Cache get error');
      return null;
    }
  }
  
  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.normalizeKey(key);
      const ttl = options.ttl || this.getDefaultTTL(key);
      
      // Prepare data
      const data = {
        value: options.compress ? await this.compress(value) : value,
        compressed: options.compress || false,
        timestamp: Date.now(),
        tags: options.tags || []
      };
      
      // Set in Redis with TTL
      await this.redis.setex(fullKey, ttl, JSON.stringify(data));
      
      // Handle tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.addToTags(fullKey, options.tags, ttl);
      }
      
      this.stats.sets++;
      this.logger.debug({ key: fullKey, ttl }, 'Cache set');
      
    } catch (error) {
      this.logger.error({ error, key }, 'Cache set error');
    }
  }
  
  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.normalizeKey(key);
      await this.redis.del(fullKey);
      this.stats.deletes++;
      
      this.logger.debug({ key: fullKey }, 'Cache delete');
      
    } catch (error) {
      this.logger.error({ error, key }, 'Cache delete error');
    }
  }
  
  /**
   * Delete all values with a specific tag
   */
  async invalidateTag(tag: string): Promise<void> {
    try {
      const tagKey = `${this.PREFIXES.TAG}${tag}`;
      const keys = await this.redis.smembers(tagKey);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        await this.redis.del(tagKey);
        this.stats.deletes += keys.length;
        
        this.logger.info({ tag, count: keys.length }, 'Invalidated tag');
      }
      
    } catch (error) {
      this.logger.error({ error, tag }, 'Tag invalidation error');
    }
  }
  
  /**
   * Clear all cache entries matching a pattern
   */
  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        this.stats.deletes += keys.length;
        
        this.logger.info({ pattern, count: keys.length }, 'Cleared pattern');
      }
      
    } catch (error) {
      this.logger.error({ error, pattern }, 'Pattern clear error');
    }
  }
  
  /**
   * Get or set cache value (memoization pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Generate value
    const value = await factory();
    
    // Store in cache
    await this.set(key, value, options);
    
    return value;
  }
  
  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(k => this.normalizeKey(k));
      const values = await this.redis.mget(fullKeys);
      
      return values.map((value, index) => {
        if (value) {
          this.stats.hits++;
          try {
            const data = JSON.parse(value);
            return data.compressed ? this.decompress(data.value) : data.value;
          } catch {
            return null;
          }
        } else {
          this.stats.misses++;
          return null;
        }
      });
      
    } catch (error) {
      this.logger.error({ error, keys }, 'Batch get error');
      return keys.map(() => null);
    }
  }
  
  /**
   * Generate cache key for weather data
   */
  weatherKey(type: string, location: any, params?: any): string {
    const parts = [
      this.PREFIXES.WEATHER,
      type,
      `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`
    ];
    
    if (params) {
      parts.push(this.hashObject(params));
    }
    
    return parts.join(':');
  }
  
  /**
   * Generate cache key for tide data
   */
  tideKey(stationId: string, dateRange?: { start: string; end: string }): string {
    const parts = [this.PREFIXES.TIDE, stationId];
    
    if (dateRange) {
      parts.push(`${dateRange.start}_${dateRange.end}`);
    }
    
    return parts.join(':');
  }
  
  /**
   * Generate cache key for route data
   */
  routeKey(departure: any, destination: any, preferences?: any): string {
    const parts = [
      this.PREFIXES.ROUTE,
      `${departure.latitude.toFixed(4)},${departure.longitude.toFixed(4)}`,
      `${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`
    ];
    
    if (preferences) {
      parts.push(this.hashObject(preferences));
    }
    
    return parts.join(':');
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }
  
  /**
   * Reset cache statistics
   */
  async resetStats(): Promise<void> {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0
    };
    
    await this.saveStats();
  }
  
  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(dataLoader: () => Promise<any[]>): Promise<void> {
    try {
      this.logger.info('Starting cache warm-up');
      
      const items = await dataLoader();
      let warmed = 0;
      
      for (const item of items) {
        if (item.key && item.value) {
          await this.set(item.key, item.value, item.options || {});
          warmed++;
        }
      }
      
      this.logger.info({ count: warmed }, 'Cache warm-up completed');
      
    } catch (error) {
      this.logger.error({ error }, 'Cache warm-up failed');
    }
  }
  
  // Private helper methods
  
  private normalizeKey(key: string): string {
    // Ensure key doesn't have special characters that could cause issues
    return key.replace(/[^a-zA-Z0-9:_-]/g, '_');
  }
  
  private getDefaultTTL(key: string): number {
    // Determine TTL based on key prefix
    if (key.startsWith(this.PREFIXES.WEATHER)) {
      if (key.includes('current')) return this.TTL_CONFIG.WEATHER_CURRENT;
      if (key.includes('forecast')) return this.TTL_CONFIG.WEATHER_FORECAST;
      return this.TTL_CONFIG.WEATHER_MARINE;
    }
    
    if (key.startsWith(this.PREFIXES.TIDE)) {
      if (key.includes('station')) return this.TTL_CONFIG.TIDE_STATIONS;
      return this.TTL_CONFIG.TIDE_PREDICTIONS;
    }
    
    if (key.startsWith(this.PREFIXES.PORT)) {
      if (key.includes('facilities')) return this.TTL_CONFIG.PORT_FACILITIES;
      return this.TTL_CONFIG.PORT_INFO;
    }
    
    if (key.startsWith(this.PREFIXES.ROUTE)) {
      if (key.includes('optimize')) return this.TTL_CONFIG.ROUTE_OPTIMIZATION;
      return this.TTL_CONFIG.ROUTE_CALCULATION;
    }
    
    return this.defaultTTL;
  }
  
  private async addToTags(key: string, tags: string[], ttl: number): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.PREFIXES.TAG}${tag}`;
      await this.redis.sadd(tagKey, key);
      await this.redis.expire(tagKey, ttl);
    }
  }
  
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }
  
  private compress(data: any): string {
    // Simple compression using base64 encoding
    // In production, use proper compression like gzip
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }
  
  private decompress(data: string): any {
    // Decompress base64 encoded data
    return JSON.parse(Buffer.from(data, 'base64').toString());
  }
  
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
  
  private async loadStats(): Promise<void> {
    try {
      const stats = await this.redis.get(`${this.PREFIXES.STATS}cache`);
      if (stats) {
        this.stats = JSON.parse(stats);
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to load cache stats');
    }
  }
  
  private async saveStats(): Promise<void> {
    try {
      await this.redis.set(
        `${this.PREFIXES.STATS}cache`,
        JSON.stringify(this.stats)
      );
    } catch (error) {
      this.logger.error({ error }, 'Failed to save cache stats');
    }
  }
} 