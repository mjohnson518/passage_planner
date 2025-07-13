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
import { addDays, format } from 'date-fns';
import { 
  CoordinateSchema,
  TidePrediction,
  TidalSummary,
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
  
  private noaaBaseUrl = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
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
          case 'get_tidal_predictions':
            return await this.getTidalPredictions(args);
            
          case 'get_current_predictions':
            return await this.getCurrentPredictions(args);
            
          case 'get_water_levels':
            return await this.getWaterLevels(args);
            
          case 'find_nearest_station':
            return await this.findNearestStation(args);
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Tool execution failed');
        throw error;
      }
    });
  }
  
  private getTools(): ToolDefinition[] {
    return [
      {
        name: 'get_tidal_predictions',
        description: 'Get tide predictions for a specific location and time range',
        inputSchema: z.object({
          stationId: z.string().optional(),
          coordinates: CoordinateSchema.optional(),
          startDate: z.string().datetime(),
          endDate: z.string().datetime(),
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
        examples: [
          {
            input: {
              stationId: '8443970',
              startDate: '2024-07-15T00:00:00Z',
              endDate: '2024-07-16T00:00:00Z',
            },
            output: {
              station: {
                id: '8443970',
                name: 'Boston, MA',
                coordinates: { latitude: 42.3584, longitude: -71.0512 },
              },
              predictions: [
                { time: '2024-07-15T04:24:00Z', height: 11.2, type: 'high' },
                { time: '2024-07-15T10:36:00Z', height: 0.8, type: 'low' },
              ],
            },
          },
        ],
      },
      {
        name: 'get_current_predictions',
        description: 'Get tidal current predictions for a location',
        inputSchema: z.object({
          stationId: z.string().optional(),
          coordinates: CoordinateSchema.optional(),
          startDate: z.string().datetime(),
          endDate: z.string().datetime(),
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
            type: z.enum(['max_flood', 'slack', 'max_ebb']),
          })),
        }),
      },
      {
        name: 'get_water_levels',
        description: 'Get real-time water level data',
        inputSchema: z.object({
          stationId: z.string(),
          timeRange: z.enum(['latest', '24h', '48h']).default('latest'),
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
        description: 'Find the nearest tidal station to given coordinates',
        inputSchema: z.object({
          coordinates: CoordinateSchema,
          stationType: z.enum(['tide', 'current']).default('tide'),
          maxDistance: z.number().default(50), // km
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
  
  private async getTidalPredictions(args: any) {
    const { stationId, coordinates, startDate, endDate, datum } = args;
    const cacheKey = `tides-${stationId || coordinates?.latitude}-${startDate}-${endDate}`;
    
    // Check cache
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Get station ID if not provided
      let station = stationId;
      if (!station && coordinates) {
        const nearest = await this.findNearestTideStation(coordinates);
        station = nearest.id;
      }
      
      if (!station) {
        throw new Error('No tidal station found for location');
      }
      
      // Fetch tide predictions
      const response = await axios.get(this.noaaBaseUrl, {
        params: {
          product: 'predictions',
          application: 'PassagePlanner',
          begin_date: format(new Date(startDate), 'yyyyMMdd HH:mm'),
          end_date: format(new Date(endDate), 'yyyyMMdd HH:mm'),
          datum,
          station,
          time_zone: 'gmt',
          units: 'english',
          interval: 'hilo',
          format: 'json',
        },
      });
      
      // Get station metadata
      const stationInfo = await this.getStationInfo(station);
      
      // Transform response
      const predictions = response.data.predictions.map((pred: any) => ({
        time: new Date(pred.t).toISOString(),
        height: parseFloat(pred.v),
        type: pred.type === 'H' ? 'high' : 'low',
      }));
      
      const result = {
        station: stationInfo,
        predictions,
      };
      
      this.setCache(cacheKey, result, 3600); // 1 hour cache
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      this.logger.error({ error, station: stationId }, 'Failed to fetch tidal predictions');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Unable to fetch tidal predictions',
            message: error.message,
          }),
        }],
      };
    }
  }
  
  private async getCurrentPredictions(args: any) {
    const { stationId, coordinates, startDate, endDate } = args;
    const cacheKey = `currents-${stationId || coordinates?.latitude}-${startDate}-${endDate}`;
    
    // Check cache
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Get station ID if not provided
      let station = stationId;
      if (!station && coordinates) {
        const nearest = await this.findNearestCurrentStation(coordinates);
        station = nearest.id;
      }
      
      if (!station) {
        throw new Error('No current station found for location');
      }
      
      // Fetch current predictions
      const response = await axios.get(this.noaaBaseUrl, {
        params: {
          product: 'currents_predictions',
          application: 'PassagePlanner',
          begin_date: format(new Date(startDate), 'yyyyMMdd HH:mm'),
          end_date: format(new Date(endDate), 'yyyyMMdd HH:mm'),
          station,
          time_zone: 'gmt',
          units: 'english',
          interval: 'MAX_SLACK',
          format: 'json',
        },
      });
      
      // Get station metadata
      const stationInfo = await this.getStationInfo(station);
      
      // Transform response
      const predictions = response.data.current_predictions.map((pred: any) => ({
        time: new Date(pred.Time).toISOString(),
        velocity: parseFloat(pred.Velocity_Major),
        direction: parseFloat(pred.Direction),
        type: this.getCurrentType(pred.Type),
      }));
      
      const result = {
        station: stationInfo,
        predictions,
      };
      
      this.setCache(cacheKey, result, 3600);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      this.logger.error({ error, station: stationId }, 'Failed to fetch current predictions');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Unable to fetch current predictions',
            message: error.message,
          }),
        }],
      };
    }
  }
  
  private async getWaterLevels(args: any) {
    const { stationId, timeRange } = args;
    
    try {
      let product = 'water_level';
      let range = '';
      
      switch (timeRange) {
        case 'latest':
          product = 'water_level';
          range = 'latest';
          break;
        case '24h':
          range = '24';
          break;
        case '48h':
          range = '48';
          break;
      }
      
      const params: any = {
        product,
        application: 'PassagePlanner',
        station: stationId,
        time_zone: 'gmt',
        units: 'english',
        datum: 'MLLW',
        format: 'json',
      };
      
      if (range === 'latest') {
        params.date = 'latest';
      } else {
        params.range = range;
      }
      
      const response = await axios.get(this.noaaBaseUrl, { params });
      
      // Get station metadata
      const stationInfo = await this.getStationInfo(stationId);
      
      // Transform response
      const waterLevels = response.data.data.map((level: any) => ({
        time: new Date(level.t).toISOString(),
        value: parseFloat(level.v),
        sigma: level.s ? parseFloat(level.s) : undefined,
        flags: level.f || undefined,
      }));
      
      const result = {
        station: {
          id: stationInfo.id,
          name: stationInfo.name,
        },
        waterLevels,
      };
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      this.logger.error({ error, station: stationId }, 'Failed to fetch water levels');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Unable to fetch water levels',
            message: error.message,
          }),
        }],
      };
    }
  }
  
  private async findNearestStation(args: any) {
    const { coordinates, stationType, maxDistance } = args;
    
    try {
      const stations = stationType === 'current' 
        ? await this.findNearestCurrentStation(coordinates, maxDistance)
        : await this.findNearestTideStation(coordinates, maxDistance);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ station: stations }, null, 2),
          },
        ],
      };
    } catch (error) {
      this.logger.error({ error, coordinates }, 'Failed to find nearest station');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Unable to find nearest station',
            message: error.message,
          }),
        }],
      };
    }
  }
  
  // Helper methods
  private async getStationInfo(stationId: string) {
    try {
      const response = await axios.get(this.noaaBaseUrl, {
        params: {
          product: 'stations',
          station: stationId,
          format: 'json',
        },
      });
      
      const station = response.data.stations[0];
      return {
        id: station.id,
        name: station.name,
        coordinates: {
          latitude: parseFloat(station.lat),
          longitude: parseFloat(station.lng),
        },
      };
    } catch (error) {
      this.logger.error({ error, stationId }, 'Failed to get station info');
      return {
        id: stationId,
        name: 'Unknown Station',
        coordinates: { latitude: 0, longitude: 0 },
      };
    }
  }
  
  private async findNearestTideStation(coordinates: any, maxDistance: number = 50) {
    // In production, this would query a database of tide stations
    // For now, return a mock station based on coordinates
    const stations = [
      { id: '8443970', name: 'Boston, MA', lat: 42.3584, lon: -71.0512 },
      { id: '8418150', name: 'Portland, ME', lat: 43.6567, lon: -70.2467 },
      { id: '8452660', name: 'Newport, RI', lat: 41.5048, lon: -71.3267 },
      { id: '8510560', name: 'Montauk, NY', lat: 41.0483, lon: -71.9600 },
    ];
    
    let nearest = null;
    let minDistance = Infinity;
    
    for (const station of stations) {
      const distance = this.calculateDistance(
        coordinates.latitude,
        coordinates.longitude,
        station.lat,
        station.lon
      );
      
      if (distance < minDistance && distance <= maxDistance) {
        minDistance = distance;
        nearest = {
          id: station.id,
          name: station.name,
          coordinates: { latitude: station.lat, longitude: station.lon },
          distance: Math.round(distance * 10) / 10,
        };
      }
    }
    
    if (!nearest) {
      throw new Error(`No tide station found within ${maxDistance}km`);
    }
    
    return nearest;
  }
  
  private async findNearestCurrentStation(coordinates: any, maxDistance: number = 50) {
    // Similar to tide stations but for current stations
    const stations = [
      { id: 'BOS1201', name: 'Boston Harbor Entrance', lat: 42.3267, lon: -70.9883 },
      { id: 'ACT3601', name: 'Cape Cod Canal', lat: 41.7717, lon: -70.6133 },
      { id: 'NYH1901', name: 'The Race', lat: 41.2350, lon: -72.0617 },
    ];
    
    let nearest = null;
    let minDistance = Infinity;
    
    for (const station of stations) {
      const distance = this.calculateDistance(
        coordinates.latitude,
        coordinates.longitude,
        station.lat,
        station.lon
      );
      
      if (distance < minDistance && distance <= maxDistance) {
        minDistance = distance;
        nearest = {
          id: station.id,
          name: station.name,
          coordinates: { latitude: station.lat, longitude: station.lon },
          distance: Math.round(distance * 10) / 10,
        };
      }
    }
    
    if (!nearest) {
      throw new Error(`No current station found within ${maxDistance}km`);
    }
    
    return nearest;
  }
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
  
  private getCurrentType(type: string): 'max_flood' | 'slack' | 'max_ebb' {
    switch (type) {
      case 'MAX_FLOOD':
        return 'max_flood';
      case 'SLACK':
        return 'slack';
      case 'MAX_EBB':
        return 'max_ebb';
      default:
        return 'slack';
    }
  }
  
  // Cache management
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
      expiry: Date.now() + (ttlSeconds * 1000),
    });
  }
  
  // Agent capabilities for registration
  getCapabilitySummary(): AgentCapabilitySummary {
    return {
      agentId: 'tidal-agent',
      name: 'Tidal Agent',
      description: 'Provides tide and current predictions for passage planning',
      version: '1.0.0',
      status: 'active',
      tools: this.getTools(),
      resources: [],
      prompts: [],
      lastUpdated: new Date(),
      healthEndpoint: '/health',
      performance: {
        averageResponseTime: 0,
        successRate: 1,
      },
    };
  }
  
  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logger.info('Tidal agent started');
      
      // Register with orchestrator
      process.send?.({
        type: 'agent:register',
        data: this.getCapabilitySummary(),
      });
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start tidal agent');
      process.exit(1);
    }
  }
}

// Start the agent
if (require.main === module) {
  const agent = new TidalAgent();
  agent.start().catch(console.error);
} 