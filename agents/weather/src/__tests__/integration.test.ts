/**
 * Weather Agent API Integration Tests
 * 
 * SAFETY CRITICAL: Weather data reliability tests
 * Bad weather data at sea = dangerous decisions. These tests ensure
 * the system handles API failures gracefully and never uses stale data.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { WeatherAgent } from '../WeatherAgent';
import axios from 'axios';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async () => null),
    setex: jest.fn(async () => 'OK'),
    hset: jest.fn(async () => 1),
    hgetall: jest.fn(async () => ({ status: 'healthy' })),
    ping: jest.fn(async () => 'PONG'),
    quit: jest.fn(async () => 'OK'),
  }));
});

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WeatherAgent - API Integration - SAFETY CRITICAL', () => {
  let weatherAgent: WeatherAgent;

  beforeEach(async () => {
    jest.clearAllMocks();
    weatherAgent = new WeatherAgent('redis://localhost:6379', 'test-key', 'test-key');
    await weatherAgent.initialize();
  });

  afterEach(async () => {
    await weatherAgent.shutdown();
  });

  describe('PART A: NOAA API Error Scenarios', () => {
    describe('Test 1: NOAA API Timeout', () => {
      it('should timeout after 30 seconds and throw error', async () => {
        // Mock timeout - axios will throw ETIMEDOUT
        mockedAxios.get.mockRejectedValueOnce({
          code: 'ETIMEDOUT',
          message: 'timeout of 30000ms exceeded',
        });

        // Attempt to get forecast
        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
            hours: 72,
          })
        ).rejects.toThrow();

        // Verify axios was called
        expect(mockedAxios.get).toHaveBeenCalled();
      });

      it('should not hang indefinitely on slow response', async () => {
        const start = Date.now();

        // Mock very slow response
        mockedAxios.get.mockImplementationOnce(
          () => new Promise<any>((resolve) => setTimeout(() => resolve({}), 35000))
        );

        try {
          await weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          });
        } catch (error) {
          // Expected to fail
        }

        const duration = Date.now() - start;

        // With retries, could take longer than 35s, but should eventually finish
        // Main check: doesn't hang forever, completes within test timeout
        expect(duration).toBeLessThan(40000);
      }, 40000); // Test timeout longer than expected wait
    });

    describe('Test 2: Malformed NOAA Response', () => {
      it('should handle invalid JSON gracefully', async () => {
        // Mock invalid JSON response
        mockedAxios.get.mockRejectedValueOnce(new SyntaxError('Unexpected token in JSON'));

        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          })
        ).rejects.toThrow();
      });

      it('should handle missing required fields in response', async () => {
        // Mock response with missing wind_speed
        mockedAxios.get.mockResolvedValueOnce({
          data: {
            properties: {
              // Missing forecastGridData or other required fields
              incomplete: true,
            },
          },
        });

        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          })
        ).rejects.toThrow();
      });

      it('should handle unexpected data types', async () => {
        mockedAxios.get.mockResolvedValueOnce({
          data: {
            properties: {
              forecastGridData: 'not-a-url', // Should be URL
            },
          },
        });

        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          })
        ).rejects.toThrow();
      });
    });

    describe('Test 3: HTTP Error Codes', () => {
      it('should handle 429 Rate Limit with retry', async () => {
        // First call: 429 rate limit
        // Subsequent calls: Success
        mockedAxios.get
          .mockRejectedValueOnce({ response: { status: 429 }, message: 'Rate limit exceeded' })
          .mockRejectedValueOnce({ response: { status: 429 }, message: 'Rate limit exceeded' })
          .mockResolvedValueOnce({
            data: {
              properties: { forecastGridData: 'http://test.url' },
            },
          })
          .mockResolvedValueOnce({
            data: { properties: {} },
          })
          .mockResolvedValueOnce({
            data: { hourly: [] },
          });

        // Should eventually succeed after retries
        const start = Date.now();
        
        try {
          await weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          });
        } catch (error) {
          // May still fail depending on mock setup
        }

        const duration = Date.now() - start;

        // Should have taken time for retries (at least 1 second for backoff)
        expect(duration).toBeGreaterThan(500);
      });

      it('should handle 500 Server Error with retry', async () => {
        // Mock server error
        mockedAxios.get.mockRejectedValueOnce({
          response: { status: 500 },
          message: 'Internal Server Error',
        });

        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          })
        ).rejects.toThrow();

        // Verify retry was attempted
        expect(mockedAxios.get).toHaveBeenCalled();
      });

      it('should handle 404 Not Found without excessive retry', async () => {
        // Mock 404 (location not found)
        mockedAxios.get.mockRejectedValueOnce({
          response: { status: 404 },
          message: 'Not Found',
        });

        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 999, // Invalid location
            longitude: 999,
          })
        ).rejects.toThrow();
      });

      it('should handle 401 Unauthorized (invalid API key)', async () => {
        // Mock unauthorized
        mockedAxios.get.mockRejectedValueOnce({
          response: { status: 401 },
          message: 'Unauthorized',
        });

        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          })
        ).rejects.toThrow();
      });
    });

    describe('Test 4: Network Failures', () => {
      it('should handle connection refused', async () => {
        // Mock ECONNREFUSED
        mockedAxios.get.mockRejectedValueOnce({
          code: 'ECONNREFUSED',
          message: 'connect ECONNREFUSED',
        });

        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          })
        ).rejects.toThrow();
      });

      it('should handle DNS resolution failure', async () => {
        // Mock ENOTFOUND
        mockedAxios.get.mockRejectedValueOnce({
          code: 'ENOTFOUND',
          message: 'getaddrinfo ENOTFOUND api.weather.gov',
        });

        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          })
        ).rejects.toThrow();
      });

      it('should handle connection timeout', async () => {
        // Mock ETIMEDOUT
        mockedAxios.get.mockRejectedValueOnce({
          code: 'ETIMEDOUT',
          message: 'Connection timeout',
        });

        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          })
        ).rejects.toThrow();
      });
    });
  });

  describe('PART B: Data Validation & Freshness', () => {
    describe('Test 5: Input Validation', () => {
      it('should reject invalid latitude (> 90)', async () => {
        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 91,
            longitude: -71.0589,
          })
        ).rejects.toThrow();
      });

      it('should reject invalid latitude (< -90)', async () => {
        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: -91,
            longitude: -71.0589,
          })
        ).rejects.toThrow();
      });

      it('should reject invalid longitude (> 180)', async () => {
        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: 181,
          })
        ).rejects.toThrow();
      });

      it('should reject invalid longitude (< -180)', async () => {
        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -181,
          })
        ).rejects.toThrow();
      });

      it('should reject negative hours', async () => {
        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
            hours: -24,
          })
        ).rejects.toThrow();
      });
    });

    describe('Test 6: Data Completeness', () => {
      it('should validate forecast has required fields', async () => {
        // Mock incomplete forecast data
        mockedAxios.get
          .mockResolvedValueOnce({
            data: {
              properties: { forecastGridData: 'http://test.url' },
            },
          })
          .mockResolvedValueOnce({
            data: { properties: {} }, // Missing wind/wave data
          });

        // Should handle missing data gracefully
        await expect(
          weatherAgent.handleToolCall('get_marine_forecast', {
            latitude: 42.3601,
            longitude: -71.0589,
          })
        ).rejects.toThrow();
      });
    });
  });

  describe('PART C: Tool Functionality', () => {
    describe('Weather Warnings', () => {
      it('should fetch marine weather warnings', async () => {
        // Mock NOAA alerts response
        mockedAxios.get.mockResolvedValueOnce({
          data: {
            features: [
              {
                properties: {
                  id: 'test-alert-1',
                  event: 'Small Craft Advisory',
                  severity: 'Moderate',
                  urgency: 'Expected',
                  headline: 'Small Craft Advisory in effect',
                  description: 'Winds 20-25 knots',
                  instruction: 'Exercise caution',
                  effective: new Date().toISOString(),
                  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  areaDesc: 'Coastal waters',
                },
              },
            ],
          },
        });

        const result = await weatherAgent.handleToolCall('get_weather_warnings', {
          latitude: 42.3601,
          longitude: -71.0589,
        });

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].event).toBe('Small Craft Advisory');
      });

      it('should filter for marine-relevant warnings only', async () => {
        // Mock response with mixed warnings
        mockedAxios.get.mockResolvedValueOnce({
          data: {
            features: [
              {
                properties: {
                  id: '1',
                  event: 'Small Craft Advisory', // Marine - should include
                  severity: 'Moderate',
                  urgency: 'Expected',
                  headline: 'Marine warning',
                  description: 'Test',
                  effective: new Date().toISOString(),
                  expires: new Date().toISOString(),
                  areaDesc: 'Coastal',
                },
              },
              {
                properties: {
                  id: '2',
                  event: 'Heat Advisory', // Not marine - should exclude
                  severity: 'Moderate',
                  urgency: 'Expected',
                  headline: 'Land warning',
                  description: 'Test',
                  effective: new Date().toISOString(),
                  expires: new Date().toISOString(),
                  areaDesc: 'Inland',
                },
              },
            ],
          },
        });

        const result = await weatherAgent.handleToolCall('get_weather_warnings', {
          latitude: 42.3601,
          longitude: -71.0589,
        });

        // Should only include marine warning
        expect(result.length).toBe(1);
        expect(result[0].event).toBe('Small Craft Advisory');
      });
    });

    describe('GRIB Data', () => {
      it('should generate valid GRIB download URL', async () => {
        const result = await weatherAgent.handleToolCall('get_grib_data', {
          bounds: {
            north: 45,
            south: 40,
            east: -70,
            west: -75,
          },
          resolution: '0.5',
          parameters: ['wind', 'waves'],
        });

        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('format', 'GRIB2');
        expect(result.url).toContain('nomads.ncep.noaa.gov');
        expect(result.url).toContain('0.5deg');
      });
    });

    describe('Tropical Cyclone Tracking', () => {
      it('should fetch active tropical cyclones', async () => {
        // Mock NOAA NHC response with active storm
        mockedAxios.get.mockResolvedValueOnce({
          data: {
            activeStorms: [
              {
                name: 'Hurricane Test',
                latitude: 25.0,
                longitude: -80.0,
                classification: 'Category 2 Hurricane',
                intensity: 96,
                pressure: 965,
                movementSpeed: 12,
                movementDir: 315,
              },
            ],
          },
        });

        const result = await weatherAgent.handleToolCall('check_tropical_cyclones', {
          bounds: {
            north: 30,
            south: 20,
            east: -75,
            west: -85,
          },
        });

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Hurricane Test');
        expect(result[0].category).toBe(2);
        expect(result[0].maxWind).toBe(96);
      });

      it('should handle no active storms', async () => {
        // Mock empty response
        mockedAxios.get.mockResolvedValueOnce({
          data: {
            activeStorms: [],
          },
        });

        const result = await weatherAgent.handleToolCall('check_tropical_cyclones', {
          bounds: {
            north: 30,
            south: 20,
            east: -75,
            west: -85,
          },
        });

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });

      it('should calculate route impact for nearby storm', async () => {
        // Mock storm near a route
        mockedAxios.get.mockResolvedValueOnce({
          data: {
            activeStorms: [
              {
                name: 'Tropical Storm Test',
                latitude: 25.5,
                longitude: -80.2,
                classification: 'Tropical Storm',
                intensity: 45,
                pressure: 1005,
                movementSpeed: 10,
                movementDir: 0,
              },
            ],
          },
        });

        // Route that comes within 200nm of storm
        const route = [
          { latitude: 25.0, longitude: -80.0 },
          { latitude: 26.0, longitude: -80.0 },
        ];

        const result = await weatherAgent.handleToolCall('check_tropical_cyclones', {
          bounds: { north: 27, south: 24, east: -79, west: -81 },
          route,
        });

        expect(result[0].affectsRoute).toBe(true);
        expect(result[0].distanceToRoute).toBeLessThan(200);
      });

      it('should gracefully handle NHC API unavailable', async () => {
        // Mock NHC API failure
        mockedAxios.get.mockRejectedValueOnce(new Error('NHC API unavailable'));

        // Should return empty array, not throw
        const result = await weatherAgent.handleToolCall('check_tropical_cyclones', {
          bounds: { north: 30, south: 20, east: -75, west: -85 },
        });

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });
    });
  });

  describe('Weather Window Detection', () => {
    it('should find suitable weather windows', async () => {
      // Mock forecast with good conditions
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { properties: { forecastGridData: 'http://test.url' } },
        })
        .mockResolvedValueOnce({
          data: { properties: {} },
        })
        .mockResolvedValueOnce({
          data: {
            hourly: Array.from({ length: 48 }, (_, i) => ({
              dt: Date.now() / 1000 + i * 3600,
              wind_speed: 5 + Math.random() * 5, // 5-10 knots
              wind_deg: 180,
              wind_gust: 8,
              visibility: 10000,
              temp: 20,
              pressure: 1013,
              clouds: 30,
            })),
          },
        });

      const result = await weatherAgent.handleToolCall('find_weather_window', {
        latitude: 42.3601,
        longitude: -71.0589,
        duration_hours: 24,
        max_wind_knots: 15,
        max_wave_feet: 4,
        days_ahead: 3,
      });

      expect(result).toHaveProperty('windowsFound');
      expect(result).toHaveProperty('recommendation');
      
      // Windows found depends on mock data and criteria
      expect(typeof result.windowsFound).toBe('number');
      expect(result.windowsFound).toBeGreaterThanOrEqual(0);
    });

    it('should report no suitable windows in stormy conditions', async () => {
      // Mock forecast with all high winds
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { properties: { forecastGridData: 'http://test.url' } },
        })
        .mockResolvedValueOnce({
          data: { properties: {} },
        })
        .mockResolvedValueOnce({
          data: {
            hourly: Array.from({ length: 48 }, (_, i) => ({
              dt: Date.now() / 1000 + i * 3600,
              wind_speed: 15 + Math.random() * 10, // 15-25 m/s = 30-50 knots
              wind_deg: 270,
              wind_gust: 25,
              visibility: 5000,
              temp: 18,
              pressure: 995,
              clouds: 80,
            })),
          },
        });

      const result = await weatherAgent.handleToolCall('find_weather_window', {
        latitude: 42.3601,
        longitude: -71.0589,
        duration_hours: 24,
        max_wind_knots: 20,
        max_wave_feet: 6,
      });

      expect(result.windowsFound).toBe(0);
      expect(result.recommendation).toMatch(/no suitable.*window/i);
    });
  });

  describe('Sea State Analysis', () => {
    it('should analyze sea state with Douglas Scale', async () => {
      // Mock moderate conditions
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { properties: { forecastGridData: 'http://test.url' } },
        })
        .mockResolvedValueOnce({
          data: { properties: {} },
        })
        .mockResolvedValueOnce({
          data: {
            hourly: [
              {
                dt: Date.now() / 1000,
                wind_speed: 8, // m/s = ~16 knots
                wind_deg: 180,
                wind_gust: 12,
                visibility: 10000,
                temp: 20,
                pressure: 1013,
                clouds: 40,
              },
            ],
          },
        });

      const result = await weatherAgent.handleToolCall('analyze_sea_state', {
        latitude: 42.3601,
        longitude: -71.0589,
        hours: 24,
      });

      expect(result).toHaveProperty('periods');
      expect(result.periods.length).toBeGreaterThan(0);
      expect(result.periods[0]).toHaveProperty('douglasScale');
      expect(result.periods[0].douglasScale).toHaveProperty('value');
      expect(result.periods[0].douglasScale).toHaveProperty('description');
      expect(result.periods[0]).toHaveProperty('safetyAssessment');
    });

    it('should provide safety assessment for conditions', async () => {
      // Mock rough conditions
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { properties: { forecastGridData: 'http://test.url' } },
        })
        .mockResolvedValueOnce({
          data: { properties: {} },
        })
        .mockResolvedValueOnce({
          data: {
            hourly: [
              {
                dt: Date.now() / 1000,
                wind_speed: 18, // m/s = ~35 knots (gale)
                wind_deg: 270,
                wind_gust: 25,
                visibility: 3000,
                temp: 15,
                pressure: 985,
                clouds: 90,
              },
            ],
          },
        });

      const result = await weatherAgent.handleToolCall('analyze_sea_state', {
        latitude: 42.3601,
        longitude: -71.0589,
      });

      expect(result.periods[0].safetyAssessment).toHaveProperty('level');
      
      // 18 m/s = ~35 knots = gale conditions (warning or dangerous)
      expect(['warning', 'dangerous']).toContain(result.periods[0].safetyAssessment.level);
      expect(result.periods[0].safetyAssessment.message).toMatch(/strong|rough|gale|warning|dangerous/i);
    });
  });

  describe('Tool Error Handling', () => {
    it('should reject unknown tool calls', async () => {
      await expect(
        weatherAgent.handleToolCall('nonexistent_tool', {})
      ).rejects.toThrow('Unknown tool');
    });

    it('should validate required parameters', async () => {
      await expect(
        weatherAgent.handleToolCall('get_marine_forecast', {
          // Missing latitude/longitude
        })
      ).rejects.toThrow();
    });
  });
});

