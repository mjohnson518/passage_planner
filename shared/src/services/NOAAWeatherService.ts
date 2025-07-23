import axios, { AxiosInstance } from 'axios';
import { Logger } from 'pino';
import { CacheManager } from './CacheManager';
import { APIFallbackManager } from './APIFallbackManager';

export interface MarineWeatherForecast {
  location: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  issuedAt: Date;
  periods: WeatherPeriod[];
  warnings: WeatherWarning[];
  waveHeight: WaveData[];
  windData: WindData[];
  visibility: VisibilityData[];
}

export interface WeatherPeriod {
  startTime: Date;
  endTime: Date;
  temperature: number;
  temperatureUnit: 'F' | 'C';
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  precipitationChance: number;
  isDaytime: boolean;
}

export interface WeatherWarning {
  id: string;
  type: 'storm' | 'gale' | 'hurricane' | 'fog' | 'thunderstorm' | 'small_craft';
  severity: 'extreme' | 'severe' | 'moderate' | 'minor';
  headline: string;
  description: string;
  instruction?: string;
  onset: Date;
  expires: Date;
  areas: string[];
}

export interface WaveData {
  time: Date;
  height: number; // meters
  period: number; // seconds
  direction: number; // degrees
}

export interface WindData {
  time: Date;
  speed: number; // knots
  gusts: number; // knots
  direction: number; // degrees
}

export interface VisibilityData {
  time: Date;
  distance: number; // nautical miles
  conditions: string;
}

export class NOAAWeatherService {
  private axios: AxiosInstance;
  private cache: CacheManager;
  private fallbackManager: APIFallbackManager;
  private logger: Logger;
  
  // NOAA API endpoints
  private readonly NOAA_API_BASE = 'https://api.weather.gov';
  private readonly NOAA_MARINE_BASE = 'https://marine.weather.gov';
  private readonly NOAA_TIDES_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
  
  constructor(cache: CacheManager, logger: Logger) {
    this.cache = cache;
    this.logger = logger;
    
    this.axios = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'PassagePlanner/1.0 (https://passageplanner.com)',
        'Accept': 'application/geo+json'
      }
    });
    
    // Setup fallback manager with multiple endpoints
    this.fallbackManager = new APIFallbackManager(
      [
        {
          name: 'NOAA Primary',
          baseUrl: this.NOAA_API_BASE,
          priority: 1
        },
        {
          name: 'NOAA Marine',
          baseUrl: this.NOAA_MARINE_BASE,
          priority: 2
        }
      ],
      logger,
      { maxRetries: 3 }
    );
  }
  
  /**
   * Get marine weather forecast for a specific point
   */
  async getMarineForecast(
    latitude: number, 
    longitude: number,
    days: number = 7
  ): Promise<MarineWeatherForecast> {
    const cacheKey = `weather:marine:${latitude.toFixed(4)},${longitude.toFixed(4)}:${days}`;
    
    // Check cache first (15 minute TTL)
    const cached = await this.cache.get<MarineWeatherForecast>(cacheKey);
    if (cached) {
      this.logger.debug({ latitude, longitude }, 'Returning cached marine forecast');
      return cached;
    }
    
    try {
      // First, get the grid point for the coordinates
      const pointData = await this.getGridPoint(latitude, longitude);
      
      // Get various forecast data in parallel
      const [forecast, warnings, marineData] = await Promise.all([
        this.getForecastFromGrid(pointData.gridId, pointData.gridX, pointData.gridY),
        this.getActiveWarnings(latitude, longitude),
        this.getMarineSpecificData(latitude, longitude)
      ]);
      
      // Combine all data
      const marineForecast: MarineWeatherForecast = {
        location: {
          latitude,
          longitude,
          name: pointData.relativeLocation?.city || undefined
        },
        issuedAt: new Date(),
        periods: forecast.periods.slice(0, days * 2), // 2 periods per day
        warnings: warnings,
        waveHeight: marineData.waves || [],
        windData: marineData.wind || [],
        visibility: marineData.visibility || []
      };
      
      // Cache the result
      await this.cache.set(cacheKey, marineForecast, 900); // 15 minutes
      
      return marineForecast;
    } catch (error) {
      this.logger.error({ error, latitude, longitude }, 'Failed to get marine forecast');
      throw new Error('Unable to retrieve marine weather forecast');
    }
  }
  
  /**
   * Get grid point data from coordinates
   */
  private async getGridPoint(latitude: number, longitude: number): Promise<any> {
    const response = await this.fallbackManager.request(`/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`);
    return (response as any).properties;
  }
  
  /**
   * Get forecast from grid coordinates
   */
  private async getForecastFromGrid(gridId: string, gridX: number, gridY: number): Promise<any> {
    const response = await this.fallbackManager.request(
      `/gridpoints/${gridId}/${gridX},${gridY}/forecast`
    );
    return (response as any).properties;
  }
  
  /**
   * Get active weather warnings for an area
   */
  private async getActiveWarnings(latitude: number, longitude: number): Promise<WeatherWarning[]> {
    try {
      const response = await this.fallbackManager.request('/alerts/active', {
        params: {
          point: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
          status: 'actual',
          message_type: 'alert,update'
        }
      });
      
      return (response as any).features.map((feature: any) => ({
        id: feature.properties.id,
        type: this.mapWarningType(feature.properties.event),
        severity: feature.properties.severity?.toLowerCase() || 'moderate',
        headline: feature.properties.headline,
        description: feature.properties.description,
        instruction: feature.properties.instruction,
        onset: new Date(feature.properties.onset),
        expires: new Date(feature.properties.expires),
        areas: feature.properties.areaDesc?.split('; ') || []
      }));
    } catch (error) {
      this.logger.warn({ error }, 'Failed to get weather warnings');
      return [];
    }
  }
  
  /**
   * Get marine-specific data (waves, detailed wind)
   */
  private async getMarineSpecificData(
    latitude: number, 
    longitude: number
  ): Promise<{ waves?: WaveData[], wind?: WindData[], visibility?: VisibilityData[] }> {
    try {
      // Find nearest NOAA buoy or station
      const station = await this.findNearestMarineStation(latitude, longitude);
      if (!station) {
        return {};
      }
      
      // Get wave and wind data from the station
      const [waveData, windData] = await Promise.all([
        this.getWaveData(station.id),
        this.getWindData(station.id)
      ]);
      
      return {
        waves: waveData,
        wind: windData,
        visibility: [] // TODO: Implement visibility data fetching
      };
    } catch (error) {
      this.logger.warn({ error }, 'Failed to get marine-specific data');
      return {};
    }
  }
  
  /**
   * Find nearest NOAA marine observation station
   */
  private async findNearestMarineStation(
    latitude: number, 
    longitude: number
  ): Promise<{ id: string; distance: number } | null> {
    // This would query NOAA's station API to find the nearest buoy/station
    // For now, returning null as a placeholder
    return null;
  }
  
  /**
   * Get wave height data from a station
   */
  private async getWaveData(stationId: string): Promise<WaveData[]> {
    try {
      const response = await axios.get(this.NOAA_TIDES_BASE, {
        params: {
          station: stationId,
          product: 'predictions',
          datum: 'MLLW',
          units: 'metric',
          time_zone: 'gmt',
          format: 'json'
        }
      });
      
      // Transform the data to our format
      return response.data.predictions?.map((pred: any) => ({
        time: new Date(pred.t),
        height: parseFloat(pred.v),
        period: 0, // TODO: Get wave period data
        direction: 0 // TODO: Get wave direction data
      })) || [];
    } catch (error) {
      this.logger.warn({ error, stationId }, 'Failed to get wave data');
      return [];
    }
  }
  
  /**
   * Get wind data from a station
   */
  private async getWindData(stationId: string): Promise<WindData[]> {
    // Similar implementation for wind data
    return [];
  }
  
  /**
   * Map NOAA warning types to our internal types
   */
  private mapWarningType(noaaEvent: string): WeatherWarning['type'] {
    const eventLower = noaaEvent.toLowerCase();
    
    if (eventLower.includes('hurricane')) return 'hurricane';
    if (eventLower.includes('gale')) return 'gale';
    if (eventLower.includes('storm')) return 'storm';
    if (eventLower.includes('fog')) return 'fog';
    if (eventLower.includes('thunderstorm')) return 'thunderstorm';
    if (eventLower.includes('small craft')) return 'small_craft';
    
    return 'storm'; // default
  }
  
  /**
   * Check if conditions are safe for sailing
   */
  async checkSafetyConditions(
    forecast: MarineWeatherForecast,
    preferences: {
      maxWindSpeed: number; // knots
      maxWaveHeight: number; // meters
      minVisibility: number; // nautical miles
    }
  ): Promise<{ safe: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    let safe = true;
    
    // Check active weather warnings
    const severeWarnings = forecast.warnings.filter(
      w => w.severity === 'extreme' || w.severity === 'severe'
    );
    
    if (severeWarnings.length > 0) {
      safe = false;
      warnings.push(...severeWarnings.map(w => w.headline));
    }
    
    // Check wind conditions
    const dangerousWinds = forecast.windData.filter(
      w => w.speed > preferences.maxWindSpeed || w.gusts > preferences.maxWindSpeed * 1.5
    );
    
    if (dangerousWinds.length > 0) {
      safe = false;
      warnings.push(`Wind speeds exceeding ${preferences.maxWindSpeed} knots detected`);
    }
    
    // Check wave heights
    const dangerousWaves = forecast.waveHeight.filter(
      w => w.height > preferences.maxWaveHeight
    );
    
    if (dangerousWaves.length > 0) {
      safe = false;
      warnings.push(`Wave heights exceeding ${preferences.maxWaveHeight}m detected`);
    }
    
    // Check visibility
    const poorVisibility = forecast.visibility.filter(
      v => v.distance < preferences.minVisibility
    );
    
    if (poorVisibility.length > 0) {
      safe = false;
      warnings.push(`Visibility below ${preferences.minVisibility} nm detected`);
    }
    
    return { safe, warnings };
  }
} 