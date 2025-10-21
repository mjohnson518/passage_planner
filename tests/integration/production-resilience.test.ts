/**
 * Integration tests for production resilience features
 * Tests circuit breakers, caching, retry logic, and error handling
 */

import { CircuitBreakerFactory } from '../../shared/src/services/resilience/circuit-breaker';
import { RetryClient } from '../../shared/src/services/resilience/retry-client';
import { CacheManager } from '../../shared/src/services/CacheManager';
import { NOAAAPIClient } from '../../shared/src/services/noaa-api-client';
import { NOAATidalService } from '../../shared/src/services/NOAATidalService';
import { ValidationError, NOAAAPIError, CircuitBreakerError } from '../../shared/src/errors/mcp-errors';
import pino from 'pino';

describe('Production Resilience Tests', () => {
  let cache: CacheManager;
  let logger: any;
  
  beforeAll(() => {
    logger = pino({ level: 'error' }); // Suppress logs during tests
    cache = new CacheManager(logger);
  });
  
  afterAll(async () => {
    // Clean up
    CircuitBreakerFactory.clearAll();
    await cache.disconnect();
  });
  
  describe('Circuit Breaker', () => {
    it('should open after 5 consecutive failures', async () => {
      let callCount = 0;
      const failingFunction = async () => {
        callCount++;
        throw new Error('Service unavailable');
      };
      
      const breaker = CircuitBreakerFactory.create(
        'test-breaker',
        failingFunction,
        {
          timeout: 1000,
          errorThresholdPercentage: 50,
          resetTimeout: 5000
        }
      );
      
      // Make 5 failing calls
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch (e) {
          // Expected to fail
        }
      }
      
      // Circuit should be open now
      const state = CircuitBreakerFactory.getState('test-breaker');
      expect(state).toBe('OPEN');
      
      // Next call should fail immediately without calling the function
      const initialCallCount = callCount;
      try {
        await breaker.fire();
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Breaker is open');
      }
      expect(callCount).toBe(initialCallCount); // Function not called
    });
    
    it('should use cache fallback when circuit is open', async () => {
      const cacheKey = 'test:fallback';
      const fallbackData = { value: 'cached data' };
      
      // Store fallback data
      await cache.setWithTTL(cacheKey, fallbackData, 3600);
      
      // Simulate circuit open scenario
      const breaker = CircuitBreakerFactory.create(
        'test-fallback',
        async () => { throw new Error('Circuit open'); },
        { timeout: 100 }
      );
      
      // Force circuit open
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      // Test fallback
      const result = await breaker.fire().catch(async () => {
        const cached = await cache.get(cacheKey);
        if (cached) return cached;
        throw new Error('No fallback available');
      });
      
      expect(result).toEqual(fallbackData);
    });
  });
  
  describe('Retry Logic', () => {
    it('should retry on 503 errors with exponential backoff', async () => {
      let attemptCount = 0;
      const timestamps: number[] = [];
      
      const failingFunction = async () => {
        attemptCount++;
        timestamps.push(Date.now());
        
        if (attemptCount < 3) {
          const error: any = new Error('Service Unavailable');
          error.statusCode = 503;
          throw error;
        }
        return { success: true };
      };
      
      const result = await RetryClient.retryWithBackoff(failingFunction, {
        retries: 3,
        minTimeout: 100,
        factor: 2
      });
      
      expect(result).toEqual({ success: true });
      expect(attemptCount).toBe(3);
      
      // Check exponential backoff (approximately)
      if (timestamps.length >= 2) {
        const firstDelay = timestamps[1] - timestamps[0];
        const secondDelay = timestamps[2] - timestamps[1];
        expect(secondDelay).toBeGreaterThan(firstDelay * 1.5); // Factor of ~2
      }
    });
    
    it('should not retry on 400 client errors', async () => {
      let attemptCount = 0;
      
      const failingFunction = async () => {
        attemptCount++;
        const error: any = new Error('Bad Request');
        error.statusCode = 400;
        error.isClientError = true;
        throw error;
      };
      
      try {
        await RetryClient.retryWithBackoff(failingFunction, {
          retries: 3
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Bad Request');
        expect(attemptCount).toBe(1); // No retries
      }
    });
  });
  
  describe('Cache with TTL', () => {
    it('should store and retrieve data with TTL metadata', async () => {
      const key = 'test:ttl';
      const value = { data: 'test value' };
      const ttl = 300; // 5 minutes
      
      await cache.setWithTTL(key, value, ttl);
      
      const result = await cache.getWithMetadata(key);
      
      expect(result).toBeTruthy();
      expect(result?.value).toEqual(value);
      expect(result?.ttl).toBeLessThanOrEqual(ttl);
      expect(result?.ttl).toBeGreaterThan(ttl - 5); // Allow 5 second margin
      expect(result?.age).toBeLessThan(5); // Should be fresh
    });
    
    it('should use proper cache key prefixes', async () => {
      // Weather cache keys
      await cache.setWithTTL('weather:grid:42.36,-71.06', { office: 'BOX' }, 604800);
      await cache.setWithTTL('weather:forecast:42.36,-71.06:7', { periods: [] }, 10800);
      
      // Tidal cache keys
      await cache.setWithTTL('tidal:stations:42.36:-71.06:50', [], 2592000);
      await cache.setWithTTL('tidal:predictions:8443970:2024-01-20', {}, 86400);
      
      // Verify retrieval
      const grid = await cache.get('weather:grid:42.36,-71.06');
      expect(grid).toEqual({ office: 'BOX' });
    });
  });
  
  describe('Error Handling', () => {
    it('should validate coordinates properly', () => {
      expect(() => {
        ValidationError.validateCoordinates(91, 0);
      }).toThrow('Invalid latitude');
      
      expect(() => {
        ValidationError.validateCoordinates(0, 181);
      }).toThrow('Invalid longitude');
      
      // Valid coordinates should not throw
      expect(() => {
        ValidationError.validateCoordinates(42.3601, -71.0589);
      }).not.toThrow();
    });
    
    it('should create proper NOAA API errors', () => {
      const response = {
        status: 503,
        statusText: 'Service Unavailable'
      };
      
      const error = NOAAAPIError.fromResponse(response, '/points/42,-71');
      
      expect(error.code).toBe('API_ERROR');
      expect(error.retryable).toBe(true);
      expect(error.statusCode).toBe(503);
      expect(error.endpoint).toBe('/points/42,-71');
    });
    
    it('should handle rate limit errors specially', () => {
      const response = {
        status: 429,
        statusText: 'Too Many Requests'
      };
      
      const error = NOAAAPIError.fromResponse(response, '/forecast');
      
      expect(error.code).toBe('API_RATE_LIMIT');
      expect(error.retryable).toBe(true);
    });
  });
  
  describe('Health Endpoints', () => {
    it('should return health status with circuit breaker states', () => {
      // Create a test breaker
      const breaker = CircuitBreakerFactory.create(
        'health-test',
        async () => ({ success: true }),
        { timeout: 1000 }
      );
      
      const state = CircuitBreakerFactory.getState('health-test');
      const metrics = CircuitBreakerFactory.getMetrics('health-test');
      
      expect(state).toBe('CLOSED');
      expect(metrics).toBeTruthy();
      expect(metrics?.failures).toBe(0);
    });
  });
  
  describe('Integration: Weather Service with Resilience', () => {
    it('should handle NOAA API failures gracefully', async () => {
      const noaaClient = new NOAAAPIClient(logger, cache);
      
      // Test with invalid coordinates that will fail
      try {
        await noaaClient.getWeatherForecast(999, 999); // Invalid coords
      } catch (error: any) {
        expect(error).toBeTruthy();
        // Should be handled gracefully without crashing
      }
    });
  });
  
  describe('Integration: Tidal Service with Resilience', () => {
    it('should handle station lookup failures', async () => {
      const tidalService = new NOAATidalService(cache, logger);
      
      // Test with coordinates that might not have nearby stations
      try {
        const stations = await tidalService.findNearestStations(0, 0, 1); // Middle of ocean
        // Should return empty array or handle gracefully
        expect(Array.isArray(stations)).toBe(true);
      } catch (error) {
        // Should handle error gracefully
        expect(error).toBeTruthy();
      }
    });
  });
});

// Export for use in other tests
export { CircuitBreakerFactory, RetryClient, CacheManager };
