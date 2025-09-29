import type { RedisClientType } from 'redis'
import type pino from 'pino'

export interface AgentContext {
  requestId: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

export interface AgentCapabilitySummary {
  agentId: string
  name: string
  description: string
  version: string
  status: 'active' | 'idle' | 'error'
  tools: { name: string; description: string }[]
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

  async register(capabilityStore?: (summary: AgentCapabilitySummary) => Promise<void>): Promise<void> {
    if (capabilityStore) {
      await capabilityStore(this.capability)
    } else if (this.redis && (this.redis as any).isOpen) {
      await this.redis.hSet(
        'agent:capabilities',
        this.capability.agentId,
        JSON.stringify(this.capability)
      )
    }
    this.logger?.debug({ agentId: this.capability.agentId }, 'agent registered')
  }

  abstract getTools(): { name: string; description: string }[]

  abstract execute(tool: string, args: any, context?: AgentContext): Promise<any>
}

