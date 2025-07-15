import axios, { AxiosInstance, AxiosError } from 'axios';
import { Logger } from 'pino';

export interface APIProvider {
  name: string;
  baseUrl: string;
  priority: number;
  healthCheckUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface FallbackOptions {
  maxRetries?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure?: Date;
  state: 'closed' | 'open' | 'half-open';
}

export class APIFallbackManager {
  private providers: APIProvider[];
  private logger: Logger;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private options: Required<FallbackOptions>;
  
  constructor(providers: APIProvider[], logger?: Logger, options?: FallbackOptions) {
    this.providers = providers.sort((a, b) => a.priority - b.priority);
    this.logger = logger || console as any;
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
  
  async request<T>(
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      params?: any;
      data?: any;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    const errors: Error[] = [];
    
    for (const provider of this.providers) {
      if (!this.isProviderAvailable(provider)) {
        this.logger.warn({ provider: provider.name }, 'Provider unavailable (circuit open)');
        continue;
      }
      
      try {
        const response = await this.makeRequest(provider, path, options);
        
        // Reset circuit breaker on success
        this.resetCircuitBreaker(provider);
        
        return response.data as T;
      } catch (error) {
        errors.push(error as Error);
        this.handleProviderError(provider, error as Error);
        
        this.logger.warn({
          provider: provider.name,
          error: (error as Error).message,
          path,
        }, 'Provider request failed, trying next');
      }
    }
    
    // All providers failed
    throw new Error(`All API providers failed: ${errors.map(e => e.message).join('; ')}`);
  }
  
  private async makeRequest(
    provider: APIProvider,
    path: string,
    options?: any
  ) {
    const client = axios.create({
      baseURL: provider.baseUrl,
      timeout: provider.timeout || 30000,
      headers: {
        ...provider.headers,
        ...options?.headers,
      },
    });
    
    // Add retry logic
    let lastError: Error;
    for (let i = 0; i < this.options.maxRetries; i++) {
      try {
        return await client.request({
          url: path,
          method: options?.method || 'GET',
          params: options?.params,
          data: options?.data,
        });
      } catch (error) {
        lastError = error as Error;
        
        if (this.isRetryableError(error as AxiosError)) {
          await this.delay(this.options.retryDelay * Math.pow(2, i)); // Exponential backoff
        } else {
          throw error;
        }
      }
    }
    
    throw lastError!;
  }
  
  private isProviderAvailable(provider: APIProvider): boolean {
    const breaker = this.circuitBreakers.get(provider.name)!;
    
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
  
  private handleProviderError(provider: APIProvider, error: Error) {
    const breaker = this.circuitBreakers.get(provider.name)!;
    
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
  
  private resetCircuitBreaker(provider: APIProvider) {
    const breaker = this.circuitBreakers.get(provider.name)!;
    breaker.failures = 0;
    breaker.state = 'closed';
    breaker.lastFailure = undefined;
  }
  
  private isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
      // Network error - retryable
      return true;
    }
    
    // Retry on 5xx errors and specific 4xx errors
    const status = error.response.status;
    return status >= 500 || status === 429 || status === 408;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Health check for all providers
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const provider of this.providers) {
      try {
        if (provider.healthCheckUrl) {
          await axios.get(provider.baseUrl + provider.healthCheckUrl, {
            timeout: 5000,
          });
          results[provider.name] = true;
        } else {
          // No health check URL, assume healthy if circuit is closed
          const breaker = this.circuitBreakers.get(provider.name)!;
          results[provider.name] = breaker.state === 'closed';
        }
      } catch (error) {
        results[provider.name] = false;
      }
    }
    
    return results;
  }
  
  // Get current circuit breaker states
  getCircuitBreakerStates(): Record<string, CircuitBreakerState> {
    const states: Record<string, CircuitBreakerState> = {};
    
    for (const [name, state] of this.circuitBreakers.entries()) {
      states[name] = { ...state };
    }
    
    return states;
  }
  
  // Manually reset a specific provider
  resetProvider(providerName: string) {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      this.resetCircuitBreaker(provider);
    }
  }
} 