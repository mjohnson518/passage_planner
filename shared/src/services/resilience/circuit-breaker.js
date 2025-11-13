"use strict";
/**
 * Circuit Breaker implementation for external API resilience
 * Uses opossum library for circuit breaker pattern
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.circuitBreakerFactory = exports.CircuitBreakerFactory = void 0;
const opossum_1 = __importDefault(require("opossum"));
const pino_1 = __importDefault(require("pino"));
class CircuitBreakerFactory {
    static breakers = new Map();
    static logger = (0, pino_1.default)({ level: process.env.LOG_LEVEL || 'info' });
    /**
     * Create or retrieve a circuit breaker for a specific service
     */
    static create(name, asyncFunction, options) {
        // Check if breaker already exists
        const existing = this.breakers.get(name);
        if (existing) {
            return existing;
        }
        // Default settings as specified
        const defaultOptions = {
            timeout: 30000, // 30 second timeout
            errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
            resetTimeout: 60000, // 60 second reset timeout
            rollingCountTimeout: 10000, // 10 second rolling window
            rollingCountBuckets: 10, // Number of buckets in rolling window
            name
        };
        const finalOptions = { ...defaultOptions, ...options };
        // Create new circuit breaker
        const breaker = new opossum_1.default(asyncFunction, {
            timeout: finalOptions.timeout,
            errorThresholdPercentage: finalOptions.errorThresholdPercentage,
            resetTimeout: finalOptions.resetTimeout,
            rollingCountTimeout: finalOptions.rollingCountTimeout,
            rollingCountBuckets: finalOptions.rollingCountBuckets,
            name: finalOptions.name,
            errorFilter: (error) => {
                // Don't count client errors as circuit breaker failures
                if (error.statusCode >= 400 && error.statusCode < 500) {
                    return false; // Don't trip circuit on client errors
                }
                return true; // Count as failure
            }
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
    static setupEventListeners(breaker, name) {
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
        breaker.on('failure', (error) => {
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
        breaker.on('fallback', (result) => {
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
    static getMetrics(name) {
        const breaker = this.breakers.get(name);
        if (!breaker) {
            return null;
        }
        const stats = breaker.stats;
        return {
            failures: stats.failures || 0,
            successes: stats.successes || 0,
            lastFailureTime: stats.lastFailureTime || null,
            consecutiveFailures: stats.consecutiveFailures || 0,
            consecutiveSuccesses: stats.consecutiveSuccesses || 0
        };
    }
    /**
     * Get the current state of a circuit breaker
     */
    static getState(name) {
        const breaker = this.breakers.get(name);
        if (!breaker) {
            return null;
        }
        if (breaker.opened)
            return 'OPEN';
        if (breaker.halfOpen)
            return 'HALF_OPEN';
        return 'CLOSED';
    }
    /**
     * Reset a specific circuit breaker
     */
    static reset(name) {
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
    static clearAll() {
        this.breakers.clear();
    }
}
exports.CircuitBreakerFactory = CircuitBreakerFactory;
// Export a singleton instance for convenience
exports.circuitBreakerFactory = CircuitBreakerFactory;
//# sourceMappingURL=circuit-breaker.js.map