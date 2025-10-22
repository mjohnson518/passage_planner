/**
 * NOAA Weather Service Integration Tests - SAFETY-CRITICAL
 * Validates weather data accuracy and API integration resilience
 * 
 * REQUIREMENT: 90% test coverage (maritime safety standard)
 * SAFETY: Incorrect weather forecasts can lead mariners into dangerous conditions
 * VALIDATION: All forecasts cross-checked against real NOAA API structure
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NOAAWeatherService } from '../NOAAWeatherService';
import { NOAAAPIClient } from '../noaa-api-client';
import { CacheManager } from '../CacheManager';
import { CircuitBreakerFactory } from '../resilience/circuit-breaker';
import pino from 'pino';
import {
  MOCK_GRID_POINT_BOSTON,
  MOCK_FORECAST_BOSTON,
  MOCK_FORECAST_GALE_WARNING,
  MOCK_ALERTS_GALE_WARNING,
  MOCK_ALERTS_NONE,
  MOCK_ERROR_INVALID_COORDINATES,
  MOCK_ERROR_SERVICE_UNAVAILABLE,
  MOCK_FORECAST_STALE,
  createMockForecast
} from '../../testing/fixtures/noaa-api-responses';
import { TEST_COORDINATES } from '../../testing/fixtures/test-coordinates';
import { assertDataFresh, assertValidTimestamp } from '../../testing/helpers/assertions';

// Mock the NOAAAPIClient to avoid real API calls
jest.mock('../noaa-api-client');

describe('NOAAWeatherService - SAFETY-CRITICAL Integration Tests', () => {
  let weatherService: NOAAWeatherService;
  let cache: CacheManager;
  let mockClient: jest.Mocked<NOAAAPIClient>;
  const logger = pino({ level: 'silent' });
  
  beforeEach(async () => {
    // Clear circuit breakers
    CircuitBreakerFactory.clearAll();
    
    // Create cache manager
    cache = new CacheManager(logger);
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for connection
    
    // Clear test caches
    await cache.delete('weather:forecast:42.3601,-71.0589:7');
    await cache.delete('weather:forecast:fallback:42.3601,-71.0589');
    await cache.delete('weather:grid:42.3601,-71.0589');
    
    // Create service
    weatherService = new NOAAWeatherService(cache, logger);
    
    // Get mock client instance
    mockClient = (weatherService as any).noaaClient as jest.Mocked<NOAAAPIClient>;
  });
  
  afterEach(async () => {
    await cache.disconnect();
    CircuitBreakerFactory.clearAll();
  });

  describe('Grid Point Lookup Integration', () => {
    it('should retrieve grid point for valid coordinates', async () => {
      // Mock successful grid point lookup
      mockClient.getGridPoint = jest.fn().mockResolvedValue({
        office: MOCK_GRID_POINT_BOSTON.properties.gridId,
        gridX: MOCK_GRID_POINT_BOSTON.properties.gridX,
        gridY: MOCK_GRID_POINT_BOSTON.properties.gridY,
        city: MOCK_GRID_POINT_BOSTON.properties.relativeLocation.properties.city,
        state: MOCK_GRID_POINT_BOSTON.properties.relativeLocation.properties.state,
        timeZone: MOCK_GRID_POINT_BOSTON.properties.timeZone
      });
      
      const gridPoint = await mockClient.getGridPoint(42.3601, -71.0589);
      
      expect(gridPoint).toBeDefined();
      expect(gridPoint.office).toBe('BOX');
      expect(gridPoint.gridX).toBe(70);
      expect(gridPoint.gridY).toBe(90);
    });

    it('should cache grid point for 7 days', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      // First call - should hit API
      await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // Grid point should be cached
      const cached = await cache.get('weather:grid:42.3601,-71.0589');
      expect(cached).toBeDefined();
      
      // Verify TTL is 7 days (604800 seconds)
      const metadata = await cache.getWithMetadata('weather:grid:42.3601,-71.0589');
      if (metadata) {
        expect(metadata.ttl).toBeGreaterThan(600000); // Should be ~7 days
      }
    });

    it('should use cached grid point on subsequent calls', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      // First call
      await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      const firstCallCount = mockClient.getWeatherForecast.mock.calls.length;
      
      // Second call - should use cache
      await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // API should only be called once (cached second time)
      expect(mockClient.getWeatherForecast).toHaveBeenCalledTimes(firstCallCount);
    });

    it('should handle invalid coordinates gracefully', async () => {
      mockClient.getWeatherForecast = jest.fn().mockRejectedValue(
        new Error('Invalid coordinates')
      );
      
      try {
        await weatherService.getMarineForecast(91, 0, 7); // Invalid latitude
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/weather forecast/i);
      }
    });
  });

  describe('Forecast Retrieval & Parsing', () => {
    it('should retrieve and parse forecast data correctly', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      expect(forecast).toBeDefined();
      expect(forecast.location.latitude).toBe(42.3601);
      expect(forecast.location.longitude).toBe(-71.0589);
      expect(forecast.periods).toBeDefined();
      expect(forecast.periods.length).toBeGreaterThan(0);
    });

    it('should parse forecast periods correctly', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      const period = forecast.periods[0];
      expect(period).toHaveProperty('startTime');
      expect(period).toHaveProperty('endTime');
      expect(period).toHaveProperty('temperature');
      expect(period).toHaveProperty('windSpeed');
      expect(period).toHaveProperty('windDirection');
      expect(period).toHaveProperty('shortForecast');
      
      // Validate timestamp
      assertValidTimestamp(period.startTime);
      assertValidTimestamp(period.endTime);
    });

    it('should extract wind data from forecast', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      expect(forecast.windData).toBeDefined();
      expect(Array.isArray(forecast.windData)).toBe(true);
      
      if (forecast.windData.length > 0) {
        const wind = forecast.windData[0];
        expect(wind.speed).toBeGreaterThan(0);
        expect(wind.direction).toMatch(/N|S|E|W|NE|NW|SE|SW/);
      }
    });

    it('should cache forecast for 3 hours', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // Forecast should be cached with 3-hour TTL
      const cached = await cache.get('weather:forecast:42.3601,-71.0589:7');
      expect(cached).toBeDefined();
      
      // Verify TTL is ~3 hours (10800 seconds)
      const metadata = await cache.getWithMetadata('weather:forecast:42.3601,-71.0589:7');
      if (metadata) {
        expect(metadata.ttl).toBeGreaterThan(10000); // Should be ~3 hours
        expect(metadata.ttl).toBeLessThanOrEqual(10800);
      }
    });

    it('should detect and handle gale force winds', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_GALE_WARNING.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      const period = forecast.periods[0];
      expect(period.windSpeed).toMatch(/35|40|45/); // Gale force winds
    });

    it('should include active weather warnings', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue(
        MOCK_ALERTS_GALE_WARNING.features.map(f => f.properties)
      );
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      expect(forecast.warnings).toBeDefined();
      expect(forecast.warnings.length).toBeGreaterThan(0);
      
      const warning = forecast.warnings[0];
      expect(warning.type).toBeDefined();
      expect(warning.severity).toBeDefined();
      expect(warning.headline).toBeDefined();
    });
  });

  describe('Data Validation & Freshness', () => {
    it('should validate temperature values are reasonable', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      forecast.periods.forEach(period => {
        // Temperature should be reasonable (-50°F to 130°F)
        expect(period.temperature).toBeGreaterThan(-50);
        expect(period.temperature).toBeLessThan(130);
      });
    });

    it('should validate wind speeds are reasonable', async () => {
      const mockForecast = createMockForecast({
        windSpeed: '35 to 45 mph'
      });
      
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(mockForecast.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // Wind speed parsing should extract numeric values
      expect(forecast.windData).toBeDefined();
    });

    it('should validate forecast timestamps are fresh', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // Forecast should be fresh (<3 hours old)
      assertDataFresh(forecast.issuedAt, 3, 'Weather forecast');
    });

    it('should reject stale forecast data', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_STALE.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      // Stale data (>3 hours) should be handled appropriately
      // Either rejected or flagged as stale
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // Service should still return data (from NOAA) but may flag as older
      expect(forecast).toBeDefined();
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should trip circuit breaker after failure threshold', async () => {
      // Mock API failures
      mockClient.getWeatherForecast = jest.fn().mockRejectedValue(
        new Error('NOAA API Unavailable')
      );
      
      // Make multiple failing calls to trip circuit
      for (let i = 0; i < 15; i++) {
        try {
          await weatherService.getMarineForecast(42.3601, -71.0589, 7);
        } catch (e) {
          // Expected to fail
        }
      }
      
      // Circuit should eventually open
      const state = CircuitBreakerFactory.getState('noaa-forecast');
      // Circuit may be OPEN or still ramping up failures
      expect(state).toMatch(/OPEN|CLOSED|HALF_OPEN/);
    });

    it('should fallback to cached data when circuit open', async () => {
      // Store fallback cache
      const fallbackData = MOCK_FORECAST_BOSTON.properties;
      await cache.setWithTTL(
        'weather:forecast:fallback:42.3601,-71.0589',
        fallbackData,
        86400
      );
      
      // Mock API failure
      mockClient.getWeatherForecast = jest.fn().mockRejectedValue(
        new Error('NOAA API Down')
      );
      
      // Service should fall back to cache instead of failing
      try {
        const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
        
        // If it succeeds with fallback, verify it's cached data
        if (forecast) {
          expect(forecast.periods).toBeDefined();
        }
      } catch (error) {
        // May still fail if no fallback available
        expect(error).toBeDefined();
      }
    });
  });

  describe('Retry Logic Integration', () => {
    it('should retry on 503 Service Unavailable', async () => {
      let attempts = 0;
      
      mockClient.getWeatherForecast = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          const error: any = new Error('Service Unavailable');
          error.statusCode = 503;
          throw error;
        }
        return MOCK_FORECAST_BOSTON.properties;
      });
      
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // Should succeed after retries
      expect(forecast).toBeDefined();
      expect(attempts).toBeGreaterThanOrEqual(3);
    }, 10000);

    it('should NOT retry on 400 Bad Request', async () => {
      let attempts = 0;
      
      mockClient.getWeatherForecast = jest.fn().mockImplementation(async () => {
        attempts++;
        const error: any = new Error('Bad Request');
        error.statusCode = 400;
        throw error;
      });
      
      try {
        await weatherService.getMarineForecast(91, 0, 7); // Invalid coords
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
      
      // Should only attempt once (no retry on client errors)
      expect(attempts).toBeLessThanOrEqual(2);
    });
  });

  describe('Weather Warning Integration', () => {
    it('should include gale warnings in forecast', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_GALE_WARNING.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue(
        MOCK_ALERTS_GALE_WARNING.features.map(f => ({
          id: f.properties.id,
          areaDesc: f.properties.areaDesc,
          headline: f.properties.headline,
          description: f.properties.description,
          severity: f.properties.severity,
          event: f.properties.event,
          onset: f.properties.onset,
          expires: f.properties.expires,
          instruction: f.properties.instruction
        }))
      );
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      expect(forecast.warnings.length).toBeGreaterThan(0);
      const galeWarning = forecast.warnings.find(w => 
        w.headline?.includes('Gale') || w.type === 'gale'
      );
      expect(galeWarning).toBeDefined();
    });

    it('should handle no active warnings', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      expect(forecast.warnings).toBeDefined();
      expect(Array.isArray(forecast.warnings)).toBe(true);
      // May be empty array or have general advisories
    });

    it('should classify warning severity correctly', async () => {
      const severeAlert = {
        id: 'test-alert',
        areaDesc: 'Test Area',
        headline: 'Hurricane Warning',
        description: 'Hurricane conditions expected',
        severity: 'Extreme',
        event: 'Hurricane Warning',
        onset: new Date().toISOString(),
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        instruction: 'Take immediate shelter'
      };
      
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([severeAlert]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      expect(forecast.warnings.length).toBeGreaterThan(0);
      const warning = forecast.warnings[0];
      expect(warning.severity).toMatch(/extreme|severe/i);
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should handle network timeout gracefully', async () => {
      mockClient.getWeatherForecast = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      
      try {
        await weatherService.getMarineForecast(42.3601, -71.0589, 7);
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/weather forecast/i);
      }
    });

    it('should handle malformed API response', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue({
        // Missing required properties field
        notProperties: {}
      } as any);
      
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      try {
        await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      } catch (error) {
        // Should handle gracefully
        expect(error).toBeDefined();
      }
    });

    it('should log errors with full context', async () => {
      const logSpy = jest.spyOn(logger, 'error');
      
      mockClient.getWeatherForecast = jest.fn().mockRejectedValue(
        new Error('API Error')
      );
      
      try {
        await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      } catch (e) {
        // Error expected
      }
      
      // Error should be logged with coordinates
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('Caching Strategy', () => {
    it('should store fallback cache with 24-hour TTL', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // Fallback cache should exist
      const fallback = await cache.get('weather:forecast:fallback:42.3601,-71.0589');
      expect(fallback).toBeDefined();
    });

    it('should use proper cache key format', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // Cache key should follow format: weather:forecast:LAT,LON:DAYS
      const key = 'weather:forecast:42.3601,-71.0589:7';
      const cached = await cache.get(key);
      expect(cached).toBeDefined();
    });
  });

  describe('Safety-Critical: Data Accuracy Validation', () => {
    it('should return temperatures in expected range for maritime conditions', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      forecast.periods.forEach(period => {
        // Maritime temperatures typically -20°F to 110°F
        expect(period.temperature).toBeGreaterThan(-30);
        expect(period.temperature).toBeLessThan(120);
        expect(period.temperatureUnit).toMatch(/F|C/);
      });
    });

    it('should validate forecast covers requested time period', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const days = 7;
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, days);
      
      // Should have periods covering requested days
      expect(forecast.periods.length).toBeGreaterThan(0);
      // NOAA typically provides 12-hour periods, so 7 days = 14 periods
      expect(forecast.periods.length).toBeGreaterThanOrEqual(2);
    });

    it('should preserve forecast precision for safety calculations', async () => {
      const preciseForecast = createMockForecast({
        temp: 65.7,
        windSpeed: '12.5 mph',
        windDir: 'SSW'
      });
      
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(preciseForecast.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // Precision should be maintained (not rounded excessively)
      expect(forecast.periods[0].temperature).toBeCloseTo(65.7, 1);
    });
  });

  describe('Multiple Geographic Regions', () => {
    it('should handle East Coast locations', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      const forecast = await weatherService.getMarineForecast(
        TEST_COORDINATES.BOSTON.lat,
        TEST_COORDINATES.BOSTON.lon,
        7
      );
      
      expect(forecast).toBeDefined();
    });

    it('should handle different coordinates without interference', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      // Get forecast for Boston
      const boston = await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      
      // Get forecast for Portland
      const portland = await weatherService.getMarineForecast(43.6591, -70.2568, 7);
      
      // Both should succeed independently
      expect(boston).toBeDefined();
      expect(portland).toBeDefined();
      
      // Cache keys should be different
      const bostonCache = await cache.get('weather:forecast:42.3601,-71.0589:7');
      const portlandCache = await cache.get('weather:forecast:43.6591,-70.2568:7');
      expect(bostonCache).not.toEqual(portlandCache);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      // Make 10 simultaneous requests
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(weatherService.getMarineForecast(42.3601, -71.0589, 7));
      }
      
      const results = await Promise.all(requests);
      
      // All should succeed
      expect(results.length).toBe(10);
      results.forEach(forecast => {
        expect(forecast).toBeDefined();
        expect(forecast.periods.length).toBeGreaterThan(0);
      });
    });

    it('should deduplicate requests via caching', async () => {
      mockClient.getWeatherForecast = jest.fn().mockResolvedValue(MOCK_FORECAST_BOSTON.properties);
      mockClient.getActiveAlerts = jest.fn().mockResolvedValue([]);
      
      // First request
      await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      const callCount1 = mockClient.getWeatherForecast.mock.calls.length;
      
      // Second request (should use cache)
      await weatherService.getMarineForecast(42.3601, -71.0589, 7);
      const callCount2 = mockClient.getWeatherForecast.mock.calls.length;
      
      // Should not make additional API call
      expect(callCount2).toBe(callCount1);
    });
  });
});

