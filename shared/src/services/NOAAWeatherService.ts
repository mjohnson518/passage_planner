import { Logger } from 'pino';
import { CacheManager } from './CacheManager';
import { NOAAAPIClient } from './noaa-api-client';
import { CircuitBreakerFactory } from './resilience/circuit-breaker';
import CircuitBreaker from 'opossum';
import { NDBCBuoyService } from './NDBCBuoyService';
import { NOAAForecastResponseSchema, NOAAAlertsResponseSchema } from '../types/weather/api-response-schemas';
import { WEATHER_CACHE_TTL_S, FALLBACK_CACHE_TTL_S } from '../constants/safety-thresholds';

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
  dataWarnings?: string[]; // Non-fatal data quality warnings (e.g., wave data unavailable)
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
  precipitationChance: number | null; // null = no data, not 0% chance
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
  direction: number; // degrees (NaN = unknown/variable)
  gustsEstimated?: boolean; // true when gust value is estimated (1.5x rule), false when parsed from forecast text
}

export interface VisibilityData {
  time: Date;
  distance: number; // nautical miles
  conditions: string;
}

export class NOAAWeatherService {
  private noaaClient: NOAAAPIClient;
  private cache: CacheManager;
  private logger: Logger;
  private gridPointBreaker: CircuitBreaker;
  private forecastBreaker: CircuitBreaker;
  private buoyService: NDBCBuoyService;

  constructor(
    cache: CacheManager,
    logger: Logger,
    apiClient?: NOAAAPIClient  // Optional for dependency injection in tests
  ) {
    this.cache = cache;
    this.logger = logger;
    this.noaaClient = apiClient ?? new NOAAAPIClient(logger, cache);

    // Initialize NDBC buoy service for wave data
    this.buoyService = new NDBCBuoyService(cache, logger);
    
    // Initialize circuit breakers for NOAA API calls
    this.gridPointBreaker = CircuitBreakerFactory.create(
      'noaa-gridpoint',
      this.noaaClient.getGridPoint.bind(this.noaaClient),
      {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 60000
      }
    );
    
    this.forecastBreaker = CircuitBreakerFactory.create(
      'noaa-forecast',
      this.noaaClient.getWeatherForecast.bind(this.noaaClient),
      {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 60000
      }
    );
  }
  
  /**
   * Get marine weather forecast for a specific point
   * Now using REAL NOAA API data
   */
  async getMarineForecast(
    latitude: number, 
    longitude: number,
    days: number = 7
  ): Promise<MarineWeatherForecast> {
    const cacheKey = `weather:forecast:${latitude.toFixed(4)},${longitude.toFixed(4)}:${days}`;
    
    // Check cache first with metadata (3 hour TTL for weather)
    const cachedData = await this.cache.getWithMetadata<MarineWeatherForecast>(cacheKey);
    if (cachedData && cachedData.value) {
      this.logger.debug({ 
        latitude, 
        longitude, 
        age: cachedData.age, 
        ttl: cachedData.ttl 
      }, 'Returning cached marine forecast');
      return cachedData.value;
    }
    
    try {
      // Get REAL weather forecast from NOAA with circuit breaker protection
      const [forecast, alerts] = await Promise.all([
        this.forecastBreaker.fire(latitude, longitude).then((result: any) => result).catch(async (error) => {
          // If circuit is open, try to return cached data
          this.logger.warn({ error: error.message }, 'Circuit breaker open for forecast, checking cache');
          const fallbackCache = await this.cache.get<any>(`weather:forecast:fallback:${latitude.toFixed(4)},${longitude.toFixed(4)}`);
          if (fallbackCache) {
            this.logger.info('Using fallback cached forecast data');
            return fallbackCache;
          }
          throw error; // Re-throw if no cache available
        }),
        this.noaaClient.getActiveAlerts(latitude, longitude)
      ]);
      
      // SAFETY CRITICAL: Validate API responses at boundary before processing
      const forecastParse = NOAAForecastResponseSchema.safeParse(forecast);
      if (!forecastParse.success) {
        this.logger.error({
          latitude,
          longitude,
          issues: forecastParse.error.issues,
          responseKeys: forecast ? Object.keys(forecast) : [],
        }, 'NOAA forecast response failed schema validation — rejecting malformed data');
        throw new Error('NOAA forecast response has unexpected shape — cannot safely parse for navigation');
      }
      const validatedForecast = forecastParse.data;

      const alertsParse = NOAAAlertsResponseSchema.safeParse(alerts);
      if (!alertsParse.success) {
        // Alerts are important but non-fatal — log and continue with empty alerts
        this.logger.warn({
          issues: alertsParse.error.issues,
        }, 'NOAA alerts response failed schema validation — using empty alerts');
      }
      const validatedAlerts = alertsParse.success ? alertsParse.data : [];

      // Fetch wave data from NDBC buoys
      const { waveData, waveDataWarning } = await this.getWaveDataForLocation(latitude, longitude);

      const dataWarnings: string[] = [];
      if (waveDataWarning) dataWarnings.push(waveDataWarning);

      // Transform NOAA format to our internal format
      const marineForecast: MarineWeatherForecast = {
        location: {
          latitude,
          longitude,
          name: undefined // Will be populated from grid point city
        },
        issuedAt: new Date(validatedForecast.generatedAt),
        periods: validatedForecast.periods.slice(0, days * 2).map(period => ({
          startTime: new Date(period.startTime),
          endTime: new Date(period.endTime),
          temperature: period.temperature,
          temperatureUnit: period.temperatureUnit as 'F' | 'C',
          windSpeed: period.windSpeed,
          windDirection: period.windDirection,
          shortForecast: period.shortForecast,
          detailedForecast: period.detailedForecast,
          precipitationChance: period.probabilityOfPrecipitation?.value ?? null,
          isDaytime: period.isDaytime
        })),
        warnings: validatedAlerts.map(alert => ({
          id: alert.id,
          type: this.mapWarningType(alert.event),
          severity: alert.severity.toLowerCase() as 'extreme' | 'severe' | 'moderate' | 'minor',
          headline: alert.headline,
          description: alert.description,
          instruction: alert.instruction ?? undefined, // normalize null → undefined
          onset: new Date(alert.onset),
          expires: new Date(alert.expires),
          areas: alert.areaDesc.split('; ')
        })),
        waveHeight: waveData,
        windData: this.extractWindData(validatedForecast.periods),
        visibility: this.extractVisibilityData(validatedForecast.periods), // Parse from forecast text
        dataWarnings: dataWarnings.length > 0 ? dataWarnings : undefined,
      };
      
      // Cache the result with 1-hour TTL (matches CLAUDE.md "reject stale data >1hr")
      await this.cache.setWithTTL(cacheKey, marineForecast, WEATHER_CACHE_TTL_S);

      // Also store a fallback cache with longer TTL for circuit breaker scenarios
      // Store marineForecast (internal format) not validatedForecast (raw NOAA shape)
      await this.cache.setWithTTL(
        `weather:forecast:fallback:${latitude.toFixed(4)},${longitude.toFixed(4)}`,
        marineForecast,
        FALLBACK_CACHE_TTL_S
      );
      
      return marineForecast;
    } catch (error) {
      this.logger.error({ error, latitude, longitude }, 'Failed to get marine forecast');
      throw new Error('Unable to retrieve marine weather forecast');
    }
  }
  
  /**
   * Parse actual gust speed from NOAA forecast text.
   * Returns null when no gust text found (caller should use estimated value).
   * SAFETY: Applies a safety floor of 1.3x sustained speed.
   */
  private parseGustFromForecast(detailedForecast: string, sustainedSpeed: number): number | null {
    const match = detailedForecast.match(/gusts?\s+(?:up\s+)?to\s+(\d+)\s*(mph|kt|knots)/i);
    if (!match) return null;

    let gustSpeed = parseInt(match[1], 10);
    if (match[2].toLowerCase() === 'mph') {
      gustSpeed = Math.round(gustSpeed * 0.868976);
    }
    // Apply safety floor: never report gusts below 1.3x sustained speed
    return Math.max(gustSpeed, Math.round(sustainedSpeed * 1.3));
  }

  /**
   * Extract wind data from forecast periods.
   * Uses parsed gust values when available; falls back to 1.5x estimate.
   */
  private extractWindData(periods: any[]): WindData[] {
    return periods.map(period => {
      const speed = this.noaaClient.parseWindSpeed(period.windSpeed);
      const parsedGust = this.parseGustFromForecast(period.detailedForecast || '', speed);
      const gustsEstimated = parsedGust === null;
      return {
        time: new Date(period.startTime),
        speed,
        gusts: parsedGust ?? Math.round(speed * 1.5),
        direction: this.parseWindDirection(period.windDirection),
        gustsEstimated,
      };
    });
  }

  /**
   * Parse wind direction string to degrees.
   * Returns NaN when direction is unknown — consumers should display "Variable/Unknown".
   */
  private parseWindDirection(direction: string): number {
    const directions: { [key: string]: number } = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
    };

    // Extract direction from strings like "SW 10 mph"
    const match = direction.match(/([NSEW]+)/);
    if (match && directions[match[1]] !== undefined) {
      return directions[match[1]];
    }
    return NaN; // Unknown/variable direction — callers show "Variable/Unknown"
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

  /**
   * Fetch wave data from nearby NDBC buoys.
   * CRITICAL SAFETY: Returns a warning when wave data is unavailable — empty array
   * is indistinguishable from calm seas, which is dangerous.
   */
  private async getWaveDataForLocation(
    latitude: number,
    longitude: number
  ): Promise<{ waveData: WaveData[]; waveDataWarning: string | null }> {
    try {
      // Find nearest buoy stations
      const nearbyStations = await this.buoyService.findNearestStations(latitude, longitude, 100, 3);

      if (nearbyStations.length === 0) {
        this.logger.debug({ latitude, longitude }, 'No NDBC buoys found near location');
        return {
          waveData: [],
          waveDataWarning: 'Wave data unavailable — no NDBC buoys within 100nm. Verify sea state independently.',
        };
      }

      // Fetch data from the nearest buoy
      const waveData: WaveData[] = [];

      for (const station of nearbyStations) {
        const buoyData = await this.buoyService.getBuoyData(station.id);

        if (buoyData && buoyData.observations.length > 0) {
          // Convert buoy observations to our WaveData format
          for (const obs of buoyData.observations.slice(0, 24)) { // Get last 24 hours
            if (obs.significantWaveHeight !== null) {
              waveData.push({
                time: obs.timestamp,
                height: obs.significantWaveHeight,
                period: obs.dominantWavePeriod || 0,
                direction: obs.meanWaveDirection || 0
              });
            }
          }

          // Log the data source for audit trail
          this.logger.info({
            latitude,
            longitude,
            stationId: station.id,
            stationName: station.name,
            observationCount: waveData.length,
            latestWaveHeight: buoyData.currentConditions?.significantWaveHeight
          }, 'Wave data fetched from NDBC buoy');

          // Use data from first station with valid observations
          if (waveData.length > 0) break;
        }
      }

      if (waveData.length === 0) {
        return {
          waveData: [],
          waveDataWarning: 'Wave data unavailable — verify sea state independently before departure.',
        };
      }

      return { waveData, waveDataWarning: null };
    } catch (error) {
      this.logger.warn({ error, latitude, longitude }, 'Failed to fetch wave data from NDBC');
      return {
        waveData: [],
        waveDataWarning: 'Wave data unavailable — verify sea state independently before departure.',
      };
    }
  }

  /**
   * Extract visibility data from NOAA forecast text
   * CRITICAL SAFETY: Parses fog and visibility conditions from forecast
   */
  private extractVisibilityData(periods: any[]): VisibilityData[] {
    const visibilityData: VisibilityData[] = [];

    for (const period of periods) {
      const forecast = (period.shortForecast + ' ' + period.detailedForecast).toLowerCase();
      const time = new Date(period.startTime);

      // Default to conservative visibility (lower than good-visibility default)
      let distance = 7; // nautical miles (conservative default per safety policy)
      let conditions = 'clear';

      // Check for fog/precipitation conditions — ordered from most to least severe
      if (forecast.includes('freezing fog')) {
        distance = 0.25;
        conditions = 'Freezing Fog';
      } else if (forecast.includes('dense fog')) {
        distance = 0.25; // Less than 1/4 mile
        conditions = 'Dense Fog';
      } else if (forecast.includes('patchy fog') || forecast.includes('areas of fog')) {
        distance = 1; // 1-3 miles
        conditions = 'Patchy Fog';
      } else if (forecast.includes('fog')) {
        distance = 0.5; // 1/2 mile
        conditions = 'Fog';
      } else if (forecast.includes('freezing drizzle')) {
        distance = 1;
        conditions = 'Freezing Drizzle';
      } else if (forecast.includes('blowing snow')) {
        distance = 0.5;
        conditions = 'Blowing Snow';
      } else if (forecast.includes('mist') || forecast.includes('haze')) {
        distance = 3; // 3-5 miles
        conditions = 'Mist/Haze';
      } else if (forecast.includes('smoke')) {
        distance = 2;
        conditions = 'Smoke';
      } else if (forecast.includes('rain') && forecast.includes('heavy')) {
        distance = 2;
        conditions = 'Heavy Rain';
      } else if (forecast.includes('snow') && forecast.includes('heavy')) {
        distance = 0.5;
        conditions = 'Heavy Snow';
      } else if (forecast.includes('thunderstorm')) {
        distance = 2;
        conditions = 'Thunderstorms';
      }

      // Parse explicit visibility values from detailed forecast
      // Examples: "visibility 1 mile", "visibility 1 mi", "visibility one quarter mile"
      const visMatch = forecast.match(/visibility[:\s]+(\d+(?:\.\d+)?)\s*(mile|mi\b|nm|nautical)/i);
      if (visMatch) {
        distance = parseFloat(visMatch[1]);
      }

      const fractionMatch = forecast.match(/visibility[:\s]+(one\s+)?(?:quarter|half|three\s+quarter)/i);
      if (fractionMatch) {
        if (forecast.includes('quarter') && !forecast.includes('three quarter')) {
          distance = 0.25;
        } else if (forecast.includes('half')) {
          distance = 0.5;
        } else if (forecast.includes('three quarter')) {
          distance = 0.75;
        }
      }

      visibilityData.push({
        time,
        distance,
        conditions
      });
    }

    return visibilityData;
  }
} 