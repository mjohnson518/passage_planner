/**
 * Circuit Breaker implementation for external API resilience
 * Uses opossum library for circuit breaker pattern
 */

import CircuitBreaker from 'opossum';
import { Logger } from 'pino';
import pino from 'pino';

export interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  rollingCountTimeout: number;
  rollingCountBuckets: number;
  volumeThreshold: number;
  name: string;
}

export interface CircuitMetrics {
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export class CircuitBreakerFactory {
  private static breakers: Map<string, CircuitBreaker> = new Map();
  private static logger: Logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  /**
   * Create or retrieve a circuit breaker for a specific service
   */
  static create<T>(
    name: string,
    asyncFunction: (...args: any[]) => Promise<T>,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreaker {
    // Check if breaker already exists
    const existing = this.breakers.get(name);
    if (existing) {
      return existing;
    }

    // Default settings as specified
    const defaultOptions: CircuitBreakerOptions = {
      timeout: 30000, // 30 second timeout
      errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
      resetTimeout: 60000, // 60 second reset timeout
      rollingCountTimeout: 10000, // 10 second rolling window
      rollingCountBuckets: 10, // Number of buckets in rolling window
      volumeThreshold: 5, // Minimum number of requests before circuit can trip
      name
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Create new circuit breaker
    const breaker = new CircuitBreaker(asyncFunction, {
      timeout: finalOptions.timeout,
      errorThresholdPercentage: finalOptions.errorThresholdPercentage,
      resetTimeout: finalOptions.resetTimeout,
      rollingCountTimeout: finalOptions.rollingCountTimeout,
      rollingCountBuckets: finalOptions.rollingCountBuckets,
      volumeThreshold: finalOptions.volumeThreshold,
      name: finalOptions.name
      // Note: errorFilter removed - opossum's errorFilter has inverted semantics
      // that don't work well with our use case. All errors will trip the circuit.
    });

    // Set up event listeners for state changes
    this.setupEventListeners(breaker, name);

    // Store breaker
    this.breakers.set(name, breaker);

    return breaker;
  }

  /**
   * Set up logging for circuit breaker state changes
   */
  private static setupEventListeners(breaker: CircuitBreaker, name: string): void {
    // Log when circuit opens
    breaker.on('open', () => {
      this.logger.error({
        event: 'circuit_breaker_open',
        name,
        message: `Circuit breaker ${name} is now OPEN - requests will fail fast`
      });
    });

    // Log when circuit closes
    breaker.on('close', () => {
      this.logger.info({
        event: 'circuit_breaker_close',
        name,
        message: `Circuit breaker ${name} is now CLOSED - normal operation resumed`
      });
    });

    // Log when circuit enters half-open state
    breaker.on('halfOpen', () => {
      this.logger.info({
        event: 'circuit_breaker_halfopen',
        name,
        message: `Circuit breaker ${name} is now HALF-OPEN - testing if service recovered`
      });
    });

    // Log failures
    breaker.on('failure', (error: Error) => {
      this.logger.warn({
        event: 'circuit_breaker_failure',
        name,
        error: error.message,
        message: `Circuit breaker ${name} recorded a failure`
      });
    });

    // Log successful calls
    breaker.on('success', () => {
      this.logger.debug({
        event: 'circuit_breaker_success',
        name,
        message: `Circuit breaker ${name} recorded a successful call`
      });
    });

    // Log timeouts
    breaker.on('timeout', () => {
      this.logger.error({
        event: 'circuit_breaker_timeout',
        name,
        message: `Circuit breaker ${name} timed out`
      });
    });

    // Log when circuit breaker rejects a call
    breaker.on('reject', () => {
      this.logger.warn({
        event: 'circuit_breaker_reject',
        name,
        message: `Circuit breaker ${name} rejected a call (circuit is open)`
      });
    });

    // Log fallback executions
    breaker.on('fallback', (result: any) => {
      this.logger.info({
        event: 'circuit_breaker_fallback',
        name,
        message: `Circuit breaker ${name} executed fallback`
      });
    });
  }

  /**
   * Get metrics for a specific circuit breaker
   */
  static getMetrics(name: string): CircuitMetrics | null {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return null;
    }

    const stats = breaker.stats;
    return {
      failures: stats.failures || 0,
      successes: stats.successes || 0,
      lastFailureTime: (stats as any).lastFailureTime || null,
      consecutiveFailures: (stats as any).consecutiveFailures || 0,
      consecutiveSuccesses: (stats as any).consecutiveSuccesses || 0
    };
  }

  /**
   * Get the current state of a circuit breaker
   */
  static getState(name: string): string | null {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return null;
    }

    if (breaker.opened) return 'OPEN';
    if (breaker.halfOpen) return 'HALF_OPEN';
    return 'CLOSED';
  }

  /**
   * Reset a specific circuit breaker
   */
  static reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.close();
      this.logger.info({
        event: 'circuit_breaker_reset',
        name,
        message: `Circuit breaker ${name} was manually reset`
      });
    }
  }

  /**
   * Clear all circuit breakers (useful for testing)
   */
  static clearAll(): void {
    this.breakers.clear();
  }
}

// Export a singleton instance for convenience
export const circuitBreakerFactory = CircuitBreakerFactory;
