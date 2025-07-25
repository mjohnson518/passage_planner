import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { ChildProcess, spawn } from 'child_process';
import { AgentCapabilitySummary, AgentStatus } from '../../shared/src/types/core';
import { createClient, RedisClientType } from 'redis';

interface AgentProcess {
  id: string;
  process: ChildProcess;
  config: AgentConfig;
  status: AgentStatus;
  lastHealthCheck: Date;
  restartCount: number;
  startTime: Date;
}

interface AgentConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  maxRestarts: number;
  restartDelay: number;
}

interface HealthCheckResult {
  agentId: string;
  status: 'healthy' | 'unhealthy' | 'timeout';
  responseTime?: number;
  error?: string;
  metrics?: {
    cpu: number;
    memory: number;
    requestsProcessed: number;
    averageResponseTime: number;
  };
}

export class AgentManager extends EventEmitter {
  private agents: Map<string, AgentProcess> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private redis: RedisClientType;
  private logger: Logger;
  private isShuttingDown = false;

  constructor(redis: RedisClientType, logger: Logger) {
    super();
    this.redis = redis;
    this.logger = logger.child({ component: 'AgentManager' });
  }

  async initialize(agentConfigs: AgentConfig[]) {
    this.logger.info(`Initializing ${agentConfigs.length} agents`);
    
    for (const config of agentConfigs) {
      await this.startAgent(config);
    }

    // Start monitoring
    this.startGlobalHealthMonitoring();
  }

  private async startAgent(config: AgentConfig): Promise<void> {
    try {
      this.logger.info({ agentId: config.id }, 'Starting agent');

      const env = {
        ...process.env,
        ...config.env,
        AGENT_ID: config.id,
        ORCHESTRATOR_URL: process.env.ORCHESTRATOR_URL || 'http://localhost:8080',
      };

      const agentProcess = spawn(config.command, config.args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });

      const agent: AgentProcess = {
        id: config.id,
        process: agentProcess,
        config,
        status: 'starting',
        lastHealthCheck: new Date(),
        restartCount: 0,
        startTime: new Date(),
      };

      this.agents.set(config.id, agent);

      // Handle process events
      agentProcess.on('error', (error) => {
        this.logger.error({ agentId: config.id, error }, 'Agent process error');
        this.handleAgentFailure(config.id);
      });

      agentProcess.on('exit', (code, signal) => {
        this.logger.warn({ agentId: config.id, code, signal }, 'Agent process exited');
        if (!this.isShuttingDown) {
          this.handleAgentFailure(config.id);
        }
      });

      // Handle stdout/stderr
      agentProcess.stdout?.on('data', (data) => {
        this.logger.debug({ agentId: config.id, output: data.toString() }, 'Agent stdout');
      });

      agentProcess.stderr?.on('data', (data) => {
        this.logger.error({ agentId: config.id, error: data.toString() }, 'Agent stderr');
      });

      // Handle IPC messages
      agentProcess.on('message', (message: any) => {
        this.handleAgentMessage(config.id, message);
      });

      // Start health monitoring for this agent
      this.startHealthMonitoring(config.id);

      // Wait for agent to be ready
      await this.waitForAgentReady(config.id, 30000);

      this.logger.info({ agentId: config.id }, 'Agent started successfully');
      this.emit('agent:started', config.id);

    } catch (error) {
      this.logger.error({ agentId: config.id, error }, 'Failed to start agent');
      throw error;
    }
  }

  private async waitForAgentReady(agentId: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const health = await this.checkAgentHealth(agentId);
      
      if (health.status === 'healthy') {
        const agent = this.agents.get(agentId);
        if (agent) {
          agent.status = 'active';
        }
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Agent ${agentId} failed to become ready within ${timeout}ms`);
  }

  private startHealthMonitoring(agentId: string) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const interval = setInterval(async () => {
      const health = await this.checkAgentHealth(agentId);
      
      if (health.status !== 'healthy') {
        this.logger.warn({ agentId, health }, 'Agent health check failed');
        
        const currentAgent = this.agents.get(agentId);
        if (currentAgent) {
          currentAgent.status = 'error';
        }
        
        // Trigger recovery
        this.handleAgentFailure(agentId);
      } else {
        // Update metrics
        if (health.metrics) {
          await this.updateAgentMetrics(agentId, health.metrics);
        }
        
        const currentAgent = this.agents.get(agentId);
        if (currentAgent) {
          currentAgent.lastHealthCheck = new Date();
          if (currentAgent.status !== 'active') {
            currentAgent.status = 'active';
            this.emit('agent:recovered', agentId);
          }
        }
      }
    }, agent.config.healthCheckInterval);

    this.healthCheckIntervals.set(agentId, interval);
  }

  private async checkAgentHealth(agentId: string): Promise<HealthCheckResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { agentId, status: 'unhealthy', error: 'Agent not found' };
    }

    try {
      // Send health check via IPC
      const startTime = Date.now();
      
      const healthPromise = new Promise<HealthCheckResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Health check timeout'));
        }, agent.config.healthCheckTimeout);

        const messageHandler = (message: any) => {
          if (message.type === 'health-response') {
            clearTimeout(timeout);
            agent.process.removeListener('message', messageHandler);
            
            resolve({
              agentId,
              status: 'healthy',
              responseTime: Date.now() - startTime,
              metrics: message.metrics,
            });
          }
        };

        agent.process.on('message', messageHandler);
        agent.process.send({ type: 'health-check' });
      });

      return await healthPromise;
    } catch (error) {
      return {
        agentId,
        status: 'timeout',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleAgentFailure(agentId: string) {
    const agent = this.agents.get(agentId);
    if (!agent || this.isShuttingDown) return;

    this.logger.error({ agentId }, 'Handling agent failure');
    
    // Stop health monitoring
    const interval = this.healthCheckIntervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(agentId);
    }

    // Kill the process if still running
    if (!agent.process.killed) {
      agent.process.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!agent.process.killed) {
          agent.process.kill('SIGKILL');
        }
      }, 5000);
    }

    // Check restart count
    if (agent.restartCount >= agent.config.maxRestarts) {
      this.logger.error(
        { agentId, restartCount: agent.restartCount },
        'Agent exceeded max restart attempts'
      );
      agent.status = 'maintenance';
      this.emit('agent:failed', agentId);
      return;
    }

    // Schedule restart
    agent.restartCount++;
    this.logger.info(
      { agentId, restartCount: agent.restartCount, delay: agent.config.restartDelay },
      'Scheduling agent restart'
    );

    setTimeout(async () => {
      try {
        await this.startAgent(agent.config);
        this.emit('agent:restarted', agentId);
      } catch (error) {
        this.logger.error({ agentId, error }, 'Failed to restart agent');
        this.emit('agent:failed', agentId);
      }
    }, agent.config.restartDelay);
  }

  private handleAgentMessage(agentId: string, message: any) {
    switch (message.type) {
      case 'capability-update':
        this.emit('agent:capability-update', agentId, message.capabilities);
        break;
      
      case 'metrics':
        this.updateAgentMetrics(agentId, message.data);
        break;
      
      case 'log':
        this.logger[message.level || 'info']({ agentId, ...message.data }, message.message);
        break;
      
      default:
        this.logger.debug({ agentId, message }, 'Received agent message');
    }
  }

  private async updateAgentMetrics(agentId: string, metrics: any) {
    try {
      await this.redis.hSet(
        `agent:metrics:${agentId}`,
        {
          ...metrics,
          lastUpdated: new Date().toISOString(),
        }
      );
      
      // Set expiry
      await this.redis.expire(`agent:metrics:${agentId}`, 300); // 5 minutes
      
      this.emit('agent:metrics', agentId, metrics);
    } catch (error) {
      this.logger.error({ agentId, error }, 'Failed to update agent metrics');
    }
  }

  private startGlobalHealthMonitoring() {
    // Monitor overall system health every 30 seconds
    setInterval(async () => {
      const summary = await this.getHealthSummary();
      
      this.logger.info(
        {
          totalAgents: summary.total,
          healthyAgents: summary.healthy,
          unhealthyAgents: summary.unhealthy,
        },
        'System health check'
      );
      
      this.emit('system:health', summary);
      
      // Store in Redis for monitoring
      await this.redis.set(
        'system:health',
        JSON.stringify(summary),
        { EX: 60 }
      );
    }, 30000);
  }

  async getHealthSummary() {
    const agents = Array.from(this.agents.values());
    
    return {
      timestamp: new Date(),
      total: agents.length,
      healthy: agents.filter(a => a.status === 'active').length,
      unhealthy: agents.filter(a => a.status === 'error').length,
      starting: agents.filter(a => a.status === 'starting').length,
      maintenance: agents.filter(a => a.status === 'maintenance').length,
      agents: agents.map(a => ({
        id: a.id,
        status: a.status,
        uptime: Date.now() - a.startTime.getTime(),
        restartCount: a.restartCount,
        lastHealthCheck: a.lastHealthCheck,
      })),
    };
  }

  async getAgentStatus(agentId: string): Promise<any> {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    const metrics = await this.redis.hGetAll(`agent:metrics:${agentId}`);
    
    return {
      id: agent.id,
      status: agent.status,
      uptime: Date.now() - agent.startTime.getTime(),
      restartCount: agent.restartCount,
      lastHealthCheck: agent.lastHealthCheck,
      metrics,
    };
  }

  async restartAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    this.logger.info({ agentId }, 'Manual agent restart requested');
    
    // Reset restart count for manual restart
    agent.restartCount = 0;
    
    await this.handleAgentFailure(agentId);
  }

  async shutdown() {
    this.logger.info('Shutting down Agent Manager');
    this.isShuttingDown = true;

    // Stop all health checks
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    // Gracefully shutdown all agents
    const shutdownPromises = Array.from(this.agents.values()).map(async (agent) => {
      try {
        agent.process.send({ type: 'shutdown' });
        
        // Wait for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            agent.process.kill('SIGKILL');
            resolve();
          }, 10000);

          agent.process.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        this.logger.error({ agentId: agent.id, error }, 'Error during agent shutdown');
      }
    });

    await Promise.all(shutdownPromises);
    this.agents.clear();
    
    this.logger.info('Agent Manager shutdown complete');
  }
} 