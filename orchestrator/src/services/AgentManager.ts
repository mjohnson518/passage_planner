import { EventEmitter } from 'events'
import { Logger } from 'pino'

export class AgentManager extends EventEmitter {
  constructor(private logger: Logger) {
    super()
  }

  async getHealthSummary() {
    return {
      timestamp: new Date(),
      total: 6,
      healthy: 6,
      unhealthy: 0,
      starting: 0,
      maintenance: 0,
      agents: [],
    }
  }

  async getAgentStatus(agentId: string) {
    return {
      id: agentId,
      status: 'active',
      uptime: 1000,
      restartCount: 0,
      lastHealthCheck: new Date(),
      metrics: {},
    }
  }

  async restartAgent(agentId: string) {
    this.logger.info({ agentId }, 'Restart requested (noop)')
  }
}