/**
 * API Client with Retry Logic and Circuit Breaker
 * 
 * Provides resilient API calling with automatic retries and circuit breaker protection.
 * Tracks API health, quotas, and performance metrics.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from 'pino';
import { RetryHandler } from './retry';
import { CircuitBreaker } from './circuit-breaker';

export interface APIClientConfig {
  baseURL: string;
  timeout: number;
  headers?: Record<string, string>;
  retryConfig?: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
  circuitBreakerConfig?: {
    failureThreshold: number;
    timeout: number;
  };
  quotaConfig?: {
    maxRequestsPerMinute?: number;
    maxRequestsPerHour?: number;
    maxRequestsPerDay?: number;
  };
}

export interface APIResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  cached: boolean;
  duration: number;
}

export interface APIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  quotaRemaining?: {
    perMinute?: number;
    perHour?: number;
    perDay?: number;
  };
  lastRequestTime?: Date;
  circuitBreakerState: string;
}

export class APIClient {
  private axiosInstance: AxiosInstance;
  private retryHandler: RetryHandler;
  private circuitBreaker: CircuitBreaker;
  private logger?: Logger;
  private name: string;
  private config: APIClientConfig;

  // Metrics
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private totalLatency = 0;
  private lastRequestTime?: Date;

  // Quota tracking
  private requestsThisMinute = 0;
  private requestsThisHour = 0;
  private requestsThisDay = 0;
  private minuteResetTime = Date.now() + 60000;
  private hourResetTime = Date.now() + 3600000;
  private dayResetTime = Date.now() + 86400000;

  constructor(name: string, config: APIClientConfig, logger?: Logger) {
    this.name = name;
    this.config = config;
    this.logger = logger;

    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'User-Agent': 'Helmwise/1.0',
        ...config.headers,
      },
    });

    // Initialize retry handler
    this.retryHandler = new RetryHandler(
      {
        maxAttempts: config.retryConfig?.maxAttempts ?? 3,
        initialDelayMs: config.retryConfig?.initialDelayMs ?? 1000,
        maxDelayMs: config.retryConfig?.maxDelayMs ?? 30000,
      },
      logger
    );

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      name,
      {
        failureThreshold: config.circuitBreakerConfig?.failureThreshold ?? 5,
        timeout: config.circuitBreakerConfig?.timeout ?? 30000,
      },
      logger
    );

    // Set up circuit breaker event listeners
    this.circuitBreaker.on('stateChange', (event) => {
      this.logger?.warn({
        service: this.name,
        from: event.from,
        to: event.to,
      }, `Circuit breaker state changed: ${event.from} → ${event.to}`);
    });
  }

  /**
   * GET request with retry and circuit breaker
   */
  async get<T>(path: string, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    return this.request<T>('GET', path, undefined, config);
  }

  /**
   * POST request with retry and circuit breaker
   */
  async post<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    return this.request<T>('POST', path, data, config);
  }

  /**
   * PUT request with retry and circuit breaker
   */
  async put<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    return this.request<T>('PUT', path, data, config);
  }

  /**
   * DELETE request with retry and circuit breaker
   */
  async delete<T>(path: string, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', path, undefined, config);
  }

  /**
   * Core request method with all resilience features
   */
  private async request<T>(
    method: string,
    path: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<APIResponse<T>> {
    // Check quota
    this.checkQuota();

    const startTime = Date.now();
    this.totalRequests++;
    this.lastRequestTime = new Date();

    // Track quota
    this.incrementQuotaCounters();

    try {
      // Execute with circuit breaker and retry
      const response = await this.circuitBreaker.execute(async () => {
        return await this.retryHandler.execute(async () => {
          return await this.axiosInstance.request<T>({
            method,
            url: path,
            data,
            ...config,
          });
        });
      });

      const duration = Date.now() - startTime;
      this.successfulRequests++;
      this.totalLatency += duration;

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
        cached: false,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.failedRequests++;
      this.totalLatency += duration;

      if (this.logger) {
        this.logger.error({
          service: this.name,
          method,
          path,
          duration,
          error: (error as Error).message,
        }, 'API request failed');
      }

      throw error;
    }
  }

  /**
   * Check if quota limits would be exceeded
   */
  private checkQuota(): void {
    // Reset counters if time windows have passed
    const now = Date.now();

    if (now >= this.minuteResetTime) {
      this.requestsThisMinute = 0;
      this.minuteResetTime = now + 60000;
    }

    if (now >= this.hourResetTime) {
      this.requestsThisHour = 0;
      this.hourResetTime = now + 3600000;
    }

    if (now >= this.dayResetTime) {
      this.requestsThisDay = 0;
      this.dayResetTime = now + 86400000;
    }

    // Check quotas
    if (this.config.quotaConfig?.maxRequestsPerMinute &&
        this.requestsThisMinute >= this.config.quotaConfig.maxRequestsPerMinute) {
      throw new Error(`Quota exceeded: ${this.name} max requests per minute (${this.config.quotaConfig.maxRequestsPerMinute})`);
    }

    if (this.config.quotaConfig?.maxRequestsPerHour &&
        this.requestsThisHour >= this.config.quotaConfig.maxRequestsPerHour) {
      throw new Error(`Quota exceeded: ${this.name} max requests per hour (${this.config.quotaConfig.maxRequestsPerHour})`);
    }

    if (this.config.quotaConfig?.maxRequestsPerDay &&
        this.requestsThisDay >= this.config.quotaConfig.maxRequestsPerDay) {
      throw new Error(`Quota exceeded: ${this.name} max requests per day (${this.config.quotaConfig.maxRequestsPerDay})`);
    }
  }

  /**
   * Increment quota counters
   */
  private incrementQuotaCounters(): void {
    this.requestsThisMinute++;
    this.requestsThisHour++;
    this.requestsThisDay++;
  }

  /**
   * Get API metrics
   */
  getMetrics(): APIMetrics {
    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      averageLatencyMs: this.totalRequests > 0 
        ? this.totalLatency / this.totalRequests 
        : 0,
      quotaRemaining: {
        perMinute: this.config.quotaConfig?.maxRequestsPerMinute 
          ? this.config.quotaConfig.maxRequestsPerMinute - this.requestsThisMinute 
          : undefined,
        perHour: this.config.quotaConfig?.maxRequestsPerHour 
          ? this.config.quotaConfig.maxRequestsPerHour - this.requestsThisHour 
          : undefined,
        perDay: this.config.quotaConfig?.maxRequestsPerDay 
          ? this.config.quotaConfig.maxRequestsPerDay - this.requestsThisDay 
          : undefined,
      },
      lastRequestTime: this.lastRequestTime,
      circuitBreakerState: this.circuitBreaker.getState(),
    };
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  /**
   * Reset circuit breaker (for recovery or testing)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Check if API is healthy
   */
  isHealthy(): boolean {
    return this.circuitBreaker.isHealthy();
  }
}

