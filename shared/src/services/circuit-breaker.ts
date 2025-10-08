/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by stopping requests to failing services.
 * Automatically recovers when service becomes healthy again.
 */

import { Logger } from 'pino';
import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests immediately
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;       // Number of successes to close from half-open
  timeout: number;                // Milliseconds to wait before attempting half-open
  resetTimeout: number;           // Milliseconds to reset failure count if no failures
  monitoringPeriodMs: number;     // Sliding window for failure tracking
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  openedAt?: Date;
  halfOpenedAt?: Date;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private openedAt?: Date;
  private halfOpenedAt?: Date;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private nextAttemptTime?: Date;
  private config: CircuitBreakerConfig;
  private logger?: Logger;
  private name: string;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>, logger?: Logger) {
    super();
    this.name = name;
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      successThreshold: config?.successThreshold ?? 2,
      timeout: config?.timeout ?? 30000,
      resetTimeout: config?.resetTimeout ?? 60000,
      monitoringPeriodMs: config?.monitoringPeriodMs ?? 60000,
      ...config,
    };
    this.logger = logger;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if enough time has passed to try half-open
      if (this.nextAttemptTime && new Date() >= this.nextAttemptTime) {
        this.transitionToHalfOpen();
      } else {
        const error = new Error(`Circuit breaker '${this.name}' is OPEN - service unavailable`);
        this.emit('rejected', { name: this.name, state: this.state });
        throw error;
      }
    }

    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.onSuccess(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.onFailure(error as Error, duration);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(duration: number): void {
    this.totalSuccesses++;
    this.lastSuccessTime = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count after successful request
      this.failureCount = 0;
    }

    this.emit('success', {
      name: this.name,
      state: this.state,
      duration,
      successCount: this.successCount,
    });
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error, duration: number): void {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.logger) {
      this.logger.warn({
        circuit: this.name,
        state: this.state,
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold,
        error: error.message,
      }, 'Circuit breaker failure recorded');
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed while testing - go back to open
      this.transitionToOpen();
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    }

    this.emit('failure', {
      name: this.name,
      state: this.state,
      error: error.message,
      duration,
      failureCount: this.failureCount,
    });
  }

  /**
   * Transition to OPEN state (circuit broken)
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.openedAt = new Date();
    this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
    this.successCount = 0;

    if (this.logger) {
      this.logger.error({
        circuit: this.name,
        failureCount: this.failureCount,
        nextAttemptTime: this.nextAttemptTime,
      }, `Circuit breaker OPENED - service unavailable until ${this.nextAttemptTime.toISOString()}`);
    }

    this.emit('stateChange', {
      name: this.name,
      from: CircuitState.CLOSED,
      to: CircuitState.OPEN,
      openedAt: this.openedAt,
      nextAttemptTime: this.nextAttemptTime,
    });
  }

  /**
   * Transition to HALF_OPEN state (testing if service recovered)
   */
  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenedAt = new Date();
    this.successCount = 0;

    if (this.logger) {
      this.logger.info({
        circuit: this.name,
      }, 'Circuit breaker HALF-OPEN - testing service recovery');
    }

    this.emit('stateChange', {
      name: this.name,
      from: previousState,
      to: CircuitState.HALF_OPEN,
      halfOpenedAt: this.halfOpenedAt,
    });
  }

  /**
   * Transition to CLOSED state (service healthy)
   */
  private transitionToClosed(): void {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = undefined;
    this.halfOpenedAt = undefined;
    this.nextAttemptTime = undefined;

    if (this.logger) {
      this.logger.info({
        circuit: this.name,
      }, 'Circuit breaker CLOSED - service healthy');
    }

    this.emit('stateChange', {
      name: this.name,
      from: previousState,
      to: CircuitState.CLOSED,
    });
  }

  /**
   * Force circuit to open (for testing or manual intervention)
   */
  forceOpen(): void {
    this.transitionToOpen();
  }

  /**
   * Force circuit to close (for testing or manual intervention)
   */
  forceClosed(): void {
    this.transitionToClosed();
  }

  /**
   * Reset circuit breaker statistics
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.openedAt = undefined;
    this.halfOpenedAt = undefined;
    this.nextAttemptTime = undefined;
    
    if (this.logger) {
      this.logger.info({ circuit: this.name }, 'Circuit breaker reset');
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      openedAt: this.openedAt,
      halfOpenedAt: this.halfOpenedAt,
    };
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }
}

