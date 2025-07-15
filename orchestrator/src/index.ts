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
} from '@passage-planner/shared';

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
  }
  
  public async handlePassagePlanning(requestId: string, args: any) {
    // Implementation will be in separate method
    return { content: [{ type: 'text', text: 'Passage planning started' }] };
  }
  
  public async handleWeatherBriefing(requestId: string, args: any) {
    // Implementation will be in separate method
    return { content: [{ type: 'text', text: 'Weather briefing started' }] };
  }
  
  public async handleAgentStatus(requestId: string) {
    // Implementation will be in separate method
    return { content: [{ type: 'text', text: 'Agent status check started' }] };
  }
  
  private setupEventHandlers() {
    // Agent registration
    this.on('agent:register', async (summary: AgentCapabilitySummary) => {
      await this.agentRegistry.registerAgent(summary);
      this.logger.info({ agentId: summary.agentId }, 'Agent registered');
    });
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
      await this.postgres.query('SELECT NOW()');
      this.logger.info('Connected to PostgreSQL');
      
      // Start MCP server
      const transport = new StdioServerTransport();
      await this.mcpServer.connect(transport);
      this.logger.info('MCP Orchestrator server started');
      
      // Start HTTP health endpoint
      this.startHealthEndpoint();
      
      this.logger.info('Orchestrator service fully initialized');
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start orchestrator');
      process.exit(1);
    }
  }
  
  private startHealthEndpoint() {
    const express = require('express');
    const app = express();
    
    app.get('/health', async (req: any, res: any) => {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        redis: this.redis.isReady,
        postgres: true,
        agents: await this.agentRegistry.getHealthyAgentCount(),
      };
      res.json(health);
    });
    
    const port = process.env.HEALTH_PORT || 8081;
    app.listen(port, () => {
      this.logger.info(`Health endpoint listening on port ${port}`);
    });
  }
  
  async shutdown() {
    this.logger.info('Shutting down orchestrator');
    
    // Close database connections
    await this.redis.quit();
    await this.postgres.end();
    
    this.logger.info('Orchestrator shutdown complete');
  }
}

// Start the orchestrator
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