"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIFallbackManager = void 0;
const axios_1 = __importDefault(require("axios"));
class APIFallbackManager {
    providers;
    logger;
    circuitBreakers = new Map();
    options;
    constructor(providers, logger, options) {
        this.providers = providers.sort((a, b) => a.priority - b.priority);
        this.logger = logger || console;
        this.options = {
            maxRetries: options?.maxRetries || 3,
            retryDelay: options?.retryDelay || 1000,
            circuitBreakerThreshold: options?.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: options?.circuitBreakerTimeout || 60000, // 1 minute
        };
        // Initialize circuit breakers
        for (const provider of this.providers) {
            this.circuitBreakers.set(provider.name, {
                failures: 0,
                state: 'closed',
            });
        }
    }
    async request(path, options) {
        const errors = [];
        for (const provider of this.providers) {
            if (!this.isProviderAvailable(provider)) {
                this.logger.warn({ provider: provider.name }, 'Provider unavailable (circuit open)');
                continue;
            }
            try {
                const response = await this.makeRequest(provider, path, options);
                // Reset circuit breaker on success
                this.resetCircuitBreaker(provider);
                return response.data;
            }
            catch (error) {
                errors.push(error);
                this.handleProviderError(provider, error);
                this.logger.warn({
                    provider: provider.name,
                    error: error.message,
                    path,
                }, 'Provider request failed, trying next');
            }
        }
        // All providers failed
        throw new Error(`All API providers failed: ${errors.map(e => e.message).join('; ')}`);
    }
    async makeRequest(provider, path, options) {
        const client = axios_1.default.create({
            baseURL: provider.baseUrl,
            timeout: provider.timeout || 30000,
            headers: {
                ...provider.headers,
                ...options?.headers,
            },
        });
        // Add retry logic
        let lastError;
        for (let i = 0; i < this.options.maxRetries; i++) {
            try {
                return await client.request({
                    url: path,
                    method: options?.method || 'GET',
                    params: options?.params,
                    data: options?.data,
                });
            }
            catch (error) {
                lastError = error;
                if (this.isRetryableError(error)) {
                    await this.delay(this.options.retryDelay * Math.pow(2, i)); // Exponential backoff
                }
                else {
                    throw error;
                }
            }
        }
        throw lastError;
    }
    isProviderAvailable(provider) {
        const breaker = this.circuitBreakers.get(provider.name);
        if (breaker.state === 'closed') {
            return true;
        }
        if (breaker.state === 'open') {
            // Check if timeout has passed
            if (breaker.lastFailure) {
                const timePassed = Date.now() - breaker.lastFailure.getTime();
                if (timePassed > this.options.circuitBreakerTimeout) {
                    // Move to half-open state
                    breaker.state = 'half-open';
                    return true;
                }
            }
            return false;
        }
        // Half-open state - allow one request
        return true;
    }
    handleProviderError(provider, error) {
        const breaker = this.circuitBreakers.get(provider.name);
        breaker.failures++;
        breaker.lastFailure = new Date();
        if (breaker.failures >= this.options.circuitBreakerThreshold) {
            breaker.state = 'open';
            this.logger.error({
                provider: provider.name,
                failures: breaker.failures,
            }, 'Circuit breaker opened');
        }
    }
    resetCircuitBreaker(provider) {
        const breaker = this.circuitBreakers.get(provider.name);
        breaker.failures = 0;
        breaker.state = 'closed';
        breaker.lastFailure = undefined;
    }
    isRetryableError(error) {
        if (!error.response) {
            // Network error - retryable
            return true;
        }
        // Retry on 5xx errors and specific 4xx errors
        const status = error.response.status;
        return status >= 500 || status === 429 || status === 408;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Health check for all providers
    async healthCheck() {
        const results = {};
        for (const provider of this.providers) {
            try {
                if (provider.healthCheckUrl) {
                    await axios_1.default.get(provider.baseUrl + provider.healthCheckUrl, {
                        timeout: 5000,
                    });
                    results[provider.name] = true;
                }
                else {
                    // No health check URL, assume healthy if circuit is closed
                    const breaker = this.circuitBreakers.get(provider.name);
                    results[provider.name] = breaker.state === 'closed';
                }
            }
            catch (error) {
                results[provider.name] = false;
            }
        }
        return results;
    }
    // Get current circuit breaker states
    getCircuitBreakerStates() {
        const states = {};
        for (const [name, state] of this.circuitBreakers.entries()) {
            states[name] = { ...state };
        }
        return states;
    }
    // Manually reset a specific provider
    resetProvider(providerName) {
        const provider = this.providers.find(p => p.name === providerName);
        if (provider) {
            this.resetCircuitBreaker(provider);
        }
    }
}
exports.APIFallbackManager = APIFallbackManager;
//# sourceMappingURL=APIFallbackManager.js.map