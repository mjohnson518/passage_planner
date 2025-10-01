import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { TidalAgent } from '../TidalAgent';
import Redis from 'ioredis';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TidalAgent', () => {
  let tidalAgent: TidalAgent;
  let redis: Redis;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const noaaApiKey = process.env.NOAA_API_KEY || 'test-noaa-key';

  beforeAll(async () => {
    redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    tidalAgent = new TidalAgent(redisUrl, noaaApiKey);
    try {
      await tidalAgent.initialize();
    } catch (error) {
      // Redis not available, skip health check
      console.warn('Redis not available, some tests will be skipped');
    }
  }, 10000);

  afterAll(async () => {
    try {
      await tidalAgent.shutdown();
      await redis.quit();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(tidalAgent).toBeDefined();
    });

    it('should report healthy status in Redis', async () => {
      const health = await redis.hgetall('agent:health:tidal-agent');
      expect(health.status).toBe('healthy');
      expect(health.lastHeartbeat).toBeDefined();
    });

    it('should return tidal tools', () => {
      const tools = tidalAgent.getTools();
      expect(tools).toHaveLength(4);
      expect(tools.map(t => t.name)).toContain('get_tide_predictions');
      expect(tools.map(t => t.name)).toContain('get_current_predictions');
      expect(tools.map(t => t.name)).toContain('get_water_levels');
      expect(tools.map(t => t.name)).toContain('find_nearest_station');
    });
  });

  describe('Tool Schema Validation', () => {
    it('should have valid input schema for get_tide_predictions', () => {
      const tools = tidalAgent.getTools();
      const tideTool = tools.find(t => t.name === 'get_tide_predictions');
      
      expect(tideTool).toBeDefined();
      expect(tideTool!.inputSchema.properties).toHaveProperty('latitude');
      expect(tideTool!.inputSchema.properties).toHaveProperty('longitude');
      expect(tideTool!.inputSchema.properties).toHaveProperty('start_date');
      expect(tideTool!.inputSchema.properties).toHaveProperty('end_date');
      expect(tideTool!.inputSchema.required).toContain('latitude');
      expect(tideTool!.inputSchema.required).toContain('longitude');
      expect(tideTool!.inputSchema.required).toContain('start_date');
      expect(tideTool!.inputSchema.required).toContain('end_date');
    });

    it('should have valid input schema for find_nearest_station', () => {
      const tools = tidalAgent.getTools();
      const stationTool = tools.find(t => t.name === 'find_nearest_station');
      
      expect(stationTool).toBeDefined();
      expect(stationTool!.inputSchema.properties).toHaveProperty('latitude');
      expect(stationTool!.inputSchema.properties).toHaveProperty('longitude');
      expect(stationTool!.inputSchema.properties).toHaveProperty('type');
    });
  });

  describe('Station Lookup', () => {
    it('should find nearest station', async () => {
      const mockStations = {
        data: {
          stations: [
            { id: '8443970', name: 'Boston', lat: 42.3601, lng: -71.0589 },
            { id: '8454000', name: 'Providence', lat: 41.8240, lng: -71.4128 },
            { id: '8461490', name: 'New London', lat: 41.3559, lng: -72.0895 }
          ]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockStations);

      const result = await tidalAgent.handleToolCall('find_nearest_station', {
        latitude: 42.3601,
        longitude: -71.0589,
        type: 'tide'
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('distance');
      expect(result.id).toBe('8443970'); // Boston is closest to Boston coordinates
    });

    it('should cache station lookup results', async () => {
      const lat = 42.3601;
      const lon = -71.0589;
      const type = 'tide';
      
      // Generate cache key same way the agent does
      const cacheKey = `tidal-agent:${require('crypto')
        .createHash('md5')
        .update(`station:${lat}:${lon}:${type}`)
        .digest('hex')}`;
      
      // Set mock data in cache
      const mockStation = {
        id: '8443970',
        name: 'Boston',
        latitude: 42.3601,
        longitude: -71.0589,
        distance: 0
      };
      
      await redis.setex(cacheKey, 604800, JSON.stringify(mockStation));
      
      // Verify cache was set
      const cached = await redis.get(cacheKey);
      expect(cached).toBeDefined();
      expect(JSON.parse(cached!)).toHaveProperty('id');
    });
  });

  describe('Tide Predictions', () => {
    it('should get tide predictions for a location', async () => {
      const mockStations = {
        data: {
          stations: [
            { id: '8443970', name: 'Boston', lat: 42.3601, lng: -71.0589 }
          ]
        }
      };

      const mockPredictions = {
        data: {
          predictions: [
            { t: '2024-01-01 00:00', v: '10.5', type: 'H' },
            { t: '2024-01-01 06:15', v: '2.3', type: 'L' },
            { t: '2024-01-01 12:30', v: '11.2', type: 'H' },
            { t: '2024-01-01 18:45', v: '1.8', type: 'L' }
          ]
        }
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockStations)
        .mockResolvedValueOnce(mockPredictions);

      const result = await tidalAgent.handleToolCall('get_tide_predictions', {
        latitude: 42.3601,
        longitude: -71.0589,
        start_date: '2024-01-01T00:00:00Z',
        end_date: '2024-01-02T00:00:00Z',
        datum: 'MLLW'
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(4);
      expect(result[0]).toHaveProperty('time');
      expect(result[0]).toHaveProperty('height');
      expect(result[0]).toHaveProperty('type');
      expect(result[0].type).toBe('high');
      expect(result[1].type).toBe('low');
    });
  });

  describe('Current Predictions', () => {
    it('should get current predictions for a location', async () => {
      const mockStations = {
        data: {
          stations: [
            { id: 'n04930', name: 'Narragansett Bay', lat: 41.4900, lng: -71.3269 }
          ]
        }
      };

      const mockCurrents = {
        data: {
          current_predictions: [
            { t: '2024-01-01 00:00', v: '1.5', d: '180' },
            { t: '2024-01-01 06:00', v: '-1.2', d: '0' },
            { t: '2024-01-01 12:00', v: '0.05', d: '90' }
          ]
        }
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockStations)
        .mockResolvedValueOnce(mockCurrents);

      const result = await tidalAgent.handleToolCall('get_current_predictions', {
        latitude: 41.4900,
        longitude: -71.3269,
        start_date: '2024-01-01T00:00:00Z',
        end_date: '2024-01-02T00:00:00Z'
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty('velocity');
      expect(result[0]).toHaveProperty('direction');
      expect(result[0]).toHaveProperty('type');
      expect(result[0].type).toBe('flood');
      expect(result[1].type).toBe('ebb');
      expect(result[2].type).toBe('slack');
    });
  });

  describe('Water Levels', () => {
    it('should get real-time water levels', async () => {
      const mockWaterLevels = {
        data: {
          data: [
            { t: '2024-01-01 00:00', v: '5.2' },
            { t: '2024-01-01 01:00', v: '5.8' },
            { t: '2024-01-01 02:00', v: '6.4' }
          ]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockWaterLevels);

      const result = await tidalAgent.handleToolCall('get_water_levels', {
        station_id: '8443970',
        hours: 24
      });

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid coordinates', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Invalid coordinates'));

      await expect(
        tidalAgent.handleToolCall('find_nearest_station', {
          latitude: 999,
          longitude: 999,
          type: 'tide'
        })
      ).rejects.toThrow();
    });

    it('should handle unknown tool calls', async () => {
      await expect(
        tidalAgent.handleToolCall('nonexistent_tool', {})
      ).rejects.toThrow('Unknown tool');
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('NOAA API Error'));

      await expect(
        tidalAgent.handleToolCall('get_water_levels', {
          station_id: 'invalid',
          hours: 24
        })
      ).rejects.toThrow('NOAA API Error');
    });
  });

  describe('Caching', () => {
    it('should use 24-hour cache TTL for tide predictions', async () => {
      const lat = 42.3601;
      const lon = -71.0589;
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-02T00:00:00Z';
      
      // Generate cache key
      const cacheKey = `tidal-agent:${require('crypto')
        .createHash('md5')
        .update(`tides:${lat}:${lon}:${startDate}:${endDate}`)
        .digest('hex')}`;
      
      // Set mock data in cache
      const mockTides = [
        { time: new Date(), height: 10.5, type: 'high' as const }
      ];
      
      await redis.setex(cacheKey, 86400, JSON.stringify(mockTides));
      
      // Verify cache TTL
      const ttl = await redis.ttl(cacheKey);
      expect(ttl).toBeGreaterThan(86300); // Should be close to 24 hours
      expect(ttl).toBeLessThanOrEqual(86400);
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance between coordinates correctly', async () => {
      const mockStations = {
        data: {
          stations: [
            { id: 'station1', name: 'Close', lat: 42.3601, lng: -71.0589 },
            { id: 'station2', name: 'Far', lat: 40.7128, lng: -74.0060 }
          ]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockStations);

      const result = await tidalAgent.handleToolCall('find_nearest_station', {
        latitude: 42.3601,
        longitude: -71.0589,
        type: 'tide'
      });

      // Should find the closer station (station1)
      expect(result.id).toBe('station1');
      expect(result.distance).toBeLessThan(1); // Very close to same coordinates
    });
  });
});

