// Simplified orchestrator without MCP SDK (HTTP + WebSocket only)
import Redis from 'ioredis';
import { WeatherAgent } from '../../agents/weather/src/WeatherAgent';
import { TidalAgent } from '../../agents/tidal/src/TidalAgent';
import { RouteAgent } from '../../agents/route/src/RouteAgent';
import { BaseAgent } from '../../agents/base/BaseAgent';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import http from 'http';

interface AgentRegistry {
  [key: string]: BaseAgent;
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
    console.log('Initializing agents...');
    
    // Initialize weather and tidal agents only (RouteAgent has Turf.js ESM issues)
    this.agents['weather'] = new WeatherAgent(
      process.env.REDIS_URL || 'redis://localhost:6379',
      process.env.NOAA_API_KEY || '',
      process.env.OPENWEATHER_API_KEY || ''
    );
    
    this.agents['tidal'] = new TidalAgent(
      process.env.REDIS_URL || 'redis://localhost:6379',
      process.env.NOAA_API_KEY || ''
    );
    
    // Initialize all agents
    for (const [name, agent] of Object.entries(this.agents)) {
      try {
        await agent.initialize();
        console.log(`✓ ${name} agent initialized`);
      } catch (error) {
        console.error(`✗ Failed to initialize ${name} agent:`, error);
      }
    }
    
    console.log('All agents initialized');
  }

  private async planPassage(request: any): Promise<any> {
    const planningId = uuidv4();
    
    // Broadcast planning start
    this.broadcastUpdate({
      type: 'planning_started',
      planningId,
      request
    });
    
    console.log(`Planning passage ${planningId}...`);
    
    try {
      // Step 1: Calculate base route (using mock data for now)
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'route',
        status: 'Calculating optimal route...'
      });
      
      console.log('Step 1: Calculating route...');
      // Mock route calculation (Turf.js ESM issues prevent real RouteAgent)
      const distance = this.calculateSimpleDistance(
        request.departure.latitude,
        request.departure.longitude,
        request.destination.latitude,
        request.destination.longitude
      );
      const cruiseSpeed = request.vessel?.cruiseSpeed || 5;
      const route = {
        waypoints: [request.departure, request.destination],
        segments: [{
          from: request.departure,
          to: request.destination,
          distance,
          bearing: 180,
          estimatedTime: distance / cruiseSpeed
        }],
        totalDistance: distance,
        estimatedDuration: distance / cruiseSpeed,
        optimized: false
      };
      console.log(`✓ Route calculated: ${route.totalDistance.toFixed(1)} nm`);
      
      // Step 2: Get weather along route
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'weather',
        status: 'Fetching weather forecast...'
      });
      
      console.log('Step 2: Fetching weather...');
      const weatherPromises = route.waypoints.map((wp: any) =>
        this.agents['weather'].handleToolCall('get_marine_forecast', {
          latitude: wp.latitude,
          longitude: wp.longitude,
          hours: 72
        }).catch((error: any) => {
          console.error('Weather fetch error:', error);
          return null;
        })
      );
      const weatherData = await Promise.all(weatherPromises);
      console.log(`✓ Weather fetched for ${weatherData.filter(w => w).length}/${route.waypoints.length} waypoints`);
      
      // Step 3: Get tidal information
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'tidal',
        status: 'Calculating tides and currents...'
      });
      
      console.log('Step 3: Fetching tidal data...');
      let tidalData = null;
      try {
        tidalData = await this.agents['tidal'].handleToolCall('get_tide_predictions', {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
          start_date: request.departure.time,
          end_date: new Date(new Date(request.departure.time).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
        console.log('✓ Tidal data fetched');
      } catch (error: any) {
        console.error('Tidal fetch error:', error);
      }
      
      // Compile comprehensive passage plan
      const passagePlan = {
        id: planningId,
        request,
        route,
        weather: weatherData.filter((w: any) => w !== null),
        tides: tidalData,
        summary: {
          totalDistance: route.totalDistance,
          estimatedDuration: route.estimatedDuration,
          departureTime: request.departure.time,
          estimatedArrival: new Date(
            new Date(request.departure.time).getTime() + route.estimatedDuration * 60 * 60 * 1000
          ),
          warnings: this.generateWarnings(weatherData),
          recommendations: this.generateRecommendations(weatherData, route)
        }
      };
      
      console.log(`✓ Passage plan complete: ${passagePlan.id}`);
      
      // Broadcast completion
      this.broadcastUpdate({
        type: 'planning_completed',
        planningId,
        plan: passagePlan
      });
      
      return passagePlan;
      
    } catch (error: any) {
      console.error('Planning error:', error);
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
        console.error('Error generating warnings:', error);
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

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');
      
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
      
      ws.on('error', (error: any) => {
        console.error('WebSocket error:', error);
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
        console.log('Received planning request:', req.body.departure?.port, '→', req.body.destination?.port);
        const plan = await this.planPassage(req.body);
        res.json({ success: true, plan });
      } catch (error: any) {
        console.error('Planning failed:', error);
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
        console.log('');
        console.log('🚀 Orchestrator started successfully!');
        console.log(`📡 HTTP server: http://localhost:${httpPort}`);
        console.log(`🔌 WebSocket server: ws://localhost:${httpPort}`);
        console.log(`💚 Health endpoint: http://localhost:${httpPort}/health`);
        console.log('');
        resolve();
      });
    });
  }

  async shutdown() {
    console.log('\nShutting down orchestrator...');
    
    for (const agent of Object.values(this.agents)) {
      try {
        await agent.shutdown();
      } catch (error) {
        console.error('Error shutting down agent:', error);
      }
    }
    
    try {
      await this.redis.quit();
    } catch (error) {
      // Ignore Redis errors
    }
    
    this.wss.clients.forEach((client: WebSocket) => {
      client.close();
    });
    this.wss.close();
    
    await new Promise<void>((resolve) => {
      this.httpServer.close(() => {
        console.log('Orchestrator shutdown complete');
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

