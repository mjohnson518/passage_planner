import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import pino from 'pino';
import { z } from 'zod';
import { 
  AgentCapabilitySummary, 
  CacheManager,
  APIFallbackManager,
  CoordinateSchema 
} from '@passage-planner/shared';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

class WeatherAgent {
  private server: Server;
  private cacheManager: CacheManager;
  private fallbackManager: APIFallbackManager;
  
  constructor() {
    this.server = new Server(
      {
        name: 'weather-agent',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.cacheManager = new CacheManager();
    this.fallbackManager = new APIFallbackManager([
      { name: 'noaa', baseUrl: 'https://api.weather.gov', priority: 1 },
      { name: 'openweather', baseUrl: 'https://api.openweathermap.org/data/2.5', priority: 2 }
    ]);
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_current_weather',
          description: 'Get current weather conditions at a location',
          inputSchema: {
            type: 'object',
            properties: {
              coordinates: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                },
                required: ['latitude', 'longitude']
              },
              units: {
                type: 'string',
                enum: ['metric', 'imperial'],
                default: 'metric'
              }
            },
            required: ['coordinates']
          }
        },
        {
          name: 'get_marine_forecast',
          description: 'Get marine weather forecast for a zone',
          inputSchema: {
            type: 'object',
            properties: {
              zone: { type: 'string', description: 'Marine zone ID (e.g., ANZ250)' },
              days: { type: 'number', minimum: 1, maximum: 7, default: 3 }
            },
            required: ['zone']
          }
        },
        {
          name: 'get_storm_warnings',
          description: 'Get active storm warnings for an area',
          inputSchema: {
            type: 'object',
            properties: {
              coordinates: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                },
                required: ['latitude', 'longitude']
              },
              radius: { type: 'number', description: 'Search radius in km', default: 100 }
            },
            required: ['coordinates']
          }
        }
      ]
    }));
    
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'get_current_weather':
            return await this.getCurrentWeather(args);
          case 'get_marine_forecast':
            return await this.getMarineForecast(args);
          case 'get_storm_warnings':
            return await this.getStormWarnings(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error({ error, tool: name }, 'Tool execution failed');
        throw error;
      }
    });
  }
  
  private async getCurrentWeather(args: any) {
    const { coordinates, units = 'metric' } = args;
    const cacheKey = `weather:current:${coordinates.latitude},${coordinates.longitude}`;
    
    // Check cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return { content: [{ type: 'text', text: JSON.stringify(cached) }] };
    }
    
    try {
      // Try NOAA first
      const gridPoint = await this.getNoaaGridPoint(coordinates);
      const noaaData = await axios.get(`https://api.weather.gov/gridpoints/${gridPoint}/forecast`);
      
      const current = noaaData.data.properties.periods[0];
      const weatherData = {
        temperature: this.extractTemperature(current.temperature, current.temperatureUnit, units),
        windSpeed: this.extractWindSpeed(current.windSpeed, units),
        windDirection: current.windDirection,
        conditions: current.shortForecast,
        humidity: current.relativeHumidity?.value || null,
        pressure: null, // NOAA doesn't provide pressure
        visibility: null,
        timestamp: new Date().toISOString()
      };
      
      await this.cacheManager.set(cacheKey, weatherData, 900); // 15 minutes
      return { content: [{ type: 'text', text: JSON.stringify(weatherData) }] };
      
    } catch (error) {
      logger.warn({ error }, 'NOAA API failed, trying OpenWeather');
      
      // Fallback to OpenWeather
      const owData = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${coordinates.latitude}&lon=${coordinates.longitude}&units=${units}&appid=${process.env.OPENWEATHER_API_KEY}`
      );
      
      const weatherData = {
        temperature: owData.data.main.temp,
        windSpeed: owData.data.wind.speed,
        windDirection: this.degreesToCardinal(owData.data.wind.deg),
        conditions: owData.data.weather[0].description,
        humidity: owData.data.main.humidity,
        pressure: owData.data.main.pressure,
        visibility: owData.data.visibility,
        timestamp: new Date().toISOString()
      };
      
      await this.cacheManager.set(cacheKey, weatherData, 900);
      return { content: [{ type: 'text', text: JSON.stringify(weatherData) }] };
    }
  }
  
  private async getMarineForecast(args: any) {
    const { zone, days = 3 } = args;
    const cacheKey = `weather:marine:${zone}:${days}`;
    
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return { content: [{ type: 'text', text: JSON.stringify(cached) }] };
    }
    
    try {
      const response = await axios.get(`https://api.weather.gov/products/types/AFD/locations/${zone}`);
      const products = response.data['@graph'];
      
      if (products.length === 0) {
        throw new Error('No marine forecast available');
      }
      
      const latestProduct = await axios.get(products[0]['@id']);
      const forecastText = latestProduct.data.productText;
      
      // Parse the forecast text (simplified)
      const forecast = {
        zone,
        issuedAt: latestProduct.data.issuanceTime,
        periods: this.parseMarineForecast(forecastText, days),
        warnings: this.extractWarnings(forecastText),
        raw: forecastText
      };
      
      await this.cacheManager.set(cacheKey, forecast, 3600); // 1 hour
      return { content: [{ type: 'text', text: JSON.stringify(forecast) }] };
      
    } catch (error) {
      logger.error({ error, zone }, 'Failed to get marine forecast');
      throw error;
    }
  }
  
  private async getStormWarnings(args: any) {
    const { coordinates, radius = 100 } = args;
    const cacheKey = `weather:warnings:${coordinates.latitude},${coordinates.longitude}:${radius}`;
    
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return { content: [{ type: 'text', text: JSON.stringify(cached) }] };
    }
    
    try {
      const response = await axios.get(
        `https://api.weather.gov/alerts/active?point=${coordinates.latitude},${coordinates.longitude}`
      );
      
      const warnings = response.data.features
        .filter((alert: any) => 
          alert.properties.severity === 'Severe' || 
          alert.properties.severity === 'Extreme'
        )
        .map((alert: any) => ({
          id: alert.properties.id,
          event: alert.properties.event,
          severity: alert.properties.severity,
          urgency: alert.properties.urgency,
          headline: alert.properties.headline,
          description: alert.properties.description,
          onset: alert.properties.onset,
          expires: alert.properties.expires,
          areas: alert.properties.areaDesc
        }));
      
      const result = {
        location: coordinates,
        warnings,
        timestamp: new Date().toISOString()
      };
      
      await this.cacheManager.set(cacheKey, result, 600); // 10 minutes
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      
    } catch (error) {
      logger.error({ error }, 'Failed to get storm warnings');
      throw error;
    }
  }
  
  private async getNoaaGridPoint(coordinates: { latitude: number; longitude: number }): Promise<string> {
    const response = await axios.get(
      `https://api.weather.gov/points/${coordinates.latitude},${coordinates.longitude}`
    );
    const props = response.data.properties;
    return `${props.gridId}/${props.gridX},${props.gridY}`;
  }
  
  private extractTemperature(temp: number, unit: string, targetUnit: string): number {
    if (unit === 'F' && targetUnit === 'metric') {
      return (temp - 32) * 5/9;
    } else if (unit === 'C' && targetUnit === 'imperial') {
      return temp * 9/5 + 32;
    }
    return temp;
  }
  
  private extractWindSpeed(windStr: string, targetUnit: string): number {
    const match = windStr.match(/(\d+)\s*to\s*(\d+)\s*(mph|kt|kph)?/i);
    if (match) {
      const avg = (parseInt(match[1]) + parseInt(match[2])) / 2;
      const unit = match[3]?.toLowerCase() || 'mph';
      
      if (unit === 'mph' && targetUnit === 'metric') {
        return avg * 1.60934; // Convert to km/h
      } else if (unit === 'kt') {
        return targetUnit === 'metric' ? avg * 1.852 : avg * 1.15078;
      }
      return avg;
    }
    return 0;
  }
  
  private degreesToCardinal(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
  
  private parseMarineForecast(text: string, days: number): any[] {
    // Simplified parsing - in production, use more sophisticated NLP
    const periods = [];
    const dayPatterns = ['TODAY', 'TONIGHT', 'TOMORROW', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    
    // This is a placeholder - real implementation would parse the forecast text properly
    for (let i = 0; i < Math.min(days, 3); i++) {
      periods.push({
        day: i,
        conditions: 'Parsed from forecast text',
        windSpeed: '10-15 kt',
        waveHeight: '2-4 ft',
        warnings: []
      });
    }
    
    return periods;
  }
  
  private extractWarnings(text: string): string[] {
    const warnings = [];
    
    if (text.includes('SMALL CRAFT ADVISORY')) {
      warnings.push('Small Craft Advisory');
    }
    if (text.includes('GALE WARNING')) {
      warnings.push('Gale Warning');
    }
    if (text.includes('STORM WARNING')) {
      warnings.push('Storm Warning');
    }
    
    return warnings;
  }
  
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Weather agent started');
    
    // Register with orchestrator
    await this.registerWithOrchestrator();
  }
  
  private async registerWithOrchestrator() {
    const capabilities: AgentCapabilitySummary = {
      agentId: 'weather-agent',
      name: 'Weather Agent',
      description: 'Provides weather forecasts and marine conditions',
      version: '1.0.0',
      status: 'active',
      tools: [
        {
          name: 'get_current_weather',
          description: 'Get current weather conditions at a location',
          inputSchema: z.object({
            coordinates: CoordinateSchema,
            units: z.enum(['metric', 'imperial']).optional()
          }),
          outputSchema: z.object({
            temperature: z.number(),
            windSpeed: z.number(),
            windDirection: z.string(),
            conditions: z.string()
          })
        }
      ],
      resources: [],
      prompts: [],
      lastUpdated: new Date(),
      healthEndpoint: '/health',
      performance: {
        averageResponseTime: 0,
        successRate: 1.0
      }
    };
    
    try {
      await axios.post('http://localhost:8080/api/agents/register', capabilities);
      logger.info('Registered with orchestrator');
    } catch (error) {
      logger.error({ error }, 'Failed to register with orchestrator');
    }
  }
}

// Start the agent
if (require.main === module) {
  const agent = new WeatherAgent();
  agent.start().catch(console.error);
} 