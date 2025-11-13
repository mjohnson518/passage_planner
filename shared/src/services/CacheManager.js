"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const redis_1 = require("redis");
class CacheManager {
    redis;
    logger;
    defaultTTL = 3600; // 1 hour
    connected = false;
    constructor(logger) {
        this.logger = logger || console;
        this.redis = (0, redis_1.createClient)({
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
    async connectAsync() {
        try {
            await this.redis.connect();
        }
        catch (error) {
            this.logger.error({ error }, 'Failed to connect to Redis');
        }
    }
    async get(key) {
        if (!this.connected)
            return null;
        try {
            const value = await this.redis.get(key);
            if (!value)
                return null;
            return JSON.parse(value);
        }
        catch (error) {
            this.logger.error({ error, key }, 'Cache get error');
            return null;
        }
    }
    async set(key, value, ttl) {
        if (!this.connected)
            return;
        try {
            const serialized = JSON.stringify(value);
            const options = ttl ? { EX: ttl } : { EX: this.defaultTTL };
            await this.redis.set(key, serialized, options);
        }
        catch (error) {
            this.logger.error({ error, key }, 'Cache set error');
        }
    }
    /**
     * Set a value with explicit TTL in seconds
     */
    async setWithTTL(key, value, ttlSeconds) {
        if (!this.connected)
            return;
        try {
            const serialized = JSON.stringify(value);
            await this.redis.set(key, serialized, { EX: ttlSeconds });
            // Also store metadata about when this was cached
            const metaKey = `${key}:meta`;
            const metadata = {
                cachedAt: Date.now(),
                ttl: ttlSeconds
            };
            await this.redis.set(metaKey, JSON.stringify(metadata), { EX: ttlSeconds });
            this.logger.debug({ key, ttlSeconds }, 'Cache set with TTL');
        }
        catch (error) {
            this.logger.error({ error, key }, 'Cache setWithTTL error');
        }
    }
    /**
     * Get a value with metadata about TTL and age
     */
    async getWithMetadata(key) {
        if (!this.connected)
            return null;
        try {
            // Get value and metadata in parallel
            const [value, metaData, ttl] = await Promise.all([
                this.redis.get(key),
                this.redis.get(`${key}:meta`),
                this.redis.ttl(key)
            ]);
            if (!value)
                return null;
            const parsed = JSON.parse(value);
            let age = 0;
            let originalTtl = ttl;
            if (metaData) {
                const meta = JSON.parse(metaData);
                age = Math.floor((Date.now() - meta.cachedAt) / 1000); // Age in seconds
                originalTtl = meta.ttl || ttl;
            }
            return {
                value: parsed,
                ttl: ttl > 0 ? ttl : 0,
                age
            };
        }
        catch (error) {
            this.logger.error({ error, key }, 'Cache getWithMetadata error');
            return null;
        }
    }
    async delete(key) {
        if (!this.connected)
            return;
        try {
            await this.redis.del(key);
        }
        catch (error) {
            this.logger.error({ error, key }, 'Cache delete error');
        }
    }
    async exists(key) {
        if (!this.connected)
            return false;
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        }
        catch (error) {
            this.logger.error({ error, key }, 'Cache exists error');
            return false;
        }
    }
    async getTTL(key) {
        if (!this.connected)
            return -1;
        try {
            return await this.redis.ttl(key);
        }
        catch (error) {
            this.logger.error({ error, key }, 'Cache TTL error');
            return -1;
        }
    }
    async invalidatePattern(pattern) {
        if (!this.connected)
            return;
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(keys);
            }
        }
        catch (error) {
            this.logger.error({ error, pattern }, 'Cache invalidate pattern error');
        }
    }
    async flush() {
        if (!this.connected)
            return;
        try {
            await this.redis.flushAll();
        }
        catch (error) {
            this.logger.error({ error }, 'Cache flush error');
        }
    }
    async disconnect() {
        if (this.connected) {
            await this.redis.quit();
            this.connected = false;
        }
    }
    // Helper method for caching function results
    async cacheable(key, fn, options) {
        // Try to get from cache first
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        // Execute function and cache result
        const result = await fn();
        await this.set(key, result, options?.ttl);
        return result;
    }
}
exports.CacheManager = CacheManager;
//# sourceMappingURL=CacheManager.js.map