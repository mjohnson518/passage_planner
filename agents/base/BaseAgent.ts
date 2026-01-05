import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createHash } from 'crypto';
import Redis from 'ioredis';

export interface AgentConfig {
  name: string;
  description: string;
  version: string;
  cacheTTL?: number; // seconds
  retryAttempts?: number;
  timeout?: number; // milliseconds
}

export interface AgentContext {
  requestId: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
}

export abstract class BaseAgent {
  protected redis: Redis;
  protected config: AgentConfig;
  
  constructor(config: AgentConfig, redisUrl: string) {
    this.config = {
      cacheTTL: 3600,
      retryAttempts: 3,
      timeout: 30000,
      ...config
    };
    this.redis = new Redis(redisUrl);
  }

  abstract getTools(): Tool[];
  abstract handleToolCall(name: string, args: any): Promise<any>;
  
  protected async getCachedData<T = any>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  protected async setCachedData(key: string, data: any, ttl?: number): Promise<void> {
    const ttlSeconds = ttl || this.config.cacheTTL;
    await this.redis.setex(key, ttlSeconds!, JSON.stringify(data));
  }

  protected generateCacheKey(...parts: string[]): string {
    const combined = parts.join(':');
    // SECURITY: Use SHA-256 instead of MD5 to prevent cache poisoning via collisions
    const hash = createHash('sha256').update(combined).digest('hex');
    return `${this.config.name}:${hash}`;
  }

  protected async withRetry<T>(
    fn: () => Promise<T>,
    attempts: number = this.config.retryAttempts!
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    
    throw lastError;
  }

  protected async reportHealth(status: 'healthy' | 'degraded' | 'offline', metadata?: any): Promise<void> {
    await this.redis.hset(`agent:health:${this.config.name}`, {
      status,
      lastHeartbeat: new Date().toISOString(),
      metadata: JSON.stringify(metadata || {})
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.reportHealth('healthy');
    } catch (error) {
      // Redis not available - continue in degraded mode for testing
      if (process.env.NODE_ENV !== 'test') {
        throw error;
      }
    }
    console.log(`${this.config.name} agent initialized`);
  }

  async shutdown(): Promise<void> {
    try {
      await this.reportHealth('offline');
      await this.redis.quit();
    } catch (error) {
      // Ignore Redis errors during shutdown
    }
    console.log(`${this.config.name} agent shutdown`);
  }
}

