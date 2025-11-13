import { BaseAgent, NOAAWeatherService, CacheManager } from '@passage-planner/shared';
import { ValidationError, NOAAAPIError, toMCPError } from '@passage-planner/shared/dist/errors/mcp-errors';
import { Logger } from 'pino';
import pino from 'pino';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types';

export class WeatherAgent extends BaseAgent {
  private weatherService: NOAAWeatherService;
  private cache: CacheManager;
  
  constructor() {
    const logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    });
    
    super(
      {
        name: 'Weather Analysis Agent',
        version: '2.0.0',
        description: 'Provides real-time marine weather forecasts and safety analysis using NOAA data',
        healthCheckInterval: 30000,
      },
      logger
    );
    
    this.cache = new CacheManager(logger);
    this.weatherService = new NOAAWeatherService(this.cache, logger);
    
    this.setupTools();
  }
  
  protected getAgentSpecificHealth(): any {
    return {
      weatherServiceActive: true,
      cacheStatus: 'active',
      lastForecastTime: new Date()
    };
  }
  
  private setupTools() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_marine_weather',
            description: 'Get comprehensive marine weather forecast for a location',
            inputSchema: {
              type: 'object',
              properties: {
                latitude: { type: 'number', minimum: -90, maximum: 90 },
                longitude: { type: 'number', minimum: -180, maximum: 180 },
                days: { type: 'number', minimum: 1, maximum: 10, default: 7 }
              },
              required: ['latitude', 'longitude']
            }
          },
          {
            name: 'check_weather_safety',
            description: 'Check if weather conditions are safe for sailing',
            inputSchema: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                maxWindSpeed: { type: 'number', description: 'Maximum safe wind speed in knots' },
                maxWaveHeight: { type: 'number', description: 'Maximum safe wave height in meters' },
                minVisibility: { type: 'number', description: 'Minimum required visibility in nm' }
              },
              required: ['latitude', 'longitude']
            }
          },
          {
            name: 'get_weather_windows',
            description: 'Find safe weather windows for sailing',
            inputSchema: {
              type: 'object',
              properties: {
                startLat: { type: 'number' },
                startLon: { type: 'number' },
                endLat: { type: 'number' },
                endLon: { type: 'number' },
                departureDate: { type: 'string', format: 'date' },
                durationHours: { type: 'number' },
                maxWindSpeed: { type: 'number' },
                maxWaveHeight: { type: 'number' }
              },
              required: ['startLat', 'startLon', 'endLat', 'endLon', 'departureDate']
            }
          },
          {
            name: 'health',
            description: 'Check the health status of the Weather Agent and its dependencies',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });
    
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'get_marine_weather':
            return await this.getMarineWeather(args);
            
          case 'check_weather_safety':
            return await this.checkWeatherSafety(args);
            
          case 'get_weather_windows':
            return await this.getWeatherWindows(args);
          
          case 'health':
            return await this.checkHealth();
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Tool execution failed');
        throw error;
      }
    });
  }
  
  private async getMarineWeather(args: any): Promise<any> {
    const { latitude, longitude, days = 7 } = args;
    
    try {
      // Validate coordinates
      ValidationError.validateCoordinates(latitude, longitude);
      const forecast = await this.weatherService.getMarineForecast(
        latitude, 
        longitude, 
        days
      );
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatWeatherSummary(forecast)
          },
          {
            type: 'data',
            data: forecast
          }
        ]
      };
    } catch (error) {
      const mcpError = toMCPError(error);
      this.logger.error({ 
        error: mcpError.toJSON(), 
        args 
      }, 'Failed to get marine weather');
      
      return {
        content: [{
          type: 'text',
          text: `Unable to retrieve weather forecast: ${mcpError.message}`
        }],
        isError: true,
        errorCode: mcpError.code,
        retryable: mcpError.retryable
      };
    }
  }
  
  private async checkWeatherSafety(args: any): Promise<any> {
    const {
      latitude,
      longitude,
      maxWindSpeed = 25,
      maxWaveHeight = 2,
      minVisibility = 5
    } = args;
    
    try {
      const forecast = await this.weatherService.getMarineForecast(latitude, longitude, 3);
      const safetyCheck = await this.weatherService.checkSafetyConditions(
        forecast,
        { maxWindSpeed, maxWaveHeight, minVisibility }
      );
      
      return {
        content: [
          {
            type: 'text',
            text: safetyCheck.safe 
              ? '✅ Weather conditions are SAFE for sailing'
              : '⚠️ Weather conditions are UNSAFE for sailing'
          },
          {
            type: 'data',
            data: {
              safe: safetyCheck.safe,
              warnings: safetyCheck.warnings,
              forecast: forecast
            }
          }
        ]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Unable to check weather safety: ${(error as Error).message}`
        }],
        isError: true
      };
    }
  }
  
  private async getWeatherWindows(args: any): Promise<any> {
    const {
      startLat,
      startLon,
      endLat,
      endLon,
      departureDate,
      durationHours,
      maxWindSpeed = 25,
      maxWaveHeight = 2
    } = args;
    
    try {
      const [startForecast, endForecast] = await Promise.all([
        this.weatherService.getMarineForecast(startLat, startLon, 7),
        this.weatherService.getMarineForecast(endLat, endLon, 7)
      ]);
      
      const windows = this.findSafeWindows(
        startForecast,
        endForecast,
        new Date(departureDate),
        durationHours,
        { maxWindSpeed, maxWaveHeight, minVisibility: 5 }
      );
      
      return {
        content: [
          {
            type: 'text',
            text: windows.length > 0
              ? `Found ${windows.length} safe weather windows for your passage`
              : 'No safe weather windows found in the next 7 days'
          },
          {
            type: 'data',
            data: {
              windows,
              startForecast,
              endForecast
            }
          }
        ]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Unable to find weather windows: ${(error as Error).message}`
        }],
        isError: true
      };
    }
  }
  
  private formatWeatherSummary(forecast: any): string {
    const lines = [
      `🌊 Marine Weather Forecast for ${forecast.location.name || `${forecast.location.latitude.toFixed(2)}°, ${forecast.location.longitude.toFixed(2)}°`}`,
      `Issued: ${forecast.issuedAt.toLocaleString()}`,
      ''
    ];
    
    if (forecast.warnings.length > 0) {
      lines.push('⚠️ **WEATHER WARNINGS:**');
      forecast.warnings.forEach((w: any) => {
        lines.push(`- ${w.headline} (${w.severity})`);
      });
      lines.push('');
    }
    
    lines.push('**Forecast:**');
    forecast.periods.slice(0, 6).forEach((period: any) => {
      lines.push(`${period.startTime.toLocaleDateString()} ${period.isDaytime ? '☀️' : '🌙'}: ${period.shortForecast}`);
      lines.push(`  Wind: ${period.windSpeed} ${period.windDirection}`);
      lines.push(`  Temp: ${period.temperature}°${period.temperatureUnit}`);
    });
    
    return lines.join('\n');
  }
  
  private findSafeWindows(
    startForecast: any,
    endForecast: any,
    departureDate: Date,
    durationHours: number,
    preferences: any
  ): any[] {
    const windows = [];
    const endDate = new Date(departureDate);
    endDate.setDate(endDate.getDate() + 7);
    
    const current = new Date(departureDate);
    while (current < endDate) {
      const windowEnd = new Date(current);
      windowEnd.setHours(windowEnd.getHours() + durationHours);
      
      const startSafe = this.isWindowSafe(startForecast, current, windowEnd, preferences);
      const endSafe = this.isWindowSafe(endForecast, current, windowEnd, preferences);
      
      if (startSafe && endSafe) {
        windows.push({
          start: new Date(current),
          end: new Date(windowEnd),
          conditions: 'Safe conditions at both departure and arrival'
        });
      }
      
      current.setHours(current.getHours() + 6);
    }
    
    return windows;
  }
  
  private isWindowSafe(forecast: any, start: Date, end: Date, preferences: any): boolean {
    const activeWarnings = forecast.warnings.filter((w: any) => 
      w.onset <= end && w.expires >= start &&
      (w.severity === 'extreme' || w.severity === 'severe')
    );
    
    if (activeWarnings.length > 0) {
      return false;
    }
    
    return true;
  }
  
  private async checkHealth(): Promise<any> {
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      lastSuccess: null,
      errorRate: 0,
      circuitStates: {},
      dependencies: {}
    };
    
    try {
      // Check circuit breaker states
      const circuitNames = ['noaa-gridpoint', 'noaa-forecast'];
      for (const name of circuitNames) {
        const state = (CircuitBreakerFactory as any).getState?.(name);
        const metrics = (CircuitBreakerFactory as any).getMetrics?.(name);
        
        health.circuitStates[name] = {
          state: state || 'UNKNOWN',
          metrics: metrics || {}
        };
        
        if (state === 'OPEN') {
          health.status = 'degraded';
        }
      }
      
      // Check NOAA API connectivity
      try {
        const testForecast = await this.weatherService.getMarineForecast(
          42.3601, // Boston coordinates
          -71.0589,
          1
        );
        health.dependencies.noaaApi = {
          status: 'healthy',
          lastCheck: new Date().toISOString()
        };
        health.lastSuccess = new Date().toISOString();
      } catch (error: any) {
        health.dependencies.noaaApi = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date().toISOString()
        };
        health.status = 'unhealthy';
      }
      
      // Check Redis connectivity
      try {
        await this.cache.get('health:check');
        health.dependencies.redis = {
          status: 'healthy',
          lastCheck: new Date().toISOString()
        };
      } catch (error: any) {
        health.dependencies.redis = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date().toISOString()
        };
        health.status = 'degraded';
      }
      
      // Calculate error rate (simplified - in production would track over time)
      const failures = health.circuitStates['noaa-forecast']?.metrics?.failures || 0;
      const successes = health.circuitStates['noaa-forecast']?.metrics?.successes || 0;
      const total = failures + successes;
      if (total > 0) {
        health.errorRate = (failures / total) * 100;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(health, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              error: error.message,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    }
  }
  
  /**
   * Public method to call tools directly (for orchestrator)
   */
  public async callTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'get_marine_weather':
      case 'get_marine_forecast': // Alias for compatibility
        return await this.getMarineWeather(args);
      case 'check_weather_safety':
        return await this.checkWeatherSafety(args);
      case 'get_weather_windows':
        return await this.getWeatherWindows(args);
      case 'health':
        return await this.checkHealth();
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

// Import CircuitBreakerFactory for health checks
const { CircuitBreakerFactory } = require('@passage-planner/shared/dist/services/resilience/circuit-breaker');

// Start the agent if run directly
if (require.main === module) {
  const agent = new WeatherAgent();
  agent.start().catch(console.error);
} 