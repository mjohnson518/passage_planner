// orchestrator/src/server.ts
// HTTP/WebSocket server wrapper for MCP orchestrator

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { OrchestratorService } from './index';
import { AuthService, FeatureGate, StripeService } from '@passage-planner/shared';
import { Pool } from 'pg';
import { createClient } from 'redis';
import pino from 'pino';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
      subscription?: any;
    }
  }
}

export class HttpServer {
  private app: express.Application;
  private httpServer: any;
  private io: SocketIOServer;
  private orchestrator: OrchestratorService;
  private authService: AuthService;
  private stripeService: StripeService;
  private postgres: Pool;
  private redis: any;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
  });

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
        credentials: true,
      },
    });
    
    this.orchestrator = new OrchestratorService();
    this.authService = new AuthService();
    this.stripeService = new StripeService(this.logger);
    
    this.postgres = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    this.redis = createClient({
      url: process.env.REDIS_URL,
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      credentials: true,
    }));
    
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info({
        method: req.method,
        path: req.path,
        ip: req.ip,
      }, 'HTTP request');
      next();
    });
  }

  private async authenticateToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
      const payload = await this.authService.verifyToken(token);
      const user = await this.getUserById(payload.userId);
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  private async checkSubscription(req: Request, res: Response, next: NextFunction) {
    if (!req.user) return next();
    
    const subscription = await this.getSubscription(req.user.id);
    req.subscription = subscription;
    next();
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date(),
        services: {
          orchestrator: 'active',
          redis: this.redis.isReady,
          postgres: true,
        },
      });
    });

    // Authentication routes
    this.app.post('/api/auth/signup', async (req, res) => {
      try {
        const { email, password, displayName } = req.body;
        
        // Check if user exists
        const existing = await this.getUserByEmail(email);
        if (existing) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Create user
        const hashedPassword = await this.authService.hashPassword(password);
        const user = await this.createUser(email, hashedPassword, displayName);
        
        // Generate token
        const token = await this.authService.generateToken(user);
        
        res.json({ token, user });
      } catch (error) {
        this.logger.error({ error }, 'Signup failed');
        res.status(500).json({ error: 'Signup failed' });
      }
    });

    this.app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        
        const user = await this.getUserByEmail(email);
        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const valid = await this.authService.verifyPassword(password, user.password_hash);
        if (!valid) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = await this.authService.generateToken(user);
        res.json({ token, user });
      } catch (error) {
        this.logger.error({ error }, 'Login failed');
        res.status(500).json({ error: 'Login failed' });
      }
    });

    // MCP tool proxy
    this.app.post('/api/mcp/tools/call', 
      this.authenticateToken.bind(this),
      this.checkSubscription.bind(this),
      async (req, res) => {
        try {
          const { tool, arguments: args } = req.body;
          
          // Check feature access
          if (tool === 'plan_passage') {
            const canUse = await FeatureGate.canUseFeature(
              req.user.id,
              'create_passage',
              req.subscription
            );
            
            if (!canUse) {
              return res.status(403).json({
                error: 'Passage limit reached',
                upgradeUrl: '/pricing',
              });
            }
          }
          
          // Track usage
          await this.trackUsage(req.user.id, 'passage_planned');
          
          // Call orchestrator
          const result = await this.orchestrator.handleToolCall({
            name: tool,
            arguments: { ...args, userId: req.user.id },
          });
          
          res.json(result);
        } catch (error) {
          this.logger.error({ error }, 'Tool call failed');
          res.status(500).json({ error: 'Tool call failed' });
        }
      }
    );

    // Subscription routes
    this.app.post('/api/subscription/create-checkout-session',
      this.authenticateToken.bind(this),
      async (req, res) => {
        try {
          const { tier, period = 'monthly' } = req.body;
          const priceId = this.getPriceId(tier, period);
          
          const session = await this.stripeService.createCheckoutSession(
            req.user.id,
            priceId,
            `${process.env.NEXT_PUBLIC_API_URL}/profile?success=true`,
            `${process.env.NEXT_PUBLIC_API_URL}/profile?canceled=true`,
            req.user.email
          );
          
          res.json({ sessionUrl: session.url });
        } catch (error) {
          this.logger.error({ error }, 'Checkout session creation failed');
          res.status(500).json({ error: 'Failed to create checkout session' });
        }
      }
    );

    // Stripe webhook
    this.app.post('/api/stripe/webhook', 
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const signature = req.headers['stripe-signature'] as string;
        
        try {
          const result = await this.stripeService.handleWebhook(
            signature,
            req.body as Buffer
          );
          
          if (result) {
            await this.updateSubscription(result);
          }
          
          res.json({ received: true });
        } catch (error) {
          this.logger.error({ error }, 'Webhook processing failed');
          res.status(400).json({ error: 'Webhook error' });
        }
      }
    );

    // Agent registration
    this.app.post('/api/agents/register', async (req, res) => {
      try {
        const agentSummary = req.body;
        this.orchestrator.emit('agent:register', agentSummary);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
      }
    });
  }

  private setupWebSocket() {
    this.io.on('connection', (socket) => {
      this.logger.info({ socketId: socket.id }, 'WebSocket connected');
      
      socket.on('authenticate', async (token) => {
        try {
          const payload = await this.authService.verifyToken(token);
          socket.data.userId = payload.userId;
          socket.join(`user:${payload.userId}`);
          socket.emit('authenticated');
        } catch (error) {
          socket.emit('authentication_error');
        }
      });
      
      socket.on('disconnect', () => {
        this.logger.info({ socketId: socket.id }, 'WebSocket disconnected');
      });
    });
    
    // Forward orchestrator events to WebSocket
    this.orchestrator.on('agent:status', (data) => {
      this.io.emit('agent_status', data);
    });
    
    this.orchestrator.on('request:progress', (data) => {
      if (data.userId) {
        this.io.to(`user:${data.userId}`).emit('progress', data);
      }
    });
  }

  // Database helpers
  private async getUserById(userId: string) {
    const result = await this.postgres.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0];
  }

  private async getUserByEmail(email: string) {
    const result = await this.postgres.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  private async createUser(email: string, passwordHash: string, displayName?: string) {
    const userResult = await this.postgres.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
      [email, passwordHash]
    );
    
    const user = userResult.rows[0];
    
    // Create profile
    await this.postgres.query(
      'INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)',
      [user.id, displayName || email.split('@')[0]]
    );
    
    // Create free subscription
    await this.postgres.query(
      'INSERT INTO subscriptions (user_id, tier, status) VALUES ($1, $2, $3)',
      [user.id, 'free', 'active']
    );
    
    return user;
  }

  private async getSubscription(userId: string) {
    const result = await this.postgres.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  }

  private async updateSubscription(data: any) {
    await this.postgres.query(
      `UPDATE subscriptions 
       SET tier = $2, status = $3, current_period_start = $4, 
           current_period_end = $5, stripe_customer_id = $6, 
           stripe_subscription_id = $7, updated_at = NOW()
       WHERE user_id = $1`,
      [
        data.userId,
        data.tier,
        data.status,
        data.currentPeriodStart,
        data.currentPeriodEnd,
        data.stripeCustomerId,
        data.stripeSubscriptionId,
      ]
    );
  }

  private async trackUsage(userId: string, action: string, metadata?: any) {
    await this.postgres.query(
      'INSERT INTO usage_metrics (user_id, action, metadata) VALUES ($1, $2, $3)',
      [userId, action, JSON.stringify(metadata || {})]
    );
  }

  private getPriceId(tier: string, period: string): string {
    const priceMap: Record<string, string> = {
      'premium_monthly': process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID!,
      'premium_yearly': process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID!,
      'pro_monthly': process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
      'pro_yearly': process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
    };
    
    return priceMap[`${tier}_${period}`];
  }

  async start(port: number = 8080) {
    await this.redis.connect();
    await this.orchestrator.start();
    
    this.httpServer.listen(port, () => {
      this.logger.info(`HTTP/WebSocket server listening on port ${port}`);
    });
  }

  async stop() {
    await this.orchestrator.shutdown();
    await this.redis.quit();
    await this.postgres.end();
    this.httpServer.close();
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new HttpServer();
  
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
  
  server.start().catch(console.error);
} 