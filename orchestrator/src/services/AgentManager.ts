import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { Logger } from 'pino'
import WebSocket from 'ws'
import path from 'path'
import fs from 'fs/promises'

interface AgentConfig {
  name: string
  path: string
  command: string
  args?: string[]
  env?: Record<string, string>
  healthCheckUrl?: string
  healthCheckInterval?: number
  maxRestarts?: number
  restartDelay?: number
}

interface AgentInstance {
  config: AgentConfig
  process?: ChildProcess
  status: 'stopped' | 'starting' | 'running' | 'crashed' | 'stopping'
  restartCount: number
  lastStartTime?: Date
  lastHealthCheck?: Date
  healthStatus?: any
  ws?: WebSocket
}

export class AgentManager extends EventEmitter {
  private agents: Map<string, AgentInstance> = new Map()
  private logger: Logger
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map()
  private isShuttingDown = false

  constructor(logger: Logger) {
    super()
    this.logger = logger.child({ component: 'AgentManager' })
    
    // Handle process signals
    process.on('SIGINT', () => this.shutdown())
    process.on('SIGTERM', () => this.shutdown())
  }

  /**
   * Register an agent for management
   */
  async registerAgent(config: AgentConfig) {
    if (this.agents.has(config.name)) {
      throw new Error(`Agent ${config.name} is already registered`)
    }

    const agent: AgentInstance = {
      config,
      status: 'stopped',
      restartCount: 0,
    }

    this.agents.set(config.name, agent)
    this.logger.info({ agent: config.name }, 'Agent registered')
  }

  /**
   * Start an agent
   */
  async startAgent(name: string): Promise<void> {
    const agent = this.agents.get(name)
    if (!agent) {
      throw new Error(`Agent ${name} not found`)
    }

    if (agent.status === 'running' || agent.status === 'starting') {
      this.logger.warn({ agent: name }, 'Agent is already running or starting')
      return
    }

    agent.status = 'starting'
    agent.lastStartTime = new Date()

    try {
      // Spawn the agent process
      const agentPath = path.resolve(agent.config.path)
      const args = agent.config.args || []
      
      this.logger.info({ agent: name, path: agentPath }, 'Starting agent process')
      
      agent.process = spawn(agent.config.command, [...args, agentPath], {
        env: {
          ...process.env,
          ...agent.config.env,
          NODE_ENV: process.env.NODE_ENV || 'production',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      // Handle process output
      agent.process.stdout?.on('data', (data) => {
        this.logger.debug({ agent: name, output: data.toString() }, 'Agent stdout')
      })

      agent.process.stderr?.on('data', (data) => {
        this.logger.error({ agent: name, error: data.toString() }, 'Agent stderr')
      })

      // Handle process exit
      agent.process.on('exit', (code, signal) => {
        this.handleAgentExit(name, code, signal)
      })

      agent.process.on('error', (error) => {
        this.logger.error({ agent: name, error }, 'Agent process error')
        agent.status = 'crashed'
      })

      // Wait a bit for the process to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (agent.process && !agent.process.killed) {
        agent.status = 'running'
        this.logger.info({ agent: name, pid: agent.process.pid }, 'Agent started successfully')
        
        // Start health checks if configured
        if (agent.config.healthCheckInterval) {
          this.startHealthChecks(name)
        }

        // Set up WebSocket connection for real-time communication
        if (agent.config.healthCheckUrl) {
          this.connectWebSocket(name)
        }

        this.emit('agent:started', { name, pid: agent.process.pid })
      } else {
        throw new Error('Agent process died immediately after starting')
      }
    } catch (error) {
      agent.status = 'crashed'
      this.logger.error({ agent: name, error }, 'Failed to start agent')
      throw error
    }
  }

  /**
   * Stop an agent
   */
  async stopAgent(name: string, force = false): Promise<void> {
    const agent = this.agents.get(name)
    if (!agent || !agent.process) {
      return
    }

    agent.status = 'stopping'
    this.stopHealthChecks(name)

    // Close WebSocket
    if (agent.ws) {
      agent.ws.close()
      agent.ws = undefined
    }

    // Try graceful shutdown first
    if (!force) {
      agent.process.kill('SIGTERM')
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (agent.process && !agent.process.killed) {
            this.logger.warn({ agent: name }, 'Agent did not stop gracefully, forcing')
            agent.process.kill('SIGKILL')
          }
          resolve()
        }, 10000) // 10 second grace period

        agent.process!.once('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      })
    } else {
      agent.process.kill('SIGKILL')
    }

    agent.status = 'stopped'
    agent.process = undefined
    this.logger.info({ agent: name }, 'Agent stopped')
    this.emit('agent:stopped', { name })
  }

  /**
   * Restart an agent
   */
  async restartAgent(name: string): Promise<void> {
    await this.stopAgent(name)
    await new Promise(resolve => setTimeout(resolve, 1000)) // Brief pause
    await this.startAgent(name)
  }

  /**
   * Handle agent process exit
   */
  private async handleAgentExit(name: string, code: number | null, signal: string | null) {
    const agent = this.agents.get(name)
    if (!agent) return

    this.stopHealthChecks(name)
    
    if (agent.ws) {
      agent.ws.close()
      agent.ws = undefined
    }

    if (this.isShuttingDown || agent.status === 'stopping') {
      agent.status = 'stopped'
      return
    }

    agent.status = 'crashed'
    this.logger.error(
      { agent: name, code, signal },
      'Agent process exited unexpectedly'
    )

    this.emit('agent:crashed', { name, code, signal })

    // Auto-restart if configured
    const maxRestarts = agent.config.maxRestarts || 3
    const restartDelay = agent.config.restartDelay || 5000

    if (agent.restartCount < maxRestarts) {
      agent.restartCount++
      this.logger.info(
        { agent: name, attempt: agent.restartCount, maxRestarts },
        'Attempting to restart agent'
      )

      setTimeout(() => {
        if (!this.isShuttingDown) {
          this.startAgent(name).catch((error) => {
            this.logger.error({ agent: name, error }, 'Failed to restart agent')
          })
        }
      }, restartDelay)
    } else {
      this.logger.error(
        { agent: name, restartCount: agent.restartCount },
        'Agent exceeded maximum restart attempts'
      )
      this.emit('agent:failed', { name })
    }
  }

  /**
   * Start health checks for an agent
   */
  private startHealthChecks(name: string) {
    const agent = this.agents.get(name)
    if (!agent || !agent.config.healthCheckInterval) return

    const interval = setInterval(async () => {
      try {
        const health = await this.checkAgentHealth(name)
        agent.lastHealthCheck = new Date()
        agent.healthStatus = health

        if (health.status === 'unhealthy') {
          this.logger.warn({ agent: name, health }, 'Agent is unhealthy')
          this.emit('agent:unhealthy', { name, health })
          
          // Restart if critically unhealthy
          if (health.critical) {
            this.logger.error({ agent: name }, 'Agent is critically unhealthy, restarting')
            await this.restartAgent(name)
          }
        }
      } catch (error) {
        this.logger.error({ agent: name, error }, 'Health check failed')
      }
    }, agent.config.healthCheckInterval)

    this.healthCheckIntervals.set(name, interval)
  }

  /**
   * Stop health checks for an agent
   */
  private stopHealthChecks(name: string) {
    const interval = this.healthCheckIntervals.get(name)
    if (interval) {
      clearInterval(interval)
      this.healthCheckIntervals.delete(name)
    }
  }

  /**
   * Check agent health
   */
  private async checkAgentHealth(name: string): Promise<any> {
    const agent = this.agents.get(name)
    if (!agent || !agent.config.healthCheckUrl) {
      return { status: 'unknown' }
    }

    try {
      const response = await fetch(agent.config.healthCheckUrl)
      if (!response.ok) {
        return { status: 'unhealthy', error: `HTTP ${response.status}` }
      }
      return await response.json()
    } catch (error) {
      return { status: 'unhealthy', error: error.message, critical: true }
    }
  }

  /**
   * Connect WebSocket for real-time agent communication
   */
  private connectWebSocket(name: string) {
    const agent = this.agents.get(name)
    if (!agent || !agent.config.healthCheckUrl) return

    try {
      const wsUrl = agent.config.healthCheckUrl.replace('http', 'ws')
      agent.ws = new WebSocket(wsUrl)

      agent.ws.on('open', () => {
        this.logger.info({ agent: name }, 'WebSocket connected')
      })

      agent.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          this.emit('agent:message', { name, message })
        } catch (error) {
          this.logger.error({ agent: name, error }, 'Failed to parse WebSocket message')
        }
      })

      agent.ws.on('error', (error) => {
        this.logger.error({ agent: name, error }, 'WebSocket error')
      })

      agent.ws.on('close', () => {
        this.logger.info({ agent: name }, 'WebSocket disconnected')
      })
    } catch (error) {
      this.logger.error({ agent: name, error }, 'Failed to connect WebSocket')
    }
  }

  /**
   * Get status of all agents
   */
  getAgentsStatus(): Record<string, any> {
    const status: Record<string, any> = {}
    
    for (const [name, agent] of this.agents) {
      status[name] = {
        status: agent.status,
        restartCount: agent.restartCount,
        lastStartTime: agent.lastStartTime,
        lastHealthCheck: agent.lastHealthCheck,
        healthStatus: agent.healthStatus,
        pid: agent.process?.pid,
      }
    }
    
    return status
  }

  /**
   * Start all registered agents
   */
  async startAll(): Promise<void> {
    const promises = Array.from(this.agents.keys()).map(name => 
      this.startAgent(name).catch(error => {
        this.logger.error({ agent: name, error }, 'Failed to start agent')
      })
    )
    
    await Promise.all(promises)
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return
    
    this.isShuttingDown = true
    this.logger.info('Shutting down agent manager...')
    
    // Stop all health checks
    for (const name of this.healthCheckIntervals.keys()) {
      this.stopHealthChecks(name)
    }
    
    // Stop all agents
    const promises = Array.from(this.agents.keys()).map(name => 
      this.stopAgent(name, false).catch(error => {
        this.logger.error({ agent: name, error }, 'Error stopping agent')
      })
    )
    
    await Promise.all(promises)
    
    this.emit('shutdown')
  }
} 