import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import Redis from 'ioredis';
import { WeatherAgent } from '../../agents/weather/src/WeatherAgent';
import { TidalAgent } from '../../agents/tidal/src/TidalAgent';
import { RouteAgent } from '../../agents/route/src/RouteAgent';
import { BaseAgent } from '../../agents/base/BaseAgent';
import { createClient } from '@supabase/supabase-js';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import http from 'http';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface AgentRegistry {
  [key: string]: BaseAgent;
}

interface PlanningRequest {
  id: string;
  userId: string;
  departure: {
    port: string;
    latitude: number;
    longitude: number;
    time: Date;
  };
  destination: {
    port: string;
    latitude: number;
    longitude: number;
  };
  vessel: {
    type: string;
    cruiseSpeed: number;
    maxSpeed: number;
  };
  preferences: {
    avoidNight?: boolean;
    maxWindSpeed?: number;
    maxWaveHeight?: number;
    preferredStops?: string[];
  };
}

export class Orchestrator {
  private server: Server;
  private agents: AgentRegistry = {};
  private redis: Redis;
  private supabase: any;
  private wss: WebSocketServer;
  private httpServer: http.Server;
  private app: express.Application;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );
    
    this.server = new Server(
      {
        name: 'passage-planner-orchestrator',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.httpServer });
    
    this.initializeAgents();
    this.setupHandlers();
    this.setupWebSocket();
    this.setupHttpServer();
  }

  private async initializeAgents() {
    // Initialize all agents
    this.agents['weather'] = new WeatherAgent(
      process.env.REDIS_URL || 'redis://localhost:6379',
      process.env.NOAA_API_KEY || '',
      process.env.OPENWEATHER_API_KEY || ''
    );
    
    this.agents['tidal'] = new TidalAgent(
      process.env.REDIS_URL || 'redis://localhost:6379',
      process.env.NOAA_API_KEY || ''
    );
    
    this.agents['route'] = new RouteAgent(
      process.env.REDIS_URL || 'redis://localhost:6379'
    );
    
    // Initialize all agents
    for (const agent of Object.values(this.agents)) {
      try {
        await agent.initialize();
      } catch (error) {
        logger.error({ error }, 'Failed to initialize agent');
      }
    }

    logger.info('All agents initialized');
  }

  private setupHandlers() {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [];
      
      // Add orchestrator-level tools
      tools.push({
        name: 'plan_passage',
        description: 'Plan a complete sailing passage',
        inputSchema: {
          type: 'object',
          properties: {
            departure: {
              type: 'object',
              properties: {
                port: { type: 'string' },
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                time: { type: 'string', format: 'date-time' }
              },
              required: ['port', 'latitude', 'longitude', 'time']
            },
            destination: {
              type: 'object',
              properties: {
                port: { type: 'string' },
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              },
              required: ['port', 'latitude', 'longitude']
            },
            vessel: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                cruiseSpeed: { type: 'number' },
                maxSpeed: { type: 'number' }
              }
            },
            preferences: {
              type: 'object',
              properties: {
                avoidNight: { type: 'boolean' },
                maxWindSpeed: { type: 'number' },
                maxWaveHeight: { type: 'number' },
                preferredStops: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          required: ['departure', 'destination']
        }
      });
      
      // Collect tools from all agents
      for (const [agentName, agent] of Object.entries(this.agents)) {
        const agentTools = agent.getTools();
        for (const tool of agentTools) {
          tools.push({
            ...tool,
            name: `${agentName}_${tool.name}`
          });
        }
      }
      
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        // Handle orchestrator-level tools
        if (name === 'plan_passage') {
          return await this.planPassage(args);
        }
        
        // Route to appropriate agent
        const [agentName, ...toolParts] = name.split('_');
        const toolName = toolParts.join('_');
        
        if (this.agents[agentName]) {
          const result = await this.agents[agentName].handleToolCall(
            toolName,
            args
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        
        throw new Error(`Unknown tool: ${name}`);
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    });
  }

  private async planPassage(request: any): Promise<any> {
    const planningId = uuidv4();
    
    // Broadcast planning start
    this.broadcastUpdate({
      type: 'planning_started',
      planningId,
      request
    });
    
    try {
      // Step 1: Calculate base route
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'route',
        status: 'Calculating optimal route...'
      });
      
      const route = await this.agents['route'].handleToolCall('calculate_route', {
        departure: request.departure,
        destination: request.destination,
        vessel_speed: request.vessel?.cruiseSpeed || 5,
        optimization: 'distance'
      });
      
      // Step 2: Get weather along route
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'weather',
        status: 'Fetching weather forecast...'
      });
      
      const weatherPromises = route.waypoints.map((wp: any) =>
        this.agents['weather'].handleToolCall('get_marine_forecast', {
          latitude: wp.latitude,
          longitude: wp.longitude,
          hours: 72
        }).catch((error: any) => {
          logger.error({ error }, 'Weather fetch error');
          return null; // Return null for failed forecasts
        })
      );
      const weatherData = await Promise.all(weatherPromises);
      
      // Step 3: Get tidal information
      this.broadcastUpdate({
        type: 'agent_active',
        planningId,
        agent: 'tidal',
        status: 'Calculating tides and currents...'
      });
      
      let tidalData = null;
      try {
        tidalData = await this.agents['tidal'].handleToolCall('get_tide_predictions', {
          latitude: request.departure.latitude,
          longitude: request.departure.longitude,
          start_date: request.departure.time,
          end_date: new Date(new Date(request.departure.time).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
      } catch (error: any) {
        logger.error({ error }, 'Tidal fetch error');
        // Continue without tidal data
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
          warnings: this.generateWarnings(weatherData, tidalData),
          recommendations: this.generateRecommendations(weatherData, route, tidalData)
        }
      };
      
      // Save to database
      let saveWarning: string | undefined;
      if (request.userId) {
        const saveResult = await this.savePassage(passagePlan);
        if (!saveResult.saved) {
          saveWarning = saveResult.error;
          // Add warning to passage plan (warnings array expects strings)
          passagePlan.summary.warnings.push(
            `WARNING: ${saveResult.error}`
          );
        }
      }

      // Broadcast completion
      this.broadcastUpdate({
        type: 'planning_completed',
        planningId,
        plan: passagePlan,
        saveWarning
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(passagePlan, null, 2)
        }]
      };
      
    } catch (error: any) {
      this.broadcastUpdate({
        type: 'planning_error',
        planningId,
        error: error.message
      });
      throw error;
    }
  }

  private generateWarnings(weather: any[], tidal: any): string[] {
    const warnings: string[] = [];

    // Check weather conditions - handle various data formats defensively
    if (weather && Array.isArray(weather) && weather.length > 0) {
      try {
        // Extract wind speeds from various possible data structures
        const windSpeeds: number[] = [];
        const waveHeights: number[] = [];

        for (const w of weather) {
          if (!w) continue;

          // If w is an array (nested structure)
          if (Array.isArray(w)) {
            for (const f of w) {
              if (f?.windSpeed != null) windSpeeds.push(Number(f.windSpeed) || 0);
              if (f?.waveHeight != null) waveHeights.push(Number(f.waveHeight) || 0);
            }
          }
          // If w is an object with windSpeed directly
          else if (typeof w === 'object') {
            if (w.windSpeed != null) windSpeeds.push(Number(w.windSpeed) || 0);
            if (w.waveHeight != null) waveHeights.push(Number(w.waveHeight) || 0);
          }
        }

        const maxWindSpeed = windSpeeds.length > 0 ? Math.max(...windSpeeds) : 0;
        const maxWaveHeight = waveHeights.length > 0 ? Math.max(...waveHeights) : 0;

        if (maxWindSpeed > 25) {
          warnings.push('Strong winds expected - consider delaying departure');
        }

        if (maxWaveHeight > 3) {
          warnings.push('Rough seas anticipated - ensure crew is prepared');
        }
      } catch {
        // Graceful degradation - don't fail on malformed weather data
        // No warnings returned is safer than crashing
      }
    }

    return warnings;
  }

  private generateRecommendations(weather: any[], route: any, tidal: any): string[] {
    const recommendations: string[] = [];

    // Analyze weather conditions - handle various data formats defensively
    if (weather && Array.isArray(weather) && weather.length > 0) {
      try {
        const windSpeeds: number[] = [];

        for (const w of weather) {
          if (!w) continue;

          // If w is an array (nested structure)
          if (Array.isArray(w)) {
            for (const f of w) {
              if (f?.windSpeed != null) windSpeeds.push(Number(f.windSpeed) || 0);
            }
          }
          // If w is an object with windSpeed directly
          else if (typeof w === 'object' && w.windSpeed != null) {
            windSpeeds.push(Number(w.windSpeed) || 0);
          }
        }

        if (windSpeeds.length > 0) {
          const avgWindSpeed = windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length;

          if (avgWindSpeed < 5) {
            recommendations.push('Light winds expected - consider motor sailing');
          } else if (avgWindSpeed > 20) {
            recommendations.push('Strong winds forecast - reef early and monitor conditions');
          }
        }
      } catch {
        // Graceful degradation - skip weather-based recommendations
      }
    }

    // Route-based recommendations
    if (route?.totalDistance > 200) {
      recommendations.push('Long passage - ensure adequate provisions and fuel');
    }

    if (route?.estimatedDuration > 24) {
      recommendations.push('Multi-day passage - plan watch schedule and rest periods');
    }

    recommendations.push('File a float plan with a trusted contact before departure');
    recommendations.push('Check all safety equipment is accessible and functional');

    return recommendations;
  }

  private async savePassage(passagePlan: any): Promise<{ saved: boolean; error?: string }> {
    const maxRetries = 3;
    const baseDelayMs = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await this.supabase
          .from('passages')
          .insert({
            id: passagePlan.id,
            user_id: passagePlan.request.userId,
            name: `${passagePlan.request.departure.port} to ${passagePlan.request.destination.port}`,
            departure_port: passagePlan.request.departure.port,
            departure_coords: `POINT(${passagePlan.request.departure.longitude} ${passagePlan.request.departure.latitude})`,
            destination_port: passagePlan.request.destination.port,
            destination_coords: `POINT(${passagePlan.request.destination.longitude} ${passagePlan.request.destination.latitude})`,
            departure_time: passagePlan.request.departure.time,
            estimated_arrival: passagePlan.summary.estimatedArrival,
            distance_nm: passagePlan.summary.totalDistance,
            route_points: passagePlan.route.waypoints,
            weather_data: passagePlan.weather,
            tidal_data: passagePlan.tides,
            planning_parameters: passagePlan.request.preferences,
            agent_responses: {
              route: passagePlan.route,
              weather: passagePlan.weather,
              tides: passagePlan.tides
            }
          });

        if (error) {
          throw error;
        }

        logger.info({ passageId: passagePlan.id }, 'Passage saved successfully');
        return { saved: true };

      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff

        logger.warn({
          error,
          attempt,
          maxRetries,
          passageId: passagePlan.id,
          willRetry: !isLastAttempt
        }, `Failed to save passage (attempt ${attempt}/${maxRetries})`);

        if (isLastAttempt) {
          // Log to audit trail for safety-critical data loss tracking
          logger.error({
            error,
            passageId: passagePlan.id,
            userId: passagePlan.request.userId,
            departure: passagePlan.request.departure.port,
            destination: passagePlan.request.destination.port
          }, 'CRITICAL: Passage save failed after all retries - user data may be lost');

          return {
            saved: false,
            error: 'Failed to save passage to database. Please export your passage plan as a backup.'
          };
        }

        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Should not reach here, but return failure just in case
    return { saved: false, error: 'Unexpected error saving passage' };
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.debug('WebSocket client connected');

      ws.on('message', (message: any) => {
        try {
          const data = JSON.parse(message.toString());
          // Handle incoming messages if needed
        } catch (error) {
          logger.error({ error }, 'Invalid WebSocket message');
        }
      });

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
        const result = await this.planPassage(req.body);
        // Extract the plan from MCP response format
        const planText = result.content[0].text;
        const plan = JSON.parse(planText);
        res.json({ success: true, plan });
      } catch (error: any) {
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
        
        // Check each agent's health from Redis
        for (const [name, agent] of Object.entries(this.agents)) {
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
      try {
        // Check if Redis is connected
        await this.redis.ping();
        res.json({ ready: true });
      } catch (error) {
        res.status(503).json({ ready: false });
      }
    });
  }

  async start() {
    // Start HTTP server
    const httpPort = parseInt(process.env.PORT || '8080', 10);
    await new Promise<void>((resolve) => {
      this.httpServer.listen(httpPort, () => {
        logger.info({ httpPort }, 'HTTP and WebSocket servers listening');
        resolve();
      });
    });

    // Start MCP server on stdio
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP server started on stdio');
  }

  async shutdown() {
    logger.info('Shutting down orchestrator...');

    // Shutdown all agents
    for (const agent of Object.values(this.agents)) {
      try {
        await agent.shutdown();
      } catch (error) {
        logger.error({ error }, 'Error shutting down agent');
      }
    }

    // Close connections
    await this.redis.quit();

    this.wss.clients.forEach((client: WebSocket) => {
      client.close();
    });
    this.wss.close();

    await new Promise<void>((resolve) => {
      this.httpServer.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });

    logger.info('Orchestrator shutdown complete');
  }
}

