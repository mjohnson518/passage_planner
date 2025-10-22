/**
 * Retry Client Tests
 * Validates exponential backoff retry logic for external API resilience
 * SAFETY-CRITICAL: Proper retry behavior ensures data availability for mariners
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RetryClient, retryWithBackoff } from '../retry-client';

describe('RetryClient', () => {
  describe('Exponential Backoff Calculation', () => {
    it('should retry with exponential backoff', async () => {
      let attempts = 0;
      const timestamps: number[] = [];
      
      const failingFn = async () => {
        attempts++;
        timestamps.push(Date.now());
        
        if (attempts < 3) {
          const error: any = new Error('Temporary failure');
          error.statusCode = 503;
          throw error;
        }
        
        return 'success';
      };
      
      const result = await RetryClient.retryWithBackoff(failingFn, {
        retries: 3,
        minTimeout: 100,
        maxTimeout: 10000,
        factor: 2
      });
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
      
      // Verify exponential backoff
      if (timestamps.length >= 3) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        
        // Second delay should be roughly 2x first delay
        expect(delay2).toBeGreaterThan(delay1 * 1.5);
      }
    }, 5000);

    it('should respect minimum timeout', async () => {
      let attempts = 0;
      const timestamps: number[] = [];
      
      const fn = async () => {
        attempts++;
        timestamps.push(Date.now());
        if (attempts < 2) throw new Error('Fail');
        return 'ok';
      };
      
      await RetryClient.retryWithBackoff(fn, {
        retries: 2,
        minTimeout: 500, // 500ms minimum
        factor: 2
      });
      
      if (timestamps.length >= 2) {
        const delay = timestamps[1] - timestamps[0];
        expect(delay).toBeGreaterThanOrEqual(450); // Allow some variance
      }
    }, 3000);

    it('should respect maximum timeout', async () => {
      let attempts = 0;
      const timestamps: number[] = [];
      
      const fn = async () => {
        attempts++;
        timestamps.push(Date.now());
        if (attempts < 4) {
          const error: any = new Error('Fail');
          error.statusCode = 503;
          throw error;
        }
        return 'ok';
      };
      
      await RetryClient.retryWithBackoff(fn, {
        retries: 4,
        minTimeout: 1000,
        maxTimeout: 2000, // Cap at 2 seconds
        factor: 10 // Would normally create huge delays
      });
      
      // Even with factor 10, delays should be capped at maxTimeout
      for (let i = 1; i < timestamps.length; i++) {
        const delay = timestamps[i] - timestamps[i-1];
        expect(delay).toBeLessThan(2500); // Max + some variance
      }
    }, 10000);
  });

  describe('Retry on Specific Errors', () => {
    it('should retry on 503 Service Unavailable', async () => {
      let attempts = 0;
      
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          const error: any = new Error('Service Unavailable');
          error.statusCode = 503;
          throw error;
        }
        return 'recovered';
      };
      
      const result = await RetryClient.retryWithBackoff(fn, { retries: 3, minTimeout: 50 });
      
      expect(result).toBe('recovered');
      expect(attempts).toBe(3);
    });

    it('should retry on 429 Rate Limit', async () => {
      let attempts = 0;
      
      const fn = async () => {
        attempts++;
        if (attempts < 2) {
          const error: any = new Error('Rate Limited');
          error.statusCode = 429;
          throw error;
        }
        return 'success';
      };
      
      const result = await RetryClient.retryWithBackoff(fn, { retries: 3, minTimeout: 50 });
      
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should retry on network errors', async () => {
      let attempts = 0;
      
      const fn = async () => {
        attempts++;
        if (attempts < 2) {
          const error: any = new Error('Network error');
          error.code = 'ECONNRESET';
          throw error;
        }
        return 'connected';
      };
      
      const result = await RetryClient.retryWithBackoff(fn, { retries: 3, minTimeout: 50 });
      
      expect(result).toBe('connected');
      expect(attempts).toBe(2);
    });
  });

  describe('Do NOT Retry on Client Errors', () => {
    it('should NOT retry on 400 Bad Request', async () => {
      let attempts = 0;
      
      const fn = async () => {
        attempts++;
        const error: any = new Error('Bad Request');
        error.statusCode = 400;
        error.isClientError = true;
        throw error;
      };
      
      try {
        await RetryClient.retryWithBackoff(fn, { retries: 3, minTimeout: 50 });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Bad Request');
      }
      
      // Should only attempt once
      expect(attempts).toBe(1);
    });

    it('should NOT retry on 401 Unauthorized', async () => {
      let attempts = 0;
      
      const fn = async () => {
        attempts++;
        const error: any = new Error('Unauthorized');
        error.statusCode = 401;
        throw error;
      };
      
      try {
        await RetryClient.retryWithBackoff(fn, { retries: 3, minTimeout: 50 });
        fail('Should have thrown');
      } catch (error) {
        // Expected
      }
      
      expect(attempts).toBe(1);
    });

    it('should NOT retry on 404 Not Found', async () => {
      let attempts = 0;
      
      const fn = async () => {
        attempts++;
        const error: any = new Error('Not Found');
        error.statusCode = 404;
        throw error;
      };
      
      try {
        await RetryClient.retryWithBackoff(fn, { retries: 3, minTimeout: 50 });
        fail('Should have thrown');
      } catch (error) {
        // Expected
      }
      
      expect(attempts).toBe(1);
    });
  });

  describe('Retry Limits', () => {
    it('should respect max retries limit', async () => {
      let attempts = 0;
      
      const alwaysFailFn = async () => {
        attempts++;
        const error: any = new Error('Always fails');
        error.statusCode = 503;
        throw error;
      };
      
      try {
        await RetryClient.retryWithBackoff(alwaysFailFn, {
          retries: 3,
          minTimeout: 50
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Always fails');
      }
      
      // Should try initial + 3 retries = 4 total
      expect(attempts).toBe(4);
    });

    it('should stop retrying after success', async () => {
      let attempts = 0;
      
      const fn = async () => {
        attempts++;
        if (attempts === 1) {
          return 'success';
        }
        throw new Error('Should not reach here');
      };
      
      const result = await RetryClient.retryWithBackoff(fn, { retries: 5, minTimeout: 50 });
      
      expect(result).toBe('success');
      expect(attempts).toBe(1); // No retries needed
    });
  });

  describe('Failed Attempt Callback', () => {
    it('should call onFailedAttempt for each retry', async () => {
      const failedAttempts: any[] = [];
      let attempts = 0;
      
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return 'success';
      };
      
      await RetryClient.retryWithBackoff(fn, {
        retries: 3,
        minTimeout: 50,
        onFailedAttempt: (error) => {
          failedAttempts.push(error);
        }
      });
      
      expect(failedAttempts.length).toBeGreaterThanOrEqual(2);
      expect(failedAttempts[0].attemptNumber).toBe(1);
      expect(failedAttempts[1].attemptNumber).toBe(2);
    });
  });

  describe('Request With Retry Wrapper', () => {
    it('should wrap axios-style requests with retry', async () => {
      let attempts = 0;
      
      const axiosRequest = async () => {
        attempts++;
        if (attempts < 2) {
          const error: any = new Error('Request failed');
          error.response = { status: 503 };
          throw error;
        }
        return { data: { result: 'success' }, status: 200 };
      };
      
      const result = await RetryClient.requestWithRetry(axiosRequest, {
        retries: 3,
        minTimeout: 50
      });
      
      expect(result).toEqual({ result: 'success' });
      expect(attempts).toBe(2);
    });

    it('should extract data from response object', async () => {
      const axiosRequest = async () => {
        return { 
          data: { forecast: 'sunny', temp: 72 },
          status: 200 
        };
      };
      
      const result = await RetryClient.requestWithRetry(axiosRequest);
      
      expect(result).toEqual({ forecast: 'sunny', temp: 72 });
    });
  });

  describe('Production Scenario: NOAA API Recovery', () => {
    it('should successfully retry and recover from transient NOAA failures', async () => {
      let attempts = 0;
      const requestLog: string[] = [];
      
      // Simulate NOAA API being flaky
      const noaaRequest = async () => {
        attempts++;
        requestLog.push(`Attempt ${attempts} at ${new Date().toISOString()}`);
        
        // First 2 attempts fail with 503
        if (attempts <= 2) {
          const error: any = new Error('NOAA API temporarily unavailable');
          error.statusCode = 503;
          error.config = { url: '/gridpoints/BOX/70,90/forecast' };
          throw error;
        }
        
        // Third attempt succeeds
        return {
          data: {
            properties: {
              periods: [
                {
                  name: 'Tonight',
                  temperature: 45,
                  windSpeed: '10 mph',
                  shortForecast: 'Clear'
                }
              ]
            }
          },
          status: 200
        };
      };
      
      const result = await RetryClient.requestWithRetry(noaaRequest, {
        retries: 3,
        minTimeout: 100,
        factor: 2
      });
      
      // Should get actual forecast data
      expect(result.properties.periods).toHaveLength(1);
      expect(result.properties.periods[0].temperature).toBe(45);
      
      // Verify retry behavior
      expect(attempts).toBe(3);
      expect(requestLog).toHaveLength(3);
    }, 3000);
  });
});

describe('Convenience Functions', () => {
  it('should export retryWithBackoff convenience function', async () => {
    let attempts = 0;
    
    const fn = async () => {
      attempts++;
      if (attempts < 2) throw new Error('Fail');
      return 'success';
    };
    
    const result = await retryWithBackoff(fn, {
      retries: 2,
      minTimeout: 50
    });
    
    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });
});

