/**
 * Mock BaseAgent for orchestrator tests
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface AgentConfig {
  name: string;
  description: string;
  version: string;
  cacheTTL?: number;
  retryAttempts?: number;
  timeout?: number;
}

export interface AgentContext {
  requestId: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
}

export abstract class BaseAgent {
  protected config: AgentConfig;

  constructor(config: AgentConfig, _redisUrl?: string) {
    this.config = {
      cacheTTL: 3600,
      retryAttempts: 3,
      timeout: 30000,
      ...config
    };
  }

  abstract getTools(): Tool[];
  abstract handleToolCall(name: string, args: any): Promise<any>;

  protected async getCachedData<T = any>(_key: string): Promise<T | null> {
    return null;
  }

  protected async setCachedData(_key: string, _data: any, _ttl?: number): Promise<void> {
    // Mock implementation
  }

  protected generateCacheKey(...parts: string[]): string {
    return parts.join(':');
  }

  async initialize(): Promise<void> {
    // Mock implementation
  }

  async shutdown(): Promise<void> {
    // Mock implementation
  }
}

export default BaseAgent;
