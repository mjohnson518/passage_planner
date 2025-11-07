import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { Logger } from 'pino';
import pino from 'pino';
import { CacheManager } from './CacheManager';
import { RetryClient } from './resilience/retry-client';

/**
 * Real NOAA Weather API Client
 * Makes actual HTTP calls to api.weather.gov
 * No mocks, no placeholders - this is production code
 */

export interface GridPoint {
  office: string;
  gridX: number;
  gridY: number;
  city?: string;
  state?: string;
  timeZone?: string;
}

export interface ForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  temperatureTrend?: string;
  windSpeed: string;
  windDirection: string;
  icon: string;
  shortForecast: string;
  detailedForecast: string;
  probabilityOfPrecipitation?: {
    unitCode: string;
    value: number | null;
  };
  dewpoint?: {
    unitCode: string;
    value: number;
  };
  relativeHumidity?: {
    unitCode: string;
    value: number;
  };
}

export interface WeatherForecast {
  updated: string;
  generatedAt: string;
  updateTime: string;
  periods: ForecastPeriod[];
  elevation?: {
    unitCode: string;
    value: number;
  };
}

export interface MarineWarning {
  id: string;
  areaDesc: string;
  headline: string;
  description: string;
  severity: string;
  certainty: string;
  urgency: string;
  event: string;
  onset: string;
  expires: string;
  instruction?: string;
}

export class NOAAAPIClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private gridCache = new Map<string, GridPoint>();
  private cache?: CacheManager;
  
  constructor(logger?: Logger, cache?: CacheManager) {
    this.logger = logger || pino({
      level: process.env.LOG_LEVEL || 'info'
    });
    this.cache = cache;

    // Create axios instance with required User-Agent header
    this.httpClient = axios.create({
      baseURL: 'https://api.weather.gov',
      timeout: 30000,
      headers: {
        'User-Agent': '(helmwise.co, support@helmwise.co)', // REQUIRED by NOAA
        'Accept': 'application/geo+json, application/json',
      }
    });

    // Configure retry logic
    axiosRetry(this.httpClient, {
      retries: 3,
      retryDelay: (retryCount) => {
        return retryCount * 1000; // exponential backoff
      },
      retryCondition: (error) => {
        // Retry on network errors or 5xx errors
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response?.status || 0) >= 500;
      },
      onRetry: (retryCount, error) => {
        this.logger.warn(`Retry attempt ${retryCount} for ${error.config?.url}`);
      }
    });

    this.logger.info('NOAA API Client initialized with real endpoints');
  }

  /**
   * Get weather forecast for coordinates
   * This is the main entry point - returns REAL weather data
   */
  async getWeatherForecast(lat: number, lon: number): Promise<WeatherForecast> {
    this.logger.info({ lat, lon }, 'Fetching real weather forecast from NOAA');
    
    try {
      // Step 1: Get grid point from coordinates
      const gridPoint = await this.getGridPoint(lat, lon);
      
      // Step 2: Get forecast using grid point
      const forecast = await this.getForecastFromGrid(
        gridPoint.office,
        gridPoint.gridX,
        gridPoint.gridY
      );
      
      // Validate data freshness
      const generatedAt = new Date(forecast.generatedAt);
      const ageHours = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
      
      if (ageHours > 3) {
        this.logger.warn({ ageHours }, 'Weather data is stale (>3 hours old)');
      }
      
      this.logger.info(
        { 
          location: `${gridPoint.city}, ${gridPoint.state}`,
          periods: forecast.periods.length,
          generated: forecast.generatedAt
        }, 
        'Successfully fetched real weather data'
      );
      
      return forecast;
    } catch (error) {
      this.logger.error({ error, lat, lon }, 'Failed to fetch weather forecast');
      throw error;
    }
  }

  /**
   * Get grid point from latitude/longitude
   * NOAA requires this two-step process
   */
  async getGridPoint(lat: number, lon: number): Promise<GridPoint> {
    const cacheKey = `weather:grid:${lat.toFixed(4)},${lon.toFixed(4)}`;
    
    // Check Redis cache first (7 day TTL for grid points - they rarely change)
    if (this.cache) {
      const cached = await this.cache.get<GridPoint>(cacheKey);
      if (cached) {
        this.logger.debug({ cacheKey }, 'Using Redis cached grid point');
        return cached;
      }
    }
    
    // Check in-memory cache as fallback
    const memCacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (this.gridCache.has(memCacheKey)) {
      this.logger.debug({ cacheKey: memCacheKey }, 'Using memory cached grid point');
      return this.gridCache.get(memCacheKey)!;
    }
    
    const url = `/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    this.logger.debug({ url }, 'Fetching grid point from NOAA');
    
    // Use retry logic for resilience
    const response = await RetryClient.requestWithRetry<any>(
      () => this.httpClient.get(url),
      {
        retries: 3,
        minTimeout: 1000,
        onFailedAttempt: (error) => {
          this.logger.warn({ 
            attempt: error.attemptNumber,
            url 
          }, 'Grid point fetch retry');
        }
      }
    );
    
    const properties = response.properties;
    const gridPoint: GridPoint = {
      office: properties.gridId,
      gridX: properties.gridX,
      gridY: properties.gridY,
      city: properties.relativeLocation?.properties?.city,
      state: properties.relativeLocation?.properties?.state,
      timeZone: properties.timeZone
    };
    
    // Cache for future use
    this.gridCache.set(memCacheKey, gridPoint);
    
    // Store in Redis with 7 day TTL (grid points rarely change)
    if (this.cache) {
      await this.cache.setWithTTL(cacheKey, gridPoint, 604800); // 7 days = 604800 seconds
    }
    
    this.logger.info(
      { 
        office: gridPoint.office,
        gridX: gridPoint.gridX,
        gridY: gridPoint.gridY,
        city: gridPoint.city,
        state: gridPoint.state
      },
      'Grid point retrieved successfully'
    );
    
    return gridPoint;
  }

  /**
   * Get forecast from grid coordinates
   * Returns actual NOAA forecast data
   */
  private async getForecastFromGrid(
    office: string, 
    gridX: number, 
    gridY: number
  ): Promise<WeatherForecast> {
    const url = `/gridpoints/${office}/${gridX},${gridY}/forecast`;
    this.logger.debug({ url }, 'Fetching forecast from NOAA');
    
    // Use retry logic for resilience
    const data = await RetryClient.requestWithRetry<any>(
      () => this.httpClient.get(url),
      {
        retries: 3,
        minTimeout: 1000,
        onFailedAttempt: (error) => {
          this.logger.warn({ 
            attempt: error.attemptNumber,
            url 
          }, 'Forecast fetch retry');
        }
      }
    );
    
    const properties = data.properties;
    
    return {
      updated: properties.updated,
      generatedAt: properties.generatedAt,
      updateTime: properties.updateTime,
      periods: properties.periods,
      elevation: properties.elevation
    };
  }

  /**
   * Get marine forecast for coastal areas
   * Uses marine-specific endpoints when available
   */
  async getMarineForecast(lat: number, lon: number): Promise<any> {
    this.logger.info({ lat, lon }, 'Fetching marine forecast');
    
    try {
      // First get regular forecast
      const forecast = await this.getWeatherForecast(lat, lon);
      
      // Then try to get marine-specific data
      const gridPoint = await this.getGridPoint(lat, lon);
      const marineUrl = `/gridpoints/${gridPoint.office}/${gridPoint.gridX},${gridPoint.gridY}/forecast/marine`;
      
      try {
        const marineResponse = await this.httpClient.get(marineUrl);
        
        // Combine regular and marine forecasts
        return {
          ...forecast,
          marine: marineResponse.data.properties
        };
      } catch (marineError) {
        // Marine forecast not available for all locations
        this.logger.debug('Marine forecast not available, using regular forecast');
        return forecast;
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch marine forecast');
      throw error;
    }
  }

  /**
   * Get active weather alerts/warnings for an area
   */
  async getActiveAlerts(lat: number, lon: number): Promise<MarineWarning[]> {
    const url = '/alerts/active';
    const params = {
      point: `${lat.toFixed(4)},${lon.toFixed(4)}`,
      status: 'actual',
      message_type: 'alert,update'
    };
    
    this.logger.debug({ url, params }, 'Fetching active alerts');
    
    try {
      // Use retry logic for resilience
      const data = await RetryClient.requestWithRetry<any>(
        () => this.httpClient.get(url, { params }),
        {
          retries: 3,
          minTimeout: 1000,
          onFailedAttempt: (error) => {
            this.logger.warn({ 
              attempt: error.attemptNumber,
              url 
            }, 'Alerts fetch retry');
          }
        }
      );
      
      const warnings: MarineWarning[] = data.features.map((feature: any) => ({
        id: feature.properties.id,
        areaDesc: feature.properties.areaDesc,
        headline: feature.properties.headline,
        description: feature.properties.description,
        severity: feature.properties.severity,
        certainty: feature.properties.certainty,
        urgency: feature.properties.urgency,
        event: feature.properties.event,
        onset: feature.properties.onset,
        expires: feature.properties.expires,
        instruction: feature.properties.instruction
      }));
      
      this.logger.info({ count: warnings.length }, 'Retrieved active alerts');
      return warnings;
    } catch (error) {
      this.logger.warn({ error }, 'Failed to fetch alerts, returning empty array');
      return [];
    }
  }

  /**
   * Parse wind speed string to knots
   * NOAA returns strings like "15 mph" or "10 to 15 mph"
   */
  parseWindSpeed(windSpeed: string): number {
    const match = windSpeed.match(/(\d+)/);
    if (!match) return 0;
    
    const speed = parseInt(match[1]);
    
    // Convert to knots if in mph
    if (windSpeed.toLowerCase().includes('mph')) {
      return Math.round(speed * 0.868976);
    }
    
    return speed;
  }
}

// Export singleton instance for immediate use
export const noaaClient = new NOAAAPIClient();