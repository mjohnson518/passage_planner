// orchestrator/src/services/AgentDiscovery.ts
// Agent Discovery Service - Dynamically discovers and registers agent capabilities

import { EventEmitter } from 'events';
import axios from 'axios';
import pino, { Logger } from 'pino';
import { AgentCapabilitySummary, ToolDefinition } from '@passage-planner/shared/types/core';
import { AgentRegistry } from './AgentRegistry';

export interface AgentEndpoint {
  agentId: string;
  url: string;
  healthCheckInterval?: number;
}

export class AgentDiscovery extends EventEmitter {
  private logger: Logger;
  private agentRegistry: AgentRegistry;
  private discoveryIntervals = new Map<string, NodeJS.Timer>();
  private healthCheckIntervals = new Map<string, NodeJS.Timer>();
  
  constructor(agentRegistry: AgentRegistry, logger: Logger) {
    super();
    this.agentRegistry = agentRegistry;
    this.logger = logger.child({ service: 'AgentDiscovery' });
  }
  
  /**
   * Start discovering agents from various sources
   */
  async startDiscovery() {
    this.logger.info('Starting agent discovery');
    
    // 1. Environment variable based discovery
    await this.discoverFromEnvironment();
    
    // 2. Kubernetes service discovery (if in K8s)
    if (process.env.KUBERNETES_SERVICE_HOST) {
      await this.discoverFromKubernetes();
    }
    
    // 3. Static configuration discovery
    await this.discoverFromConfig();
    
    // 4. mDNS/Bonjour discovery for local development
    if (process.env.NODE_ENV === 'development') {
      await this.discoverFromMDNS();
    }
  }
  
  /**
   * Discover agents from environment variables
   */
  private async discoverFromEnvironment() {
    const agentUrls = process.env.AGENT_URLS?.split(',') || [];
    
    for (const url of agentUrls) {
      const [agentId, endpoint] = url.split('=');
      if (agentId && endpoint) {
        await this.registerAgent({ agentId, url: endpoint });
      }
    }
  }
  
  /**
   * Discover agents from Kubernetes services
   */
  private async discoverFromKubernetes() {
    try {
      // In a real implementation, this would use the K8s API
      // to discover services with specific labels
      this.logger.info('Kubernetes discovery not implemented yet');
    } catch (error) {
      this.logger.error({ error }, 'Kubernetes discovery failed');
    }
  }
  
  /**
   * Discover agents from static configuration
   */
  private async discoverFromConfig() {
    const staticAgents: AgentEndpoint[] = [
      { agentId: 'weather-agent', url: 'http://localhost:8101' },
      { agentId: 'tidal-agent', url: 'http://localhost:8102' },
      { agentId: 'port-agent', url: 'http://localhost:8103' },
      { agentId: 'safety-agent', url: 'http://localhost:8104' },
      { agentId: 'route-agent', url: 'http://localhost:8105' },
      { agentId: 'wind-agent', url: 'http://localhost:8106' },
      { agentId: 'factory-agent', url: 'http://localhost:8107' },
    ];
    
    for (const agent of staticAgents) {
      await this.registerAgent(agent);
    }
  }
  
  /**
   * Discover agents using mDNS/Bonjour
   */
  private async discoverFromMDNS() {
    // This would use a library like 'bonjour' or 'mdns'
    // to discover services on the local network
    this.logger.info('mDNS discovery not implemented yet');
  }
  
  /**
   * Register a discovered agent
   */
  async registerAgent(endpoint: AgentEndpoint) {
    try {
      this.logger.info({ agentId: endpoint.agentId, url: endpoint.url }, 'Registering agent');
      
      // Try to get agent capabilities
      const capabilities = await this.fetchAgentCapabilities(endpoint);
      
      if (capabilities) {
        await this.agentRegistry.registerAgent(capabilities);
        this.emit('agent:discovered', capabilities);
        
        // Start health monitoring
        this.startHealthCheck(endpoint, capabilities);
        
        // Watch for capability changes
        this.watchCapabilityChanges(endpoint);
      }
    } catch (error) {
      this.logger.error({ error, agentId: endpoint.agentId }, 'Failed to register agent');
    }
  }
  
  /**
   * Fetch agent capabilities via HTTP
   */
  private async fetchAgentCapabilities(endpoint: AgentEndpoint): Promise<AgentCapabilitySummary | null> {
    try {
      // Try MCP-style capability endpoint first
      const response = await axios.get(`${endpoint.url}/mcp/capabilities`, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      
      if (response.status === 200) {
        return this.transformMCPCapabilities(endpoint.agentId, endpoint.url, response.data);
      }
      
      // Fallback to custom capability endpoint
      const fallbackResponse = await axios.get(`${endpoint.url}/capabilities`, {
        timeout: 5000
      });
      
      return this.transformCustomCapabilities(endpoint.agentId, endpoint.url, fallbackResponse.data);
      
    } catch (error) {
      this.logger.warn({ error, agentId: endpoint.agentId }, 'Failed to fetch capabilities');
      
      // Return basic capabilities if agent is reachable
      try {
        await axios.get(`${endpoint.url}/health`, { timeout: 2000 });
        return this.createBasicCapabilities(endpoint.agentId, endpoint.url);
      } catch {
        return null;
      }
    }
  }
  
  /**
   * Transform MCP-style capabilities to our format
   */
  private transformMCPCapabilities(agentId: string, url: string, mcpData: any): AgentCapabilitySummary {
    return {
      agentId,
      name: mcpData.name || agentId,
      description: mcpData.description || `${agentId} service`,
      version: mcpData.version || '1.0.0',
      status: 'active',
      tools: mcpData.tools || [],
      resources: mcpData.resources || [],
      prompts: mcpData.prompts || [],
      lastUpdated: new Date(),
      healthEndpoint: `${url}/health`,
      performance: {
        averageResponseTime: 0,
        successRate: 100
      }
    };
  }
  
  /**
   * Transform custom capabilities to our format
   */
  private transformCustomCapabilities(agentId: string, url: string, customData: any): AgentCapabilitySummary {
    const tools: ToolDefinition[] = [];
    
    // Convert custom tool format
    if (customData.capabilities) {
      for (const cap of customData.capabilities) {
        tools.push({
          name: cap.name || cap,
          description: cap.description || `${cap} operation`,
          inputSchema: cap.schema || {},
          outputSchema: {},
          examples: []
        } as any);
      }
    }
    
    return {
      agentId,
      name: customData.name || agentId,
      description: customData.description || `${agentId} service`,
      version: customData.version || '1.0.0',
      status: 'active',
      tools,
      resources: [],
      prompts: [],
      lastUpdated: new Date(),
      healthEndpoint: `${url}/health`,
      performance: {
        averageResponseTime: 0,
        successRate: 100
      }
    };
  }
  
  /**
   * Create basic capabilities for agents without capability endpoints
   */
  private createBasicCapabilities(agentId: string, url: string): AgentCapabilitySummary {
    // Map of known agent capabilities
    const knownCapabilities: Record<string, string[]> = {
      'weather-agent': ['get_current_weather', 'get_marine_forecast', 'get_storm_warnings'],
      'tidal-agent': ['get_tide_predictions', 'get_current_predictions', 'get_water_levels'],
      'port-agent': ['get_port_info', 'get_marina_facilities', 'search_ports'],
      'safety-agent': ['get_safety_warnings', 'get_emergency_contacts', 'check_equipment'],
      'route-agent': ['calculate_route', 'optimize_waypoints', 'get_distance'],
      'wind-agent': ['get_wind_forecast', 'get_wave_conditions', 'get_gust_analysis'],
      'factory-agent': ['create_agent', 'list_templates', 'deploy_agent']
    };
    
    const capabilities = knownCapabilities[agentId] || [];
    const tools: ToolDefinition[] = capabilities.map(cap => ({
      name: cap,
      description: `${cap} operation`,
      inputSchema: {} as any,
      outputSchema: {} as any
    }));
    
    return {
      agentId,
      name: agentId.replace('-agent', ' Agent').replace(/\b\w/g, l => l.toUpperCase()),
      description: `${agentId} service`,
      version: '1.0.0',
      status: 'active',
      tools,
      resources: [],
      prompts: [],
      lastUpdated: new Date(),
      healthEndpoint: `${url}/health`,
      performance: {
        averageResponseTime: 0,
        successRate: 100
      }
    };
  }
  
  /**
   * Start health checking for an agent
   */
  private startHealthCheck(endpoint: AgentEndpoint, capabilities: AgentCapabilitySummary) {
    const interval = endpoint.healthCheckInterval || 30000; // 30 seconds default
    
    const healthCheck = setInterval(async () => {
      try {
        const response = await axios.get(capabilities.healthEndpoint, {
          timeout: 5000
        });
        
        if (response.status === 200) {
          await this.agentRegistry.updateAgentStatus(endpoint.agentId, 'active');
          this.emit('agent:healthy', { agentId: endpoint.agentId });
        }
      } catch (error) {
        this.logger.warn({ agentId: endpoint.agentId, error }, 'Health check failed');
        await this.agentRegistry.updateAgentStatus(endpoint.agentId, 'error');
        this.emit('agent:unhealthy', { agentId: endpoint.agentId, error });
      }
    }, interval);
    
    this.healthCheckIntervals.set(endpoint.agentId, healthCheck);
  }
  
  /**
   * Watch for capability changes
   */
  private watchCapabilityChanges(endpoint: AgentEndpoint) {
    // Poll for capability changes every 5 minutes
    const interval = setInterval(async () => {
      const newCapabilities = await this.fetchAgentCapabilities(endpoint);
      if (newCapabilities) {
        const existing = await this.agentRegistry.getAgent(endpoint.agentId);
        
        // Check if capabilities have changed
        if (existing && this.hasCapabilitiesChanged(existing, newCapabilities)) {
          this.logger.info({ agentId: endpoint.agentId }, 'Agent capabilities changed');
          await this.agentRegistry.registerAgent(newCapabilities);
          this.emit('agent:updated', newCapabilities);
        }
      }
    }, 300000); // 5 minutes
    
    this.discoveryIntervals.set(endpoint.agentId, interval);
  }
  
  /**
   * Check if capabilities have changed
   */
  private hasCapabilitiesChanged(existing: AgentCapabilitySummary, newCaps: AgentCapabilitySummary): boolean {
    // Simple comparison - in production, this would be more sophisticated
    return JSON.stringify(existing.tools) !== JSON.stringify(newCaps.tools) ||
           existing.version !== newCaps.version;
  }
  
  /**
   * Stop all discovery and health checks
   */
  async stop() {
    this.logger.info('Stopping agent discovery');
    
    // Clear all intervals
    for (const interval of this.discoveryIntervals.values()) {
      clearInterval(interval);
    }
    
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    
    this.discoveryIntervals.clear();
    this.healthCheckIntervals.clear();
  }
} 