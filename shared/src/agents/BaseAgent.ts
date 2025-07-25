import { Server } from '@modelcontextprotocol/sdk/server/index'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio'
import { Logger } from 'pino'
import { EventEmitter } from 'events'

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  lastCheck: Date
  uptime: number
  memoryUsage: NodeJS.MemoryUsage
  errors: number
  requestsHandled: number
  averageResponseTime: number
  details?: any
}

export interface AgentConfig {
  name: string
  version: string
  description: string
  healthCheckInterval?: number // milliseconds
  maxErrors?: number
  maxMemoryUsage?: number // bytes
}

export abstract class BaseAgent extends EventEmitter {
  protected server: Server
  protected logger: Logger
  protected config: AgentConfig
  protected startTime: Date
  protected errorCount: number = 0
  protected requestCount: number = 0
  protected totalResponseTime: number = 0
  protected healthCheckInterval?: NodeJS.Timeout
  protected isShuttingDown: boolean = false

  constructor(config: AgentConfig, logger: Logger) {
    super()
    this.config = config
    this.logger = logger
    this.startTime = new Date()
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {},
      }
    )

    // Set up error tracking
    this.server.onerror = (error) => {
      this.errorCount++
      this.logger.error({ error, agent: this.config.name }, 'Agent error')
      this.emit('error', error)
    }

    // Start health checks if configured
    if (config.healthCheckInterval) {
      this.startHealthChecks()
    }
  }

  /**
   * Start the agent with stdio transport
   */
  async start() {
    try {
      const transport = new StdioServerTransport()
      await this.server.connect(transport)
      this.logger.info(`${this.config.name} agent started successfully`)
      
      // Set up graceful shutdown
      process.on('SIGINT', () => this.shutdown())
      process.on('SIGTERM', () => this.shutdown())
    } catch (error) {
      this.logger.error({ error }, 'Failed to start agent')
      throw error
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    const uptime = Date.now() - this.startTime.getTime()
    const memoryUsage = process.memoryUsage()
    const averageResponseTime = this.requestCount > 0 
      ? this.totalResponseTime / this.requestCount 
      : 0

    // Determine overall status
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
    
    // Check error rate
    if (this.config.maxErrors && this.errorCount > this.config.maxErrors) {
      status = 'unhealthy'
    }
    
    // Check memory usage
    if (this.config.maxMemoryUsage && memoryUsage.heapUsed > this.config.maxMemoryUsage) {
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded'
    }
    
    // Check if agent is responsive
    if (this.isShuttingDown) {
      status = 'unhealthy'
    }

    return {
      status,
      lastCheck: new Date(),
      uptime,
      memoryUsage,
      errors: this.errorCount,
      requestsHandled: this.requestCount,
      averageResponseTime,
      details: this.getAgentSpecificHealth(),
    }
  }

  /**
   * Override this method to provide agent-specific health details
   */
  protected abstract getAgentSpecificHealth(): any

  /**
   * Start periodic health checks
   */
  private startHealthChecks() {
    this.healthCheckInterval = setInterval(() => {
      const health = this.getHealthStatus()
      this.emit('health', health)
      
      if (health.status === 'unhealthy') {
        this.logger.error({ health }, 'Agent is unhealthy')
      } else if (health.status === 'degraded') {
        this.logger.warn({ health }, 'Agent is degraded')
      }
    }, this.config.healthCheckInterval!)
  }

  /**
   * Track request metrics
   */
  protected trackRequest(startTime: number) {
    this.requestCount++
    const responseTime = Date.now() - startTime
    this.totalResponseTime += responseTime
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return
    
    this.isShuttingDown = true
    this.logger.info('Shutting down agent...')
    
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    
    // Close server
    await this.server.close()
    
    // Emit shutdown event
    this.emit('shutdown')
    
    process.exit(0)
  }

  /**
   * Reset error count (useful after recovery)
   */
  resetErrors() {
    this.errorCount = 0
  }
} 