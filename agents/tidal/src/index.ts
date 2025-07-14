// agents/tidal/src/index.ts
// Tidal Agent Implementation

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import pino from 'pino';
import { z } from 'zod';
import { 
  CoordinateSchema,
  TidePrediction,
  AgentCapabilitySummary,
  ToolDefinition 
} from '@passage-planner/shared/types/core';

export class TidalAgent {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  
  private noaaApiUrl = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
  private cacheMap = new Map<string, { data: any; expiry: number }>();
  
  constructor() {
    this.server = new Server(
      {
        name: 'tidal-agent',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));
    
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'get_tide_predictions':
            return await this.getTidePredictions(args);
          case 'get_current_predictions':
            return await this.getCurrentPredictions(args);
          case 'get_water_levels':
            return await this.getWaterLevels(args);
          case 'find_nearest_station':
            return await this.findNearestStation(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        this.logger.error({ error, tool: name }, 'Tool execution failed');
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }
  
  private getTools(): ToolDefinition[] {
    return [
      {
        name: 'get_tide_predictions',
        description: 'Get tide predictions for a specific location',
        inputSchema: z.object({
          stationId: z.string().optional().describe('NOAA station ID'),
          coordinates: CoordinateSchema.optional().describe('Location coordinates if station ID not provided'),
          beginDate: z.string().describe('Start date (YYYYMMDD)'),
          endDate: z.string().describe('End date (YYYYMMDD)'),
          datum: z.enum(['MLLW', 'MLW', 'MSL', 'MHW', 'MHHW']).optional().default('MLLW'),
        }),
        outputSchema: z.object({
          station: z.object({
            id: z.string(),
            name: z.string(),
            coordinates: CoordinateSchema,
          }),
          predictions: z.array(z.object({
            time: z.string(),
            height: z.number(),
            type: z.enum(['high', 'low']),
          })),
        }),
      },
      {
        name: 'get_current_predictions',
        description: 'Get tidal current predictions',
        inputSchema: z.object({
          stationId: z.string().optional(),
          coordinates: CoordinateSchema.optional(),
          beginDate: z.string(),
          endDate: z.string(),
        }),
        outputSchema: z.object({
          station: z.object({
            id: z.string(),
            name: z.string(),
            coordinates: CoordinateSchema,
          }),
          predictions: z.array(z.object({
            time: z.string(),
            velocity: z.number(),
            direction: z.number(),
            type: z.enum(['max_flood', 'max_ebb', 'slack']),
          })),
        }),
      },
      {
        name: 'get_water_levels',
        description: 'Get real-time water level data',
        inputSchema: z.object({
          stationId: z.string(),
          timeRange: z.enum(['latest', '24hr', '48hr']).optional().default('24hr'),
          datum: z.enum(['MLLW', 'MLW', 'MSL', 'MHW', 'MHHW']).optional().default('MLLW'),
        }),
        outputSchema: z.object({
          station: z.object({
            id: z.string(),
            name: z.string(),
          }),
          waterLevels: z.array(z.object({
            time: z.string(),
            value: z.number(),
            sigma: z.number().optional(),
            flags: z.string().optional(),
          })),
        }),
      },
      {
        name: 'find_nearest_station',
        description: 'Find the nearest tide station to given coordinates',
        inputSchema: z.object({
          coordinates: CoordinateSchema,
          stationType: z.enum(['tide', 'current']).optional().default('tide'),
        }),
        outputSchema: z.object({
          station: z.object({
            id: z.string(),
            name: z.string(),
            coordinates: CoordinateSchema,
            distance: z.number(),
          }),
        }),
      },
    ];
  }
  
  private async getTidePredictions(args: any) {
    const cacheKey = `tide:${args.stationId || `${args.coordinates?.latitude},${args.coordinates?.longitude}`}:${args.beginDate}:${args.endDate}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
      };
    }
    
    let stationId = args.stationId;
    
    // Find nearest station if coordinates provided
    if (!stationId && args.coordinates) {
      const nearestResult = await this.findNearestStation({ 
        coordinates: args.coordinates,
        stationType: 'tide' 
      });
      const nearestData = JSON.parse(nearestResult.content[0].text);
      stationId = nearestData.station.id;
    }
    
    if (!stationId) {
      throw new Error('Station ID required or coordinates to find nearest station');
    }
    
    // Fetch tide predictions
    const params = new URLSearchParams({
      product: 'predictions',
      application: 'passage_planner',
      begin_date: args.beginDate,
      end_date: args.endDate,
      datum: args.datum || 'MLLW',
      station: stationId,
      time_zone: 'gmt',
      units: 'english',
      interval: 'hilo',
      format: 'json',
    });
    
    const response = await axios.get(`${this.noaaApiUrl}?${params}`);
    
    if (response.data.error) {
      throw new Error(response.data.error.message);
    }
    
    const predictions = response.data.predictions.map((pred: any) => ({
      time: pred.t,
      height: parseFloat(pred.v),
      type: pred.type === 'H' ? 'high' : 'low',
    }));
    
    const result = {
      station: {
        id: stationId,
        name: response.data.metadata?.name || 'Unknown Station',
        coordinates: {
          latitude: parseFloat(response.data.metadata?.lat || 0),
          longitude: parseFloat(response.data.metadata?.lon || 0),
        },
      },
      predictions,
    };
    
    this.setCache(cacheKey, result, 3600); // Cache for 1 hour
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
  
  private async getCurrentPredictions(args: any) {
    const cacheKey = `current:${args.stationId || `${args.coordinates?.latitude},${args.coordinates?.longitude}`}:${args.beginDate}:${args.endDate}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
      };
    }
    
    let stationId = args.stationId;
    
    // Find nearest station if coordinates provided
    if (!stationId && args.coordinates) {
      const nearestResult = await this.findNearestStation({ 
        coordinates: args.coordinates,
        stationType: 'current' 
      });
      const nearestData = JSON.parse(nearestResult.content[0].text);
      stationId = nearestData.station.id;
    }
    
    if (!stationId) {
      throw new Error('Station ID required or coordinates to find nearest station');
    }
    
    // Fetch current predictions
    const params = new URLSearchParams({
      product: 'currents_predictions',
      application: 'passage_planner',
      begin_date: args.beginDate,
      end_date: args.endDate,
      station: stationId,
      time_zone: 'gmt',
      units: 'english',
      interval: 'MAX_SLACK',
      format: 'json',
    });
    
    const response = await axios.get(`${this.noaaApiUrl}?${params}`);
    
    if (response.data.error) {
      throw new Error(response.data.error.message);
    }
    
    const predictions = response.data.current_predictions.map((pred: any) => ({
      time: pred.Time,
      velocity: parseFloat(pred.Velocity_Major),
      direction: parseFloat(pred.Direction),
      type: pred.Type.toLowerCase().replace(' ', '_'),
    }));
    
    const result = {
      station: {
        id: stationId,
        name: response.data.metadata?.name || 'Unknown Station',
        coordinates: {
          latitude: parseFloat(response.data.metadata?.lat || 0),
          longitude: parseFloat(response.data.metadata?.lon || 0),
        },
      },
      predictions,
    };
    
    this.setCache(cacheKey, result, 3600); // Cache for 1 hour
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
  
  private async getWaterLevels(args: any) {
    const cacheKey = `water:${args.stationId}:${args.timeRange}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
      };
    }
    
    // Calculate date range
    const endDate = new Date();
    const beginDate = new Date();
    
    switch (args.timeRange) {
      case 'latest':
        beginDate.setHours(beginDate.getHours() - 1);
        break;
      case '48hr':
        beginDate.setHours(beginDate.getHours() - 48);
        break;
      default: // 24hr
        beginDate.setHours(beginDate.getHours() - 24);
    }
    
    const params = new URLSearchParams({
      product: 'water_level',
      application: 'passage_planner',
      begin_date: beginDate.toISOString().slice(0, 10).replace(/-/g, ''),
      end_date: endDate.toISOString().slice(0, 10).replace(/-/g, ''),
      datum: args.datum || 'MLLW',
      station: args.stationId,
      time_zone: 'gmt',
      units: 'english',
      format: 'json',
    });
    
    const response = await axios.get(`${this.noaaApiUrl}?${params}`);
    
    if (response.data.error) {
      throw new Error(response.data.error.message);
    }
    
    const waterLevels = response.data.data.map((level: any) => ({
      time: level.t,
      value: parseFloat(level.v),
      sigma: level.s ? parseFloat(level.s) : undefined,
      flags: level.f || undefined,
    }));
    
    const result = {
      station: {
        id: args.stationId,
        name: response.data.metadata?.name || 'Unknown Station',
      },
      waterLevels,
    };
    
    this.setCache(cacheKey, result, 300); // Cache for 5 minutes
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
  
  private async findNearestStation(args: any) {
    const cacheKey = `nearest:${args.coordinates.latitude},${args.coordinates.longitude}:${args.stationType}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
      };
    }
    
    // Get station list
    const stationType = args.stationType === 'current' ? 'currentpredictions' : 'tidepredictions';
    const response = await axios.get(
      `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=${stationType}&units=english`
    );
    
    if (!response.data.stations) {
      throw new Error('Failed to fetch station list');
    }
    
    // Calculate distances and find nearest
    let nearestStation = null;
    let minDistance = Infinity;
    
    for (const station of response.data.stations) {
      if (!station.lat || !station.lng) continue;
      
      const distance = this.calculateDistance(
        args.coordinates.latitude,
        args.coordinates.longitude,
        parseFloat(station.lat),
        parseFloat(station.lng)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = station;
      }
    }
    
    if (!nearestStation) {
      throw new Error('No stations found');
    }
    
    const result = {
      station: {
        id: nearestStation.id,
        name: nearestStation.name,
        coordinates: {
          latitude: parseFloat(nearestStation.lat),
          longitude: parseFloat(nearestStation.lng),
        },
        distance: Math.round(minDistance * 10) / 10, // Round to 0.1 nm
      },
    };
    
    this.setCache(cacheKey, result, 86400); // Cache for 24 hours
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula for nautical miles
    const R = 3440.065; // Earth's radius in nautical miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  private getCached(key: string): any {
    const cached = this.cacheMap.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    return null;
  }
  
  private setCache(key: string, data: any, ttlSeconds: number) {
    this.cacheMap.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }
  
  getCapabilitySummary(): AgentCapabilitySummary {
    return {
      agentId: 'tidal-agent',
      name: 'Tidal Agent',
      description: 'Provides tide predictions, current forecasts, and water level data',
      version: '1.0.0',
      status: 'active',
      tools: this.getTools(),
      resources: [],
      prompts: [],
      lastUpdated: new Date(),
      healthEndpoint: '/health',
      performance: {
        averageResponseTime: 250,
        successRate: 0.98,
      },
    };
  }
  
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('Tidal agent started');
    
    // Register with orchestrator
    if (process.env.ORCHESTRATOR_URL) {
      try {
        await axios.post(`${process.env.ORCHESTRATOR_URL}/api/agents/register`, 
          this.getCapabilitySummary()
        );
        this.logger.info('Registered with orchestrator');
      } catch (error) {
        this.logger.error({ error }, 'Failed to register with orchestrator');
      }
    }
  }
}

// Start the agent
if (require.main === module) {
  const agent = new TidalAgent();
  agent.start().catch(console.error);
} 