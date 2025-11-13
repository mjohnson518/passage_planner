"use strict";
/**
 * Production-Grade API Client with Retry Logic and Circuit Breaker
 *
 * Provides resilient API calling with automatic retries, circuit breakers,
 * timeout handling, and structured error logging.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
exports.createNOAAClient = createNOAAClient;
exports.createOrchestratorClient = createOrchestratorClient;
const retry_1 = require("./retry");
const circuit_breaker_1 = require("./circuit-breaker");
class ApiClient {
    baseUrl;
    timeout;
    retryOptions;
    circuitBreaker;
    defaultHeaders;
    onError;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.timeout = options.timeout || 30000;
        this.retryOptions = options.retryOptions || {};
        this.defaultHeaders = options.headers || {};
        this.onError = options.onError;
        this.circuitBreaker = new circuit_breaker_1.CircuitBreaker({
            ...options.circuitBreakerOptions,
            onCircuitOpen: () => {
                console.error(`[ApiClient] Circuit breaker OPEN for ${this.baseUrl}`);
                // In production: send alert to monitoring system
            },
            onCircuitClose: () => {
                console.info(`[ApiClient] Circuit breaker CLOSED for ${this.baseUrl}`);
            }
        });
    }
    /**
     * Make GET request with retry and circuit breaker
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }
    /**
     * Make POST request with retry and circuit breaker
     */
    async post(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
    }
    /**
     * Core request method with all resilience patterns
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        try {
            const response = await this.circuitBreaker.execute(async () => {
                return await (0, retry_1.retryFetch)(url, {
                    ...options,
                    headers: {
                        ...this.defaultHeaders,
                        ...options.headers,
                    },
                }, {
                    ...this.retryOptions,
                    onRetry: (error, attempt) => {
                        console.warn(`[ApiClient] Retry attempt ${attempt} for ${endpoint}:`, error.message);
                        this.retryOptions.onRetry?.(error, attempt);
                    }
                });
            });
            // Parse JSON response
            const data = await response.json();
            return data;
        }
        catch (error) {
            const err = error;
            // Log error
            console.error(`[ApiClient] Request failed for ${endpoint}:`, err);
            // Call error callback
            this.onError?.(err, endpoint);
            // Enrich error with context
            throw Object.assign(err, {
                endpoint,
                baseUrl: this.baseUrl,
                circuitState: this.circuitBreaker.getState(),
                timestamp: new Date().toISOString(),
            });
        }
    }
    /**
     * Get circuit breaker state
     */
    getCircuitState() {
        return this.circuitBreaker.getState();
    }
    /**
     * Get circuit breaker metrics
     */
    getMetrics() {
        return this.circuitBreaker.getMetrics();
    }
    /**
     * Manually reset circuit breaker
     */
    resetCircuit() {
        this.circuitBreaker.reset();
    }
}
exports.ApiClient = ApiClient;
/**
 * Create API client for NOAA Weather API
 */
function createNOAAClient() {
    return new ApiClient({
        baseUrl: 'https://api.weather.gov',
        timeout: 30000,
        headers: {
            'User-Agent': 'helmwise.co, support@helmwise.co', // Required by NOAA
            'Accept': 'application/geo+json',
        },
        retryOptions: {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            retryableStatuses: [408, 429, 500, 502, 503, 504],
        },
        circuitBreakerOptions: {
            failureThreshold: 5,
            timeout: 60000, // 1 minute before retry
        },
        onError: (error, endpoint) => {
            // In production: send to error tracking (Sentry, etc.)
            console.error(`[NOAA API Error] ${endpoint}:`, error);
        }
    });
}
/**
 * Create API client for internal orchestrator
 */
function createOrchestratorClient(baseUrl) {
    return new ApiClient({
        baseUrl,
        timeout: 60000, // Passage planning can take time
        retryOptions: {
            maxRetries: 2, // Fewer retries for internal services
            initialDelay: 500,
            maxDelay: 5000,
        },
        circuitBreakerOptions: {
            failureThreshold: 3,
            timeout: 30000,
        },
    });
}
//# sourceMappingURL=api-client.js.map