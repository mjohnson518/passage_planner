// orchestrator/src/index.ts
// Complete Orchestrator Implementation

import { Server } from '@modelcontextprotocol/sdk/server/index';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode 
} from '@modelcontextprotocol/sdk/types';
import { createClient, RedisClientType } from 'redis';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import pino from 'pino';
import { AgentRegistry } from './services/AgentRegistry';
import { RequestRouter } from './services/RequestRouter';
import { ResponseAggregator } from './services/ResponseAggregator';
import { SessionManager } from './services/SessionManager';
import { MetricsCollector } from './services/MetricsCollector';
import { AgentManager } from './services/AgentManager';
import { 
  AgentCapabilitySummary, 
  AgentRequest, 
  AgentResponse,
  OrchestrationPlan 
} from '@passage-planner/shared';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { StripeService } from './services/StripeService';
import { AuthMiddleware } from './middleware/auth';
import { RateLimiter } from './middleware/rateLimiter';

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
  private agentManager: AgentManager;
  
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
    this.agentManager = new AgentManager(this.redis, this.logger);
    
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
  
  async handleRequest(request: any): Promise<any> {
    const { tool, arguments: args } = request;
    const requestId = this.generateRequestId();
    
    switch (tool) {
      case 'plan_passage':
        return await this.handlePassagePlanning(requestId, args);
      case 'get_weather_briefing':
        return await this.handleWeatherBriefing(requestId, args);
      case 'check_agent_status':
        return await this.handleAgentStatus(requestId);
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  async listTools(): Promise<any[]> {
    return [
      {
        name: 'plan_passage',
        description: 'Plan a sailing passage between two ports',
      },
      {
        name: 'get_weather_briefing',
        description: 'Get detailed weather briefing for a route',
      },
      {
        name: 'check_agent_status',
        description: 'Check the status of all registered agents',
      }
    ];
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

export class HttpServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private orchestrator: OrchestratorService;
  private stripeService: StripeService;
  private authMiddleware: AuthMiddleware;
  private rateLimiter: RateLimiter;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });

  constructor(orchestrator: OrchestratorService) {
    this.orchestrator = orchestrator;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
      }
    });
    
    // Initialize services
    this.stripeService = new StripeService(orchestrator['postgres'], this.logger);
    this.authMiddleware = new AuthMiddleware(orchestrator['postgres'], this.logger);
    this.rateLimiter = new RateLimiter(orchestrator['redis'], this.logger);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }));
    this.app.use(express.json());
    this.app.use(express.raw({ type: 'application/json' })); // For Stripe webhooks
    
    // Health check endpoint (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date() });
    });
  }

  private setupRoutes() {
    // Public routes
    this.app.post('/api/auth/signup', this.handleSignup.bind(this));
    this.app.post('/api/auth/login', this.handleLogin.bind(this));
    this.app.post('/api/auth/refresh', this.handleRefreshToken.bind(this));
    
    // Stripe webhook (uses raw body)
    this.app.post('/api/stripe/webhook', 
      express.raw({ type: 'application/json' }), 
      this.handleStripeWebhook.bind(this)
    );
    
    // Protected routes
    this.app.use('/api', this.authMiddleware.authenticate.bind(this.authMiddleware));
    
    // Apply rate limiting based on subscription tier
    this.app.use('/api/mcp', this.rateLimiter.limit.bind(this.rateLimiter));
    
    // MCP endpoints
    this.app.post('/api/mcp/tools/list', this.handleListTools.bind(this));
    this.app.post('/api/mcp/tools/call', this.handleCallTool.bind(this));
    
    // Subscription management
    this.app.post('/api/subscription/create-checkout', this.handleCreateCheckout.bind(this));
    this.app.post('/api/subscription/create-portal', this.handleCreatePortal.bind(this));
    this.app.get('/api/subscription/status', this.handleGetSubscription.bind(this));
    
    // API key management
    this.app.post('/api/keys/create', this.handleCreateApiKey.bind(this));
    this.app.get('/api/keys', this.handleListApiKeys.bind(this));
    this.app.delete('/api/keys/:id', this.handleDeleteApiKey.bind(this));
    
    // Usage metrics
    this.app.get('/api/usage', this.handleGetUsage.bind(this));
  }

  // Auth handlers
  private async handleSignup(req: express.Request, res: express.Response) {
    try {
      const { email, password } = req.body;
      
      // Create user
      const result = await this.orchestrator['postgres'].query(
        'INSERT INTO users (email) VALUES ($1) RETURNING id, email',
        [email]
      );
      
      const user = result.rows[0];
      
      // Create subscription record
      await this.orchestrator['postgres'].query(
        `INSERT INTO subscriptions (user_id, tier, status) 
         VALUES ($1, 'free', 'active')`,
        [user.id]
      );
      
      // Generate JWT
      const token = await this.authMiddleware.generateToken(user);
      
      res.json({ user, token });
    } catch (error) {
      this.logger.error({ error }, 'Signup failed');
      res.status(400).json({ error: 'Signup failed' });
    }
  }

  private async handleLogin(req: express.Request, res: express.Response) {
    try {
      const { email, password } = req.body;
      
      // Verify credentials (simplified - use bcrypt in production)
      const result = await this.orchestrator['postgres'].query(
        'SELECT id, email FROM users WHERE email = $1',
        [email]
      );
      
      const user = result.rows[0];
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Generate JWT
      const token = await this.authMiddleware.generateToken(user);
      
      res.json({ user, token });
    } catch (error) {
      this.logger.error({ error }, 'Login failed');
      res.status(401).json({ error: 'Login failed' });
    }
  }

  private async handleRefreshToken(req: express.Request, res: express.Response) {
    // Implement token refresh logic
    res.status(501).json({ error: 'Not implemented' });
  }

  // Stripe handlers
  private async handleStripeWebhook(req: express.Request, res: express.Response) {
    const signature = req.headers['stripe-signature'] as string;
    
    try {
      await this.stripeService.handleWebhook(signature, req.body);
      res.json({ received: true });
    } catch (error) {
      this.logger.error({ error }, 'Webhook processing failed');
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  }

  private async handleCreateCheckout(req: express.Request, res: express.Response) {
    try {
      const { priceId } = req.body;
      const userId = (req as any).user.id;
      
      const session = await this.stripeService.createCheckoutSession({
        userId,
        priceId,
        successUrl: `${process.env.FRONTEND_URL}/profile?success=true`,
        cancelUrl: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      });
      
      res.json({ sessionUrl: session.url });
    } catch (error) {
      this.logger.error({ error }, 'Failed to create checkout session');
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  private async handleCreatePortal(req: express.Request, res: express.Response) {
    try {
      const userId = (req as any).user.id;
      
      // Get Stripe customer ID
      const result = await this.orchestrator['postgres'].query(
        'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
        [userId]
      );
      
      const customerId = result.rows[0]?.stripe_customer_id;
      if (!customerId) {
        return res.status(400).json({ error: 'No subscription found' });
      }
      
      const session = await this.stripeService.createPortalSession({
        customerId,
        returnUrl: `${process.env.FRONTEND_URL}/profile`,
      });
      
      res.json({ portalUrl: session.url });
    } catch (error) {
      this.logger.error({ error }, 'Failed to create portal session');
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  }

  private async handleGetSubscription(req: express.Request, res: express.Response) {
    try {
      const userId = (req as any).user.id;
      
      const result = await this.orchestrator['postgres'].query(
        'SELECT * FROM subscriptions WHERE user_id = $1',
        [userId]
      );
      
      res.json(result.rows[0] || { tier: 'free', status: 'active' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get subscription' });
    }
  }

  // API key handlers
  private async handleCreateApiKey(req: express.Request, res: express.Response) {
    try {
      const { name } = req.body;
      const userId = (req as any).user.id;
      
      // Check subscription allows API access
      const subscription = (req as any).subscription;
      if (subscription.tier === 'free') {
        return res.status(403).json({ error: 'API access requires Premium or Pro subscription' });
      }
      
      const { key, hash } = this.stripeService.generateApiKey();
      
      await this.orchestrator['postgres'].query(
        'INSERT INTO api_keys (user_id, name, key_hash) VALUES ($1, $2, $3)',
        [userId, name, hash]
      );
      
      res.json({ key, name, note: 'Save this key - it cannot be retrieved again' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }

  private async handleListApiKeys(req: express.Request, res: express.Response) {
    try {
      const userId = (req as any).user.id;
      
      const result = await this.orchestrator['postgres'].query(
        'SELECT id, name, last_used_at, created_at FROM api_keys WHERE user_id = $1',
        [userId]
      );
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to list API keys' });
    }
  }

  private async handleDeleteApiKey(req: express.Request, res: express.Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      
      await this.orchestrator['postgres'].query(
        'DELETE FROM api_keys WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete API key' });
    }
  }

  // Usage handler
  private async handleGetUsage(req: express.Request, res: express.Response) {
    try {
      const userId = (req as any).user.id;
      const { period = 'month' } = req.query;
      
      const result = await this.orchestrator['postgres'].query(
        `SELECT action, COUNT(*) as count, DATE_TRUNC($1, created_at) as period
         FROM usage_metrics 
         WHERE user_id = $2 AND created_at > NOW() - INTERVAL '1 ' || $1
         GROUP BY action, period
         ORDER BY period DESC`,
        [period, userId]
      );
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get usage' });
    }
  }

  // MCP handlers with subscription checks
  private async handleListTools(req: express.Request, res: express.Response) {
    try {
      const tools = await this.orchestrator.listTools();
      res.json({ tools });
    } catch (error) {
      this.logger.error({ error }, 'Failed to list tools');
      res.status(500).json({ error: 'Failed to list tools' });
    }
  }

  private async handleCallTool(req: express.Request, res: express.Response) {
    try {
      const { tool, arguments: args } = req.body;
      const userId = (req as any).user.id;
      const subscription = (req as any).subscription;
      
      // Check feature access
      if (tool === 'plan_passage') {
        const canUse = await this.checkFeatureAccess(userId, 'create_passage', subscription);
        if (!canUse) {
          return res.status(403).json({ 
            error: 'Usage limit exceeded',
            upgradeUrl: '/pricing'
          });
        }
      }
      
      // Track usage
      await this.orchestrator['postgres'].query(
        'INSERT INTO usage_metrics (user_id, action, metadata) VALUES ($1, $2, $3)',
        [userId, `tool_${tool}`, JSON.stringify({ tool, timestamp: new Date() })]
      );
      
      // Call original MCP handler
      const request = {
        method: 'tools/call',
        params: {
          name: tool,
          arguments: args
        }
      };
      
      const response = await this.orchestrator.handleRequest(request);
      res.json(response);
      
    } catch (error) {
      this.logger.error({ error }, 'Tool call failed');
      res.status(500).json({ error: 'Tool call failed' });
    }
  }

  private async checkFeatureAccess(userId: string, feature: string, subscription: any): Promise<boolean> {
    // Implement feature gating logic
    if (subscription.tier === 'free' && feature === 'create_passage') {
      const result = await this.orchestrator['postgres'].query(
        `SELECT COUNT(*) FROM usage_metrics 
         WHERE user_id = $1 
         AND action = 'passage_planned' 
         AND created_at > DATE_TRUNC('month', NOW())`,
        [userId]
      );
      
      const monthlyUsage = parseInt(result.rows[0].count);
      return monthlyUsage < 2; // Free tier limit
    }
    
    return true;
  }

  private setupWebSocket() {
    this.io.on('connection', (socket) => {
      this.logger.info('WebSocket client connected');

      socket.on('disconnect', () => {
        this.logger.info('WebSocket client disconnected');
      });

      // Example: Handle MCP messages from the frontend
      socket.on('mcp_message', async (data: any) => {
        try {
          const response = await this.orchestrator.handleRequest(data);
          socket.emit('mcp_response', response);
        } catch (error) {
          this.logger.error({ error }, 'Error processing MCP message');
          socket.emit('mcp_response', { error: 'Failed to process MCP message' });
        }
      });

      // Agent management handlers
      socket.on('agents:status', async () => {
        const status = await this.orchestrator['agentManager'].getHealthSummary();
        socket.emit('agents:status', status);
      });

      socket.on('agent:start', async ({ name }: { name: string }) => {
        try {
          // AgentManager doesn't have a public startAgent method, use restart instead
          await this.orchestrator['agentManager'].restartAgent(name);
          socket.emit('agent:started', { name });
        } catch (error) {
          this.logger.error({ error, agent: name }, 'Failed to start agent');
          socket.emit('agent:error', { name, error: error instanceof Error ? error.message : String(error) });
        }
      });

      socket.on('agent:stop', async ({ name }: { name: string }) => {
        try {
          // AgentManager doesn't have a public stopAgent method
          socket.emit('agent:error', { name, error: 'Stop functionality not implemented' });
        } catch (error) {
          this.logger.error({ error, agent: name }, 'Failed to stop agent');
          socket.emit('agent:error', { name, error: error instanceof Error ? error.message : String(error) });
        }
      });

      socket.on('agent:restart', async ({ name }: { name: string }) => {
        try {
          await this.orchestrator['agentManager'].restartAgent(name);
          socket.emit('agent:restarted', { name });
        } catch (error) {
          this.logger.error({ error, agent: name }, 'Failed to restart agent');
          socket.emit('agent:error', { name, error: error instanceof Error ? error.message : String(error) });
        }
      });
    });

    // Forward agent manager events to WebSocket clients
    this.orchestrator['agentManager'].on('agent:started', (data) => {
      this.io.emit('agent:started', data);
    });

    this.orchestrator['agentManager'].on('agent:stopped', (data) => {
      this.io.emit('agent:stopped', data);
    });

    this.orchestrator['agentManager'].on('agent:crashed', (data) => {
      this.io.emit('agent:crashed', data);
    });

    this.orchestrator['agentManager'].on('agent:health', (data) => {
      this.io.emit('agent:health', data);
    });

    this.orchestrator['agentManager'].on('agent:unhealthy', (data) => {
      this.io.emit('agent:unhealthy', data);
    });
  }

  async start() {
    try {
      // Start the orchestrator first
      await this.orchestrator.start();
      
      // Start HTTP server
      const port = process.env.HTTP_PORT || 3000;
      this.server.listen(port, () => {
        this.logger.info(`HTTP server listening on port ${port}`);
      });

      // Start WebSocket server
      this.logger.info('WebSocket server started');
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start HTTP server');
      process.exit(1);
    }
  }

  async shutdown() {
    this.logger.info('Shutting down HTTP server');
    
    // Shutdown orchestrator (which will close its connections)
    await this.orchestrator.shutdown();
    
    this.logger.info('HTTP server shutdown complete');
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