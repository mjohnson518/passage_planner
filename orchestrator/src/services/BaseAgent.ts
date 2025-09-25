import type { RedisClientType } from 'redis'
import type pino from 'pino'

import type { AgentCapabilitySummary } from './AgentRegistry'

export interface AgentContext {
  requestId: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

export abstract class BaseAgent {
  protected readonly capability: AgentCapabilitySummary

  constructor(
    summary: AgentCapabilitySummary,
    protected readonly logger?: pino.Logger,
    protected readonly redis?: RedisClientType
  ) {
    this.capability = summary
  }

  get id(): string {
    return this.capability.agentId
  }

  get summary(): AgentCapabilitySummary {
    return this.capability
  }

  async register(): Promise<void> {
    if (this.redis) {
      await this.redis.hSet(
        `agent:capabilities`,
        this.capability.agentId,
        JSON.stringify(this.capability)
      )
    }
    this.logger?.debug({ agentId: this.capability.agentId }, 'agent registered')
  }

  abstract getTools(): { name: string; description: string }[]

  abstract execute(tool: string, args: any, context?: AgentContext): Promise<any>
}

