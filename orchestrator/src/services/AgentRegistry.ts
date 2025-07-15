import { RedisClientType } from 'redis';
import { Pool } from 'pg';
import { Logger } from 'pino';
import { AgentCapabilitySummary, AgentStatus } from '@passage-planner/shared';

export class AgentRegistry {
  private static readonly AGENT_KEY_PREFIX = 'agent:';
  private static readonly CAPABILITY_KEY_PREFIX = 'capability:';
  
  constructor(
    private redis: RedisClientType,
    private postgres: Pool,
    private logger: Logger
  ) {}
  
  async registerAgent(summary: AgentCapabilitySummary): Promise<void> {
    try {
      // Store in Redis for fast access
      await this.redis.set(
        `${AgentRegistry.AGENT_KEY_PREFIX}${summary.agentId}`,
        JSON.stringify(summary),
        { EX: 3600 } // 1 hour TTL
      );
      
      // Store capabilities for searching
      for (const tool of summary.tools) {
        await this.redis.sAdd(
          `${AgentRegistry.CAPABILITY_KEY_PREFIX}${tool.name}`,
          summary.agentId
        );
      }
      
      // Persist to PostgreSQL
      await this.postgres.query(
        `INSERT INTO agent_capabilities (
          agent_id, name, description, version, status, tools, resources, prompts, health_endpoint, performance_metrics
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (agent_id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          version = EXCLUDED.version,
          status = EXCLUDED.status,
          tools = EXCLUDED.tools,
          resources = EXCLUDED.resources,
          prompts = EXCLUDED.prompts,
          health_endpoint = EXCLUDED.health_endpoint,
          performance_metrics = EXCLUDED.performance_metrics,
          updated_at = NOW()`,
        [
          summary.agentId,
          summary.name,
          summary.description,
          summary.version,
          summary.status,
          JSON.stringify(summary.tools),
          JSON.stringify(summary.resources),
          JSON.stringify(summary.prompts),
          summary.healthEndpoint,
          JSON.stringify(summary.performance)
        ]
      );
      
      this.logger.info({ agentId: summary.agentId }, 'Agent registered successfully');
    } catch (error) {
      this.logger.error({ error, agentId: summary.agentId }, 'Failed to register agent');
      throw error;
    }
  }
  
  async getAgent(agentId: string): Promise<AgentCapabilitySummary | null> {
    try {
      // Try Redis first
      const cached = await this.redis.get(`${AgentRegistry.AGENT_KEY_PREFIX}${agentId}`);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Fallback to PostgreSQL
      const result = await this.postgres.query(
        'SELECT * FROM agent_capabilities WHERE agent_id = $1',
        [agentId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      const summary: AgentCapabilitySummary = {
        agentId: row.agent_id,
        name: row.name,
        description: row.description,
        version: row.version,
        status: row.status,
        tools: row.tools,
        resources: row.resources,
        prompts: row.prompts,
        lastUpdated: row.updated_at,
        healthEndpoint: row.health_endpoint,
        performance: row.performance_metrics
      };
      
      // Cache for next time
      await this.redis.set(
        `${AgentRegistry.AGENT_KEY_PREFIX}${agentId}`,
        JSON.stringify(summary),
        { EX: 3600 }
      );
      
      return summary;
    } catch (error) {
      this.logger.error({ error, agentId }, 'Failed to get agent');
      return null;
    }
  }
  
  async getAgentsByCapability(capability: string): Promise<AgentCapabilitySummary[]> {
    try {
      const agentIds = await this.redis.sMembers(
        `${AgentRegistry.CAPABILITY_KEY_PREFIX}${capability}`
      );
      
      const agents = await Promise.all(
        agentIds.map(id => this.getAgent(id))
      );
      
      return agents.filter(agent => agent !== null) as AgentCapabilitySummary[];
    } catch (error) {
      this.logger.error({ error, capability }, 'Failed to get agents by capability');
      return [];
    }
  }
  
  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    try {
      await this.postgres.query(
        'UPDATE agent_capabilities SET status = $1, updated_at = NOW() WHERE agent_id = $2',
        [status, agentId]
      );
      
      // Update cache if exists
      const cached = await this.redis.get(`${AgentRegistry.AGENT_KEY_PREFIX}${agentId}`);
      if (cached) {
        const agent = JSON.parse(cached);
        agent.status = status;
        await this.redis.set(
          `${AgentRegistry.AGENT_KEY_PREFIX}${agentId}`,
          JSON.stringify(agent),
          { EX: 3600 }
        );
      }
    } catch (error) {
      this.logger.error({ error, agentId, status }, 'Failed to update agent status');
      throw error;
    }
  }
  
  async getHealthyAgentCount(): Promise<number> {
    try {
      const result = await this.postgres.query(
        "SELECT COUNT(*) FROM agent_capabilities WHERE status = 'active'"
      );
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      this.logger.error({ error }, 'Failed to get healthy agent count');
      return 0;
    }
  }
  
  async getAllAgents(): Promise<AgentCapabilitySummary[]> {
    try {
      const result = await this.postgres.query(
        'SELECT * FROM agent_capabilities ORDER BY name'
      );
      
      return result.rows.map(row => ({
        agentId: row.agent_id,
        name: row.name,
        description: row.description,
        version: row.version,
        status: row.status,
        tools: row.tools,
        resources: row.resources,
        prompts: row.prompts,
        lastUpdated: row.updated_at,
        healthEndpoint: row.health_endpoint,
        performance: row.performance_metrics
      }));
    } catch (error) {
      this.logger.error({ error }, 'Failed to get all agents');
      return [];
    }
  }
  
  async updateAgentHealth(agentId: string, health: any): Promise<void> {
    try {
      await this.postgres.query(
        'UPDATE agent_capabilities SET performance_metrics = $1, last_health_check = NOW() WHERE agent_id = $2',
        [JSON.stringify(health), agentId]
      );
    } catch (error) {
      this.logger.error({ error, agentId }, 'Failed to update agent health');
    }
  }
  
  async getAllAgentStatuses(): Promise<Record<string, any>> {
    try {
      const agents = await this.getAllAgents();
      const statuses: Record<string, any> = {};
      
      for (const agent of agents) {
        statuses[agent.agentId] = {
          status: agent.status,
          lastHealthCheck: agent.lastUpdated,
          performance: agent.performance
        };
      }
      
      return statuses;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get all agent statuses');
      return {};
    }
  }
} 