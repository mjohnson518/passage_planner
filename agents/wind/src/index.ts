// Wind Agent Implementation with Windy API Integration
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
  AgentCapabilitySummary,
  ToolDefinition 
} from '@passage-planner/shared/types/core';

export class WindAgent {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  
  private windyApiKey = process.env.WINDY_API_KEY;
  private cacheMap = new Map<string, { data: any; expiry: number }>();
  
  constructor() {
    this.server = new Server(
      {
        name: 'wind-agent',
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
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));
    
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'get_wind_forecast':
            return await this.getWindForecast(args);
          case 'get_wave_conditions':
            return await this.getWaveConditions(args);
          case 'get_wind_patterns':
            return await this.getWindPatterns(args);
          case 'get_gust_analysis':
            return await this.getGustAnalysis(args);
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
        name: 'get_wind_forecast',
        description: 'Get detailed wind forecast for coordinates',
        inputSchema: z.object({
          coordinates: CoordinateSchema,
          hours: z.number().min(1).max(240).default(48),
          model: z.enum(['gfs', 'ecmwf', 'nam', 'icon']).default('gfs'),
        }),
        outputSchema: z.object({
          forecast: z.array(z.object({
            time: z.string(),
            windSpeed: z.number(),
            windGust: z.number(),
            windDirection: z.number(),
            pressure: z.number(),
            temperature: z.number(),
          })),
          model: z.string(),
          lastUpdated: z.string(),
        }),
      },
      {
        name: 'get_wave_conditions',
        description: 'Get wave and swell forecast',
        inputSchema: z.object({
          coordinates: CoordinateSchema,
          hours: z.number().min(1).max(240).default(48),
        }),
        outputSchema: z.object({
          waves: z.array(z.object({
            time: z.string(),
            waveHeight: z.number(),
            wavePeriod: z.number(),
            waveDirection: z.number(),
            swellHeight: z.number(),
            swellPeriod: z.number(),
            swellDirection: z.number(),
          })),
        }),
      },
      {
        name: 'get_wind_patterns',
        description: 'Analyze wind patterns for route optimization',
        inputSchema: z.object({
          route: z.array(CoordinateSchema),
          departureTime: z.string(),
          vesselSpeed: z.number().min(1).max(50),
        }),
        outputSchema: z.object({
          segments: z.array(z.object({
            from: CoordinateSchema,
            to: CoordinateSchema,
            averageWind: z.object({
              speed: z.number(),
              direction: z.number(),
              angle: z.number(), // relative to course
            }),
            recommendation: z.string(),
          })),
          optimalDeparture: z.string(),
        }),
      },
      {
        name: 'get_gust_analysis',
        description: 'Analyze wind gusts and turbulence',
        inputSchema: z.object({
          coordinates: CoordinateSchema,
          timeWindow: z.object({
            start: z.string(),
            end: z.string(),
          }),
        }),
        outputSchema: z.object({
          maxGust: z.number(),
          averageGust: z.number(),
          gustFactor: z.number(),
          turbulenceRisk: z.enum(['low', 'moderate', 'high']),
          warnings: z.array(z.string()),
        }),
      },
    ];
  }
  
  private async getWindForecast(args: any) {
    const cacheKey = `wind:${args.coordinates.latitude},${args.coordinates.longitude}:${args.hours}:${args.model}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
      };
    }
    
    if (!this.windyApiKey) {
      throw new Error('Windy API key not configured');
    }
    
    try {
      const response = await axios.post('https://api.windy.com/api/point-forecast/v2', {
        lat: args.coordinates.latitude,
        lon: args.coordinates.longitude,
        model: args.model || 'gfs',
        parameters: ['wind', 'windGust', 'pressure', 'temp'],
        levels: ['surface', '10m', '80m'],
        key: this.windyApiKey,
      }, {
        timeout: 10000,
      });
      
      const forecast = this.transformWindyForecast(response.data, args.hours);
      
      const result = {
        forecast,
        model: args.model || 'gfs',
        lastUpdated: new Date().toISOString(),
      };
      
      this.setCache(cacheKey, result, 3600); // Cache for 1 hour
      
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      this.logger.error({ error, args }, 'Windy API request failed');
      
      if (error.response?.status === 429) {
        throw new Error('Windy API rate limit exceeded. Please try again later.');
      }
      
      throw new Error(`Failed to fetch wind forecast: ${error.message}`);
    }
  }
  
  private async getWaveConditions(args: any) {
    const cacheKey = `waves:${args.coordinates.latitude},${args.coordinates.longitude}:${args.hours}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return {
        content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
      };
    }
    
    if (!this.windyApiKey) {
      throw new Error('Windy API key not configured');
    }
    
    try {
      const response = await axios.post('https://api.windy.com/api/point-forecast/v2', {
        lat: args.coordinates.latitude,
        lon: args.coordinates.longitude,
        model: 'gfsWave',
        parameters: ['waves', 'swell1', 'swell2', 'swell3'],
        key: this.windyApiKey,
      }, {
        timeout: 10000,
      });
      
      const waves = this.transformWaveData(response.data, args.hours);
      
      const result = { waves };
      
      this.setCache(cacheKey, result, 3600); // Cache for 1 hour
      
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      this.logger.error({ error, args }, 'Wave data request failed');
      throw new Error(`Failed to fetch wave conditions: ${error.message}`);
    }
  }
  
  private async getWindPatterns(args: any) {
    const segments = [];
    
    for (let i = 0; i < args.route.length - 1; i++) {
      const from = args.route[i];
      const to = args.route[i + 1];
      
      // Calculate course bearing
      const course = this.calculateBearing(from, to);
      
      // Get wind forecast for midpoint
      const midpoint = {
        latitude: (from.latitude + to.latitude) / 2,
        longitude: (from.longitude + to.longitude) / 2,
      };
      
      const windData = await this.getWindForecast({
        coordinates: midpoint,
        hours: 48,
        model: 'gfs',
      });
      
      const forecast = JSON.parse(windData.content[0].text).forecast;
      
      // Find forecast closest to departure time
      const targetTime = new Date(args.departureTime).getTime() + 
        (i * this.calculateDistance(from, to) / args.vesselSpeed * 3600000);
      
      const relevantForecast = forecast.reduce((prev: any, curr: any) => {
        const prevDiff = Math.abs(new Date(prev.time).getTime() - targetTime);
        const currDiff = Math.abs(new Date(curr.time).getTime() - targetTime);
        return currDiff < prevDiff ? curr : prev;
      });
      
      // Calculate relative wind angle
      const windAngle = this.calculateRelativeWindAngle(
        course,
        relevantForecast.windDirection
      );
      
      segments.push({
        from,
        to,
        averageWind: {
          speed: relevantForecast.windSpeed,
          direction: relevantForecast.windDirection,
          angle: windAngle,
        },
        recommendation: this.getWindRecommendation(windAngle, relevantForecast.windSpeed),
      });
    }
    
    // Find optimal departure time based on wind conditions
    const optimalDeparture = this.findOptimalDeparture(segments, args.departureTime);
    
    return {
      content: [{ type: 'text', text: JSON.stringify({
        segments,
        optimalDeparture,
      }, null, 2) }],
    };
  }
  
  private async getGustAnalysis(args: any) {
    const windData = await this.getWindForecast({
      coordinates: args.coordinates,
      hours: 48,
      model: 'gfs',
    });
    
    const forecast = JSON.parse(windData.content[0].text).forecast;
    
    // Filter forecast within time window
    const relevantData = forecast.filter((f: any) => {
      const time = new Date(f.time);
      return time >= new Date(args.timeWindow.start) && 
             time <= new Date(args.timeWindow.end);
    });
    
    if (relevantData.length === 0) {
      throw new Error('No data available for specified time window');
    }
    
    const gusts = relevantData.map((f: any) => f.windGust);
    const winds = relevantData.map((f: any) => f.windSpeed);
    
    const maxGust = Math.max(...gusts);
    const averageGust = gusts.reduce((a: number, b: number) => a + b, 0) / gusts.length;
    const averageWind = winds.reduce((a: number, b: number) => a + b, 0) / winds.length;
    const gustFactor = averageWind > 0 ? averageGust / averageWind : 1;
    
    const turbulenceRisk = this.assessTurbulenceRisk(gustFactor, maxGust);
    const warnings = this.generateGustWarnings(maxGust, gustFactor, turbulenceRisk);
    
    return {
      content: [{ type: 'text', text: JSON.stringify({
        maxGust,
        averageGust,
        gustFactor,
        turbulenceRisk,
        warnings,
      }, null, 2) }],
    };
  }
  
  private transformWindyForecast(data: any, hours: number): any[] {
    const forecast = [];
    const times = data.ts || [];
    
    // Limit to requested hours
    const maxIndex = Math.min(times.length, hours);
    
    for (let i = 0; i < maxIndex; i++) {
      forecast.push({
        time: new Date(times[i]).toISOString(),
        windSpeed: this.msToKnots(data['wind-10m']?.[i] || 0),
        windGust: this.msToKnots(data.windGust?.[i] || data['wind-10m']?.[i] || 0),
        windDirection: data['windDir-10m']?.[i] || 0,
        pressure: data.pressure?.[i] || 1013,
        temperature: data.temp?.[i] || 20,
      });
    }
    
    return forecast;
  }
  
  private transformWaveData(data: any, hours: number): any[] {
    const waves = [];
    const times = data.ts || [];
    
    const maxIndex = Math.min(times.length, hours);
    
    for (let i = 0; i < maxIndex; i++) {
      waves.push({
        time: new Date(times[i]).toISOString(),
        waveHeight: data.waves?.height?.[i] || 0,
        wavePeriod: data.waves?.period?.[i] || 0,
        waveDirection: data.waves?.direction?.[i] || 0,
        swellHeight: data.swell1?.height?.[i] || 0,
        swellPeriod: data.swell1?.period?.[i] || 0,
        swellDirection: data.swell1?.direction?.[i] || 0,
      });
    }
    
    return waves;
  }
  
  private calculateBearing(from: any, to: any): number {
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;
    
    const x = Math.sin(deltaLon) * Math.cos(lat2);
    const y = Math.cos(lat1) * Math.sin(lat2) - 
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
    
    const bearing = Math.atan2(x, y);
    
    return ((bearing * 180 / Math.PI) + 360) % 360;
  }
  
  private calculateDistance(from: any, to: any): number {
    const R = 3440.065; // Earth radius in nautical miles
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const deltaLat = (to.latitude - from.latitude) * Math.PI / 180;
    const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }
  
  private calculateRelativeWindAngle(course: number, windDirection: number): number {
    let angle = windDirection - course;
    
    // Normalize to -180 to 180
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    
    return Math.abs(angle);
  }
  
  private getWindRecommendation(angle: number, windSpeed: number): string {
    if (windSpeed > 30) {
      return 'Strong wind warning - consider delaying departure';
    }
    
    if (angle < 30) {
      return 'Headwind - expect reduced speed';
    } else if (angle < 60) {
      return 'Close hauled - challenging sailing conditions';
    } else if (angle < 120) {
      return 'Beam reach - good sailing conditions';
    } else if (angle < 150) {
      return 'Broad reach - fast sailing conditions';
    } else {
      return 'Running - following wind';
    }
  }
  
  private findOptimalDeparture(segments: any[], requestedDeparture: string): string {
    // Simple optimization - could be enhanced with more sophisticated algorithm
    // For now, just return requested time if conditions are acceptable
    const avgWindSpeed = segments.reduce((sum, seg) => sum + seg.averageWind.speed, 0) / segments.length;
    
    if (avgWindSpeed > 25) {
      // Suggest delaying by 12 hours
      const delayed = new Date(requestedDeparture);
      delayed.setHours(delayed.getHours() + 12);
      return delayed.toISOString();
    }
    
    return requestedDeparture;
  }
  
  private assessTurbulenceRisk(gustFactor: number, maxGust: number): 'low' | 'moderate' | 'high' {
    if (gustFactor > 2.0 || maxGust > 40) {
      return 'high';
    } else if (gustFactor > 1.5 || maxGust > 25) {
      return 'moderate';
    }
    return 'low';
  }
  
  private generateGustWarnings(maxGust: number, gustFactor: number, risk: string): string[] {
    const warnings = [];
    
    if (maxGust > 40) {
      warnings.push('Gale force gusts expected - secure all deck equipment');
    } else if (maxGust > 30) {
      warnings.push('Strong gusts expected - reef early');
    }
    
    if (gustFactor > 2.0) {
      warnings.push('High gust factor - expect sudden wind changes');
    }
    
    if (risk === 'high') {
      warnings.push('High turbulence risk - consider alternative timing');
    }
    
    return warnings;
  }
  
  private msToKnots(ms: number): number {
    return ms * 1.94384;
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
      agentId: 'wind-agent',
      name: 'Wind Agent',
      description: 'Provides detailed wind forecasts, wave conditions, and route optimization based on wind patterns',
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
    this.logger.info('Wind agent started');
  }
}

// Start the agent if running directly
if (require.main === module) {
  const agent = new WindAgent();
  agent.start().catch(console.error);
}
