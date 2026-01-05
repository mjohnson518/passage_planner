/**
 * Retry client with exponential backoff for external API calls
 * Uses async-retry library for robust retry logic
 */

import retry from 'async-retry';
import { Logger } from 'pino';
import pino from 'pino';

// Create custom AbortError since async-retry doesn't export one
class AbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortError';
  }
}

export interface RetryOptions {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  factor?: number;
  onFailedAttempt?: (error: any) => void;
}

export class RetryClient {
  private static logger: Logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  /**
   * Retry with exponential backoff
   * Default: 3 retries, starting at 1000ms, doubling each time
   */
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const defaultOptions: RetryOptions = {
      retries: 3,
      minTimeout: 1000,  // Start at 1 second
      maxTimeout: 10000, // Max 10 seconds
      factor: 2          // Double each time
    };

    const finalOptions = { ...defaultOptions, ...options };

    let attemptNumber = 0;
    
    return retry(async (bail) => {
      attemptNumber++;
      
      try {
        return await fn();
      } catch (error: any) {
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

        // Check if error is retryable FIRST (before client error check)
        // This ensures 429 (rate limit) is retried even though it's a 4xx code
        if (this.isRetryableError(error)) {
          throw error; // Will trigger retry
        }

        // Don't retry on client errors (400-499 except retryable ones)
        if (this.isClientError(error)) {
          const statusCode = error.statusCode || error.response?.status;
          const message = error.message || error.toString();
          bail(new AbortError(`Client error ${statusCode}: ${message}`));
          return;
        }

        // Non-retryable server/unknown errors - abort
        const message = error.message || error.toString();
        bail(new AbortError(`Non-retryable error: ${message}`));
        return; // bail() will throw
      }
    }, {
      retries: finalOptions.retries!,
      minTimeout: finalOptions.minTimeout!,
      maxTimeout: finalOptions.maxTimeout!,
      factor: finalOptions.factor!
    });
  }

  /**
   * Wrap fetch with retry logic
   */
  static async fetchWithRetry(
    url: string,
    options?: RequestInit,
    retryOptions?: RetryOptions
  ): Promise<Response> {
    return this.retryWithBackoff(
      async () => {
        const response = await fetch(url, options);
        
        // Check for retryable status codes
        if (response.status === 503 || response.status === 429) {
          const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.statusCode = response.status;
          error.response = response;
          throw error;
        }
        
        // Check for client errors (don't retry these)
        if (response.status >= 400 && response.status < 500) {
          const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.statusCode = response.status;
          error.response = response;
          error.isClientError = true;
          throw error;
        }
        
        // Network or server errors
        if (!response.ok) {
          const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.statusCode = response.status;
          error.response = response;
          throw error;
        }
        
        return response;
      },
      retryOptions
    );
  }

  /**
   * Wrap axios-like request with retry logic
   */
  static async requestWithRetry<T>(
    requestFn: () => Promise<{ data: T; status: number }>,
    retryOptions?: RetryOptions
  ): Promise<T> {
    return this.retryWithBackoff(
      async () => {
        try {
          const response = await requestFn();
          return response.data;
        } catch (error: any) {
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
      },
      retryOptions
    );
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: any): boolean {
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
      500  // Internal Server Error (sometimes transient)
    ];

    // Handle both string and number status codes
    const statusCode = Number(error.statusCode);
    return retryableStatusCodes.includes(statusCode);
  }

  /**
   * Check if error is a client error (don't retry)
   */
  private static isClientError(error: any): boolean {
    if (error.isClientError) return true;

    // 4xx errors are client errors (except those handled by isRetryableError)
    const statusCode = Number(error.statusCode);
    return statusCode >= 400 && statusCode < 500;
  }
}

// Export convenience function
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return RetryClient.retryWithBackoff(fn, options);
}

// Export convenience function for fetch
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return RetryClient.fetchWithRetry(url, options, retryOptions);
}
