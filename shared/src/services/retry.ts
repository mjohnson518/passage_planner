/**
 * Retry Logic with Exponential Backoff
 * 
 * Implements production-grade retry patterns for external API calls
 * with exponential backoff, jitter, and configurable strategies.
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffFactor?: number
  jitter?: boolean
  retryableStatuses?: number[]
  onRetry?: (error: Error, attempt: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  jitter: true,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  onRetry: () => {},
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffFactor: number,
  jitter: boolean
): number {
  const exponentialDelay = Math.min(
    initialDelay * Math.pow(backoffFactor, attempt),
    maxDelay
  )

  if (!jitter) {
    return exponentialDelay
  }

  // Add jitter: random value between 0 and calculated delay
  // This prevents thundering herd problem
  return Math.random() * exponentialDelay
}

/**
 * Check if error is retryable
 */
function isRetryable(error: any, retryableStatuses: number[]): boolean {
  // Network errors are retryable
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true
  }

  // HTTP status code based retry
  if (error.response?.status) {
    return retryableStatuses.includes(error.response.status)
  }

  // Fetch API errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }

  return false
}

/**
 * Retry a function with exponential backoff
 * 
 * @example
 * ```typescript
 * const data = await retry(
 *   async () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, initialDelay: 1000 }
 * )
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry on last attempt
      if (attempt === config.maxRetries) {
        break
      }

      // Check if error is retryable
      if (!isRetryable(error, config.retryableStatuses)) {
        throw error
      }

      // Call retry callback
      config.onRetry(lastError, attempt + 1)

      // Calculate and wait for delay
      const delay = calculateDelay(
        attempt,
        config.initialDelay,
        config.maxDelay,
        config.backoffFactor,
        config.jitter
      )

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Retry wrapper for fetch calls with proper error handling
 * 
 * @example
 * ```typescript
 * const response = await retryFetch('https://api.noaa.gov/data', {
 *   headers: { 'User-Agent': 'helmwise.co, support@helmwise.co' }
 * })
 * ```
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return retry(
    async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        })

        // Throw for HTTP errors to trigger retry
        if (!response.ok && isRetryable({ response }, options?.retryableStatuses || DEFAULT_OPTIONS.retryableStatuses)) {
          throw Object.assign(
            new Error(`HTTP ${response.status}: ${response.statusText}`),
            { response }
          )
        }

        return response
      } finally {
        clearTimeout(timeout)
      }
    },
    options
  )
}
