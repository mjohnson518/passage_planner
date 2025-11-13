"use strict";
/**
 * Retry client with exponential backoff for external API calls
 * Uses async-retry library for robust retry logic
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryClient = void 0;
exports.retryWithBackoff = retryWithBackoff;
exports.fetchWithRetry = fetchWithRetry;
const async_retry_1 = __importDefault(require("async-retry"));
const pino_1 = __importDefault(require("pino"));
// Create custom AbortError since async-retry doesn't export one
class AbortError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AbortError';
    }
}
class RetryClient {
    static logger = (0, pino_1.default)({ level: process.env.LOG_LEVEL || 'info' });
    /**
     * Retry with exponential backoff
     * Default: 3 retries, starting at 1000ms, doubling each time
     */
    static async retryWithBackoff(fn, options) {
        const defaultOptions = {
            retries: 3,
            minTimeout: 1000, // Start at 1 second
            maxTimeout: 10000, // Max 10 seconds
            factor: 2 // Double each time
        };
        const finalOptions = { ...defaultOptions, ...options };
        let attemptNumber = 0;
        return (0, async_retry_1.default)(async (bail) => {
            attemptNumber++;
            try {
                return await fn();
            }
            catch (error) {
                this.logger.warn({
                    attemptNumber,
                    retriesLeft: (finalOptions.retries || 3) - attemptNumber,
                    error: error.message || error.toString()
                }, `Retry attempt ${attemptNumber} failed`);
                if (finalOptions.onFailedAttempt) {
                    finalOptions.onFailedAttempt({
                        ...error,
                        attemptNumber,
                        retriesLeft: (finalOptions.retries || 3) - attemptNumber
                    });
                }
                // Don't retry on client errors (400-499)
                if (this.isClientError(error)) {
                    const statusCode = error.statusCode || error.response?.status;
                    const message = error.message || error.toString();
                    bail(new AbortError(`Client error ${statusCode}: ${message}`));
                    return;
                }
                // Retry on network errors, 503, 429
                if (!this.isRetryableError(error)) {
                    const message = error.message || error.toString();
                    bail(new AbortError(`Non-retryable error: ${message}`));
                    return;
                }
                throw error; // Will trigger retry
            }
        }, {
            retries: finalOptions.retries,
            minTimeout: finalOptions.minTimeout,
            maxTimeout: finalOptions.maxTimeout,
            factor: finalOptions.factor
        });
    }
    /**
     * Wrap fetch with retry logic
     */
    static async fetchWithRetry(url, options, retryOptions) {
        return this.retryWithBackoff(async () => {
            const response = await fetch(url, options);
            // Check for retryable status codes
            if (response.status === 503 || response.status === 429) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.statusCode = response.status;
                error.response = response;
                throw error;
            }
            // Check for client errors (don't retry these)
            if (response.status >= 400 && response.status < 500) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.statusCode = response.status;
                error.response = response;
                error.isClientError = true;
                throw error;
            }
            // Network or server errors
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.statusCode = response.status;
                error.response = response;
                throw error;
            }
            return response;
        }, retryOptions);
    }
    /**
     * Wrap axios-like request with retry logic
     */
    static async requestWithRetry(requestFn, retryOptions) {
        return this.retryWithBackoff(async () => {
            try {
                const response = await requestFn();
                return response.data;
            }
            catch (error) {
                // Add status code to error if available
                if (error.response) {
                    error.statusCode = error.response.status;
                }
                // Log the attempt
                this.logger.debug({
                    error: error.message,
                    statusCode: error.statusCode,
                    url: error.config?.url
                }, 'Request attempt failed');
                throw error;
            }
        }, retryOptions);
    }
    /**
     * Check if error is retryable
     */
    static isRetryableError(error) {
        // Network errors are retryable
        if (!error.statusCode && error.code) {
            const networkErrorCodes = [
                'ECONNRESET',
                'ETIMEDOUT',
                'ECONNREFUSED',
                'ENOTFOUND',
                'ENETUNREACH'
            ];
            return networkErrorCodes.includes(error.code);
        }
        // HTTP status codes that are retryable
        const retryableStatusCodes = [
            429, // Too Many Requests
            503, // Service Unavailable
            502, // Bad Gateway
            504, // Gateway Timeout
            500 // Internal Server Error (sometimes transient)
        ];
        return retryableStatusCodes.includes(error.statusCode);
    }
    /**
     * Check if error is a client error (don't retry)
     */
    static isClientError(error) {
        if (error.isClientError)
            return true;
        // 4xx errors are client errors
        return error.statusCode >= 400 && error.statusCode < 500;
    }
}
exports.RetryClient = RetryClient;
// Export convenience function
async function retryWithBackoff(fn, options) {
    return RetryClient.retryWithBackoff(fn, options);
}
// Export convenience function for fetch
async function fetchWithRetry(url, options, retryOptions) {
    return RetryClient.fetchWithRetry(url, options, retryOptions);
}
//# sourceMappingURL=retry-client.js.map