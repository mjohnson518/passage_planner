// agents/weather/src/index.ts
// Weather Agent Implementation

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
  WeatherCondition,
  AgentCapabilitySummary,
  ToolDefinition 
} from '@passage-planner/shared/types/core';

export class WeatherAgent {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  
  private noaaApiKey = process.env.NOAA_API_KEY;
  private openWeatherApiKey = process.env.OPENWEATHER_API_KEY;
  private cacheMap = new Map<string, { data: any; expiry: number }>();
  
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
        this.logger.error({ error, tool: name }, 'Tool execution failed');
        throw error;
      }
    });
  }
  
  private getTools(): ToolDefinition[] {
    return [
      {
        name: 'get_current_weather',
        description: 'Get current weather conditions for a specific location',
        inputSchema: z.object({
          coordinates: CoordinateSchema,
          units: z.enum(['metric', 'imperial']).optional().default('metric'),
        }),
        outputSchema: z.object({
          temperature: z.number(),
          windSpeed: z.number(),
          windDirection: z.string(),
          pressure: z.number(),
          humidity: z.number(),
          visibility: z.number(),
          conditions: z.string(),
          cloudCover: z.number(),
        }),
        examples: [
          {
            input: {
              coordinates: { latitude: 42.3601, longitude: -71.0589 },
              units: 'metric',
            },
            output: {
              temperature: 22,
              windSpeed: 5.5,
              windDirection: 'NW',
              pressure: 1013,
              humidity: 65,
              visibility: 10,
              conditions: 'Partly Cloudy',
              cloudCover: 40,
            },
          },
        ],
      },
      {
        name: 'get_marine_forecast',
        description: 'Get marine weather forecast for a specific zone or coordinates',
        inputSchema: z.object({
          zone: z.string().optional(),
          coordinates: CoordinateSchema.optional(),
          days: z.number().min(1).max(7).default(3),
        }),
        outputSchema: z.object({
          zone: z.string(),
          periods: z.array(z.object({
            name: z.string(),
            startTime: z.string(),
            endTime: z.string(),
            windSpeed: z.string(),
            windDirection: z.string(),
            waveHeight: z.string(),
            weather: z.string(),
            detailedForecast: z.string(),
          })),
          warnings: z.array(z.string()),
        }),
      },
      {
        name: 'get_storm_warnings',
        description: 'Get active storm warnings and tropical cyclone information',
        inputSchema: z.object({
          region: z.string(),
          includeWatches: z.boolean().default(true),
        }),
        outputSchema: z.object({
          warnings: z.array(z.object({
            id: z.string(),
            type: z.string(),
            severity: z.string(),
            areas: z.array(z.string()),
            validFrom: z.string(),
            validUntil: z.string(),
            description: z.string(),
          })),
          tropicalCyclones: z.array(z.object({
            name: z.string(),
            category: z.number(),
            location: CoordinateSchema,
            movement: z.object({
              direction: z.string(),
              speed: z.number(),
            }),
            forecast: z.array(z.object({
              time: z.string(),
              location: CoordinateSchema,
              intensity: z.string(),
            })),
          })),
        }),
      },
    ];
  }
  
  private async getCurrentWeather(args: any) {
    const { coordinates, units } = args;
    const cacheKey = `current-${coordinates.latitude}-${coordinates.longitude}`;
    
    // Check cache
    const cached = this.getCached(cacheKey);
    if (cached) {
      return { content: [{ type: 'text', text: JSON.stringify(cached) }] };
    }
    
    let weatherData: any = {};
    const errors: any[] = [];
    
    // Try multiple sources in parallel for better performance
    const promises = [];
    
    // NOAA Weather
    promises.push(
      this.fetchNOAACurrentWeather(coordinates)
        .then(data => ({ source: 'NOAA', data: this.transformNOAACurrentWeather(data, units) }))
        .catch(error => {
          errors.push({ source: 'NOAA', error: error.message });
          return null;
        })
    );
    
    // OpenWeatherMap current
    if (this.openWeatherApiKey) {
      promises.push(
        this.fetchOpenWeatherCurrent(coordinates, units)
          .then(data => ({ source: 'OpenWeatherMap', data: this.transformOpenWeatherCurrent(data) }))
          .catch(error => {
            errors.push({ source: 'OpenWeatherMap', error: error.message });
            return null;
          })
      );
      
      // OpenWeatherMap marine (One Call API 3.0)
      promises.push(
        this.fetchOpenWeatherMarine(coordinates, units)
          .then(data => ({ source: 'OpenWeatherMap Marine', data }))
          .catch(error => {
            errors.push({ source: 'OpenWeatherMap Marine', error: error.message });
            return null;
          })
      );
      
      // UV Index
      promises.push(
        this.fetchOpenWeatherUV(coordinates)
          .then(uvIndex => ({ source: 'UV', data: { uvIndex } }))
          .catch(() => null)
      );
    }
    
    const results = await Promise.all(promises);
    
    // Merge results from all sources
    for (const result of results) {
      if (result && result.data) {
        if (result.source === 'NOAA') {
          weatherData = { ...weatherData, ...result.data, primarySource: 'NOAA' };
        } else if (result.source === 'OpenWeatherMap') {
          weatherData = { ...result.data, ...weatherData };
          if (!weatherData.primarySource) weatherData.primarySource = 'OpenWeatherMap';
        } else if (result.source === 'OpenWeatherMap Marine' && result.data.current) {
          weatherData.marine = {
            waveHeight: result.data.current.waves?.height,
            wavePeriod: result.data.current.waves?.period,
            waveDirection: result.data.current.waves?.direction,
            visibility: result.data.current.visibility,
          };
        } else if (result.source === 'UV') {
          weatherData.uvIndex = result.data.uvIndex;
        }
      }
    }
    
    if (!weatherData.temperature && !weatherData.windSpeed) {
      this.logger.error('All weather APIs failed', { errors });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Unable to fetch weather data',
            errors,
            fallbackData: {
              temperature: 20,
              windSpeed: 10,
              windDirection: 'N',
              conditions: 'Data unavailable',
              source: 'fallback',
            },
          }),
        }],
      };
    }
    
    // Add metadata
    weatherData.fetchedAt = new Date().toISOString();
    weatherData.coordinates = coordinates;
    weatherData.dataSources = results.filter(r => r !== null).map(r => r!.source);
    
    // Cache for 15 minutes
    this.setCache(cacheKey, weatherData, 900);
    
    return { content: [{ type: 'text', text: JSON.stringify(weatherData) }] };
  }
  
  private async getMarineForecast(args: any) {
    const { zone, coordinates, days } = args;
    const cacheKey = `marine-${zone || `${coordinates.latitude}-${coordinates.longitude}`}`;
    
    // Check cache
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      let marineZone = zone;
      
      // If no zone provided, find nearest marine zone
      if (!marineZone && coordinates) {
        marineZone = await this.findNearestMarineZone(coordinates);
      }
      
      const response = await this.fetchNOAAMarineForecast(marineZone);
      const result = this.transformMarineForecast(response, days);
      this.setCache(cacheKey, result, 3600); // 1 hour
      
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      this.logger.error({ error, zone }, 'Failed to fetch marine forecast');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Unable to fetch marine forecast',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
        }],
      };
    }
  }
  
  private async getStormWarnings(args: any) {
    const { region, includeWatches } = args;
    const cacheKey = `storms-${region}`;
    
    // Check cache
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const [warnings, cyclones] = await Promise.all([
        this.fetchActiveWarnings(region, includeWatches),
        this.fetchTropicalCyclones(region),
      ]);
      
      const result = {
        warnings: this.transformWarnings(warnings),
        tropicalCyclones: this.transformCyclones(cyclones),
      };
      
      this.setCache(cacheKey, result, 600); // 10 minutes
      
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      this.logger.error({ error, region }, 'Failed to fetch storm warnings');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Unable to fetch storm warnings',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
        }],
      };
    }
  }
  
  // NOAA API methods
  private async fetchNOAACurrentWeather(coordinates: any) {
    // First get the grid point
    const pointUrl = `https://api.weather.gov/points/${coordinates.latitude},${coordinates.longitude}`;
    const pointResponse = await axios.get(pointUrl, {
      headers: { 'User-Agent': 'PassagePlanner/1.0' },
    });
    
    const { gridX, gridY, gridId } = pointResponse.data.properties;
    
    // Get current observations
    const stationUrl = pointResponse.data.properties.observationStations;
    const stationsResponse = await axios.get(stationUrl, {
      headers: { 'User-Agent': 'PassagePlanner/1.0' },
    });
    
    const stationId = stationsResponse.data.features[0]?.properties.stationIdentifier;
    if (!stationId) {
      throw new Error('No observation station found');
    }
    
    const obsUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`;
    const obsResponse = await axios.get(obsUrl, {
      headers: { 'User-Agent': 'PassagePlanner/1.0' },
    });
    
    return obsResponse.data;
  }
  
  private transformNOAACurrentWeather(data: any, units: string) {
    const props = data.properties;
    const isMetric = units === 'metric';
    
    return {
      temperature: isMetric 
        ? props.temperature.value 
        : (props.temperature.value * 9/5) + 32,
      windSpeed: isMetric
        ? props.windSpeed.value * 3.6 // m/s to km/h
        : props.windSpeed.value * 2.237, // m/s to mph
      windDirection: this.degreesToCardinal(props.windDirection.value),
      pressure: props.barometricPressure.value / 100, // Pa to hPa
      humidity: props.relativeHumidity.value,
      visibility: props.visibility.value / 1000, // m to km
      conditions: props.textDescription,
      cloudCover: this.estimateCloudCover(props.cloudLayers),
    };
  }
  
  // OpenWeatherMap fallback
  private async fetchOpenWeatherCurrent(coordinates: any, units: string) {
    const url = `https://api.openweathermap.org/data/2.5/weather`;
    const response = await axios.get(url, {
      params: {
        lat: coordinates.latitude,
        lon: coordinates.longitude,
        appid: this.openWeatherApiKey,
        units: units === 'metric' ? 'metric' : 'imperial',
      },
      timeout: 5000,
    });
    
    return response.data;
  }
  
  private async fetchOpenWeatherMarine(coordinates: any, units: string) {
    // One Call API 3.0 for marine-specific data
    const url = `https://api.openweathermap.org/data/3.0/onecall`;
    
    try {
      const response = await axios.get(url, {
        params: {
          lat: coordinates.latitude,
          lon: coordinates.longitude,
          appid: this.openWeatherApiKey,
          units: units === 'metric' ? 'metric' : 'imperial',
          exclude: 'minutely,alerts', // We handle alerts separately
        },
        timeout: 10000,
      });
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.logger.warn('OpenWeatherMap One Call API 3.0 requires separate subscription');
        return null;
      }
      throw error;
    }
  }
  
  private async fetchOpenWeatherUV(coordinates: any) {
    const url = `https://api.openweathermap.org/data/2.5/uvi`;
    
    try {
      const response = await axios.get(url, {
        params: {
          lat: coordinates.latitude,
          lon: coordinates.longitude,
          appid: this.openWeatherApiKey,
        },
        timeout: 5000,
      });
      
      return response.data.value;
    } catch (error) {
      this.logger.warn('UV index fetch failed', error);
      return null;
    }
  }
  
  private async fetchOpenWeatherForecast(coordinates: any, units: string, days: number = 5) {
    const url = `https://api.openweathermap.org/data/2.5/forecast`;
    
    const response = await axios.get(url, {
      params: {
        lat: coordinates.latitude,
        lon: coordinates.longitude,
        appid: this.openWeatherApiKey,
        units: units === 'metric' ? 'metric' : 'imperial',
        cnt: days * 8, // 8 forecasts per day (3-hour intervals)
      },
      timeout: 10000,
    });
    
    return response.data;
  }
  
  private transformOpenWeatherCurrent(data: any) {
    return {
      temperature: data.main.temp,
      windSpeed: data.wind.speed,
      windDirection: this.degreesToCardinal(data.wind.deg),
      pressure: data.main.pressure,
      humidity: data.main.humidity,
      visibility: data.visibility / 1000,
      conditions: data.weather[0].description,
      cloudCover: data.clouds.all,
    };
  }
  
  // Marine forecast methods
  private async fetchNOAAMarineForecast(zone: string) {
    const url = `https://api.weather.gov/products/types/CWF/zones/${zone}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'PassagePlanner/1.0' },
    });
    
    // Get the latest product
    const latestProduct = response.data['@graph'][0];
    const productUrl = `https://api.weather.gov/products/${latestProduct.id}`;
    const productResponse = await axios.get(productUrl, {
      headers: { 'User-Agent': 'PassagePlanner/1.0' },
    });
    
    return productResponse.data;
  }
  
  private transformMarineForecast(data: any, days: number) {
    const text = data.productText;
    const periods = this.parseMarineForecastText(text);
    
    return {
      zone: data.issuingOffice,
      periods: periods.slice(0, days * 2), // Day and night periods
      warnings: this.extractWarnings(text),
    };
  }
  
  private parseMarineForecastText(text: string) {
    const periods: any[] = [];
    const lines = text.split('\n');
    
    let currentPeriod: any = null;
    
    for (const line of lines) {
      if (line.match(/^\.([A-Z ]+)\.\.\./)) {
        if (currentPeriod) {
          periods.push(currentPeriod);
        }
        const match = line.match(/^\.([A-Z ]+)\.\.\./);
        currentPeriod = {
          name: match ? match[1] : 'Unknown',
          text: '',
        };
      } else if (currentPeriod) {
        currentPeriod.text += line + ' ';
      }
    }
    
    if (currentPeriod) {
      periods.push(currentPeriod);
    }
    
    return periods;
  }
  
  // Utility methods
  private degreesToCardinal(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
  
  private estimateCloudCover(cloudLayers: any[]): number {
    if (!cloudLayers || cloudLayers.length === 0) return 0;
    
    const coverageMap: { [key: string]: number } = {
      CLR: 0,
      FEW: 25,
      SCT: 50,
      BKN: 75,
      OVC: 100,
    };
    
    let maxCoverage = 0;
    for (const layer of cloudLayers) {
      const coverage = coverageMap[layer.amount as string] || 0;
      maxCoverage = Math.max(maxCoverage, coverage);
    }
    
    return maxCoverage;
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
    if (text.includes('HURRICANE')) {
      warnings.push('Hurricane Warning');
    }
    
    return warnings;
  }
  
  private async findNearestMarineZone(coordinates: any): Promise<string> {
    // This would query a database or API to find the nearest marine zone
    // For now, return a default zone
    return 'ANZ250'; // Example: Boston Harbor approach
  }
  
  private async fetchActiveWarnings(region: string, includeWatches: boolean) {
    // Fetch from NOAA alerts API
    const url = `https://api.weather.gov/alerts/active`;
    const response = await axios.get(url, {
      params: {
        area: region,
        status: 'actual',
        message_type: 'alert',
      },
      headers: { 'User-Agent': 'PassagePlanner/1.0' },
    });
    
    return response.data.features;
  }
  
  private async fetchTropicalCyclones(region: string) {
    // This would fetch from NHC or similar service
    // Simplified mock implementation
    return [];
  }
  
  private transformWarnings(warnings: any[]) {
    return warnings.map(w => ({
      id: w.id,
      type: w.properties.event,
      severity: w.properties.severity,
      areas: w.properties.areaDesc.split(';'),
      validFrom: w.properties.onset,
      validUntil: w.properties.expires,
      description: w.properties.description,
    }));
  }
  
  private transformCyclones(cyclones: any[]) {
    // Transform tropical cyclone data
    return cyclones;
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
      agentId: 'weather-agent',
      name: 'Weather Agent',
      description: 'Provides weather data and marine forecasts for passage planning',
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
      this.logger.info('Weather agent started');
      
      // Register with orchestrator
      // In production, this would be done via HTTP or message queue
      process.send?.({
        type: 'agent:register',
        data: this.getCapabilitySummary(),
      });
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start weather agent');
      process.exit(1);
    }
  }
}

// Start the agent
if (require.main === module) {
  const agent = new WeatherAgent();
  agent.start().catch(console.error);
} 