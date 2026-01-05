import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock ioredis to avoid connection issues
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async () => null),
    setex: jest.fn(async () => 'OK'),
    hset: jest.fn(async () => 1),
    hgetall: jest.fn(async () => ({})),
    quit: jest.fn(async () => 'OK'),
  }));
});

import { TidalAgent } from '../TidalAgent';

describe('TidalAgent (Unit Tests)', () => {
  let tidalAgent: TidalAgent;
  const redisUrl = 'redis://localhost:6379';
  const noaaApiKey = 'test-noaa-key';

  beforeAll(async () => {
    tidalAgent = new TidalAgent(redisUrl, noaaApiKey);
    await tidalAgent.initialize();
  });

  afterAll(async () => {
    await tidalAgent.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(tidalAgent).toBeDefined();
    });

    it('should return 4 tidal tools', () => {
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
      expect(tideTool!.inputSchema.properties).toHaveProperty('datum');
      expect(tideTool!.inputSchema.required).toEqual(['latitude', 'longitude', 'start_date', 'end_date']);
    });

    it('should have valid input schema for get_current_predictions', () => {
      const tools = tidalAgent.getTools();
      const currentTool = tools.find(t => t.name === 'get_current_predictions');
      
      expect(currentTool).toBeDefined();
      expect(currentTool!.inputSchema.properties).toHaveProperty('latitude');
      expect(currentTool!.inputSchema.properties).toHaveProperty('longitude');
      expect(currentTool!.inputSchema.properties).toHaveProperty('start_date');
      expect(currentTool!.inputSchema.properties).toHaveProperty('end_date');
    });

    it('should have valid input schema for find_nearest_station', () => {
      const tools = tidalAgent.getTools();
      const stationTool = tools.find(t => t.name === 'find_nearest_station');
      
      expect(stationTool).toBeDefined();
      expect(stationTool!.inputSchema.properties).toHaveProperty('latitude');
      expect(stationTool!.inputSchema.properties).toHaveProperty('longitude');
      expect(stationTool!.inputSchema.properties).toHaveProperty('type');
    });

    it('should have valid input schema for get_water_levels', () => {
      const tools = tidalAgent.getTools();
      const waterTool = tools.find(t => t.name === 'get_water_levels');
      
      expect(waterTool).toBeDefined();
      expect(waterTool!.inputSchema.properties).toHaveProperty('station_id');
      expect(waterTool!.inputSchema.properties).toHaveProperty('hours');
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
      expect(result.distance).toBeLessThan(1); // Should be very close
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
      expect(result[0].height).toBe(10.5);
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
      expect(result[0].type).toBe('flood'); // positive velocity
      expect(result[1].type).toBe('ebb');   // negative velocity
      expect(result[2].type).toBe('slack'); // ~0 velocity
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
      expect(result.data.length).toBe(3);
    });
  });

  describe('Error Handling', () => {
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
      ).rejects.toThrow();
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

    it('should find correct nearest station among multiple options', async () => {
      const mockStations = {
        data: {
          stations: [
            { id: 'far1', name: 'Far Station 1', lat: 30.0, lng: -80.0 },
            { id: 'near', name: 'Near Station', lat: 42.5, lng: -71.2 },
            { id: 'far2', name: 'Far Station 2', lat: 50.0, lng: -60.0 }
          ]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockStations);

      const result = await tidalAgent.handleToolCall('find_nearest_station', {
        latitude: 42.3601,
        longitude: -71.0589,
        type: 'tide'
      });

      // Should find the nearest station
      expect(result.id).toBe('near');
    });
  });
});

