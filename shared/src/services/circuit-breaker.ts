/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by failing fast when downstream services are unhealthy.
 * Implements three states: CLOSED (normal), OPEN (failing fast), HALF_OPEN (testing recovery).
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast, not calling service
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number      // Number of failures before opening
  successThreshold?: number      // Number of successes to close from half-open
  timeout?: number               // ms to wait before attempting recovery
  monitoringPeriod?: number      // ms window for tracking failures
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void
  onCircuitOpen?: () => void
  onCircuitClose?: () => void
}

export interface CircuitMetrics {
  failures: number
  successes: number
  lastFailureTime: number | null
  consecutiveFailures: number
  consecutiveSuccesses: number
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, 'onStateChange' | 'onCircuitOpen' | 'onCircuitClose'>> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
  monitoringPeriod: 60000, // 1 minute
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private metrics: CircuitMetrics = {
    failures: 0,
    successes: 0,
    lastFailureTime: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
  }
  private nextAttemptTime: number = 0
  private options: Required<Omit<CircuitBreakerOptions, 'onStateChange' | 'onCircuitOpen' | 'onCircuitClose'>>
  private callbacks: {
    onStateChange?: (oldState: CircuitState, newState: CircuitState) => void
    onCircuitOpen?: () => void
    onCircuitClose?: () => void
  }

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.callbacks = {
      onStateChange: options.onStateChange,
      onCircuitOpen: options.onCircuitOpen,
      onCircuitClose: options.onCircuitClose,
    }
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(
          `Circuit breaker is OPEN. Service unavailable. Retry after ${Math.ceil((this.nextAttemptTime - Date.now()) / 1000)}s`
        )
      }
      // Transition to half-open to test recovery
      this.transitionTo(CircuitState.HALF_OPEN)
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.metrics.successes++
    this.metrics.consecutiveSuccesses++
    this.metrics.consecutiveFailures = 0

    if (this.state === CircuitState.HALF_OPEN) {
      // Check if we've had enough successes to close circuit
      if (this.metrics.consecutiveSuccesses >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED)
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.metrics.failures++
    this.metrics.consecutiveFailures++
    this.metrics.consecutiveSuccesses = 0
    this.metrics.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      // Single failure in half-open transitions back to open
      this.transitionTo(CircuitState.OPEN)
      return
    }

    if (this.state === CircuitState.CLOSED) {
      // Check if we've exceeded failure threshold
      if (this.metrics.consecutiveFailures >= this.options.failureThreshold) {
        this.transitionTo(CircuitState.OPEN)
      }
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state

    if (oldState === newState) return

    this.state = newState

    // Set next attempt time when opening circuit
    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.options.timeout
      this.callbacks.onCircuitOpen?.()
    }

    // Reset metrics when closing circuit
    if (newState === CircuitState.CLOSED) {
      this.metrics.consecutiveFailures = 0
      this.metrics.consecutiveSuccesses = 0
      this.callbacks.onCircuitClose?.()
    }

    // Call state change callback
    this.callbacks.onStateChange?.(oldState, newState)

    console.log(`[CircuitBreaker] State transition: ${oldState} → ${newState}`)
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Get circuit metrics
   */
  getMetrics(): Readonly<CircuitMetrics> {
    return { ...this.metrics }
  }

  /**
   * Manually reset circuit to closed state
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED)
    this.metrics = {
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    }
  }
}

/**
 * Create a circuit breaker for a specific service
 * 
 * @example
 * ```typescript
 * const noaaCircuit = new CircuitBreaker({
 *   failureThreshold: 5,
 *   timeout: 30000,
 *   onCircuitOpen: () => {
 *     console.error('NOAA API circuit breaker opened - service degraded')
 *     // Alert operations team
 *   }
 * })
 * 
 * // Use in API calls
 * const data = await noaaCircuit.execute(() => fetchNOAAData())
 * ```
 */
