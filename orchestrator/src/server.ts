// orchestrator/src/server.ts
// HTTP/WebSocket server wrapper for MCP orchestrator

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { OrchestratorService } from './index';
import { AuthService, FeatureGate, StripeService, SecurityHeaders } from '@passage-planner/shared';
import { AuthMiddleware } from './middleware/auth';
import { AgentManager } from './services/AgentManager';
import { RateLimiter } from './middleware/rateLimiter';
import { createAdminGuard } from './middleware/adminGuard';
import { emailService } from './services/EmailService';
import { Pool } from 'pg';
import { createClient } from 'redis';
import * as crypto from 'crypto';
import pino from 'pino';

const startupLogger = pino({ level: process.env.LOG_LEVEL || 'info' });

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
  private authMiddleware: AuthMiddleware;
  private agentManager: AgentManager;
  private stripeService: StripeService;
  private postgres: Pool;
  private redis: any;
  private rateLimiter?: RateLimiter;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
  });

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    // Define allowed origins for CORS - must include all production and development URLs
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://helmwise.co',
      'https://www.helmwise.co',
      'https://helmwise.pages.dev',
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean) as string[];

    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, curl, etc.)
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            this.logger.warn({ origin, allowedOrigins }, 'Blocked WebSocket CORS request');
            callback(new Error('CORS not allowed'));
          }
        },
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
    
    this.authMiddleware = new AuthMiddleware(this.postgres, this.logger);
    
    // AgentManager will be initialized after all agents are set up
    // For now, create a placeholder that returns mock data
    this.agentManager = {
      getHealthSummary: async () => ({
        timestamp: new Date(),
        total: 6,
        healthy: 6,
        unhealthy: 0,
        starting: 0,
        maintenance: 0,
        agents: []
      }),
      getAgentStatus: async (agentId: string) => ({
        id: agentId,
        status: 'active',
        uptime: 3600000,
        restartCount: 0,
        lastHealthCheck: new Date(),
        metrics: {}
      }),
      restartAgent: async (agentId: string) => {
        this.logger.info({ agentId }, 'Agent restart requested (mock)');
      }
    } as any;
    
    this.setupMiddleware();
    // Register webhook route BEFORE JSON parser to preserve raw body for Stripe signature verification
    this.registerStripeWebhookEarly();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private registerStripeWebhookEarly() {
    // Ensure raw body is available for signature verification
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
  }

  private setupMiddleware() {
    // CRITICAL: Configure trust proxy for proper IP detection behind reverse proxy
    // This ensures rate limiting and logging work correctly in production
    // Set to 1 for single proxy (e.g., nginx, CloudFlare), or number of trusted proxies
    if (process.env.NODE_ENV === 'production') {
      this.app.set('trust proxy', 1);
      this.logger.info('Trust proxy enabled for production environment');
    }

    // CRITICAL: Apply security headers first, including HSTS
    // Use the same allowedOrigins list for consistency
    const corsOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://helmwise.co',
      'https://www.helmwise.co',
      'https://helmwise.pages.dev',
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean) as string[];

    const securityHeaders = new SecurityHeaders({
      enableHSTS: true,
      enableCSP: true,
      enableCORS: true,
      corsOrigins: corsOrigins
    });
    this.app.use(securityHeaders.apply());

    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          this.logger.warn({ origin }, 'Blocked CORS request from unauthorized origin');
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }));

    // NOTE: JSON parser is registered AFTER the early Stripe webhook route
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

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(this.redis, this.logger);
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

    // WebSocket health check
    this.app.get('/healthz/ws', (req, res) => {
      try {
        const engine = (this.io as any).engine;
        const clients = engine && engine.clientsCount ? engine.clientsCount : 0;
        res.json({ status: 'ok', clients });
      } catch {
        res.status(500).json({ status: 'error' });
      }
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

    // Dashboard stats endpoint
    this.app.get('/api/dashboard/stats',
      this.authenticateToken.bind(this),
      async (req, res) => {
        try {
          const userId = req.user.id;
          
          // Get total passages
          const totalPassagesResult = await this.postgres.query(
            'SELECT COUNT(*) as count FROM passages WHERE user_id = $1',
            [userId]
          );
          const totalPassages = parseInt(totalPassagesResult.rows[0]?.count || '0');
          
          // Get monthly passages
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const monthlyPassagesResult = await this.postgres.query(
            'SELECT COUNT(*) as count FROM passages WHERE user_id = $1 AND created_at >= $2',
            [userId, startOfMonth]
          );
          const monthlyPassages = parseInt(monthlyPassagesResult.rows[0]?.count || '0');
          
          // Get total miles from all passages
          const totalMilesResult = await this.postgres.query(
            'SELECT COALESCE(SUM(distance_nm), 0) as total FROM passages WHERE user_id = $1',
            [userId]
          );
          const totalMiles = Math.round(parseFloat(totalMilesResult.rows[0]?.total || '0'));
          
          // Get favorite port (most visited destination)
          const favoritePortResult = await this.postgres.query(
            `SELECT destination, COUNT(*) as visit_count 
             FROM passages 
             WHERE user_id = $1 AND destination IS NOT NULL
             GROUP BY destination 
             ORDER BY visit_count DESC 
             LIMIT 1`,
            [userId]
          );
          const favoritePort = favoritePortResult.rows[0]?.destination || 'N/A';
          
          // Calculate weather score (percentage of passages with favorable weather)
          // This is a simplified calculation - in production you'd analyze actual weather data
          const weatherScoreResult = await this.postgres.query(
            `SELECT 
               COUNT(CASE WHEN max_wind_speed <= 25 AND max_wave_height <= 2 THEN 1 END) * 100.0 / 
               NULLIF(COUNT(*), 0) as score
             FROM passages 
             WHERE user_id = $1`,
            [userId]
          );
          const weatherScore = Math.round(parseFloat(weatherScoreResult.rows[0]?.score || '75'));
          
          res.json({
            totalPassages,
            monthlyPassages,
            totalMiles,
            favoritePort,
            weatherScore
          });
        } catch (error) {
          this.logger.error({ error }, 'Failed to fetch dashboard stats');
          res.status(500).json({ error: 'Failed to fetch dashboard stats' });
        }
      }
    );

    // Profile endpoints
    this.app.get('/api/profile',
      this.authenticateToken.bind(this),
      async (req, res) => {
        try {
          const userId = req.user!.id;

          const result = await this.postgres.query(
            `SELECT
               id, email, full_name, company_name, phone,
               subscription_tier, subscription_status,
               trial_ends_at, subscription_ends_at,
               monthly_passage_count, usage_reset_at,
               metadata, created_at, updated_at
             FROM profiles
             WHERE id = $1`,
            [userId]
          );

          if (!result.rows[0]) {
            return res.status(404).json({ error: 'Profile not found' });
          }

          res.json(result.rows[0]);
        } catch (error) {
          this.logger.error({ error }, 'Failed to fetch profile');
          res.status(500).json({ error: 'Failed to fetch profile' });
        }
      }
    );

    this.app.put('/api/profile',
      this.authenticateToken.bind(this),
      async (req, res) => {
        try {
          const userId = req.user!.id;
          const { full_name, company_name, phone, metadata } = req.body;

          const result = await this.postgres.query(
            `UPDATE profiles
             SET full_name = COALESCE($2, full_name),
                 company_name = COALESCE($3, company_name),
                 phone = COALESCE($4, phone),
                 metadata = COALESCE($5, metadata),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, email, full_name, company_name, phone,
                       subscription_tier, subscription_status,
                       metadata, updated_at`,
            [userId, full_name, company_name, phone, metadata ? JSON.stringify(metadata) : null]
          );

          if (!result.rows[0]) {
            return res.status(404).json({ error: 'Profile not found' });
          }

          res.json(result.rows[0]);
        } catch (error) {
          this.logger.error({ error }, 'Failed to update profile');
          res.status(500).json({ error: 'Failed to update profile' });
        }
      }
    );

    // Passages endpoints
    this.app.get('/api/passages',
      this.authenticateToken.bind(this),
      async (req, res) => {
        try {
          const userId = req.user.id;
          
          const result = await this.postgres.query(
            `SELECT 
               p.*,
               b.name as boat_name
             FROM passages p
             LEFT JOIN boats b ON p.boat_id = b.id
             WHERE p.user_id = $1
             ORDER BY p.departure_date DESC`,
            [userId]
          );
          
          res.json(result.rows);
        } catch (error) {
          this.logger.error({ error }, 'Failed to fetch passages');
          res.status(500).json({ error: 'Failed to fetch passages' });
        }
      }
    );

    this.app.get('/api/passages/recent',
      this.authenticateToken.bind(this),
      async (req, res) => {
        try {
          const userId = req.user.id;
          const limit = parseInt(req.query.limit as string) || 5;
          
          const result = await this.postgres.query(
            `SELECT 
               p.*,
               b.name as boat_name
             FROM passages p
             LEFT JOIN boats b ON p.boat_id = b.id
             WHERE p.user_id = $1
             ORDER BY p.created_at DESC
             LIMIT $2`,
            [userId, limit]
          );
          
          res.json(result.rows);
        } catch (error) {
          this.logger.error({ error }, 'Failed to fetch recent passages');
          res.status(500).json({ error: 'Failed to fetch recent passages' });
        }
      }
    );

    this.app.post('/api/passages',
      this.authenticateToken.bind(this),
      this.checkSubscription.bind(this),
      async (req, res) => {
        try {
          const userId = req.user.id;
          const passageData = req.body;
          
          // Check passage limits
          const canCreate = await FeatureGate.canUseFeature(
            userId,
            'create_passage',
            req.subscription
          );
          
          if (!canCreate) {
            return res.status(403).json({
              error: 'Passage limit reached',
              upgradeUrl: '/pricing',
            });
          }
          
          const result = await this.postgres.query(
            `INSERT INTO passages (
               user_id, name, departure, destination, departure_date,
               distance_nm, estimated_duration, status, weather_summary,
               boat_id, route_data
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
              userId,
              passageData.name,
              passageData.departure,
              passageData.destination,
              passageData.departureDate,
              passageData.distanceNm,
              passageData.estimatedDuration,
              passageData.status || 'draft',
              passageData.weatherSummary,
              passageData.boatId,
              JSON.stringify(passageData.routeData || {})
            ]
          );
          
          // Track usage
          await this.trackUsage(userId, 'passage_created', {
            passageId: result.rows[0].id,
            distance: passageData.distanceNm
          });
          
          res.json(result.rows[0]);
        } catch (error) {
          this.logger.error({ error }, 'Failed to create passage');
          res.status(500).json({ error: 'Failed to create passage' });
        }
      }
    );

    this.app.get('/api/passages/:passageId',
      this.authenticateToken.bind(this),
      async (req, res) => {
        try {
          const userId = req.user.id;
          const { passageId } = req.params;
          
          const result = await this.postgres.query(
            `SELECT 
               p.*,
               b.name as boat_name,
               b.type as boat_type,
               b.length as boat_length
             FROM passages p
             LEFT JOIN boats b ON p.boat_id = b.id
             WHERE p.id = $1 AND p.user_id = $2`,
            [passageId, userId]
          );
          
          if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Passage not found' });
          }
          
          res.json(result.rows[0]);
        } catch (error) {
          this.logger.error({ error }, 'Failed to fetch passage');
          res.status(500).json({ error: 'Failed to fetch passage' });
        }
      }
    );

    this.app.delete('/api/passages/:passageId',
      this.authenticateToken.bind(this),
      async (req, res) => {
        try {
          const userId = req.user.id;
          const { passageId } = req.params;
          
          const result = await this.postgres.query(
            'DELETE FROM passages WHERE id = $1 AND user_id = $2 RETURNING id',
            [passageId, userId]
          );
          
          if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Passage not found' });
          }
          
          res.json({ success: true, deletedId: passageId });
        } catch (error) {
          this.logger.error({ error }, 'Failed to delete passage');
          res.status(500).json({ error: 'Failed to delete passage' });
        }
      }
    );

    // Weather endpoints
    this.app.post('/api/weather/current',
      this.authenticateToken.bind(this),
      async (req, res) => {
        try {
          const { location, coordinates } = req.body;
          
          // Use coordinates if provided, otherwise geocode the location
          let lat, lon;
          if (coordinates) {
            lat = coordinates.lat;
            lon = coordinates.lng;
          } else {
            // Simple geocoding for common locations (in production, use a geocoding service)
            const locationMap: Record<string, { lat: number; lon: number }> = {
              'Boston, MA': { lat: 42.3601, lon: -71.0589 },
              'Boston Harbor': { lat: 42.3601, lon: -71.0589 },
              'Portland, ME': { lat: 43.6591, lon: -70.2568 },
              'Newport, RI': { lat: 41.4901, lon: -71.3128 },
              'Nantucket, MA': { lat: 41.2835, lon: -70.0995 },
              'Block Island, RI': { lat: 41.1718, lon: -71.5778 },
              'Bar Harbor, ME': { lat: 44.3876, lon: -68.2039 },
              'Provincetown, MA': { lat: 42.0570, lon: -70.1786 },
              'Gloucester, MA': { lat: 42.6159, lon: -70.6620 },
              'Marblehead, MA': { lat: 42.5001, lon: -70.8578 }
            };
            
            const coords = locationMap[location] || locationMap['Boston, MA'];
            lat = coords.lat;
            lon = coords.lon;
          }
          
          // Call the weather agent through orchestrator
          const weatherResult = await this.orchestrator.handleRequest({
            tool: 'get_marine_weather',
            arguments: {
              latitude: lat,
              longitude: lon,
              days: 1
            }
          });
          
          // Transform the weather data for the widget
          if (weatherResult && weatherResult.result) {
            const data = weatherResult.result;
            const current = data.forecasts && data.forecasts[0];
            
            const response = {
              location: location || `${lat.toFixed(2)}°N, ${Math.abs(lon).toFixed(2)}°W`,
              current: {
                temperature: current?.temperature || 68,
                feelsLike: current?.temperature ? current.temperature - 3 : 65,
                condition: current?.weather || 'Partly Cloudy',
                icon: this.getWeatherIcon(current?.weather),
                wind: {
                  speed: current?.windSpeed || 12,
                  direction: current?.windDirection || 'SW',
                  degrees: this.getWindDegrees(current?.windDirection || 'SW')
                },
                humidity: current?.humidity || 72,
                pressure: current?.pressure || 30.12,
                visibility: current?.visibility || 10,
                uvIndex: 6
              },
              marine: {
                waveHeight: current?.waveHeight || 2.5,
                wavePeriod: current?.wavePeriod || 6,
                waterTemp: current?.waterTemp || 62,
                swellDirection: current?.swellDirection || 'S'
              },
              forecast: this.generateHourlyForecast(data.forecasts || [])
            };
            
            res.json(response);
          } else {
            // Return mock data as fallback
            res.json({
              location: location || 'Boston Harbor',
              current: {
                temperature: 68,
                feelsLike: 65,
                condition: 'Partly Cloudy',
                icon: 'cloud',
                wind: { speed: 12, direction: 'SW', degrees: 225 },
                humidity: 72,
                pressure: 30.12,
                visibility: 10,
                uvIndex: 6
              },
              marine: {
                waveHeight: 2.5,
                wavePeriod: 6,
                waterTemp: 62,
                swellDirection: 'S'
              },
              forecast: [
                { time: '12:00', temperature: 70, condition: 'Sunny', windSpeed: 10, precipitation: 0 },
                { time: '15:00', temperature: 72, condition: 'Partly Cloudy', windSpeed: 12, precipitation: 0 },
                { time: '18:00', temperature: 68, condition: 'Cloudy', windSpeed: 14, precipitation: 10 },
                { time: '21:00', temperature: 64, condition: 'Light Rain', windSpeed: 16, precipitation: 30 }
              ]
            });
          }
        } catch (error) {
          this.logger.error({ error }, 'Failed to fetch weather data');
          res.status(500).json({ error: 'Failed to fetch weather data' });
        }
      }
    );

    // MCP tool proxy
    this.app.post('/api/mcp/tools/call', 
      this.authenticateToken.bind(this),
      this.checkSubscription.bind(this),
      this.rateLimiter!.limit.bind(this.rateLimiter!),
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
          
          // Orchestrate the passage planning request through agents
          try {
            const result = await this.orchestrator.handleRequest({
              tool: tool,
              arguments: args
            });
            
            res.json({
              success: true,
              result: result
            });
          } catch (error: any) {
            this.logger.error({ error, tool, args }, 'Orchestration failed');
            res.json({
              success: false,
              error: error.message || 'Failed to process request'
            });
          }
        } catch (error) {
          this.logger.error({ error }, 'Tool call failed');
          res.status(500).json({ error: 'Tool call failed' });
        }
      }
    );

    // Subscription routes
    this.app.post('/api/subscription/create-checkout-session',
      this.authenticateToken.bind(this),
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      async (req, res) => {
        try {
          const { tier, period = 'monthly' } = req.body;
          const priceId = this.getPriceId(tier, period);
          
          const session = await this.stripeService.createCheckoutSession(
            req.user.id,
            priceId,
            `${process.env.NEXT_PUBLIC_APP_URL}/profile?success=true`,
            `${process.env.NEXT_PUBLIC_APP_URL}/profile?canceled=true`,
            req.user.email
          );
          
          res.json({ sessionUrl: session.url });
        } catch (error) {
          this.logger.error({ error }, 'Checkout session creation failed');
          res.status(500).json({ error: 'Failed to create checkout session' });
        }
      }
    );

    // Stripe webhook is registered early in constructor to ensure raw body is available

    // Fleet Management Routes (Pro tier only) - Rate limited
    this.app.post('/api/fleet/create',
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const { name, description } = req.body;
          const userId = req.user!.id;
          
          // Check subscription
          const subscription = await this.getSubscription(userId);
          if (!subscription || subscription.tier !== 'pro') {
            return res.status(403).json({ error: 'Fleet management requires Pro subscription' });
          }
          
          // Check if user already has a fleet
          const existing = await this.postgres.query(
            'SELECT id FROM fleets WHERE owner_id = $1',
            [userId]
          );
          
          if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Fleet already exists' });
          }
          
          const result = await this.postgres.query(
            `INSERT INTO fleets (owner_id, name, description) 
             VALUES ($1, $2, $3) 
             RETURNING *`,
            [userId, name, description]
          );
          
          // Add owner as admin member
          await this.postgres.query(
            `INSERT INTO fleet_members (fleet_id, user_id, role) 
             VALUES ($1, $2, 'admin')`,
            [result.rows[0].id, userId]
          );
          
          res.json(result.rows[0]);
        } catch (error) {
          this.logger.error({ error }, 'Failed to create fleet');
          res.status(500).json({ error: 'Failed to create fleet' });
        }
      }
    );

    this.app.get('/api/fleet',
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const userId = req.user!.id;
          
          const result = await this.postgres.query(
            `SELECT f.*, fm.role 
             FROM fleets f
             JOIN fleet_members fm ON f.id = fm.fleet_id
             WHERE fm.user_id = $1`,
            [userId]
          );
          
          if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No fleet found' });
          }
          
          res.json(result.rows[0]);
        } catch (error) {
          this.logger.error({ error }, 'Failed to get fleet');
          res.status(500).json({ error: 'Failed to get fleet' });
        }
      }
    );

    this.app.post('/api/fleet/:fleetId/vessels',
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const { fleetId } = req.params;
          const userId = req.user!.id;
          const vesselData = req.body;
          
          // Verify user has admin access
          const access = await this.postgres.query(
            `SELECT role FROM fleet_members 
             WHERE fleet_id = $1 AND user_id = $2 AND role IN ('admin', 'captain')`,
            [fleetId, userId]
          );
          
          if (access.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
          }
          
          const result = await this.postgres.query(
            `INSERT INTO fleet_vessels (fleet_id, name, type, length, beam, draft, registration, home_port) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [fleetId, vesselData.name, vesselData.type, vesselData.length, vesselData.beam, 
             vesselData.draft, vesselData.registration, vesselData.homePort]
          );
          
          res.json(result.rows[0]);
        } catch (error) {
          this.logger.error({ error }, 'Failed to add vessel');
          res.status(500).json({ error: 'Failed to add vessel' });
        }
      }
    );

    this.app.get('/api/fleet/:fleetId/analytics',
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const { fleetId } = req.params;
          const userId = req.user!.id;
          const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = req.query;
          
          // Verify access
          const access = await this.postgres.query(
            'SELECT role FROM fleet_members WHERE fleet_id = $1 AND user_id = $2',
            [fleetId, userId]
          );
          
          if (access.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
          }
          
          // Get fleet analytics
          const analytics = await this.postgres.query(
            `SELECT 
               COUNT(DISTINCT fp.id) as total_passages,
               COUNT(DISTINCT fp.vessel_id) as active_vessels,
               AVG(fp.distance_nm) as avg_distance,
               SUM(fp.distance_nm) as total_distance,
               COUNT(DISTINCT fm.user_id) as active_members
             FROM fleet_passages fp
             JOIN fleet_members fm ON fm.fleet_id = fp.fleet_id
             WHERE fp.fleet_id = $1 
               AND fp.created_at BETWEEN $2 AND $3`,
            [fleetId, startDate, endDate]
          );
          
          res.json(analytics.rows[0]);
        } catch (error) {
          this.logger.error({ error }, 'Failed to get analytics');
          res.status(500).json({ error: 'Failed to get analytics' });
        }
      }
    );

    // Agent Management Routes
    // Public health check - minimal info only (no sensitive details)
    this.app.get('/api/agents/health', async (req, res) => {
      try {
        const health = await this.agentManager.getHealthSummary();
        // Return only high-level status for public endpoint
        res.json({
          status: health.overallStatus || 'unknown',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ status: 'error', timestamp: new Date().toISOString() });
      }
    });

    // Detailed health check - requires authentication
    this.app.get('/api/agents/health/detailed',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          // Check if user is admin
          const userResult = await this.postgres.query(
            'SELECT role FROM users WHERE id = $1',
            [req.user!.id]
          );

          if (!userResult.rows[0] || userResult.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
          }

          const health = await this.agentManager.getHealthSummary();
          res.json(health);
        } catch (error) {
          res.status(500).json({ error: 'Failed to get health summary' });
        }
      }
    );

    // Agent status - requires authentication (admin only)
    this.app.get('/api/agents/:agentId/status',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          // Check if user is admin
          const userResult = await this.postgres.query(
            'SELECT role FROM users WHERE id = $1',
            [req.user!.id]
          );

          if (!userResult.rows[0] || userResult.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
          }

          const { agentId } = req.params;
          const status = await this.agentManager.getAgentStatus(agentId);

          if (!status) {
            return res.status(404).json({ error: 'Agent not found' });
          }

          res.json(status);
        } catch (error) {
          res.status(500).json({ error: 'Failed to get agent status' });
        }
      }
    );

    this.app.post('/api/agents/:agentId/restart',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const { agentId } = req.params;
          
          // Check if user is admin by querying the database
          const userResult = await this.postgres.query(
            'SELECT role FROM users WHERE id = $1',
            [req.user!.id]
          );
          
          if (!userResult.rows[0] || userResult.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
          }
          
          await this.agentManager.restartAgent(agentId);
          res.json({ message: `Agent ${agentId} restart initiated` });
        } catch (error: any) {
          res.status(500).json({ error: error.message || 'Failed to restart agent' });
        }
      }
    );

    // API Key Management
    this.app.get('/api/user/api-key',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const userId = req.user!.id;

          // SECURITY: We only store hashes now, so we can only confirm key exists
          const result = await this.postgres.query(
            `SELECT id, name, created_at, last_used_at, expires_at
             FROM api_keys WHERE user_id = $1 AND active = true`,
            [userId]
          );

          if (result.rows.length > 0) {
            const keyInfo = result.rows[0];
            res.json({
              hasActiveKey: true,
              keyInfo: {
                name: keyInfo.name,
                createdAt: keyInfo.created_at,
                lastUsedAt: keyInfo.last_used_at,
                expiresAt: keyInfo.expires_at
              },
              message: 'API key exists but cannot be retrieved. Generate a new one if needed.'
            });
          } else {
            res.json({ hasActiveKey: false, apiKey: null });
          }
        } catch (error) {
          this.logger.error({ error }, 'Failed to fetch API key');
          res.status(500).json({ error: 'Failed to fetch API key' });
        }
      }
    );

    this.app.post('/api/user/api-key/generate',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const userId = req.user!.id;

          // Check subscription
          const subscription = await this.getSubscription(userId);
          if (!subscription || (subscription.tier !== 'pro' && subscription.tier !== 'enterprise')) {
            return res.status(403).json({ error: 'API access requires Pro subscription' });
          }

          // Deactivate existing keys
          await this.postgres.query(
            'UPDATE api_keys SET active = false WHERE user_id = $1',
            [userId]
          );

          // Generate new key
          const apiKey = `pk_${Buffer.from(crypto.randomBytes(32)).toString('hex')}`;

          // SECURITY: Store HMAC-SHA256 hash, not plaintext
          // Use API_KEY_SECRET or JWT_SECRET as HMAC key to prevent rainbow table attacks
          const apiKeySecret = process.env.API_KEY_SECRET || process.env.JWT_SECRET || '';
          const keyHash = crypto
            .createHmac('sha256', apiKeySecret)
            .update(apiKey)
            .digest('hex');

          await this.postgres.query(
            `INSERT INTO api_keys (user_id, key_hash, name, scopes, rate_limit)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, keyHash, 'Primary API Key', ['read', 'write'], 1000]
          );

          // Return plaintext key to user ONCE - they must store it securely
          res.json({ apiKey, warning: 'Store this key securely. It cannot be retrieved again.' });
        } catch (error) {
          this.logger.error({ error }, 'Failed to generate API key');
          res.status(500).json({ error: 'Failed to generate API key' });
        }
      }
    );

    // Admin Routes
    const adminGuard = createAdminGuard(this.logger)

    this.app.get('/api/admin/verify',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      adminGuard,
      async (req, res) => {
        try {
          const userId = req.user!.id;
          
          const result = await this.postgres.query(
            'SELECT id, email, role, subscription_tier FROM users WHERE id = $1',
            [userId]
          );
          
          if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
          }
          
          res.json({ user: result.rows[0] });
        } catch (error) {
          res.status(500).json({ error: 'Failed to verify admin access' });
        }
      }
    );

    this.app.get('/api/admin/metrics/overview',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      adminGuard,
      async (req, res) => {
        try {
          // Mock data for now - would integrate with real metrics
          const metrics = {
            revenue: {
              mrr: 12500,
              arr: 150000,
              growth: 15.5,
              churn: 2.1
            },
            users: {
              total: 450,
              paid: 125,
              trial: 45,
              active: 320,
              newThisMonth: 38,
              churnedThisMonth: 5
            },
            usage: {
              passagesPlanned: 1250,
              apiCallsToday: 8500,
              activeAgents: 6,
              avgResponseTime: 245
            },
            health: {
              uptime: 99.95,
              errorRate: 0.12,
              queueDepth: 15
            }
          };
          
          const revenueChart = [
            { month: 'Jan', mrr: 8000, arr: 96000 },
            { month: 'Feb', mrr: 9200, arr: 110400 },
            { month: 'Mar', mrr: 10500, arr: 126000 },
            { month: 'Apr', mrr: 11800, arr: 141600 },
            { month: 'May', mrr: 12500, arr: 150000 }
          ];
          
          const userChart = [
            { month: 'Jan', new: 25, churned: 3 },
            { month: 'Feb', new: 32, churned: 4 },
            { month: 'Mar', new: 28, churned: 2 },
            { month: 'Apr', new: 35, churned: 6 },
            { month: 'May', new: 38, churned: 5 }
          ];
          
          res.json({ metrics, revenueChart, userChart });
        } catch (error) {
          res.status(500).json({ error: 'Failed to fetch metrics' });
        }
      }
    );

    // Agent registration - requires admin authentication
    this.app.post('/api/agents/register',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          // Check if user is admin
          const userResult = await this.postgres.query(
            'SELECT role FROM users WHERE id = $1',
            [req.user!.id]
          );

          if (!userResult.rows[0] || userResult.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required for agent registration' });
          }

          const agentSummary = req.body;
          this.orchestrator.emit('agent:register', agentSummary);
          res.json({ success: true });
        } catch (error) {
          res.status(500).json({ error: 'Registration failed' });
        }
      }
    );

    // =====================================
    // MISSING API IMPLEMENTATIONS
    // =====================================

    // Stripe Customer Portal - allows users to manage subscriptions
    this.app.post('/api/subscription/customer-portal',
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const userId = req.user!.id;
          const { returnUrl } = req.body;

          // Get user's Stripe customer ID from subscription
          const subscription = await this.postgres.query(
            'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
            [userId]
          );

          if (!subscription.rows[0]?.stripe_customer_id) {
            return res.status(404).json({
              error: 'No subscription found',
              message: 'You need an active subscription to access the customer portal'
            });
          }

          const { StripeService } = await import('@passage-planner/shared');
          const stripeService = new StripeService(this.logger);

          const session = await stripeService.createPortalSession(
            subscription.rows[0].stripe_customer_id,
            returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/profile`
          );

          res.json({ url: session.url, success: true });
        } catch (error) {
          this.logger.error({ error }, 'Failed to create customer portal session');
          res.status(500).json({ error: 'Failed to create customer portal session' });
        }
      }
    );

    // Passage Export - export a single passage in various formats
    this.app.post('/api/passages/:passageId/export',
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const userId = req.user!.id;
          const { passageId } = req.params;
          const { format } = req.body; // 'gpx', 'kml', 'pdf', 'csv'

          // Get passage data
          const result = await this.postgres.query(
            'SELECT * FROM passages WHERE id = $1 AND user_id = $2',
            [passageId, userId]
          );

          if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Passage not found' });
          }

          const passage = result.rows[0];

          // Generate export based on format
          let exportData: string;
          let contentType: string;
          let filename: string;

          switch (format) {
            case 'gpx':
              exportData = this.generateGPX(passage);
              contentType = 'application/gpx+xml';
              filename = `passage-${passageId}.gpx`;
              break;
            case 'kml':
              exportData = this.generateKML(passage);
              contentType = 'application/vnd.google-earth.kml+xml';
              filename = `passage-${passageId}.kml`;
              break;
            case 'csv':
              exportData = this.generateCSV(passage);
              contentType = 'text/csv';
              filename = `passage-${passageId}.csv`;
              break;
            default:
              return res.status(400).json({ error: 'Invalid export format. Use gpx, kml, or csv' });
          }

          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.send(exportData);
        } catch (error) {
          this.logger.error({ error }, 'Failed to export passage');
          res.status(500).json({ error: 'Failed to export passage' });
        }
      }
    );

    // Bulk Passage Export
    this.app.post('/api/passages/export/bulk',
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const userId = req.user!.id;
          const { passageIds, format } = req.body;

          if (!passageIds || !Array.isArray(passageIds) || passageIds.length === 0) {
            return res.status(400).json({ error: 'No passages selected for export' });
          }

          if (passageIds.length > 50) {
            return res.status(400).json({ error: 'Maximum 50 passages can be exported at once' });
          }

          // Get all selected passages
          const result = await this.postgres.query(
            'SELECT * FROM passages WHERE id = ANY($1) AND user_id = $2',
            [passageIds, userId]
          );

          if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No passages found' });
          }

          // Generate combined export
          let exportData: string;
          let contentType: string;
          let filename: string;

          switch (format) {
            case 'gpx':
              exportData = this.generateBulkGPX(result.rows);
              contentType = 'application/gpx+xml';
              filename = `passages-export-${Date.now()}.gpx`;
              break;
            case 'csv':
              exportData = this.generateBulkCSV(result.rows);
              contentType = 'text/csv';
              filename = `passages-export-${Date.now()}.csv`;
              break;
            default:
              return res.status(400).json({ error: 'Invalid export format. Use gpx or csv for bulk export' });
          }

          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.send(exportData);
        } catch (error) {
          this.logger.error({ error }, 'Failed to bulk export passages');
          res.status(500).json({ error: 'Failed to export passages' });
        }
      }
    );

    // Passage Cancellation - cancel an in-progress passage planning request
    this.app.post('/api/passages/:passageId/cancel',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const userId = req.user!.id;
          const { passageId } = req.params;

          // Update passage status to cancelled
          const result = await this.postgres.query(
            `UPDATE passages SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1 AND user_id = $2 AND status IN ('planning', 'pending')
             RETURNING id, status`,
            [passageId, userId]
          );

          if (result.rows.length === 0) {
            return res.status(404).json({
              error: 'Passage not found or cannot be cancelled'
            });
          }

          // Emit cancellation event to orchestrator
          this.orchestrator.emit('passage:cancel', { passageId, userId });

          res.json({
            success: true,
            passageId: result.rows[0].id,
            status: 'cancelled'
          });
        } catch (error) {
          this.logger.error({ error }, 'Failed to cancel passage');
          res.status(500).json({ error: 'Failed to cancel passage' });
        }
      }
    );

    // Fleet Crew Invitations
    this.app.post('/api/fleet/:fleetId/invite',
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const userId = req.user!.id;
          const { fleetId } = req.params;
          const { invites } = req.body; // Array of { email, name, role, permissions }

          // Verify user has admin access to fleet
          const access = await this.postgres.query(
            `SELECT role FROM fleet_members
             WHERE fleet_id = $1 AND user_id = $2 AND role = 'admin'`,
            [fleetId, userId]
          );

          if (access.rows.length === 0) {
            return res.status(403).json({ error: 'Admin access required to invite crew' });
          }

          if (!invites || !Array.isArray(invites) || invites.length === 0) {
            return res.status(400).json({ error: 'No invitations provided' });
          }

          if (invites.length > 10) {
            return res.status(400).json({ error: 'Maximum 10 invitations at once' });
          }

          // Get fleet name and inviter info for emails
          const fleetResult = await this.postgres.query(
            'SELECT name FROM fleets WHERE id = $1',
            [fleetId]
          );
          const fleetName = fleetResult.rows[0]?.name || 'Fleet';

          const inviterResult = await this.postgres.query(
            'SELECT email, full_name FROM profiles WHERE id = $1',
            [userId]
          );
          const inviterName = inviterResult.rows[0]?.full_name || inviterResult.rows[0]?.email || 'A fleet admin';

          const results = [];

          for (const invite of invites) {
            if (!invite.email || !invite.name) continue;

            try {
              // Generate unique invitation token
              const token = crypto.randomBytes(32).toString('hex');

              // Create invitation record with token
              const inviteResult = await this.postgres.query(
                `INSERT INTO fleet_invitations
                 (fleet_id, email, name, role, permissions, invited_by, token, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days')
                 ON CONFLICT (fleet_id, email) DO UPDATE SET
                   name = EXCLUDED.name,
                   role = EXCLUDED.role,
                   permissions = EXCLUDED.permissions,
                   invited_by = EXCLUDED.invited_by,
                   token = EXCLUDED.token,
                   expires_at = NOW() + INTERVAL '7 days',
                   created_at = NOW()
                 RETURNING id, email, token`,
                [fleetId, invite.email, invite.name, invite.role || 'crew',
                 JSON.stringify(invite.permissions || {}), userId, token]
              );

              const invitationToken = inviteResult.rows[0].token;

              // Send invitation email
              try {
                await emailService.sendFleetInvitationEmail(
                  invite.email,
                  invite.name,
                  fleetName,
                  inviterName,
                  invite.role || 'crew',
                  invitationToken
                );
              } catch (emailErr) {
                this.logger.warn({ error: emailErr, email: invite.email }, 'Failed to send invitation email, but invitation was created');
              }

              results.push({
                email: invite.email,
                success: true,
                invitationId: inviteResult.rows[0].id
              });

              this.logger.info({
                fleetId,
                email: invite.email,
                invitedBy: userId
              }, 'Fleet invitation created and email sent');

            } catch (err) {
              results.push({
                email: invite.email,
                success: false,
                error: 'Failed to create invitation'
              });
            }
          }

          res.json({
            success: true,
            invitations: results,
            sent: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
          });
        } catch (error) {
          this.logger.error({ error }, 'Failed to send fleet invitations');
          res.status(500).json({ error: 'Failed to send invitations' });
        }
      }
    );

    // Accept fleet invitation
    this.app.post('/api/fleet/invitations/:token/accept',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const userId = req.user!.id;
          const { token } = req.params;

          // Get invitation by token
          const inviteResult = await this.postgres.query(
            `SELECT fi.*, f.name as fleet_name, u.email as inviter_email
             FROM fleet_invitations fi
             JOIN fleets f ON f.id = fi.fleet_id
             LEFT JOIN users u ON u.id = fi.invited_by
             WHERE fi.token = $1
               AND fi.expires_at > NOW()
               AND fi.accepted_at IS NULL`,
            [token]
          );

          if (inviteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invitation not found or expired' });
          }

          const invite = inviteResult.rows[0];

          // Verify user email matches invitation
          const userResult = await this.postgres.query(
            'SELECT email FROM users WHERE id = $1',
            [userId]
          );

          if (userResult.rows[0]?.email !== invite.email) {
            return res.status(403).json({
              error: 'This invitation was sent to a different email address'
            });
          }

          // Add user to fleet_members
          await this.postgres.query(
            `INSERT INTO fleet_members (fleet_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (fleet_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
            [invite.fleet_id, userId, invite.role]
          );

          // Mark invitation as accepted
          await this.postgres.query(
            `UPDATE fleet_invitations
             SET accepted_at = NOW()
             WHERE token = $1`,
            [token]
          );

          this.logger.info({
            fleetId: invite.fleet_id,
            userId,
            role: invite.role
          }, 'Fleet invitation accepted');

          res.json({
            success: true,
            message: `Successfully joined ${invite.fleet_name}`,
            fleet: {
              id: invite.fleet_id,
              name: invite.fleet_name,
              role: invite.role
            }
          });
        } catch (error) {
          this.logger.error({ error }, 'Failed to accept fleet invitation');
          res.status(500).json({ error: 'Failed to accept invitation' });
        }
      }
    );

    // Reject fleet invitation
    this.app.post('/api/fleet/invitations/:token/reject',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const userId = req.user!.id;
          const { token } = req.params;

          // Get invitation by token
          const inviteResult = await this.postgres.query(
            `SELECT fi.*, f.name as fleet_name
             FROM fleet_invitations fi
             JOIN fleets f ON f.id = fi.fleet_id
             WHERE fi.token = $1
               AND fi.expires_at > NOW()
               AND fi.accepted_at IS NULL`,
            [token]
          );

          if (inviteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invitation not found or expired' });
          }

          const invite = inviteResult.rows[0];

          // Verify user email matches invitation
          const userResult = await this.postgres.query(
            'SELECT email FROM users WHERE id = $1',
            [userId]
          );

          if (userResult.rows[0]?.email !== invite.email) {
            return res.status(403).json({
              error: 'This invitation was sent to a different email address'
            });
          }

          // Delete the invitation (or mark as rejected if you want to track)
          await this.postgres.query(
            `DELETE FROM fleet_invitations WHERE token = $1`,
            [token]
          );

          this.logger.info({
            fleetId: invite.fleet_id,
            userId,
            email: invite.email
          }, 'Fleet invitation rejected');

          res.json({
            success: true,
            message: `Declined invitation to ${invite.fleet_name}`
          });
        } catch (error) {
          this.logger.error({ error }, 'Failed to reject fleet invitation');
          res.status(500).json({ error: 'Failed to reject invitation' });
        }
      }
    );

    // Agent Start - start a stopped agent (admin only)
    this.app.post('/api/agents/:agentId/start',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          // Check if user is admin
          const userResult = await this.postgres.query(
            'SELECT role FROM users WHERE id = $1',
            [req.user!.id]
          );

          if (!userResult.rows[0] || userResult.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
          }

          const { agentId } = req.params;
          await this.agentManager.startAgent(agentId);

          res.json({
            success: true,
            message: `Agent ${agentId} start initiated`,
            agentId
          });
        } catch (error: any) {
          res.status(500).json({ error: error.message || 'Failed to start agent' });
        }
      }
    );

    // Agent Stop - stop a running agent (admin only)
    this.app.post('/api/agents/:agentId/stop',
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          // Check if user is admin
          const userResult = await this.postgres.query(
            'SELECT role FROM users WHERE id = $1',
            [req.user!.id]
          );

          if (!userResult.rows[0] || userResult.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
          }

          const { agentId } = req.params;
          await this.agentManager.stopAgent(agentId);

          res.json({
            success: true,
            message: `Agent ${agentId} stop initiated`,
            agentId
          });
        } catch (error: any) {
          res.status(500).json({ error: error.message || 'Failed to stop agent' });
        }
      }
    );

    // Weather Export - export weather data for a region
    this.app.post('/api/weather/export',
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      this.authMiddleware.authenticate.bind(this.authMiddleware),
      async (req, res) => {
        try {
          const { region, format, layer } = req.body;

          if (!region || !region.bounds) {
            return res.status(400).json({ error: 'Region bounds required' });
          }

          // Get weather data for the region
          const { NOAAWeatherService, CacheManager } = await import('@passage-planner/shared');
          const cache = new CacheManager(this.logger);
          const weatherService = new NOAAWeatherService(cache, this.logger);

          const centerLat = (region.bounds.north + region.bounds.south) / 2;
          const centerLon = (region.bounds.east + region.bounds.west) / 2;

          const forecast = await weatherService.getMarineForecast(centerLat, centerLon, 7);

          // Generate export based on format
          let exportData: string;
          let contentType: string;
          let filename: string;

          switch (format) {
            case 'json':
              exportData = JSON.stringify(forecast, null, 2);
              contentType = 'application/json';
              filename = `weather-${Date.now()}.json`;
              break;
            case 'csv':
              exportData = this.generateWeatherCSV(forecast);
              contentType = 'text/csv';
              filename = `weather-${Date.now()}.csv`;
              break;
            default:
              return res.status(400).json({ error: 'Invalid format. Use json or csv' });
          }

          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.send(exportData);
        } catch (error) {
          this.logger.error({ error }, 'Failed to export weather data');
          res.status(500).json({ error: 'Failed to export weather data' });
        }
      }
    );

    // Frontend error logging endpoint - rate limited to prevent abuse
    this.app.post('/api/errors/log',
      this.rateLimiter!.limit.bind(this.rateLimiter!),
      async (req, res) => {
        try {
        const { message, stack, componentStack, timestamp, userAgent, url } = req.body;
        
        this.logger.error({
          type: 'frontend_error',
          message,
          stack,
          componentStack,
          timestamp,
          userAgent,
          url,
          correlationId: (req as any).correlationId || 'unknown',
        });
        
        // Send to Sentry for error tracking
        const { captureError } = await import('./sentry');
        captureError(new Error(message), {
          tags: {
            source: 'frontend',
            component: componentStack?.split('\n')[1]?.trim() || 'unknown'
          },
          extra: {
            stack,
            componentStack,
            url,
            userAgent,
            correlationId: (req as any).correlationId
          },
          user: req.user ? { id: req.user.id, email: req.user.email } : undefined
        });
        
        res.status(200).json({ success: true });
      } catch (err) {
        this.logger.error('Failed to log frontend error:', err);
        res.status(500).json({ error: 'Failed to log error' });
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

  private getWeatherIcon(condition: string): 'sun' | 'cloud' | 'rain' | 'snow' | 'drizzle' {
    const conditionLower = (condition || '').toLowerCase();
    if (conditionLower.includes('rain')) return 'rain';
    if (conditionLower.includes('snow')) return 'snow';
    if (conditionLower.includes('drizzle')) return 'drizzle';
    if (conditionLower.includes('clear') || conditionLower.includes('sunny')) return 'sun';
    return 'cloud';
  }

  private getWindDegrees(direction: string): number {
    const directionMap: Record<string, number> = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
    };
    return directionMap[direction] || 0;
  }

  private generateHourlyForecast(forecasts: any[]): any[] {
    const hours = [3, 6, 9, 12];
    return hours.map((hour, idx) => {
      const forecast = forecasts[Math.min(idx, forecasts.length - 1)];
      const baseTime = new Date();
      baseTime.setHours(baseTime.getHours() + hour);
      
      return {
        time: baseTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        temperature: forecast?.temperature || (68 + Math.random() * 8),
        condition: forecast?.weather || 'Partly Cloudy',
        windSpeed: forecast?.windSpeed || (10 + Math.random() * 10),
        precipitation: forecast?.precipitation || (Math.random() * 30)
      };
    });
  }

  // =====================================
  // EXPORT HELPER METHODS
  // =====================================

  private generateGPX(passage: any): string {
    const waypoints = passage.waypoints || [];
    const name = passage.name || 'Passage';
    const description = passage.description || '';

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Helmwise Passage Planner"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${this.escapeXML(name)}</name>
    <desc>${this.escapeXML(description)}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <rte>
    <name>${this.escapeXML(name)}</name>
    <desc>${this.escapeXML(description)}</desc>
`;

    waypoints.forEach((wp: any, idx: number) => {
      gpx += `    <rtept lat="${wp.latitude || wp.lat}" lon="${wp.longitude || wp.lon}">
      <name>${this.escapeXML(wp.name || `Waypoint ${idx + 1}`)}</name>
      <desc>${this.escapeXML(wp.notes || '')}</desc>
    </rtept>\n`;
    });

    gpx += `  </rte>
</gpx>`;

    return gpx;
  }

  private generateKML(passage: any): string {
    const waypoints = passage.waypoints || [];
    const name = passage.name || 'Passage';

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${this.escapeXML(name)}</name>
    <description>Generated by Helmwise Passage Planner</description>
    <Style id="routeStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3</width>
      </LineStyle>
    </Style>
`;

    // Add placemarks for waypoints
    waypoints.forEach((wp: any, idx: number) => {
      kml += `    <Placemark>
      <name>${this.escapeXML(wp.name || `Waypoint ${idx + 1}`)}</name>
      <Point>
        <coordinates>${wp.longitude || wp.lon},${wp.latitude || wp.lat},0</coordinates>
      </Point>
    </Placemark>\n`;
    });

    // Add route line
    if (waypoints.length > 1) {
      kml += `    <Placemark>
      <name>Route</name>
      <styleUrl>#routeStyle</styleUrl>
      <LineString>
        <coordinates>`;
      waypoints.forEach((wp: any) => {
        kml += `${wp.longitude || wp.lon},${wp.latitude || wp.lat},0 `;
      });
      kml += `</coordinates>
      </LineString>
    </Placemark>\n`;
    }

    kml += `  </Document>
</kml>`;

    return kml;
  }

  private generateCSV(passage: any): string {
    const waypoints = passage.waypoints || [];
    let csv = 'Waypoint,Name,Latitude,Longitude,Notes\n';

    waypoints.forEach((wp: any, idx: number) => {
      csv += `${idx + 1},"${wp.name || ''}",${wp.latitude || wp.lat},${wp.longitude || wp.lon},"${wp.notes || ''}"\n`;
    });

    return csv;
  }

  private generateBulkGPX(passages: any[]): string {
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Helmwise Passage Planner"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Passage Export</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

    passages.forEach((passage) => {
      const waypoints = passage.waypoints || [];
      gpx += `  <rte>
    <name>${this.escapeXML(passage.name || 'Passage')}</name>
`;
      waypoints.forEach((wp: any, idx: number) => {
        gpx += `    <rtept lat="${wp.latitude || wp.lat}" lon="${wp.longitude || wp.lon}">
      <name>${this.escapeXML(wp.name || `Waypoint ${idx + 1}`)}</name>
    </rtept>\n`;
      });
      gpx += `  </rte>\n`;
    });

    gpx += `</gpx>`;
    return gpx;
  }

  private generateBulkCSV(passages: any[]): string {
    let csv = 'Passage ID,Passage Name,Departure,Destination,Status,Distance,Duration,Created\n';

    passages.forEach((p) => {
      csv += `"${p.id}","${p.name || ''}","${p.departure_port || ''}","${p.destination_port || ''}","${p.status || ''}",${p.distance || 0},"${p.estimated_duration || ''}","${p.created_at || ''}"\n`;
    });

    return csv;
  }

  private generateWeatherCSV(forecast: any): string {
    let csv = 'Time,Temperature,Wind Speed,Wind Direction,Short Forecast,Precipitation %\n';

    if (forecast.periods) {
      forecast.periods.forEach((p: any) => {
        csv += `"${p.startTime}",${p.temperature},"${p.windSpeed}","${p.windDirection}","${(p.shortForecast || '').replace(/"/g, '""')}",${p.precipitationChance || 0}\n`;
      });
    }

    return csv;
  }

  private escapeXML(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
  
  server.start().catch((error) => {
    startupLogger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  });
} 