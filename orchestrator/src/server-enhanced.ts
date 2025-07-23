import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { z } from 'zod';
import { OrchestratorService } from './index';
import { AuthService, FeatureGate, StripeService } from '@passage-planner/shared';
import { Pool } from 'pg';
import { createClient } from 'redis';
import pino from 'pino';
import { InputValidation } from '@passage-planner/shared/middleware/InputValidation';
import { SecurityHeaders } from '@passage-planner/shared/middleware/SecurityHeaders';
import { RateLimiter } from '@passage-planner/shared/services/RateLimiter';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
      subscription?: any;
    }
  }
}

export class EnhancedHttpServer {
  private app: express.Application;
  private httpServer: any;
  private io: SocketIOServer;
  private orchestrator: OrchestratorService;
  private authService: AuthService;
  private stripeService: StripeService;
  private postgres: Pool;
  private redis: any;
  private inputValidation: InputValidation;
  private securityHeaders: SecurityHeaders;
  private rateLimiter: RateLimiter;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
  });

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: this.getAllowedOrigins(),
        credentials: true,
      },
    });
    
    this.orchestrator = new OrchestratorService();
    this.authService = new AuthService();
    this.stripeService = new StripeService(this.logger);
    
    this.postgres = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    this.redis = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });
    
    // Initialize security services
    this.inputValidation = new InputValidation(this.logger);
    this.securityHeaders = new SecurityHeaders({
      corsOrigins: this.getAllowedOrigins(),
      cspDirectives: {
        connectSrc: [
          "'self'",
          "https://api.weather.gov",
          "https://api.tidesandcurrents.noaa.gov",
          "https://marine.weather.gov",
          "https://overpass-api.de",
          "wss://*.passageplanner.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "blob:",
          "https://tile.openstreetmap.org",
          "https://tiles.openseamap.org"
        ]
      }
    });
    this.rateLimiter = new RateLimiter(this.redis, this.logger);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private getAllowedOrigins(): string[] {
    const origins = [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ];
    
    if (process.env.ALLOWED_ORIGINS) {
      origins.push(...process.env.ALLOWED_ORIGINS.split(','));
    }
    
    return origins;
  }

  private setupMiddleware() {
    // Trust proxy
    this.app.set('trust proxy', 1);
    
    // Security headers - must be first
    this.app.use(this.securityHeaders.apply());
    
    // Compression
    this.app.use(compression());
    
    // Body size limits
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request ID and logging
    this.app.use((req, res, next) => {
      req.id = crypto.randomUUID();
      this.logger.info({
        requestId: req.id,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }, 'HTTP request');
      next();
    });
    
    // Global rate limiting for DDoS protection
    this.app.use(this.createGlobalRateLimit());
  }

  private createGlobalRateLimit() {
    const limiter = new Map<string, number[]>();
    
    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      const window = 60000; // 1 minute
      const maxRequests = 600; // 10 requests per second
      
      const requests = limiter.get(key) || [];
      const recentRequests = requests.filter(time => time > now - window);
      
      if (recentRequests.length >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: 60
        });
      }
      
      recentRequests.push(now);
      limiter.set(key, recentRequests);
      
      // Cleanup old entries periodically
      if (Math.random() < 0.01) {
        for (const [k, v] of limiter.entries()) {
          if (v.filter(t => t > now - window).length === 0) {
            limiter.delete(k);
          }
        }
      }
      
      next();
    };
  }

  private setupRoutes() {
    // Health check - no auth required
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

    // Authentication routes with validation
    this.app.post('/api/auth/signup',
      this.inputValidation.validateBody(z.object({
        email: InputValidation.schemas.email,
        password: InputValidation.schemas.password,
        displayName: z.string().min(1).max(100).optional(),
      })),
      this.inputValidation.rateLimitedValidation(
        z.any(),
        5, // 5 attempts
        900000 // 15 minutes
      ),
      async (req, res) => {
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
          
          // Track signup
          await this.trackEvent(user.id, 'user_signup', { source: 'web' });
          
          res.json({ token, user: this.sanitizeUser(user) });
        } catch (error) {
          this.logger.error({ error }, 'Signup failed');
          res.status(500).json({ error: 'Signup failed' });
        }
      }
    );

    this.app.post('/api/auth/login',
      this.inputValidation.validateBody(z.object({
        email: InputValidation.schemas.email,
        password: z.string().min(1),
      })),
      this.inputValidation.rateLimitedValidation(
        z.any(),
        10, // 10 attempts
        900000 // 15 minutes
      ),
      async (req, res) => {
        try {
          const { email, password } = req.body;
          
          const user = await this.getUserByEmail(email);
          if (!user) {
            // Don't reveal if email exists
            await this.simulatePasswordHash(); // Prevent timing attacks
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          
          const valid = await this.authService.verifyPassword(password, user.password_hash);
          if (!valid) {
            await this.trackFailedLogin(email);
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          
          // Check if account is locked
          if (await this.isAccountLocked(user.id)) {
            return res.status(403).json({ error: 'Account temporarily locked' });
          }
          
          const token = await this.authService.generateToken(user);
          await this.trackEvent(user.id, 'user_login', { source: 'web' });
          
          res.json({ token, user: this.sanitizeUser(user) });
        } catch (error) {
          this.logger.error({ error }, 'Login failed');
          res.status(500).json({ error: 'Login failed' });
        }
      }
    );

    // Stripe webhook with signature verification
    this.app.post('/api/stripe/webhook',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const sig = req.headers['stripe-signature'];
        
        if (!sig) {
          return res.status(400).json({ error: 'No signature' });
        }
        
        try {
          await this.stripeService.handleWebhook(sig as string, req.body);
          res.json({ received: true });
        } catch (error) {
          this.logger.error({ error }, 'Webhook processing failed');
          res.status(400).json({ error: 'Webhook processing failed' });
        }
      }
    );

    // Protected routes
    this.app.use('/api', this.authenticateToken.bind(this));
    this.app.use('/api', this.checkSubscription.bind(this));

    // Passage planning endpoint with validation
    this.app.post('/api/passages/plan',
      this.rateLimiter.limit.bind(this.rateLimiter),
      this.inputValidation.validateBody(z.object({
        departure: InputValidation.schemas.waypoint,
        destination: InputValidation.schemas.waypoint,
        waypoints: z.array(InputValidation.schemas.waypoint).max(20).optional(),
        departureTime: InputValidation.schemas.dateTime,
        boat: InputValidation.schemas.boatDetails,
        preferences: InputValidation.schemas.weatherPreferences.optional(),
      })),
      async (req, res) => {
        try {
          const userId = req.user.id;
          const subscription = req.subscription;
          
          // Check feature access
          const canPlan = await FeatureGate.canCreatePassage(subscription, userId);
          if (!canPlan) {
            return res.status(403).json({
              error: 'Passage limit exceeded',
              upgradeUrl: '/pricing'
            });
          }
          
          // Plan passage
          const plan = await this.orchestrator.planPassage(req.body);
          
          // Track usage
          await this.trackEvent(userId, 'passage_planned', {
            distance: plan.distance,
            duration: plan.estimatedDuration
          });
          
          res.json(plan);
        } catch (error) {
          this.logger.error({ error }, 'Passage planning failed');
          res.status(500).json({ error: 'Failed to plan passage' });
        }
      }
    );

    // Port search with validation
    this.app.get('/api/ports/search',
      this.inputValidation.validateQuery(z.object({
        q: InputValidation.schemas.searchQuery.optional(),
        lat: z.coerce.number().min(-90).max(90).optional(),
        lon: z.coerce.number().min(-180).max(180).optional(),
        radius: z.coerce.number().min(1).max(500).optional(),
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(50).default(20),
      })),
      async (req, res) => {
        try {
          const results = await this.searchPorts(req.query);
          res.json(results);
        } catch (error) {
          this.logger.error({ error }, 'Port search failed');
          res.status(500).json({ error: 'Search failed' });
        }
      }
    );

    // Error handling
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      this.logger.error({
        error: err,
        requestId: req.id,
        path: req.path,
      }, 'Unhandled error');
      
      // Don't leak error details in production
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({
          error: 'Internal server error',
          requestId: req.id
        });
      } else {
        res.status(500).json({
          error: err.message,
          stack: err.stack,
          requestId: req.id
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path
      });
    });
  }

  private async authenticateToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    
    if (!authHeader && !apiKey) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = await this.authService.verifyToken(token);
        const user = await this.getUserById(payload.userId);
        
        if (!user) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        
        req.user = user;
      } else if (apiKey) {
        const user = await this.verifyApiKey(apiKey as string);
        if (!user) {
          return res.status(401).json({ error: 'Invalid API key' });
        }
        req.user = user;
      }
      
      next();
    } catch (error) {
      this.logger.error({ error }, 'Authentication failed');
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }

  // Helper methods (implement these based on your database schema)
  private async getUserByEmail(email: string): Promise<any> {
    const result = await this.postgres.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  private async getUserById(id: string): Promise<any> {
    const result = await this.postgres.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  private async createUser(email: string, passwordHash: string, displayName?: string): Promise<any> {
    const result = await this.postgres.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING *',
      [email, passwordHash, displayName]
    );
    return result.rows[0];
  }

  private async checkSubscription(req: Request, res: Response, next: NextFunction) {
    if (!req.user) return next();
    
    const result = await this.postgres.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 AND status = $2',
      [req.user.id, 'active']
    );
    
    req.subscription = result.rows[0];
    next();
  }

  private sanitizeUser(user: any) {
    const { password_hash, ...safe } = user;
    return safe;
  }

  private async simulatePasswordHash() {
    // Prevent timing attacks by always running bcrypt
    await this.authService.hashPassword('dummy');
  }

  private async trackFailedLogin(email: string) {
    const key = `failed_login:${email}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 900); // 15 minutes
  }

  private async isAccountLocked(userId: string): Promise<boolean> {
    const key = `account_lock:${userId}`;
    const locked = await this.redis.get(key);
    return !!locked;
  }

  private async trackEvent(userId: string, event: string, properties?: any) {
    try {
      await this.postgres.query(
        'INSERT INTO analytics_events (user_id, event, properties) VALUES ($1, $2, $3)',
        [userId, event, JSON.stringify(properties || {})]
      );
    } catch (error) {
      this.logger.error({ error }, 'Failed to track event');
    }
  }

  private async verifyApiKey(key: string): Promise<any> {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const result = await this.postgres.query(
      'SELECT u.* FROM users u JOIN api_keys ak ON u.id = ak.user_id WHERE ak.key_hash = $1 AND ak.active = true',
      [keyHash]
    );
    return result.rows[0];
  }

  private setupWebSocket() {
    // Implement WebSocket handlers with authentication
    this.io.use(async (socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      try {
        const payload = await this.authService.verifyToken(token);
        socket.data.userId = payload.userId;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });
    
    this.io.on('connection', (socket) => {
      this.logger.info({ userId: socket.data.userId }, 'WebSocket connected');
      
      socket.on('disconnect', () => {
        this.logger.info({ userId: socket.data.userId }, 'WebSocket disconnected');
      });
    });
  }

  async start(port: number = 8080) {
    await this.redis.connect();
    
    this.httpServer.listen(port, () => {
      this.logger.info({ port }, 'Server started');
    });
  }

  async stop() {
    await new Promise((resolve) => this.httpServer.close(resolve));
    await this.redis.quit();
    await this.postgres.end();
  }
} 