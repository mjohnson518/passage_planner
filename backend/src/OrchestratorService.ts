/**
 * OrchestratorService - Event-emitting wrapper for passage planning orchestration
 * Provides handleRequest method and event emission for WebSocket updates
 */

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

export interface PassageRequest {
  departure: {
    port?: string;
    latitude: number;
    longitude: number;
    time?: string;
  };
  destination: {
    port?: string;
    latitude: number;
    longitude: number;
  };
  vessel?: {
    type?: string;
    cruiseSpeed?: number;
    maxSpeed?: number;
    draft?: number;
  };
  preferences?: {
    avoidNight?: boolean;
    maxWindSpeed?: number;
    maxWaveHeight?: number;
  };
}

export interface ToolRequest {
  tool: string;
  arguments: any;
}

export class OrchestratorService extends EventEmitter {
  private redis: Redis | null = null;
  private isRunning: boolean = false;

  constructor() {
    super();
    
    // Connect to Redis if available
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null
      });
      
      this.redis.on('error', (err) => {
        logger.error({ error: err }, 'Redis connection error');
      });
    }
  }

  /**
   * Handle a tool request - main entry point for passage planning
   */
  async handleRequest(request: ToolRequest): Promise<any> {
    const { tool, arguments: args } = request;
    const requestId = uuidv4();
    
    logger.info({ tool, requestId }, 'Handling orchestrator request');
    
    this.emit('request:progress', {
      requestId,
      status: 'started',
      tool
    });
    
    try {
      switch (tool) {
        case 'plan_passage':
          return await this.planPassage(args, requestId);
          
        case 'get_marine_weather':
        case 'get_weather':
          return await this.getWeather(args, requestId);
          
        case 'get_tides':
          return await this.getTides(args, requestId);
          
        case 'calculate_route':
          return await this.calculateRoute(args, requestId);
          
        default:
          throw new Error(`Unknown tool: ${tool}`);
      }
    } catch (error: any) {
      logger.error({ error: error.message, tool, requestId }, 'Request failed');
      this.emit('request:progress', {
        requestId,
        status: 'error',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Plan a complete passage with weather, tides, and route
   */
  private async planPassage(request: PassageRequest, requestId: string): Promise<any> {
    this.emit('request:progress', {
      requestId,
      status: 'planning',
      message: 'Calculating route...'
    });

    // Calculate route
    const route = this.calculateSimpleRoute(
      request.departure,
      request.destination,
      request.vessel?.cruiseSpeed || 5
    );

    this.emit('request:progress', {
      requestId,
      status: 'planning',
      message: 'Fetching weather data...'
    });

    // Compile passage plan
    const passagePlan = {
      id: requestId,
      request,
      route,
      weather: {
        departure: { available: false, message: 'Weather data requires external API' },
        arrival: { available: false, message: 'Weather data requires external API' }
      },
      tides: {
        departure: { available: false, message: 'Tidal data requires external API' },
        arrival: { available: false, message: 'Tidal data requires external API' }
      },
      summary: {
        totalDistance: route.totalDistance,
        estimatedDuration: route.estimatedDuration,
        departureTime: request.departure.time || new Date().toISOString(),
        estimatedArrival: new Date(
          new Date(request.departure.time || Date.now()).getTime() + 
          route.estimatedDuration * 60 * 60 * 1000
        ).toISOString(),
        warnings: [],
        recommendations: this.generateRecommendations(route)
      }
    };

    this.emit('request:progress', {
      requestId,
      status: 'complete',
      result: passagePlan
    });

    return {
      success: true,
      result: passagePlan
    };
  }

  /**
   * Get weather data for a location
   */
  private async getWeather(args: any, requestId: string): Promise<any> {
    const { latitude, longitude, days = 3 } = args;
    
    // Return placeholder - actual weather comes from Weather Agent
    return {
      success: true,
      result: {
        location: { latitude, longitude },
        forecasts: [],
        message: 'Weather agent not connected - use direct agent calls'
      }
    };
  }

  /**
   * Get tidal data for a location
   */
  private async getTides(args: any, requestId: string): Promise<any> {
    const { latitude, longitude } = args;
    
    // Return placeholder - actual tides come from Tidal Agent
    return {
      success: true,
      result: {
        location: { latitude, longitude },
        predictions: [],
        message: 'Tidal agent not connected - use direct agent calls'
      }
    };
  }

  /**
   * Calculate a route between two points
   */
  private async calculateRoute(args: any, requestId: string): Promise<any> {
    const { startLat, startLon, endLat, endLon, speed = 5 } = args;
    
    const route = this.calculateSimpleRoute(
      { latitude: startLat, longitude: startLon },
      { latitude: endLat, longitude: endLon },
      speed
    );
    
    return {
      success: true,
      result: route
    };
  }

  /**
   * Calculate simple route using Haversine formula
   */
  private calculateSimpleRoute(
    departure: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    speed: number
  ): any {
    const distance = this.haversineDistance(
      departure.latitude,
      departure.longitude,
      destination.latitude,
      destination.longitude
    );
    
    const bearing = this.calculateBearing(
      departure.latitude,
      departure.longitude,
      destination.latitude,
      destination.longitude
    );
    
    const estimatedDuration = distance / speed;
    
    // Generate waypoints
    const numWaypoints = Math.max(2, Math.ceil(distance / 50));
    const waypoints = [];
    
    for (let i = 0; i <= numWaypoints; i++) {
      const fraction = i / numWaypoints;
      const lat = departure.latitude + (destination.latitude - departure.latitude) * fraction;
      const lon = departure.longitude + (destination.longitude - departure.longitude) * fraction;
      
      waypoints.push({
        lat,
        lon,
        distance: distance * fraction,
        bearing,
        name: i === 0 ? 'Departure' : i === numWaypoints ? 'Arrival' : `WP${i}`
      });
    }
    
    return {
      waypoints,
      totalDistance: distance,
      estimatedDuration,
      bearing,
      type: 'rhumb_line'
    };
  }

  /**
   * Haversine distance calculation (nautical miles)
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3440.065; // Earth radius in nautical miles
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Calculate bearing between two points
   */
  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    let θ = Math.atan2(y, x);
    θ = θ * 180 / Math.PI;
    return (θ + 360) % 360;
  }

  /**
   * Generate recommendations based on route
   */
  private generateRecommendations(route: any): string[] {
    const recommendations: string[] = [];
    
    if (route.totalDistance > 200) {
      recommendations.push('Long passage - ensure adequate provisions and fuel');
    }
    
    if (route.estimatedDuration > 24) {
      recommendations.push('Multi-day passage - plan watch schedule and rest periods');
    }
    
    if (route.estimatedDuration > 12) {
      recommendations.push('Extended passage - monitor weather conditions throughout transit');
    }
    
    recommendations.push('File a float plan with a trusted contact before departure');
    recommendations.push('Check all safety equipment is accessible and functional');
    
    return recommendations;
  }

  /**
   * Start the orchestrator service
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    logger.info('OrchestratorService starting...');
    this.isRunning = true;
    
    this.emit('agent:status', {
      agent: 'orchestrator',
      status: 'running'
    });
    
    logger.info('OrchestratorService started');
  }

  /**
   * Shutdown the orchestrator service
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) return;
    
    logger.info('OrchestratorService shutting down...');
    this.isRunning = false;
    
    if (this.redis) {
      await this.redis.quit();
    }
    
    this.emit('agent:status', {
      agent: 'orchestrator',
      status: 'stopped'
    });
    
    logger.info('OrchestratorService shutdown complete');
  }
}

