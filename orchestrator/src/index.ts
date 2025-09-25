// orchestrator/src/index.ts
// Complete Orchestrator Implementation

import { EventEmitter } from 'events'
import { Pool } from 'pg'
import { RedisClientType, createClient } from 'redis'
import pino from 'pino'

import { AgentCapabilitySummary, AgentRegistry } from './services/AgentRegistry'
import { RequestRouter, OrchestrationPlan } from './services/RequestRouter'
import { ResponseAggregator } from './services/ResponseAggregator'
import { SessionManager } from './services/SessionManager'
import { MetricsCollector } from './services/MetricsCollector'
import { PassagePlanner } from './services/PassagePlanner'

interface ToolCallRequest {
  tool: string
  arguments: Record<string, unknown>
}

interface PlanningResponse {
  success: boolean
  planId: string
  summary: Record<string, unknown>
}

export class OrchestratorService extends EventEmitter {
  private readonly redis: RedisClientType
  private readonly postgres: Pool
  private readonly logger = pino({ enabled: process.env.NODE_ENV !== 'test' })

  private readonly tools = [
    {
      name: 'plan_passage',
      description: 'Plan a sailing passage using onboard agents',
    },
  ]

  private readonly agentRegistry: AgentRegistry
  private readonly requestRouter: RequestRouter
  private readonly aggregator: ResponseAggregator
  private readonly sessionManager: SessionManager
  private readonly metrics: MetricsCollector
  private readonly planner: PassagePlanner
  
  constructor() {
    super()

    this.redis = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' })
    this.postgres = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres' })

    this.agentRegistry = new AgentRegistry(this.logger, this.redis)
    this.requestRouter = new RequestRouter(this.logger)
    this.aggregator = new ResponseAggregator(this.logger)
    this.sessionManager = new SessionManager(null, this.logger)
    this.metrics = new MetricsCollector(this.logger)
    this.planner = new PassagePlanner({
      agentRegistry: this.agentRegistry,
      aggregator: this.aggregator,
      persistence: {
        savePassagePlan: async (plan: Record<string, unknown>) => ({
          id: (plan.requestId as string) ?? `plan-${Date.now()}`
        })
      },
      metrics: this.metrics,
      emitter: this,
      logger: this.logger
    })

    this.setupHandlers()
  }

  private setupHandlers() {
    this.on('agent:register', async (summary: AgentCapabilitySummary) => {
      await this.agentRegistry.registerAgent(summary)
      this.logger.debug({ agentId: summary.agentId }, 'agent registered')
    })
  }

  private generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  async handleRequest(request: ToolCallRequest): Promise<{ success: boolean; result: PlanningResponse }> {
    if (request.tool !== 'plan_passage') {
      throw new Error(`Unsupported tool ${request.tool}`)
    }

    const requestId = this.generateRequestId()
    const userId = (request.arguments.userId as string) ?? 'anonymous-user'

    const plan: OrchestrationPlan = await this.requestRouter.createPlan({
      requestId,
      userId,
      departure: request.arguments.departure,
      destination: request.arguments.destination
    })

    const sessionId = await this.sessionManager.createSession({
      requestId,
      userId,
      createdAt: new Date().toISOString()
    })

    try {
      const result = await this.planner.run(plan, request.arguments)
      await this.sessionManager.endSession(sessionId)
      return { success: true, result }
    } catch (error) {
      await this.sessionManager.endSession(sessionId)
      throw error
    }
  }

  async listTools() {
    return this.tools
  }

  getAgentCapabilities() {
    return this.agentRegistry.getCapabilities()
  }

  async start() {
    await this.redis.connect()
    await this.postgres.connect()
    this.logger.info('Orchestrator started')
  }

  async shutdown() {
    await this.redis.quit()
    await this.postgres.end()
    this.logger.info('Orchestrator stopped')
  }
}

export class HttpServer {
  constructor(_orchestrator: OrchestratorService) {
    throw new Error('HttpServer is not implemented in Phase 1')
  }
} 