/**
 * CacheManager Tests
 * Validates Redis caching with TTL support for performance and reliability
 * SAFETY-CRITICAL: Cache fallbacks enable system operation when external APIs fail
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CacheManager } from '../CacheManager';
import pino from 'pino';

describe('CacheManager', () => {
  let cache: CacheManager;
  const logger = pino({ level: 'silent' });
  
  beforeAll(async () => {
    cache = new CacheManager(logger);
    // Wait for Redis connection
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
  
  afterAll(async () => {
    await cache.disconnect();
  });
  
  beforeEach(async () => {
    // Clean test keys before each test
    const testKeys = [
      'test:basic',
      'test:ttl',
      'test:metadata',
      'test:expiration',
      'weather:grid:test',
      'weather:forecast:test',
      'tidal:stations:test',
      'tidal:predictions:test'
    ];
    
    for (const key of testKeys) {
      await cache.delete(key);
      await cache.delete(`${key}:meta`);
    }
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve string values', async () => {
      const key = 'test:basic';
      const value = 'test-value';
      
      await cache.set(key, value);
      const result = await cache.get(key);
      
      expect(result).toBe(value);
    });

    it('should store and retrieve object values', async () => {
      const key = 'test:basic';
      const value = { 
        forecast: 'sunny',
        temp: 72,
        wind: 10 
      };
      
      await cache.set(key, value);
      const result = await cache.get(key);
      
      expect(result).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('test:does-not-exist');
      expect(result).toBeNull();
    });

    it('should delete keys successfully', async () => {
      const key = 'test:basic';
      await cache.set(key, 'value');
      
      const before = await cache.get(key);
      expect(before).toBe('value');
      
      await cache.delete(key);
      
      const after = await cache.get(key);
      expect(after).toBeNull();
    });
  });

  describe('TTL Support (setWithTTL)', () => {
    it('should store data with explicit TTL', async () => {
      const key = 'test:ttl';
      const value = { data: 'test' };
      const ttl = 300; // 5 minutes
      
      await cache.setWithTTL(key, value, ttl);
      const result = await cache.get(key);
      
      expect(result).toEqual(value);
    });

    it('should expire data after TTL', async () => {
      const key = 'test:expiration';
      const value = 'should-expire';
      const ttl = 2; // 2 seconds
      
      await cache.setWithTTL(key, value, ttl);
      
      // Should exist immediately
      const immediate = await cache.get(key);
      expect(immediate).toBe(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Should be expired
      const expired = await cache.get(key);
      expect(expired).toBeNull();
    }, 4000);

    it('should use different TTLs for different data types', async () => {
      // Grid points: 7 day TTL
      await cache.setWithTTL(
        'weather:grid:test',
        { office: 'BOX', gridX: 70, gridY: 90 },
        604800 // 7 days
      );
      
      // Forecasts: 3 hour TTL
      await cache.setWithTTL(
        'weather:forecast:test',
        { temp: 65, wind: 15 },
        10800 // 3 hours
      );
      
      // Tidal stations: 30 day TTL
      await cache.setWithTTL(
        'tidal:stations:test',
        [{ id: '8443970', name: 'Boston' }],
        2592000 // 30 days
      );
      
      // Tidal predictions: 24 hour TTL
      await cache.setWithTTL(
        'tidal:predictions:test',
        [{ time: '2024-01-20T12:00:00Z', height: 9.5 }],
        86400 // 24 hours
      );
      
      // Verify all stored
      const grid = await cache.get('weather:grid:test');
      const forecast = await cache.get('weather:forecast:test');
      const stations = await cache.get('tidal:stations:test');
      const predictions = await cache.get('tidal:predictions:test');
      
      expect(grid).toBeTruthy();
      expect(forecast).toBeTruthy();
      expect(stations).toBeTruthy();
      expect(predictions).toBeTruthy();
    });
  });

  describe('Cache Metadata (getWithMetadata)', () => {
    it('should return value with TTL and age metadata', async () => {
      const key = 'test:metadata';
      const value = { data: 'test-with-metadata' };
      const ttl = 3600; // 1 hour
      
      await cache.setWithTTL(key, value, ttl);
      
      const result = await cache.getWithMetadata(key);
      
      expect(result).toBeTruthy();
      expect(result!.value).toEqual(value);
      expect(result!.ttl).toBeLessThanOrEqual(ttl);
      expect(result!.ttl).toBeGreaterThan(ttl - 10); // Allow some variance
      expect(result!.age).toBeLessThan(5); // Should be fresh (< 5 seconds old)
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.getWithMetadata('test:does-not-exist');
      expect(result).toBeNull();
    });

    it('should track data age accurately', async () => {
      const key = 'test:metadata';
      const value = 'aging-data';
      const ttl = 10;
      
      await cache.setWithTTL(key, value, ttl);
      
      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const result = await cache.getWithMetadata(key);
      
      expect(result).toBeTruthy();
      expect(result!.age).toBeGreaterThanOrEqual(1); // At least 1 second old
      expect(result!.age).toBeLessThan(5); // But not too old
    }, 4000);
  });

  describe('Cache Key Prefixes', () => {
    it('should enforce cache key prefix conventions', async () => {
      const weatherGrid = 'weather:grid:42.36,-71.06';
      const weatherForecast = 'weather:forecast:42.36,-71.06:7';
      const tidalStations = 'tidal:stations:42.36:-71.06:50';
      const tidalPredictions = 'tidal:predictions:8443970:2024-01-20';
      
      // Store with proper prefixes
      await cache.setWithTTL(weatherGrid, { office: 'BOX' }, 604800);
      await cache.setWithTTL(weatherForecast, { periods: [] }, 10800);
      await cache.setWithTTL(tidalStations, [], 2592000);
      await cache.setWithTTL(tidalPredictions, {}, 86400);
      
      // Verify retrieval
      expect(await cache.get(weatherGrid)).toBeTruthy();
      expect(await cache.get(weatherForecast)).toBeTruthy();
      expect(await cache.get(tidalStations)).toBeTruthy();
      expect(await cache.get(tidalPredictions)).toBeTruthy();
    });
  });

  describe('Fallback Cache Strategy', () => {
    it('should support short TTL cache with long TTL fallback', async () => {
      const primaryKey = 'weather:forecast:42.36,-71.06';
      const fallbackKey = 'weather:forecast:fallback:42.36,-71.06';
      
      const forecastData = {
        periods: [
          { temp: 65, wind: 15, forecast: 'Clear' }
        ]
      };
      
      // Store primary cache (3 hours)
      await cache.setWithTTL(primaryKey, forecastData, 10800);
      
      // Store fallback cache (24 hours)
      await cache.setWithTTL(fallbackKey, forecastData, 86400);
      
      // Both should be available
      const primary = await cache.get(primaryKey);
      const fallback = await cache.get(fallbackKey);
      
      expect(primary).toEqual(forecastData);
      expect(fallback).toEqual(forecastData);
      
      // Fallback should have longer TTL
      const primaryMeta = await cache.getWithMetadata(primaryKey);
      const fallbackMeta = await cache.getWithMetadata(fallbackKey);
      
      expect(fallbackMeta!.ttl).toBeGreaterThan(primaryMeta!.ttl);
    });
  });

  describe('Connection Handling', () => {
    it('should handle operations gracefully when not connected', async () => {
      const disconnectedCache = new CacheManager(logger);
      // Don't wait for connection
      
      // Should not throw
      await disconnectedCache.set('test:disconnected', 'value');
      const result = await disconnectedCache.get('test:disconnected');
      
      // May return null if not connected
      expect(result === null || result === 'value').toBe(true);
      
      await disconnectedCache.disconnect();
    });
  });

  describe('Safety-Critical: Cache for Circuit Breaker Fallback', () => {
    it('should provide fallback data when primary cache expires but fallback exists', async () => {
      const primaryKey = 'tidal:predictions:8443970';
      const fallbackKey = 'tidal:predictions:fallback:8443970';
      
      const tidalData = {
        station: { id: '8443970', name: 'Boston' },
        predictions: [
          { time: '2024-01-20T06:00:00Z', height: 9.5, type: 'H' },
          { time: '2024-01-20T12:30:00Z', height: 0.5, type: 'L' }
        ]
      };
      
      // Store primary with short TTL (2 seconds for test)
      await cache.setWithTTL(primaryKey, tidalData, 2);
      
      // Store fallback with long TTL (10 seconds for test)
      await cache.setWithTTL(fallbackKey, tidalData, 10);
      
      // Verify primary exists
      const primary = await cache.get(primaryKey);
      expect(primary).toEqual(tidalData);
      
      // Wait for primary to expire
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Primary should be expired
      const expiredPrimary = await cache.get(primaryKey);
      expect(expiredPrimary).toBeNull();
      
      // Fallback should still exist
      const fallback = await cache.get(fallbackKey);
      expect(fallback).toEqual(tidalData);
      
      // This enables circuit breaker fallback pattern
    }, 5000);
  });
});

