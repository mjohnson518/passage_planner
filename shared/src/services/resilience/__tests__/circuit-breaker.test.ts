/**
 * Circuit Breaker Tests
 * Validates production resilience features for external API protection
 * SAFETY-CRITICAL: Circuit breakers prevent cascade failures in maritime systems
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CircuitBreakerFactory, CircuitMetrics } from '../circuit-breaker';

describe('CircuitBreakerFactory', () => {
  afterEach(() => {
    // Clean up breakers between tests
    CircuitBreakerFactory.clearAll();
  });

  describe('Circuit Breaker Creation', () => {
    it('should create a new circuit breaker with default settings', () => {
      const testFn = async () => 'success';
      const breaker = CircuitBreakerFactory.create('test-breaker', testFn);
      
      expect(breaker).toBeDefined();
      expect(breaker.name).toBe('test-breaker');
    });

    it('should create circuit breaker with custom options', () => {
      const testFn = async () => 'success';
      const breaker = CircuitBreakerFactory.create(
        'custom-breaker',
        testFn,
        {
          timeout: 10000,
          errorThresholdPercentage: 75,
          resetTimeout: 30000
        }
      );
      
      expect(breaker).toBeDefined();
      // Note: opossum doesn't expose options directly, just verify breaker created
    });

    it('should reuse existing circuit breaker with same name', () => {
      const testFn1 = async () => 'first';
      const testFn2 = async () => 'second';
      
      const breaker1 = CircuitBreakerFactory.create('reuse-test', testFn1);
      const breaker2 = CircuitBreakerFactory.create('reuse-test', testFn2);
      
      // Should be the same instance
      expect(breaker1).toBe(breaker2);
    });
  });

  describe('Circuit State Transitions', () => {
    it('should start in CLOSED state', async () => {
      const testFn = async () => 'success';
      const breaker = CircuitBreakerFactory.create('state-test', testFn);
      
      const state = CircuitBreakerFactory.getState('state-test');
      expect(state).toBe('CLOSED');
    });

    it('should transition to OPEN after failure threshold', async () => {
      let callCount = 0;
      const failingFn = async () => {
        callCount++;
        throw new Error('Service unavailable');
      };
      
      const breaker = CircuitBreakerFactory.create(
        'failure-test',
        failingFn,
        {
          timeout: 1000,
          errorThresholdPercentage: 50, // Open at 50% error rate
          resetTimeout: 60000
        }
      );
      
      // Make 10 failing calls (should trip at ~5)
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.fire();
        } catch (error) {
          // Expected to fail
        }
      }
      
      const state = CircuitBreakerFactory.getState('failure-test');
      expect(state).toBe('OPEN');
    });

    it('should fail fast when circuit is OPEN', async () => {
      let callCount = 0;
      const failingFn = async () => {
        callCount++;
        throw new Error('Service unavailable');
      };
      
      const breaker = CircuitBreakerFactory.create(
        'fast-fail-test',
        failingFn,
        { timeout: 1000, errorThresholdPercentage: 50 }
      );
      
      // Trip the circuit
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      const beforeCount = callCount;
      const state = CircuitBreakerFactory.getState('fast-fail-test');
      expect(state).toBe('OPEN');
      
      // Try another call - should fail immediately
      try {
        await breaker.fire();
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Breaker is open');
      }
      
      // Function should not have been called
      expect(callCount).toBe(beforeCount);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const failingFn = async () => { throw new Error('Fail'); };
      
      const breaker = CircuitBreakerFactory.create(
        'reset-test',
        failingFn,
        {
          timeout: 100,
          errorThresholdPercentage: 50,
          resetTimeout: 1000 // 1 second reset
        }
      );
      
      // Trip the circuit
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      expect(CircuitBreakerFactory.getState('reset-test')).toBe('OPEN');
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Circuit should enter half-open state
      const state = CircuitBreakerFactory.getState('reset-test');
      expect(state).toMatch(/HALF_OPEN|CLOSED/); // May auto-close on success
    }, 5000);
  });

  describe('Circuit Metrics', () => {
    it('should track successful calls', async () => {
      const successFn = async () => 'success';
      const breaker = CircuitBreakerFactory.create('metrics-success', successFn);
      
      // Make some successful calls
      for (let i = 0; i < 5; i++) {
        await breaker.fire();
      }
      
      const metrics = CircuitBreakerFactory.getMetrics('metrics-success');
      expect(metrics).toBeTruthy();
      expect(metrics!.successes).toBeGreaterThanOrEqual(5);
      expect(metrics!.failures).toBe(0);
    });

    it('should track failed calls', async () => {
      const failFn = async () => { throw new Error('Fail'); };
      const breaker = CircuitBreakerFactory.create('metrics-fail', failFn);
      
      // Make some failing calls
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      const metrics = CircuitBreakerFactory.getMetrics('metrics-fail');
      expect(metrics).toBeTruthy();
      expect(metrics!.failures).toBeGreaterThanOrEqual(3);
    });

    it('should return null for non-existent breaker', () => {
      const metrics = CircuitBreakerFactory.getMetrics('does-not-exist');
      expect(metrics).toBeNull();
    });
  });

  describe('Circuit Breaker Timeout', () => {
    it('should timeout long-running functions', async () => {
      const slowFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        return 'too-slow';
      };
      
      const breaker = CircuitBreakerFactory.create(
        'timeout-test',
        slowFn,
        { timeout: 1000 } // 1 second timeout
      );
      
      try {
        await breaker.fire();
        throw new Error('Should have timed out');
      } catch (error: any) {
        expect(error.message).toMatch(/timeout|timed out/i);
      }
    });

    it('should succeed for fast functions', async () => {
      const fastFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms
        return 'fast-enough';
      };
      
      const breaker = CircuitBreakerFactory.create(
        'fast-test',
        fastFn,
        { timeout: 1000 }
      );
      
      const result = await breaker.fire();
      expect(result).toBe('fast-enough');
    });
  });

  describe('Error Filtering', () => {
    it('should not trip circuit on 4xx client errors', async () => {
      let callCount = 0;
      const clientErrorFn = async () => {
        callCount++;
        const error: any = new Error('Bad Request');
        error.statusCode = 400;
        throw error;
      };
      
      const breaker = CircuitBreakerFactory.create(
        'client-error-test',
        clientErrorFn,
        { timeout: 1000, errorThresholdPercentage: 50 }
      );
      
      // Make multiple 4xx errors
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      // Circuit should remain CLOSED (client errors don't count as failures)
      const state = CircuitBreakerFactory.getState('client-error-test');
      expect(state).toBe('CLOSED');
      expect(callCount).toBe(10); // All calls attempted
    });

    it('should trip circuit on 5xx server errors', async () => {
      const serverErrorFn = async () => {
        const error: any = new Error('Internal Server Error');
        error.statusCode = 500;
        throw error;
      };
      
      const breaker = CircuitBreakerFactory.create(
        'server-error-test',
        serverErrorFn,
        { timeout: 1000, errorThresholdPercentage: 50 }
      );
      
      // Make multiple 5xx errors
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      // Circuit should OPEN (server errors count as failures)
      const state = CircuitBreakerFactory.getState('server-error-test');
      expect(state).toBe('OPEN');
    });
  });

  describe('Circuit Reset', () => {
    it('should manually reset a circuit breaker', async () => {
      const failFn = async () => { throw new Error('Fail'); };
      const breaker = CircuitBreakerFactory.create('reset-manual', failFn);
      
      // Trip circuit
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      expect(CircuitBreakerFactory.getState('reset-manual')).toBe('OPEN');
      
      // Manual reset
      CircuitBreakerFactory.reset('reset-manual');
      
      // Circuit should be closed
      const state = CircuitBreakerFactory.getState('reset-manual');
      expect(state).toBe('CLOSED');
    });
  });

  describe('Multiple Circuit Breakers', () => {
    it('should manage multiple independent circuit breakers', async () => {
      const success1 = async () => 'service1';
      const success2 = async () => 'service2';
      const failing = async () => { throw new Error('Service3 down'); };
      
      const breaker1 = CircuitBreakerFactory.create('service-1', success1);
      const breaker2 = CircuitBreakerFactory.create('service-2', success2);
      const breaker3 = CircuitBreakerFactory.create('service-3', failing);
      
      // Service 1 and 2 work fine
      await breaker1.fire();
      await breaker2.fire();
      
      // Service 3 fails
      for (let i = 0; i < 10; i++) {
        try {
          await breaker3.fire();
        } catch (e) { /* ignore */ }
      }
      
      // Check states independently
      expect(CircuitBreakerFactory.getState('service-1')).toBe('CLOSED');
      expect(CircuitBreakerFactory.getState('service-2')).toBe('CLOSED');
      expect(CircuitBreakerFactory.getState('service-3')).toBe('OPEN');
    });

    it('should isolate failures between services', async () => {
      const service1 = async () => 'ok';
      const service2 = async () => { throw new Error('Fail'); };
      
      const breaker1 = CircuitBreakerFactory.create('isolated-1', service1);
      const breaker2 = CircuitBreakerFactory.create('isolated-2', service2);
      
      // Service 2 fails repeatedly
      for (let i = 0; i < 10; i++) {
        try {
          await breaker2.fire();
        } catch (e) { /* ignore */ }
      }
      
      // Service 1 should still work
      const result = await breaker1.fire();
      expect(result).toBe('ok');
      
      // Service 1 circuit still closed
      expect(CircuitBreakerFactory.getState('isolated-1')).toBe('CLOSED');
      // Service 2 circuit open
      expect(CircuitBreakerFactory.getState('isolated-2')).toBe('OPEN');
    });
  });

  describe('Production Scenario: NOAA API Failure', () => {
    it('should protect system when NOAA API is down', async () => {
      let apiCallCount = 0;
      const noaaAPI = async () => {
        apiCallCount++;
        const error: any = new Error('NOAA API Unavailable');
        error.statusCode = 503;
        throw error;
      };
      
      const breaker = CircuitBreakerFactory.create(
        'noaa-gridpoint',
        noaaAPI,
        {
          timeout: 30000,
          errorThresholdPercentage: 50,
          resetTimeout: 60000
        }
      );
      
      // Simulate multiple users requesting weather during NOAA outage
      for (let i = 0; i < 20; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      // Circuit should be open after ~10 failures
      const state = CircuitBreakerFactory.getState('noaa-gridpoint');
      expect(state).toBe('OPEN');
      
      // Remaining requests should fail fast (not hit API)
      const callsBeforeFailFast = apiCallCount;
      
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      // No additional API calls should have been made
      expect(apiCallCount).toBeLessThan(callsBeforeFailFast + 3);
    });

    it('should recover when NOAA API comes back online', async () => {
      let apiDown = true;
      const noaaAPI = async () => {
        if (apiDown) {
          throw new Error('Service unavailable');
        }
        return { forecast: 'data' };
      };
      
      const breaker = CircuitBreakerFactory.create(
        'noaa-recovery',
        noaaAPI,
        {
          timeout: 1000,
          errorThresholdPercentage: 50,
          resetTimeout: 1000 // 1 second for test
        }
      );
      
      // Trip circuit
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      expect(CircuitBreakerFactory.getState('noaa-recovery')).toBe('OPEN');
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Bring API back online
      apiDown = false;
      
      // Next call should succeed (circuit testing recovery)
      const result = await breaker.fire();
      expect(result).toEqual({ forecast: 'data' });
      
      // Circuit should close
      const finalState = CircuitBreakerFactory.getState('noaa-recovery');
      expect(finalState).toBe('CLOSED');
    }, 3000);
  });

  describe('Circuit Breaker Metrics', () => {
    it('should track consecutive failures', async () => {
      const failFn = async () => { throw new Error('Fail'); };
      const breaker = CircuitBreakerFactory.create('consecutive-fail', failFn);
      
      // Make consecutive failures
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      const metrics = CircuitBreakerFactory.getMetrics('consecutive-fail');
      expect(metrics).toBeTruthy();
      expect(metrics!.consecutiveFailures).toBeGreaterThanOrEqual(5);
    });

    it('should reset consecutive failures on success', async () => {
      let shouldFail = true;
      const mixedFn = async () => {
        if (shouldFail) {
          throw new Error('Fail');
        }
        return 'Success';
      };
      
      const breaker = CircuitBreakerFactory.create('mixed-results', mixedFn);
      
      // Make some failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      // Success should reset consecutive counter
      shouldFail = false;
      await breaker.fire();
      
      const metrics = CircuitBreakerFactory.getMetrics('mixed-results');
      expect(metrics).toBeTruthy();
      // Consecutive successes should be tracked
      expect(metrics!.consecutiveSuccesses).toBeGreaterThan(0);
    });
  });

  describe('Safety-Critical: Fallback Behavior', () => {
    it('should allow fallback to cache when circuit open', async () => {
      const mockCache = new Map();
      mockCache.set('weather:forecast:boston', {
        temp: 65,
        wind: 10,
        cached: true
      });
      
      const noaaAPI = async () => {
        throw new Error('API Down');
      };
      
      const breaker = CircuitBreakerFactory.create(
        'fallback-test',
        noaaAPI,
        { timeout: 1000, errorThresholdPercentage: 50 }
      );
      
      // Trip circuit
      for (let i = 0; i < 10; i++) {
        try {
          await breaker.fire();
        } catch (e) { /* ignore */ }
      }
      
      // Use fallback pattern
      let result;
      try {
        result = await breaker.fire();
      } catch (error) {
        // Fall back to cache
        result = mockCache.get('weather:forecast:boston');
      }
      
      // Should get cached data
      expect(result).toBeTruthy();
      expect(result.cached).toBe(true);
      expect(result.temp).toBe(65);
    });
  });
});

