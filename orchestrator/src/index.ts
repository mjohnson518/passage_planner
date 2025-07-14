// orchestrator/src/index.ts
// Complete Orchestrator Implementation

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode 
} from '@modelcontextprotocol/sdk/types.js';
import { createClient, RedisClientType } from 'redis';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import pino from 'pino';
import { AgentRegistry } from './services/AgentRegistry';
import { RequestRouter } from './services/RequestRouter';
import { ResponseAggregator } from './services/ResponseAggregator';
import { SessionManager } from './services/SessionManager';
import { MetricsCollector } from './services/MetricsCollector';
import { 
  AgentCapabilitySummary, 
  AgentRequest, 
  AgentResponse,
  OrchestrationPlan 
} from '@passage-planner/shared/types/core';

export class OrchestratorService extends EventEmitter {
  private mcpServer: Server;
  private redis: RedisClientType;
  private postgres: Pool;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  
  // Core services
  private agentRegistry: AgentRegistry;
  private requestRouter: RequestRouter;
  private responseAggregator: ResponseAggregator;
  private sessionManager: SessionManager;
  private metricsCollector: MetricsCollector;
  
  // State
  private activeRequests = new Map<string, OrchestrationPlan>();
  private agentConnections = new Map<string, any>(); // MCP clients
  
  constructor() {
    super();
    
    // Initialize MCP server
    this.mcpServer = new Server(
      {
        name: 'passage-planner-orchestrator',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );
    
    // Initialize Redis
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    
    // Initialize PostgreSQL
    this.postgres = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Initialize services
    this.agentRegistry = new AgentRegistry(this.redis, this.postgres, this.logger);
    this.requestRouter = new RequestRouter(this.agentRegistry, this.logger);
    this.responseAggregator = new ResponseAggregator(this.logger);
    this.sessionManager = new SessionManager(this.redis, this.logger);
    this.metricsCollector = new MetricsCollector(this.logger);
    
    this.setupMcpHandlers();
    this.setupEventHandlers();
  }
  
  private setupMcpHandlers() {
    // List available tools
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'plan_passage',
          description: 'Plan a sailing passage between two ports',
          inputSchema: {
            type: 'object',
            properties: {
              departure: { 
                type: 'string', 
                description: 'Departure port name or coordinates' 
              },
              destination: { 
                type: 'string', 
                description: 'Destination port name or coordinates' 
              },
              departure_time: { 
                type: 'string', 
                format: 'date-time',
                description: 'Planned departure time' 
              },
              boat_type: {
                type: 'string',
                enum: ['sailboat', 'powerboat', 'catamaran'],
                description: 'Type of vessel'
              },
              preferences: {
                type: 'object',
                properties: {
                  avoid_night: { type: 'boolean' },
                  max_wind_speed: { type: 'number' },
                  max_wave_height: { type: 'number' }
                }
              }
            },
            required: ['departure', 'destination', 'departure_time'],
          },
        },
        {
          name: 'get_weather_briefing',
          description: 'Get detailed weather briefing for a route',
          inputSchema: {
            type: 'object',
            properties: {
              route_id: { type: 'string' },
              coordinates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number' },
                    lon: { type: 'number' }
                  }
                }
              }
            }
          }
        },
        {
          name: 'check_agent_status',
          description: 'Check the status of all registered agents',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ],
    }));
    
    // Handle tool calls
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();
      
      try {
        this.logger.info({ requestId, tool: request.params.name }, 'Processing tool request');
        
        switch (request.params.name) {
          case 'plan_passage':
            return await this.handlePassagePlanning(requestId, request.params.arguments);
            
          case 'get_weather_briefing':
            return await this.handleWeatherBriefing(requestId, request.params.arguments);
            
          case 'check_agent_status':
            return await this.handleAgentStatus(requestId);
            
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        this.logger.error({ requestId, error }, 'Tool request failed');
        throw error;
      } finally {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordRequest(request.params.name, duration, true);
      }
    });
  }
  
  public async handlePassagePlanning(requestId: string, args: any) {
    // Create session
    const sessionId = await this.sessionManager.createSession({
      requestId,
      userId: args.userId,
      startTime: new Date(),
    });
    
    // Analyze request and create orchestration plan
    const plan = await this.requestRouter.analyzeRequest({
      prompt: `Plan passage from ${args.departure} to ${args.destination} departing at ${args.departure_time}`,
      context: args,
    });
    
    this.activeRequests.set(requestId, plan);
    
    // Execute plan steps
    const responses: AgentResponse[] = [];
    
    for (const step of plan.steps) {
        const request: AgentRequest = {
          id: `${requestId}-${step.id}`,
          timestamp: new Date(),
          source: 'orchestrator',
          target: step.agentId,
          type: 'tool',
          name: step.operation,
          arguments: step.arguments,
          timeout: step.timeout,
          priority: 'normal',
          context: {
            sessionId,
            correlationId: requestId,
            parentRequestId: requestId,
          },
        };
        
      try {
        const response = await this.sendAgentRequest(request);
        responses.push(response);
        
        // Update session with intermediate results
        await this.sessionManager.updateSession(sessionId, {
          lastActivity: new Date(),
          completedSteps: responses.length,
          totalSteps: plan.steps.length,
        });
        
      } catch (error) {
        this.logger.error({ step, error }, 'Step execution failed');
        
        // Try fallback strategy
        const fallback = plan.fallbackStrategies.find(
          f => f.agentId === step.agentId && f.condition === 'error'
        );
        
        if (fallback?.alternativeAgent) {
          // Retry with alternative agent
          const altRequest = { ...request, target: fallback.alternativeAgent };
          const altResponse = await this.sendAgentRequest(altRequest);
          responses.push(altResponse);
        } else if (fallback?.degradedResponse) {
          // Use degraded response
          responses.push({
            id: `${requestId}-${step.id}-degraded`,
            requestId: request.id,
            timestamp: new Date(),
            source: step.agentId,
            status: 'partial',
            data: fallback.degradedResponse,
            performance: { duration: 0 },
          });
        }
      }
    }
    
    // Aggregate responses
    const aggregatedResult = await this.responseAggregator.aggregate(responses, plan);
    
    // Clean up
    this.activeRequests.delete(requestId);
    await this.sessionManager.endSession(sessionId);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(aggregatedResult, null, 2),
        },
      ],
    };
  }
  
  private async sendAgentRequest(request: AgentRequest): Promise<AgentResponse> {
    const agent = await this.agentRegistry.getAgent(request.target);
    
    if (!agent) {
      throw new Error(`Agent ${request.target} not found`);
    }
    
    // Get or create MCP client connection
    let client = this.agentConnections.get(request.target);
    
    if (!client) {
      client = await this.createAgentConnection(agent);
      this.agentConnections.set(request.target, client);
    }
    
    // Send request with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), request.timeout || 30000);
    });
    
    try {
      const response = await Promise.race([
        client.callTool(request.name, request.arguments),
        timeoutPromise,
      ]);
      
      return {
        id: `resp-${request.id}`,
        requestId: request.id,
        timestamp: new Date(),
        source: request.target,
        status: 'success',
        data: response,
        performance: {
          duration: Date.now() - request.timestamp.getTime(),
        },
      };
    } catch (error) {
      await this.agentRegistry.updateAgentStatus(request.target, 'error');
      throw error;
    }
  }
  
  private async createAgentConnection(agent: AgentCapabilitySummary) {
    // Create MCP client connection to agent
    // This would use stdio, HTTP, or WebSocket transport based on agent config
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    
    const transport = new StdioClientTransport({
      command: agent.command || 'node',
      args: agent.args || [`./agents/${agent.agentId}/dist/index.js`],
    });
    
    const client = new Client({
      name: 'orchestrator-client',
      version: '1.0.0',
    }, {
      capabilities: {}
    });
    
    await client.connect(transport);
    return client;
  }
  
  public async handleWeatherBriefing(requestId: string, args: any) {
    // Simplified weather briefing handler
    const weatherRequest: AgentRequest = {
      id: requestId,
      timestamp: new Date(),
      source: 'orchestrator',
      target: 'weather-agent',
      type: 'tool',
      name: 'get_marine_forecast',
      arguments: args,
    };
    
    const response = await this.sendAgentRequest(weatherRequest);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }
  
  public async handleAgentStatus(requestId: string) {
    const statuses = await this.agentRegistry.getAllAgentStatuses();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(statuses, null, 2),
        },
      ],
    };
  }
  
  private setupEventHandlers() {
    // Agent registration
    this.on('agent:register', async (summary: AgentCapabilitySummary) => {
      await this.agentRegistry.registerAgent(summary);
      this.logger.info({ agentId: summary.agentId }, 'Agent registered');
    });
    
    // Agent health updates
    this.on('agent:health', async (agentId: string, status: any) => {
      await this.agentRegistry.updateAgentHealth(agentId, status);
    });
    
    // Metrics collection
    setInterval(async () => {
      const metrics = await this.collectSystemMetrics();
      this.emit('metrics:update', metrics);
    }, 10000); // Every 10 seconds
  }
  
  private async collectSystemMetrics() {
    const agentStatuses = await this.agentRegistry.getAllAgentStatuses();
    const activeRequestCount = this.activeRequests.size;
    const queueDepth = await this.redis.lLen('request_queue');
    
    return {
      timestamp: new Date(),
      orchestrator: {
        activeRequests: activeRequestCount,
        queueDepth,
        processingTime: this.metricsCollector.getAverageResponseTime(),
      },
      agents: agentStatuses,
      system: {
        cpuUsage: process.cpuUsage(),
        memoryUsage: process.memoryUsage(),
      },
    };
  }
  
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async start() {
    try {
      // Connect to Redis
      await this.redis.connect();
      this.logger.info('Connected to Redis');
      
      // Test PostgreSQL connection
      const pgTest = await this.postgres.query('SELECT NOW()');
      this.logger.info({ time: pgTest.rows[0].now }, 'Connected to PostgreSQL');
      
      // Start MCP server
      const transport = new StdioServerTransport();
      await this.mcpServer.connect(transport);
      this.logger.info('MCP server started');
      
      // Discover and connect to agents
      await this.discoverAgents();
      
      // Start metrics collection
      setInterval(() => this.collectSystemMetrics(), 30000);
      
      this.logger.info('Orchestrator service started successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to start orchestrator');
      throw error;
    }
  }
  
  private async discoverAgents() {
    try {
      // For now, manually connect to known agents
      const agentPorts = {
        'weather-agent': 8101,
        'tidal-agent': 8102,
        'port-agent': 8103,
        'safety-agent': 8104,
        'route-agent': 8105,
        'wind-agent': 8106,
        'factory-agent': 8107,
      };
      
      for (const [agentId, port] of Object.entries(agentPorts)) {
        try {
          // In a real implementation, we'd connect via MCP protocol
          // For now, just register them as available
          const agentSummary: AgentCapabilitySummary = {
            agentId,
            name: agentId.replace('-agent', ' Agent').replace(/\b\w/g, l => l.toUpperCase()),
            version: '1.0.0',
            description: `${agentId} service`,
            status: 'starting',
            tools: [], // Will be populated when agent connects
            resources: [],
            prompts: [],
            lastUpdated: new Date(),
            healthEndpoint: `http://localhost:${port}/health`,
            performance: {
              averageResponseTime: 0,
              successRate: 100,
            }
          };
          
          await this.agentRegistry.registerAgent(agentSummary);
          
          this.logger.info({ agentId, port }, 'Registered agent');
        } catch (error) {
          this.logger.error({ agentId, error }, 'Failed to register agent');
        }
      }
    } catch (error) {
      this.logger.error({ error }, 'Agent discovery failed');
    }
  }
  
  async shutdown() {
    try {
      this.logger.info('Shutting down orchestrator...');
      
      // Close agent connections
      for (const [agentId, connection] of this.agentConnections) {
        try {
          // Close MCP connection
          this.logger.info({ agentId }, 'Closing agent connection');
        } catch (error) {
          this.logger.error({ agentId, error }, 'Error closing agent connection');
        }
      }
      
      // Close database connections
      await this.redis.quit();
      await this.postgres.end();
      
      // Close MCP server
      await this.mcpServer.close();
      
      this.logger.info('Orchestrator shutdown complete');
    } catch (error) {
      this.logger.error({ error }, 'Error during shutdown');
      throw error;
    }
  }
  
  // Public methods for HTTP API
  async getConnectedAgents(): Promise<string[]> {
    const agents = await this.agentRegistry.getAllAgents();
    return agents.filter(a => a.status === 'active').map(a => a.agentId);
  }
  
  async registerAgent(agentId: string, capabilities: any): Promise<void> {
    const agentSummary: AgentCapabilitySummary = {
      agentId,
      name: agentId.replace('-agent', ' Agent').replace(/\b\w/g, l => l.toUpperCase()),
      version: '1.0.0',
      description: `${agentId} service`,
      status: 'active',
      tools: capabilities.tools || [],
      resources: capabilities.resources || [],
      prompts: capabilities.prompts || [],
      lastUpdated: new Date(),
      healthEndpoint: capabilities.endpoint || `http://localhost:8100/health`,
      performance: {
        averageResponseTime: 0,
        successRate: 100,
      }
    };
    
    await this.agentRegistry.registerAgent(agentSummary);
    
    this.emit('agent:status', {
      agentId,
      status: { status: 'active', lastSeen: new Date() }
    });
  }
  
  async getAgentStatuses(): Promise<any[]> {
    const agents = await this.agentRegistry.getAllAgents();
    return agents.map(agent => ({
      id: agent.agentId,
      name: agent.name,
      status: agent.status,
      lastSeen: agent.lastUpdated,
      capabilities: agent.tools.map(t => t.name),
    }));
  }

}

// Export for use in server.ts
export default OrchestratorService;

// Start the orchestrator if run directly
if (require.main === module) {
  const orchestrator = new OrchestratorService();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await orchestrator.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await orchestrator.shutdown();
    process.exit(0);
  });
  
  orchestrator.start().catch(console.error);
} 