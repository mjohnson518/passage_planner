// orchestrator/src/services/AgentRegistry.ts

import { RedisClientType } from 'redis';
import { Pool } from 'pg';
import { Logger } from 'pino';
import { 
  AgentCapabilitySummary, 
  AgentStatus,
  AgentMetrics 
} from '@passage-planner/shared/types/core';

export class AgentRegistry {
  private redis: RedisClientType;
  private postgres: Pool;
  private logger: Logger;
  private agents = new Map<string, AgentCapabilitySummary>();
  
  constructor(redis: RedisClientType, postgres: Pool, logger: Logger) {
    this.redis = redis;
    this.postgres = postgres;
    this.logger = logger;
  }
  
  async registerAgent(agent: AgentCapabilitySummary): Promise<void> {
    try {
      // Store in memory
      this.agents.set(agent.agentId, agent);
      
      // Store in Redis for distributed access
      await this.redis.set(
        `agent:${agent.agentId}`,
        JSON.stringify(agent),
        { EX: 3600 } // 1 hour TTL
      );
      
      // Store capabilities in PostgreSQL
      await this.postgres.query(
        `INSERT INTO agent_capabilities 
         (agent_id, name, description, version, capabilities, active) 
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (agent_id) 
         DO UPDATE SET 
           name = $2,
           description = $3,
           version = $4,
           capabilities = $5,
           last_updated = CURRENT_TIMESTAMP,
           active = true`,
        [
          agent.agentId,
          agent.name,
          agent.description,
          agent.version,
          JSON.stringify({
            tools: agent.tools,
            resources: agent.resources,
            prompts: agent.prompts
          })
        ]
      );
      
      this.logger.info({ agentId: agent.agentId }, 'Agent registered');
    } catch (error) {
      this.logger.error({ agentId: agent.agentId, error }, 'Failed to register agent');
      throw error;
    }
  }
  
  async getAgent(agentId: string): Promise<AgentCapabilitySummary | null> {
    // Check memory cache first
    if (this.agents.has(agentId)) {
      return this.agents.get(agentId)!;
    }
    
    // Check Redis
    const cached = await this.redis.hGet('agents:registry', agentId);
    if (cached) {
      const agent = JSON.parse(cached) as AgentCapabilitySummary;
      this.agents.set(agentId, agent);
      return agent;
    }
    
    // Check database
    try {
      const result = await this.postgres.query(
        'SELECT * FROM agent_capabilities WHERE agent_id = $1',
        [agentId]
      );
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const capabilities = JSON.parse(row.capabilities);
        const agent: AgentCapabilitySummary = {
          agentId: row.agent_id,
          name: row.name,
          description: row.description,
          version: row.version,
          status: 'idle',
          tools: capabilities.tools || [],
          resources: capabilities.resources || [],
          prompts: capabilities.prompts || [],
          lastUpdated: row.last_updated,
          healthEndpoint: `/agents/${row.agent_id}/health`,
          performance: {
            averageResponseTime: 0,
            successRate: 1,
          },
        };
        
        this.agents.set(agentId, agent);
        await this.redis.hSet('agents:registry', agentId, JSON.stringify(agent));
        return agent;
      }
    } catch (error) {
      this.logger.error({ error, agentId }, 'Failed to retrieve agent');
    }
    
    return null;
  }
  
  async getAgentsByCapability(capability: string): Promise<AgentCapabilitySummary[]> {
    const matchingAgents: AgentCapabilitySummary[] = [];
    
    // Search through all agents
    for (const agent of this.agents.values()) {
      const hasCapability = 
        agent.tools.some(t => t.name === capability) ||
        agent.resources.some(r => r.name === capability) ||
        agent.prompts.some(p => p.name === capability);
      
      if (hasCapability && agent.status === 'active') {
        matchingAgents.push(agent);
      }
    }
    
    // If no agents in memory, query database
    if (matchingAgents.length === 0) {
      try {
        const result = await this.postgres.query(
          `SELECT * FROM agent_capabilities 
           WHERE capabilities::jsonb @> $1`,
          [JSON.stringify({ tools: [{ name: capability }] })]
        );
        
        for (const row of result.rows) {
          const agent = await this.getAgent(row.agent_id);
          if (agent && agent.status === 'active') {
            matchingAgents.push(agent);
          }
        }
      } catch (error) {
        this.logger.error({ error, capability }, 'Failed to search agents by capability');
      }
    }
    
    return matchingAgents;
  }
  
  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    agent.status = status;
    agent.lastUpdated = new Date();
    
    // Update all stores
    this.agents.set(agentId, agent);
    await this.redis.hSet('agents:registry', agentId, JSON.stringify(agent));
    await this.redis.hSet('agents:status', agentId, status);
    
    // Log status change
    await this.postgres.query(
      `INSERT INTO agent_status_log (agent_id, status, timestamp)
       VALUES ($1, $2, $3)`,
      [agentId, status, new Date()]
    );
    
    this.logger.info({ agentId, status }, 'Agent status updated');
  }
  
  async updateAgentHealth(agentId: string, health: any): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      return;
    }
    
    // Update performance metrics
    if (health.responseTime !== undefined) {
      agent.performance.averageResponseTime = 
        (agent.performance.averageResponseTime + health.responseTime) / 2;
    }
    
    if (health.successRate !== undefined) {
      agent.performance.successRate = health.successRate;
    }
    
    if (health.lastError) {
      agent.performance.lastError = health.lastError;
    }
    
    // Update status based on health
    if (health.healthy === false) {
      agent.status = 'error';
    } else if (agent.status === 'error' && health.healthy === true) {
      agent.status = 'active';
    }
    
    this.agents.set(agentId, agent);
    await this.redis.hSet('agents:registry', agentId, JSON.stringify(agent));
  }
  
  async getHealthyAgents(): Promise<AgentCapabilitySummary[]> {
    const healthyAgents: AgentCapabilitySummary[] = [];
    
    for (const agent of this.agents.values()) {
      if (agent.status === 'active' || agent.status === 'idle') {
        healthyAgents.push(agent);
      }
    }
    
    return healthyAgents;
  }
  
  async getHealthyAgentCount(): Promise<number> {
    const healthyAgents = await this.getHealthyAgents();
    return healthyAgents.length;
  }
  
  async getAllAgents(): Promise<AgentCapabilitySummary[]> {
    // If cache is empty, load from Redis
    if (this.agents.size === 0) {
      const allAgents = await this.redis.hGetAll('agents:registry');
      for (const [agentId, data] of Object.entries(allAgents)) {
        this.agents.set(agentId, JSON.parse(data));
      }
    }
    
    return Array.from(this.agents.values());
  }
  
  async getAllAgentStatuses(): Promise<Record<string, AgentMetrics>> {
    const statuses: Record<string, AgentMetrics> = {};
    
    for (const [agentId, agent] of this.agents) {
      // Get metrics from Redis
      const metrics = await this.redis.hGet('agents:metrics', agentId);
      
      if (metrics) {
        statuses[agentId] = JSON.parse(metrics);
      } else {
        statuses[agentId] = {
          status: agent.status,
          requestsProcessed: 0,
          averageResponseTime: agent.performance.averageResponseTime,
          errorRate: agent.performance.successRate ? 1 - agent.performance.successRate : 0,
          lastError: agent.performance.lastError,
          resourceUsage: {
            cpu: 0,
            memory: 0,
          },
        };
      }
    }
    
    return statuses;
  }
  
  async removeAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId);
    await this.redis.hDel('agents:registry', agentId);
    await this.redis.hDel('agents:status', agentId);
    await this.redis.hDel('agents:metrics', agentId);
    
    await this.postgres.query(
      'UPDATE agent_capabilities SET active = false WHERE agent_id = $1',
      [agentId]
    );
    
    this.logger.info({ agentId }, 'Agent removed from registry');
  }
} 