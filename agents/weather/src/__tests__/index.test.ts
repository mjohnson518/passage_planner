/**
 * Production WeatherAgent tests
 *
 * SAFETY CRITICAL: Targets agents/weather/src/index.ts (production WeatherAgent)
 * NOT WeatherAgent.ts (legacy). Required coverage: ≥90%.
 *
 * Tests: tool registration, forecast retrieval, error handling, staleness validation
 */
import { describe, it, expect, beforeAll, afterAll, jest, beforeEach } from '@jest/globals';

// ── Mocks must come before production imports ─────────────────────────────

jest.mock('@passage-planner/shared', () => {
  const actual = jest.requireActual('@passage-planner/shared') as any;
  return {
    ...actual,
    CacheManager: jest.fn().mockImplementation(() => ({
      get: jest.fn(async () => null),
      set: jest.fn(async () => {}),
      setWithTTL: jest.fn(async () => {}),
      getWithMetadata: jest.fn(async () => null),
      delete: jest.fn(async () => {}),
    })),
    NOAAWeatherService: jest.fn().mockImplementation(() => ({
      getMarineForecast: jest.fn(async () => mockForecast),
      checkSafetyConditions: jest.fn(async () => ({ safe: true, warnings: [] })),
    })),
    NDBCBuoyService: jest.fn().mockImplementation(() => ({
      getNearbyStations: jest.fn(async () => []),
      getBuoyData: jest.fn(async () => null),
    })),
    GribService: jest.fn().mockImplementation(() => ({
      getGribData: jest.fn(async () => ({ url: 'https://nomads.ncep.noaa.gov/test', format: 'GRIB2' })),
    })),
    CircuitBreakerFactory: {
      create: jest.fn((_name, fn) => ({ fire: fn })),
      getState: jest.fn(() => 'CLOSED'),
      getMetrics: jest.fn(() => ({ failures: 0, successes: 10 })),
    },
  };
});

import { WeatherAgent } from '../index';

// ── Shared test data ──────────────────────────────────────────────────────

const mockForecast = {
  location: { latitude: 42.36, longitude: -71.06, name: 'Boston' },
  issuedAt: new Date(),
  periods: [
    {
      startTime: new Date(),
      endTime: new Date(Date.now() + 6 * 3600_000),
      temperature: 72,
      temperatureUnit: 'F',
      windSpeed: '10 mph',
      windDirection: 'SW',
      shortForecast: 'Partly Cloudy',
      detailedForecast: 'Partly cloudy with a light southwest wind.',
      precipitationChance: 10,
      isDaytime: true,
    },
  ],
  warnings: [],
  waveHeight: [],
  windData: [{ time: new Date(), speed: 10, gusts: 15, direction: 225 }],
  visibility: [],
};

// ── Test suite ────────────────────────────────────────────────────────────

describe('WeatherAgent (production index.ts)', () => {
  let agent: WeatherAgent;

  beforeAll(() => {
    agent = new WeatherAgent();
  });

  afterAll(async () => {
    // Agent doesn't need explicit shutdown without a transport connection
  });

  // ── Tool registration ───────────────────────────────────────────────────

  describe('Tool registration', () => {
    it('should instantiate without throwing', () => {
      expect(agent).toBeDefined();
    });

    it('should expose a callTool method', () => {
      expect(typeof agent.callTool).toBe('function');
    });

    it('should throw for unknown tool names', async () => {
      await expect(agent.callTool('unknown_tool_xyz', {})).rejects.toThrow('Unknown tool');
    });
  });

  // ── get_marine_weather ──────────────────────────────────────────────────

  describe('get_marine_weather', () => {
    it('should return forecast content for valid coordinates', async () => {
      const result = await agent.callTool('get_marine_weather', {
        latitude: 42.36,
        longitude: -71.06,
        days: 3,
      });
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThanOrEqual(1);
    });

    it('should include a text summary and a data object in the response', async () => {
      const result = await agent.callTool('get_marine_weather', {
        latitude: 42.36,
        longitude: -71.06,
      });
      const textItem = result.content.find((c: any) => c.type === 'text');
      const dataItem = result.content.find((c: any) => c.type === 'data');
      expect(textItem).toBeDefined();
      expect(dataItem).toBeDefined();
      expect(dataItem.data).toHaveProperty('location');
    });

    it('should return isError:true for invalid coordinates', async () => {
      const result = await agent.callTool('get_marine_weather', {
        latitude: 999,   // invalid
        longitude: -71.06,
      });
      expect(result.isError).toBe(true);
    });

    it('should accept get_marine_forecast alias for compatibility', async () => {
      const result = await agent.callTool('get_marine_forecast', {
        latitude: 42.36,
        longitude: -71.06,
      });
      expect(result).toHaveProperty('content');
    });
  });

  // ── check_weather_safety ─────────────────────────────────────────────────

  describe('check_weather_safety', () => {
    it('should return a safe/unsafe determination', async () => {
      const result = await agent.callTool('check_weather_safety', {
        latitude: 42.36,
        longitude: -71.06,
        maxWindSpeed: 25,
        maxWaveHeight: 2,
        minVisibility: 5,
      });
      expect(result).toHaveProperty('content');
      const dataItem = result.content.find((c: any) => c.type === 'data');
      expect(dataItem?.data).toHaveProperty('safe');
    });

    it('should handle weather service failures gracefully', async () => {
      // Temporarily override the mock to throw
      const { NOAAWeatherService } = jest.requireMock('@passage-planner/shared') as any;
      const original = NOAAWeatherService.mock.results[0]?.value?.getMarineForecast;
      if (original) {
        NOAAWeatherService.mock.results[0].value.getMarineForecast = jest.fn(async () => {
          throw new Error('NOAA API timeout');
        });
      }

      const result = await agent.callTool('check_weather_safety', {
        latitude: 42.36,
        longitude: -71.06,
      });
      // Should return error response, not throw
      expect(result).toHaveProperty('content');
      expect(result.isError).toBe(true);

      // Restore
      if (original) {
        NOAAWeatherService.mock.results[0].value.getMarineForecast = original;
      }
    });
  });

  // ── get_weather_windows ──────────────────────────────────────────────────

  describe('get_weather_windows', () => {
    it('should return weather windows for a route', async () => {
      const result = await agent.callTool('get_weather_windows', {
        startLat: 42.36,
        startLon: -71.06,
        endLat: 41.49,
        endLon: -71.31,
        departureDate: new Date(Date.now() + 86_400_000).toISOString(),
        durationHours: 12,
        maxWindSpeed: 25,
        maxWaveHeight: 2,
      });
      expect(result).toHaveProperty('content');
      const dataItem = result.content.find((c: any) => c.type === 'data');
      expect(dataItem?.data).toHaveProperty('windows');
      expect(Array.isArray(dataItem?.data?.windows)).toBe(true);
    });
  });

  // ── get_buoy_wave_data ───────────────────────────────────────────────────

  describe('get_buoy_wave_data', () => {
    it('should return buoy data content for a route', async () => {
      const result = await agent.callTool('get_buoy_wave_data', {
        waypoints: [
          { latitude: 42.36, longitude: -71.06 },
          { latitude: 41.49, longitude: -71.31 },
        ],
        radius_nm: 50,
      });
      expect(result).toHaveProperty('content');
    });

    it('should fail gracefully when no waypoints provided', async () => {
      const result = await agent.callTool('get_buoy_wave_data', {
        waypoints: [],
      });
      expect(result).toHaveProperty('content');
    });
  });

  // ── get_route_wind_field ─────────────────────────────────────────────────

  describe('get_route_wind_field', () => {
    it('should return wind field content', async () => {
      const result = await agent.callTool('get_route_wind_field', {
        waypoints: [
          { latitude: 42.36, longitude: -71.06 },
          { latitude: 41.49, longitude: -71.31 },
        ],
        forecastHours: [0, 6, 12, 24],
      });
      expect(result).toHaveProperty('content');
    });
  });

  // ── health ──────────────────────────────────────────────────────────────

  describe('health', () => {
    it('should return a health status object', async () => {
      const result = await agent.callTool('health', {});
      expect(result).toHaveProperty('content');
      const textItem = result.content.find((c: any) => c.type === 'text');
      expect(textItem).toBeDefined();
      const parsed = JSON.parse(textItem.text);
      expect(parsed).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy', 'error']).toContain(parsed.status);
    });
  });

  // ── Staleness validation ─────────────────────────────────────────────────

  describe('Data staleness', () => {
    it('should return forecast with an issuedAt timestamp', async () => {
      const result = await agent.callTool('get_marine_weather', {
        latitude: 42.36,
        longitude: -71.06,
      });
      const dataItem = result.content.find((c: any) => c.type === 'data');
      expect(dataItem?.data).toHaveProperty('issuedAt');
    });

    it('forecast issuedAt should be a recent timestamp (not stale)', async () => {
      const result = await agent.callTool('get_marine_weather', {
        latitude: 42.36,
        longitude: -71.06,
      });
      const dataItem = result.content.find((c: any) => c.type === 'data');
      const issuedAt = new Date(dataItem?.data?.issuedAt);
      const ageMinutes = (Date.now() - issuedAt.getTime()) / 60_000;
      // Mock returns a fresh Date(), so age should be < 1 minute
      expect(ageMinutes).toBeLessThan(60);
    });
  });
});
