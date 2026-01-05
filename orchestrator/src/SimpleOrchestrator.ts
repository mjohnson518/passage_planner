// Simplified orchestrator without MCP SDK (HTTP + WebSocket only)
import Redis from 'ioredis';
import { WeatherAgent } from '../../agents/weather/src/index';
import { TidalAgent } from '../../agents/tidal/src/index';
import { RouteAgent } from '../../agents/route/src';
import { SafetyAgent } from '../../agents/safety/src/index';
import { BaseAgent } from '@passage-planner/shared';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import http from 'http';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface AgentRegistry {
  [key: string]: BaseAgent | SafetyAgent;
}

export class SimpleOrchestrator {
  private agents: AgentRegistry = {};
  private redis: Redis;
  private wss: WebSocketServer;
  private httpServer: http.Server;
  private app: express.Application;
  
  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        'FATAL: REDIS_URL environment variable is required. ' +
        'Cannot start orchestrator without Redis configured.'
      );
    }
    
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null // Don't retry if Redis is down
    });
    
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });
    
    this.initializeAgents();
    this.setupWebSocket();
    this.setupHttpServer();
  }

  private async initializeAgents() {
    logger.info('Initializing agents...');

    // Initialize all four agents - including CRITICAL SafetyAgent
    this.agents['weather'] = new WeatherAgent();
    logger.info('Weather agent initialized');

    this.agents['tidal'] = new TidalAgent();
    logger.info('Tidal agent initialized');

    // RouteAgent now working with geolib (no more Turf.js ESM issues)
    this.agents['route'] = new RouteAgent();
    logger.info('Route agent initialized');

    // CRITICAL: SafetyAgent for hazard detection, depth checks, and safety warnings
    // This is life-safety infrastructure - never skip safety checks
    this.agents['safety'] = new SafetyAgent();
    await (this.agents['safety'] as SafetyAgent).initialize();
    logger.info('Safety agent initialized - CRITICAL for mariner safety');

    logger.info('All agents initialized');
  }

  private async planPassage(request: any): Promise<any> {
    const planningId = uuidv4();
    const startTime = Date.now();
    
    // Broadcast planning start
    this.broadcastUpdate({
      type: 'planning_started',
      planningId,
      request
    });
    
    logger.info({ planningId, request }, 'Starting passage planning with PARALLEL execution');

    try {
      // PARALLEL EXECUTION - All agents at once for <3 second response!
      logger.info({ planningId }, 'Executing all agents in parallel');
      
      // Prepare all agent calls with timeout protection
      const agentTimeout = 30000; // 30 second timeout
      
      const routePromise = Promise.race([
        this.agents['route'].callTool('calculate_route', {
          startLat: request.departure.latitude,
          startLon: request.departure.longitude,
          endLat: request.destination.latitude,
          endLon: request.destination.longitude,
          speed: request.vessel?.cruiseSpeed || 5
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Route calculation timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Route agent error');
        // Fallback to simple calculation
        const distance = this.calculateSimpleDistance(
          request.departure.latitude,
          request.departure.longitude,
          request.destination.latitude,
          request.destination.longitude
        );
        return {
          waypoints: [request.departure, request.destination],
          totalDistance: distance,
          estimatedDuration: distance / (request.vessel?.cruiseSpeed || 5)
        };
      });
      
      const weatherDeparturePromise = Promise.race([
        this.agents['weather'].callTool('get_marine_weather', {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
          days: 3
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Weather fetch timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Weather departure error');
        return null;
      });
      
      const weatherArrivalPromise = Promise.race([
        this.agents['weather'].callTool('get_marine_weather', {
          latitude: request.destination.latitude,
          longitude: request.destination.longitude,
          days: 3
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Weather fetch timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Weather arrival error');
        return null;
      });
      
      const tidalDeparturePromise = Promise.race([
        this.agents['tidal'].callTool('get_tides', {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
          startDate: request.departure.time || new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tidal fetch timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Tidal departure error');
        return null;
      });
      
      const tidalArrivalPromise = Promise.race([
        this.agents['tidal'].callTool('get_tides', {
          latitude: request.destination.latitude,
          longitude: request.destination.longitude,
          startDate: request.departure.time || new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tidal fetch timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Tidal arrival error');
        return null;
      });

      // CRITICAL: Safety Agent checks - LIFE SAFETY INFRASTRUCTURE
      // These checks detect hazards, verify depths, and provide safety warnings
      const routeWaypoints = [
        { latitude: request.departure.latitude, longitude: request.departure.longitude },
        { latitude: request.destination.latitude, longitude: request.destination.longitude }
      ];

      const safetyRoutePromise = Promise.race([
        this.agents['safety'].callTool('check_route_safety', {
          route: routeWaypoints,
          departure_time: request.departure.time || new Date().toISOString(),
          vessel_draft: request.vessel?.draft || 6
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Safety check timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Safety route check error - CRITICAL');
        // Return empty safety result but log as critical error
        return { warnings: [], hazards: [], recommendations: ['Safety check failed - exercise extreme caution'] };
      });

      const safetyBriefPromise = Promise.race([
        this.agents['safety'].callTool('generate_safety_brief', {
          departure_port: request.departure.name || 'Unknown',
          destination_port: request.destination.name || 'Unknown',
          route_distance: 0, // Will be updated after route calculation
          estimated_duration: '0h',
          crew_size: request.crew?.size || 2,
          vessel_type: request.vessel?.type || 'sailboat'
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Safety brief timeout')), agentTimeout)
        )
      ]).catch(error => {
        logger.error({ error }, 'Safety brief generation error');
        return null;
      });

      // EXECUTE ALL IN PARALLEL - THIS IS THE KEY!
      // Including CRITICAL safety checks in parallel execution
      const parallelStart = Date.now();
      const [route, weatherDeparture, weatherArrival, tidalDeparture, tidalArrival, safetyRoute, safetyBrief] = await Promise.all([
        routePromise,
        weatherDeparturePromise,
        weatherArrivalPromise,
        tidalDeparturePromise,
        tidalArrivalPromise,
        safetyRoutePromise,
        safetyBriefPromise
      ]);

      const parallelTime = Date.now() - parallelStart;
      logger.info({ parallelTime, planningId }, 'All agents completed in parallel execution (including safety)');
      
      // Extract safety warnings from safety route check
      const safetyWarnings = this.extractSafetyWarnings(safetyRoute);

      // Compile comprehensive passage plan
      const passagePlan = {
        id: planningId,
        request,
        route,
        weather: {
          departure: weatherDeparture,
          arrival: weatherArrival
        },
        tides: {
          departure: tidalDeparture,
          arrival: tidalArrival
        },
        // CRITICAL: Safety data for mariner awareness
        safety: {
          routeAnalysis: safetyRoute,
          brief: safetyBrief,
          warnings: safetyWarnings,
          disclaimer: 'This safety analysis is advisory only. Skipper retains ultimate responsibility for vessel safety.'
        },
        summary: {
          totalDistance: route.totalDistance,
          estimatedDuration: route.estimatedDuration,
          departureTime: request.departure.time,
          estimatedArrival: new Date(
            new Date(request.departure.time || Date.now()).getTime() +
            route.estimatedDuration * 60 * 60 * 1000
          ),
          // Combine weather AND safety warnings
          warnings: [
            ...this.generateWarnings([weatherDeparture, weatherArrival]),
            ...safetyWarnings
          ],
          recommendations: this.generateRecommendations([weatherDeparture, weatherArrival], route)
        },
        performance: {
          totalTime: Date.now() - startTime,
          parallelTime,
          agentsUsed: ['weather', 'tidal', 'route', 'safety']
        }
      };
      
      logger.info({
        planningId,
        totalTime: passagePlan.performance.totalTime,
        under3Seconds: passagePlan.performance.totalTime < 3000
      }, 'Passage plan complete');
      
      // Broadcast completion
      this.broadcastUpdate({
        type: 'planning_completed',
        planningId,
        plan: passagePlan
      });
      
      return passagePlan;
      
    } catch (error: any) {
      logger.error({ error, planningId }, 'Planning error');
      this.broadcastUpdate({
        type: 'planning_error',
        planningId,
        error: error.message
      });
      throw error;
    }
  }

  private generateWarnings(weather: any[]): string[] {
    const warnings: string[] = [];
    
    if (weather && weather.length > 0) {
      const validWeather = weather.filter(w => w);
      if (validWeather.length === 0) return warnings;
      
      try {
        const maxWindSpeed = Math.max(...validWeather.flatMap((w: any) => 
          w.map((f: any) => f.windSpeed || 0)
        ));
        
        if (maxWindSpeed > 25) {
          warnings.push('Strong winds expected - consider delaying departure');
        }
        
        const maxWaveHeight = Math.max(...validWeather.flatMap((w: any) =>
          w.map((f: any) => f.waveHeight || 0)
        ));
        
        if (maxWaveHeight > 3) {
          warnings.push('Rough seas anticipated - ensure crew is prepared');
        }
      } catch (error) {
        logger.error({ error }, 'Error generating warnings');
      }
    }
    
    return warnings;
  }

  private generateRecommendations(weather: any[], route: any): string[] {
    const recommendations: string[] = [];

    if (route.totalDistance > 200) {
      recommendations.push('Long passage - ensure adequate provisions and fuel');
    }

    if (route.estimatedDuration > 24) {
      recommendations.push('Multi-day passage - plan watch schedule and rest periods');
    }

    recommendations.push('File a float plan with a trusted contact before departure');
    recommendations.push('Check all safety equipment is accessible and functional');

    return recommendations;
  }

  /**
   * Extract safety warnings from SafetyAgent route analysis
   * Formats warnings for display to the user
   */
  private extractSafetyWarnings(safetyRoute: any): string[] {
    const warnings: string[] = [];

    if (!safetyRoute) {
      warnings.push('⚠️ SAFETY CHECK UNAVAILABLE - Exercise extreme caution');
      return warnings;
    }

    // Extract warnings from content array if present (MCP format)
    let safetyData = safetyRoute;
    if (safetyRoute.content && Array.isArray(safetyRoute.content)) {
      try {
        const textContent = safetyRoute.content.find((c: any) => c.type === 'text');
        if (textContent?.text) {
          safetyData = JSON.parse(textContent.text);
        }
      } catch (e) {
        // Use safetyRoute as-is
      }
    }

    // Extract warnings array
    if (safetyData.warnings && Array.isArray(safetyData.warnings)) {
      for (const warning of safetyData.warnings) {
        if (typeof warning === 'string') {
          warnings.push(warning);
        } else if (warning.description) {
          const severity = warning.severity === 'urgent' ? '🔴' : '⚠️';
          warnings.push(`${severity} ${warning.description}`);
        }
      }
    }

    // Extract hazards
    if (safetyData.hazards && Array.isArray(safetyData.hazards)) {
      for (const hazard of safetyData.hazards) {
        const severity = hazard.severity === 'high' ? '🔴' : '⚠️';
        warnings.push(`${severity} HAZARD: ${hazard.description || hazard.type}`);
      }
    }

    // Extract recommendations
    if (safetyData.recommendations && Array.isArray(safetyData.recommendations)) {
      for (const rec of safetyData.recommendations) {
        if (typeof rec === 'string' && !warnings.includes(rec)) {
          warnings.push(`📋 ${rec}`);
        }
      }
    }

    return warnings;
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.debug('WebSocket client connected');

      ws.on('close', () => {
        logger.debug('WebSocket client disconnected');
      });

      ws.on('error', (error: any) => {
        logger.error({ error }, 'WebSocket error');
      });
    });
  }

  private broadcastUpdate(update: any) {
    const message = JSON.stringify(update);
    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private setupHttpServer() {
    this.app.use(express.json());
    
    // CORS for frontend
    this.app.use((req, res, next) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://helmwise.co',
        'https://helmwise.pages.dev'
      ];
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
    
    // REST endpoint for passage planning
    this.app.post('/api/plan', async (req, res) => {
      try {
        logger.info({
          departure: req.body.departure?.port,
          destination: req.body.destination?.port
        }, 'Received planning request');
        const plan = await this.planPassage(req.body);
        res.json({ success: true, plan });
      } catch (error: any) {
        logger.error({ error }, 'Planning failed');
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const health: any = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          agents: {}
        };
        
        for (const [name] of Object.entries(this.agents)) {
          try {
            const agentHealth = await this.redis.hgetall(`agent:health:${name}-agent`);
            health.agents[name] = {
              status: agentHealth.status || 'unknown',
              lastHeartbeat: agentHealth.lastHeartbeat || null
            };
          } catch (error) {
            health.agents[name] = {
              status: 'unknown',
              error: 'Failed to check health'
            };
          }
        }
        
        res.json(health);
      } catch (error: any) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });
    
    // Readiness probe for Kubernetes
    this.app.get('/ready', async (req, res) => {
      res.json({ ready: true });
    });
  }

  async start() {
    const httpPort = parseInt(process.env.PORT || '8080', 10);
    await new Promise<void>((resolve) => {
      this.httpServer.listen(httpPort, () => {
        logger.info({
          httpPort,
          httpServer: `http://localhost:${httpPort}`,
          wsServer: `ws://localhost:${httpPort}`,
          healthEndpoint: `http://localhost:${httpPort}/health`
        }, 'Orchestrator started successfully');
        resolve();
      });
    });
  }

  async shutdown() {
    logger.info('Shutting down orchestrator...');

    for (const agent of Object.values(this.agents)) {
      try {
        await agent.shutdown();
      } catch (error) {
        logger.error({ error }, 'Error shutting down agent');
      }
    }

    try {
      await this.redis.quit();
    } catch (error) {
      // Ignore Redis errors during shutdown
    }

    this.wss.clients.forEach((client: WebSocket) => {
      client.close();
    });
    this.wss.close();

    await new Promise<void>((resolve) => {
      this.httpServer.close(() => {
        logger.info('Orchestrator shutdown complete');
        resolve();
      });
    });
  }

  private calculateSimpleDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula for distance in nautical miles
    const R = 3440.1; // Earth radius in nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

