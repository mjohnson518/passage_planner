import { Logger } from 'pino'
import type { RedisClientType } from 'redis'

import { BaseAgent } from './BaseAgent'
import { getMockAgents } from './agentMocks'

export interface AgentCapabilitySummary {
  agentId: string
  name: string
  description: string
  version: string
  status: 'active' | 'idle' | 'error'
  tools: { name: string; description: string }[]
}

export class AgentRegistry {
  private readonly agents = new Map<string, BaseAgent>()
  private capabilities: AgentCapabilitySummary[] = []

  constructor(private logger: Logger, private redis?: RedisClientType | null) {
    this.registerDefaults()
  }

  private async persistCapability(summary: AgentCapabilitySummary) {
    this.capabilities = this.capabilities.filter((c) => c.agentId !== summary.agentId)
    this.capabilities.push(summary)

    if (this.redis && (this.redis as any).isOpen) {
      await this.redis.set(`agent:capabilities:${summary.agentId}`, JSON.stringify(summary))
    }
  }

  private registerDefaults() {
    for (const agent of getMockAgents()) {
      this.agents.set(agent.id, agent)
      this.capabilities.push(agent.summary)
    }
  }

  async registerAgentInstance(agent: BaseAgent): Promise<void> {
    this.agents.set(agent.id, agent)
    await this.persistCapability(agent.summary)
    await agent.register()
    this.logger.info({ agentId: agent.id }, 'Agent instance registered')
  }

  async execute(agentId: string, tool: string, args: any): Promise<any> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Unknown agent: ${agentId}`)
    }
    this.logger.debug({ agentId, tool }, 'Executing agent tool')
    return agent.execute(tool, args)
  }

  async registerAgent(summary: AgentCapabilitySummary): Promise<void> {
    await this.persistCapability(summary)
    this.logger.info({ agentId: summary.agentId }, 'Agent registered')
  }

  async getHealthyAgentCount(): Promise<number> {
    return this.capabilities.length
  }

  getCapabilities(): AgentCapabilitySummary[] {
    return this.capabilities
  }
}