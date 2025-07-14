import pino from 'pino';
import { RateLimiter } from './RateLimiter';
import { CacheManager } from './CacheManager';

export interface APIProvider {
  name: string;
  priority: number;
  healthCheck: () => Promise<boolean>;
  fetch: (params: any) => Promise<any>;
  transform?: (data: any) => any;
  rateLimit?: {
    api: string;
    identifier?: string;
  };
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

export interface FallbackConfig {
  providers: APIProvider[];
  cacheType?: string;
  circuitBreaker?: CircuitBreakerConfig;
  retryConfig?: {
    attempts: number;
    delay: number;
    backoffMultiplier: number;
  };
}

type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private halfOpenRequests = 0;
  
  constructor(private config: CircuitBreakerConfig) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we should try half-open
      if (this.lastFailureTime && 
          Date.now() - this.lastFailureTime.getTime() > this.config.resetTimeout) {
        this.state = 'half-open';
        this.halfOpenRequests = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    if (this.state === 'half-open' && 
        this.halfOpenRequests >= this.config.halfOpenRequests) {
      throw new Error('Circuit breaker is half-open, max requests reached');
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    if (this.state === 'half-open') {
      this.successCount++;
      this.halfOpenRequests++;
      
      if (this.successCount >= this.config.halfOpenRequests) {
        this.state = 'closed';
        this.failures = 0;
        this.successCount = 0;
      }
    } else {
      this.failures = 0;
    }
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.state === 'half-open') {
      this.state = 'open';
      this.successCount = 0;
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }
  
  getState(): CircuitState {
    return this.state;
  }
  
  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }
}

export class APIFallbackManager {
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private providerHealth = new Map<string, boolean>();
  
  constructor(
    private rateLimiter: RateLimiter,
    private cacheManager: CacheManager
  ) {}
  
  /**
   * Execute request with fallback strategy
   */
  async execute<T>(
    config: FallbackConfig,
    params: any,
    cacheKey?: string
  ): Promise<T> {
    // Check cache first if configured
    if (config.cacheType && cacheKey) {
      const cached = await this.cacheManager.get<T>(config.cacheType, cacheKey);
      if (cached) {
        this.logger.debug({ cacheType: config.cacheType, cacheKey }, 'Cache hit');
        return cached;
      }
    }
    
    // Sort providers by priority
    const providers = [...config.providers].sort((a, b) => a.priority - b.priority);
    
    const errors: Array<{ provider: string; error: string }> = [];
    
    for (const provider of providers) {
      try {
        // Check circuit breaker
        const breaker = this.getOrCreateCircuitBreaker(
          provider.name,
          config.circuitBreaker
        );
        
        const result = await breaker.execute(async () => {
          // Check rate limit
          if (provider.rateLimit) {
            const rateLimitCheck = await this.rateLimiter.checkLimit(
              provider.rateLimit.api,
              provider.rateLimit.identifier
            );
            
            if (!rateLimitCheck.allowed) {
              throw new Error(`Rate limit exceeded for ${provider.name}`);
            }
          }
          
          // Check provider health
          const isHealthy = await this.checkProviderHealth(provider);
          if (!isHealthy) {
            throw new Error(`Provider ${provider.name} is unhealthy`);
          }
          
          // Execute request with retry
          const data = await this.executeWithRetry(
            () => provider.fetch(params),
            config.retryConfig
          );
          
          // Transform data if needed
          return provider.transform ? provider.transform(data) : data;
        });
        
        // Cache successful result
        if (config.cacheType && cacheKey) {
          await this.cacheManager.set(config.cacheType, cacheKey, result);
        }
        
        this.logger.info({ provider: provider.name }, 'Request successful');
        return result;
        
      } catch (error: any) {
        this.logger.warn({
          provider: provider.name,
          error: error.message
        }, 'Provider failed, trying next');
        
        errors.push({
          provider: provider.name,
          error: error.message
        });
        
        continue;
      }
    }
    
    // All providers failed
    this.logger.error({ errors }, 'All providers failed');
    throw new Error(`All API providers failed: ${JSON.stringify(errors)}`);
  }
  
  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    config?: {
      attempts: number;
      delay: number;
      backoffMultiplier: number;
    }
  ): Promise<T> {
    const retryConfig = config || {
      attempts: 3,
      delay: 1000,
      backoffMultiplier: 2
    };
    
    let lastError: Error | undefined;
    let delay = retryConfig.delay;
    
    for (let attempt = 1; attempt <= retryConfig.attempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (attempt < retryConfig.attempts) {
          this.logger.debug({
            attempt,
            delay,
            error: error.message
          }, 'Retrying request');
          
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= retryConfig.backoffMultiplier;
        }
      }
    }
    
    throw lastError || new Error('Request failed after retries');
  }
  
  /**
   * Check provider health
   */
  private async checkProviderHealth(provider: APIProvider): Promise<boolean> {
    const cacheKey = `health:${provider.name}`;
    const cached = this.providerHealth.get(cacheKey);
    
    // Use cached health status for 1 minute
    if (cached !== undefined) {
      return cached;
    }
    
    try {
      const isHealthy = await provider.healthCheck();
      this.providerHealth.set(cacheKey, isHealthy);
      
      // Clear cache after 1 minute
      setTimeout(() => {
        this.providerHealth.delete(cacheKey);
      }, 60000);
      
      return isHealthy;
    } catch (error) {
      this.logger.error({
        provider: provider.name,
        error
      }, 'Health check failed');
      
      this.providerHealth.set(cacheKey, false);
      return false;
    }
  }
  
  /**
   * Get or create circuit breaker for provider
   */
  private getOrCreateCircuitBreaker(
    providerName: string,
    config?: CircuitBreakerConfig
  ): CircuitBreaker {
    let breaker = this.circuitBreakers.get(providerName);
    
    if (!breaker) {
      const breakerConfig = config || {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        halfOpenRequests: 3
      };
      
      breaker = new CircuitBreaker(breakerConfig);
      this.circuitBreakers.set(providerName, breaker);
    }
    
    return breaker;
  }
  
  /**
   * Get status of all providers
   */
  async getProviderStatus(): Promise<Array<{
    name: string;
    healthy: boolean;
    circuitState?: CircuitState;
    rateLimit?: any;
  }>> {
    const status = [];
    
    for (const [name, breaker] of this.circuitBreakers) {
      const health = this.providerHealth.get(`health:${name}`);
      
      status.push({
        name,
        healthy: health !== false,
        circuitState: breaker.getState()
      });
    }
    
    return status;
  }
  
  /**
   * Reset circuit breaker for a provider
   */
  resetCircuitBreaker(providerName: string) {
    const breaker = this.circuitBreakers.get(providerName);
    if (breaker) {
      breaker.reset();
      this.logger.info({ provider: providerName }, 'Circuit breaker reset');
    }
  }
  
  /**
   * Create weather API fallback configuration
   */
  static createWeatherFallback(
    rateLimiter: RateLimiter,
    options: {
      noaaApiKey?: string;
      openWeatherApiKey?: string;
      windyApiKey?: string;
    }
  ): FallbackConfig {
    const providers: APIProvider[] = [];
    
    // NOAA - highest priority (free, reliable)
    if (options.noaaApiKey) {
      providers.push({
        name: 'NOAA',
        priority: 1,
        healthCheck: async () => {
          try {
            const response = await fetch('https://api.weather.gov/');
            return response.ok;
          } catch {
            return false;
          }
        },
        fetch: async (params) => {
          const response = await fetch(
            `https://api.weather.gov/points/${params.latitude},${params.longitude}`
          );
          if (!response.ok) throw new Error('NOAA API error');
          return response.json();
        },
        rateLimit: {
          api: 'noaa'
        }
      });
    }
    
    // OpenWeatherMap - second priority
    if (options.openWeatherApiKey) {
      providers.push({
        name: 'OpenWeatherMap',
        priority: 2,
        healthCheck: async () => {
          try {
            const response = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?lat=0&lon=0&appid=${options.openWeatherApiKey}`
            );
            return response.status !== 401;
          } catch {
            return false;
          }
        },
        fetch: async (params) => {
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${params.latitude}&lon=${params.longitude}&appid=${options.openWeatherApiKey}&units=metric`
          );
          if (!response.ok) throw new Error('OpenWeatherMap API error');
          return response.json();
        },
        rateLimit: {
          api: 'openweather'
        }
      });
    }
    
    // Windy - third priority
    if (options.windyApiKey) {
      providers.push({
        name: 'Windy',
        priority: 3,
        healthCheck: async () => true, // Windy doesn't have a simple health endpoint
        fetch: async (params) => {
          const response = await fetch('https://api.windy.com/api/point-forecast/v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: params.latitude,
              lon: params.longitude,
              model: 'gfs',
              parameters: ['wind', 'temp', 'pressure'],
              key: options.windyApiKey
            })
          });
          if (!response.ok) throw new Error('Windy API error');
          return response.json();
        },
        rateLimit: {
          api: 'windy'
        }
      });
    }
    
    return {
      providers,
      cacheType: 'weather_current',
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 300000, // 5 minutes
        halfOpenRequests: 2
      },
      retryConfig: {
        attempts: 2,
        delay: 500,
        backoffMultiplier: 2
      }
    };
  }
} 