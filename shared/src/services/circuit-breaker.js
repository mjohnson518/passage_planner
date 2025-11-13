"use strict";
/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by failing fast when downstream services are unhealthy.
 * Implements three states: CLOSED (normal), OPEN (failing fast), HALF_OPEN (testing recovery).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitState = void 0;
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN"; // Testing if service has recovered
})(CircuitState || (exports.CircuitState = CircuitState = {}));
const DEFAULT_OPTIONS = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000, // 30 seconds
    monitoringPeriod: 60000, // 1 minute
};
class CircuitBreaker {
    state = CircuitState.CLOSED;
    metrics = {
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
    };
    nextAttemptTime = 0;
    options;
    callbacks;
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.callbacks = {
            onStateChange: options.onStateChange,
            onCircuitOpen: options.onCircuitOpen,
            onCircuitClose: options.onCircuitClose,
        };
    }
    /**
     * Execute function with circuit breaker protection
     */
    async execute(fn) {
        // Check if circuit is open
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextAttemptTime) {
                throw new Error(`Circuit breaker is OPEN. Service unavailable. Retry after ${Math.ceil((this.nextAttemptTime - Date.now()) / 1000)}s`);
            }
            // Transition to half-open to test recovery
            this.transitionTo(CircuitState.HALF_OPEN);
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    /**
     * Handle successful execution
     */
    onSuccess() {
        this.metrics.successes++;
        this.metrics.consecutiveSuccesses++;
        this.metrics.consecutiveFailures = 0;
        if (this.state === CircuitState.HALF_OPEN) {
            // Check if we've had enough successes to close circuit
            if (this.metrics.consecutiveSuccesses >= this.options.successThreshold) {
                this.transitionTo(CircuitState.CLOSED);
            }
        }
    }
    /**
     * Handle failed execution
     */
    onFailure() {
        this.metrics.failures++;
        this.metrics.consecutiveFailures++;
        this.metrics.consecutiveSuccesses = 0;
        this.metrics.lastFailureTime = Date.now();
        if (this.state === CircuitState.HALF_OPEN) {
            // Single failure in half-open transitions back to open
            this.transitionTo(CircuitState.OPEN);
            return;
        }
        if (this.state === CircuitState.CLOSED) {
            // Check if we've exceeded failure threshold
            if (this.metrics.consecutiveFailures >= this.options.failureThreshold) {
                this.transitionTo(CircuitState.OPEN);
            }
        }
    }
    /**
     * Transition to new state
     */
    transitionTo(newState) {
        const oldState = this.state;
        if (oldState === newState)
            return;
        this.state = newState;
        // Set next attempt time when opening circuit
        if (newState === CircuitState.OPEN) {
            this.nextAttemptTime = Date.now() + this.options.timeout;
            this.callbacks.onCircuitOpen?.();
        }
        // Reset metrics when closing circuit
        if (newState === CircuitState.CLOSED) {
            this.metrics.consecutiveFailures = 0;
            this.metrics.consecutiveSuccesses = 0;
            this.callbacks.onCircuitClose?.();
        }
        // Call state change callback
        this.callbacks.onStateChange?.(oldState, newState);
        console.log(`[CircuitBreaker] State transition: ${oldState} → ${newState}`);
    }
    /**
     * Get current circuit state
     */
    getState() {
        return this.state;
    }
    /**
     * Get circuit metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Manually reset circuit to closed state
     */
    reset() {
        this.transitionTo(CircuitState.CLOSED);
        this.metrics = {
            failures: 0,
            successes: 0,
            lastFailureTime: null,
            consecutiveFailures: 0,
            consecutiveSuccesses: 0,
        };
    }
}
exports.CircuitBreaker = CircuitBreaker;
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
//# sourceMappingURL=circuit-breaker.js.map