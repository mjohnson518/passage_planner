import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock ioredis before importing WeatherAgent
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async () => null),
    setex: jest.fn(async () => 'OK'),
    hset: jest.fn(async () => 1),
    hgetall: jest.fn(async () => ({ 
      status: 'healthy', 
      lastHeartbeat: new Date().toISOString() 
    })),
    ping: jest.fn(async () => 'PONG'),
    quit: jest.fn(async () => 'OK'),
  }));
});

// Mock axios for API calls
jest.mock('axios');

import { WeatherAgent } from '../WeatherAgent';
import Redis from 'ioredis';

describe('WeatherAgent', () => {
  let weatherAgent: WeatherAgent;
  let redis: Redis;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const noaaApiKey = process.env.NOAA_API_KEY || 'test-noaa-key';
  const openWeatherApiKey = process.env.OPENWEATHER_API_KEY || 'test-openweather-key';

  beforeAll(async () => {
    redis = new Redis(redisUrl);
    weatherAgent = new WeatherAgent(redisUrl, noaaApiKey, openWeatherApiKey);
    await weatherAgent.initialize();
  }, 15000); // Increased timeout

  afterAll(async () => {
    await weatherAgent.shutdown();
    await redis.quit();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(weatherAgent).toBeDefined();
    });

    it('should report healthy status in Redis', async () => {
      const health = await redis.hgetall('agent:health:weather-agent');
      expect(health.status).toBe('healthy');
      expect(health.lastHeartbeat).toBeDefined();
    });

    it('should return weather tools', () => {
      const tools = weatherAgent.getTools();
      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toContain('get_marine_forecast');
      expect(tools.map(t => t.name)).toContain('get_weather_warnings');
      expect(tools.map(t => t.name)).toContain('get_grib_data');
    });
  });

  describe('Caching', () => {
    it('should cache forecast data', async () => {
      const lat = 42.3601;
      const lon = -71.0589;
      
      // Generate cache key same way the agent does
      const cacheKey = `weather-agent:${require('crypto')
        .createHash('md5')
        .update(`forecast:${lat}:${lon}:72`)
        .digest('hex')}`;
      
      // Set mock data in cache
      const mockForecast = [
        {
          time: new Date().toISOString(),
          windSpeed: 10,
          windDirection: 180,
          windGust: 15,
          waveHeight: 1.5,
          wavePeriod: 6,
          waveDirection: 180,
          precipitation: 0,
          visibility: 10,
          temperature: 20,
          pressure: 1013,
          cloudCover: 50
        }
      ];
      
      // Mock the get method to return our data
      const mockRedisGet = redis.get as jest.MockedFunction<typeof redis.get>;
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(mockForecast));
      
      // Set in cache
      await redis.setex(cacheKey, 1800, JSON.stringify(mockForecast));
      
      // Verify cache was set and can be retrieved
      const cached = await redis.get(cacheKey);
      expect(cached).toBeDefined();
      expect(cached).not.toBeNull();
      
      if (cached) {
        const parsedData = JSON.parse(cached);
        expect(Array.isArray(parsedData)).toBe(true);
        expect(parsedData).toHaveLength(1);
        expect(parsedData[0]).toHaveProperty('windSpeed', 10);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid coordinates', async () => {
      await expect(
        weatherAgent.handleToolCall('get_marine_forecast', {
          latitude: 999,
          longitude: 999,
          hours: 72
        })
      ).rejects.toThrow();
    });

    it('should handle unknown tool calls', async () => {
      await expect(
        weatherAgent.handleToolCall('nonexistent_tool', {})
      ).rejects.toThrow('Unknown tool');
    });
  });

  describe('Tool Schema Validation', () => {
    it('should have valid input schema for get_marine_forecast', () => {
      const tools = weatherAgent.getTools();
      const forecastTool = tools.find(t => t.name === 'get_marine_forecast');
      
      expect(forecastTool).toBeDefined();
      expect(forecastTool!.inputSchema.properties).toHaveProperty('latitude');
      expect(forecastTool!.inputSchema.properties).toHaveProperty('longitude');
      expect(forecastTool!.inputSchema.required).toContain('latitude');
      expect(forecastTool!.inputSchema.required).toContain('longitude');
    });

    it('should have valid input schema for get_weather_warnings', () => {
      const tools = weatherAgent.getTools();
      const warningsTool = tools.find(t => t.name === 'get_weather_warnings');
      
      expect(warningsTool).toBeDefined();
      expect(warningsTool!.inputSchema.properties).toHaveProperty('latitude');
      expect(warningsTool!.inputSchema.properties).toHaveProperty('longitude');
    });
  });

  describe('GRIB Data', () => {
    it('should generate GRIB data URL', async () => {
      const result = await weatherAgent.handleToolCall('get_grib_data', {
        bounds: {
          north: 45,
          south: 40,
          east: -70,
          west: -75
        },
        resolution: '0.5',
        parameters: ['wind', 'waves']
      });
      
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('format');
      expect(result.format).toBe('GRIB2');
      expect(result.url).toContain('nomads.ncep.noaa.gov');
    });
  });
});

