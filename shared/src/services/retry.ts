/**
 * Retry Utility with Exponential Backoff
 * 
 * Implements retry logic with configurable backoff for external API calls.
 * Includes jitter to prevent thundering herd problem.
 */

import { Logger } from 'pino';

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
  retryableErrors?: string[]; // Only retry these error types
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  data?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
  success: boolean;
}

export class RetryHandler {
  private config: RetryConfig;
  private logger?: Logger;

  constructor(config?: Partial<RetryConfig>, logger?: Logger) {
    this.config = {
      maxAttempts: config?.maxAttempts ?? 3,
      initialDelayMs: config?.initialDelayMs ?? 1000,
      maxDelayMs: config?.maxDelayMs ?? 30000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      jitterMs: config?.jitterMs ?? 100,
      retryableErrors: config?.retryableErrors,
      shouldRetry: config?.shouldRetry,
      ...config,
    };
    this.logger = logger;
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: Error | undefined;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const result = await fn();
        const duration = Date.now() - startTime;

        if (this.logger && attempt > 1) {
          this.logger.info({
            context,
            attempt,
            duration,
            totalDelay,
          }, 'Retry succeeded');
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error as Error);
        
        if (!isRetryable || attempt === this.config.maxAttempts) {
          if (this.logger) {
            this.logger.error({
              context,
              attempt,
              maxAttempts: this.config.maxAttempts,
              totalDelay,
              error: lastError.message,
              retryable: isRetryable,
            }, `Failed after ${attempt} attempt(s)`);
          }
          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(
          this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1),
          this.config.maxDelayMs
        );
        const jitter = Math.random() * this.config.jitterMs;
        const delay = baseDelay + jitter;
        totalDelay += delay;

        if (this.logger) {
          this.logger.warn({
            context,
            attempt,
            maxAttempts: this.config.maxAttempts,
            delay,
            error: lastError.message,
          }, 'Retrying after delay');
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error should be retried
   */
  private isRetryableError(error: Error): boolean {
    // Use custom retry predicate if provided
    if (this.config.shouldRetry) {
      return this.config.shouldRetry(error);
    }

    // Check against retryable error list
    if (this.config.retryableErrors) {
      return this.config.retryableErrors.some(retryableError => 
        error.message.includes(retryableError) || error.name.includes(retryableError)
      );
    }

    // Default: retry network errors, timeouts, rate limits
    const retryablePatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'timeout',
      'rate limit',
      '429', // HTTP 429 Too Many Requests
      '503', // HTTP 503 Service Unavailable
      '502', // HTTP 502 Bad Gateway
    ];

    return retryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}

/**
 * Convenience function for simple retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  logger?: Logger
): Promise<T> {
  const retryHandler = new RetryHandler({ maxAttempts }, logger);
  return retryHandler.execute(fn);
}

