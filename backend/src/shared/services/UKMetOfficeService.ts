/**
 * UK Met Office DataPoint API Service
 * 
 * Provides high-quality weather forecasts for UK waters and North Atlantic.
 * Uses FREE tier DataPoint API with 5,000 calls/day limit.
 * 
 * Gracefully handles missing API key - returns null if not configured.
 */

import { Logger } from 'pino';
import { ApiClient } from './api-client';
import { DataFreshnessValidator } from './data-freshness';
import { WeatherServiceError } from '../types/errors';

export interface UKMOForecast {
  time: Date;
  windSpeed: number; // knots
  windDirection: number; // degrees
  windGust: number; // knots
  visibility: number; // nautical miles
  temperature: number; // Celsius
  precipitation: number; // probability percentage
  pressure?: number; // hPa
  humidity?: number; // percentage
  weatherType: string;
  source: 'ukmo';
  confidence: 'high' | 'medium' | 'low';
}

export interface UKMOSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  region?: string;
}

export class UKMetOfficeService {
  private apiClient: ApiClient | null = null;
  private logger: Logger;
  private freshnessValidator: DataFreshnessValidator;
  private siteCache: Map<string, UKMOSite> = new Map();
  private sitelist: UKMOSite[] = [];
  private apiKey: string | null;
  private readonly BASE_URL = 'http://datapoint.metoffice.gov.uk/public/data';

  constructor(apiKey: string | undefined, logger: Logger) {
    this.logger = logger;
    this.apiKey = apiKey || null;
    this.freshnessValidator = new DataFreshnessValidator({}, logger);

    // Only initialize API client if key is provided
    if (this.apiKey) {
      this.apiClient = new ApiClient({
        baseUrl: this.BASE_URL,
        timeout: 15000,
        retryOptions: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          retryableStatuses: [408, 429, 500, 502, 503, 504],
        },
        circuitBreakerOptions: {
          failureThreshold: 5,
          timeout: 60000,
        },
        headers: {
          'apikey': this.apiKey,
        },
        onError: (error, endpoint) => {
          logger.error(`UK Met Office API error on ${endpoint}:`, error)
        }
      });

      // Load site list on initialization
      this.loadSiteList().catch((error) => {
        this.logger.warn({ error }, 'Failed to load UK Met Office site list');
      });
    } else {
      this.logger.info('UK Met Office API key not configured - service disabled');
    }
  }

  /**
   * Check if service is available (API key configured)
   */
  isAvailable(): boolean {
    return this.apiKey !== null && this.apiClient !== null;
  }

  /**
   * Get marine forecast for location
   * Returns null if service not available
   */
  async getMarineForecast(
    latitude: number,
    longitude: number,
    hours: number = 72
  ): Promise<UKMOForecast[] | null> {
    if (!this.isAvailable() || !this.apiClient) {
      this.logger.debug('UK Met Office service not available - API key not configured');
      return null;
    }

    try {
      // Find nearest forecast site
      const site = await this.findNearestSite(latitude, longitude);
      if (!site) {
        throw new WeatherServiceError('No UK Met Office forecast site found for location', {
          latitude,
          longitude,
          service: 'UKMetOffice',
        });
      }

      // Get 3-hourly forecast
      const response = await this.apiClient.get<any>(
        `/val/wxfcs/all/json/${site.id}?res=3hourly&key=${this.apiKey}`
      );

      // Parse forecast data
      const forecasts = this.parseForecastResponse(response.data, site);

      // Filter to requested hours
      const now = new Date();
      const cutoff = new Date(now.getTime() + hours * 60 * 60 * 1000);
      const filtered = forecasts.filter(f => f.time <= cutoff);

      // Validate data freshness
      const issueTime = response.data.SiteRep?.DV?.dataDate;
      if (issueTime) {
        this.freshnessValidator.validateWeatherForecast({
          retrievedAt: issueTime,
          source: 'UK Met Office',
        });
      }

      this.logger.info({
        site: site.name,
        siteId: site.id,
        forecastsReturned: filtered.length,
        hours,
      }, 'UK Met Office forecast retrieved');

      return filtered;
    } catch (error) {
      if (error instanceof WeatherServiceError) {
        throw error;
      }
      
      this.logger.error({ error, latitude, longitude }, 'Failed to get UK Met Office forecast');
      throw new WeatherServiceError(
        `UK Met Office API error: ${(error as Error).message}`,
        {
          latitude,
          longitude,
          service: 'UKMetOffice',
        }
      );
    }
  }

  /**
   * Find nearest forecast site to given coordinates
   */
  private async findNearestSite(latitude: number, longitude: number): Promise<UKMOSite | null> {
    // Check cache first
    const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const cached = this.siteCache.get(cacheKey);
    if (cached) return cached;

    // Ensure site list is loaded
    if (this.sitelist.length === 0) {
      await this.loadSiteList();
    }

    // Find nearest site using Haversine distance
    let nearestSite: UKMOSite | null = null;
    let minDistance = Infinity;

    for (const site of this.sitelist) {
      const distance = this.haversineDistance(
        latitude,
        longitude,
        site.latitude,
        site.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestSite = site;
      }
    }

    // Cache the result (site lookups don't change often)
    if (nearestSite) {
      this.siteCache.set(cacheKey, nearestSite);
    }

    return nearestSite;
  }

  /**
   * Load list of all UK Met Office forecast sites
   */
  private async loadSiteList(): Promise<void> {
    if (!this.apiClient) return;

    try {
      const response = await this.apiClient.get<any>(
        `/val/wxfcs/all/json/sitelist?key=${this.apiKey}`
      );

      const locations = response.data.Locations?.Location || [];
      this.sitelist = locations.map((loc: any) => ({
        id: loc.id,
        name: loc.name,
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude),
        elevation: loc.elevation ? parseFloat(loc.elevation) : undefined,
        region: loc.region,
      }));

      this.logger.info({ sites: this.sitelist.length }, 'UK Met Office site list loaded');
    } catch (error) {
      this.logger.error({ error }, 'Failed to load UK Met Office site list');
      throw error;
    }
  }

  /**
   * Parse UK Met Office forecast response
   */
  private parseForecastResponse(data: any, site: UKMOSite): UKMOForecast[] {
    const forecasts: UKMOForecast[] = [];
    
    try {
      const periods = data.SiteRep?.DV?.Location?.Period || [];

      for (const period of periods) {
        const reps = period.Rep || [];
        const periodDate = period.value; // Format: "2024-07-15Z"

        for (const rep of reps) {
          // Parse time ($ field represents minutes since midnight)
          const minutesSinceMidnight = parseInt(rep.$, 10);
          const forecastTime = new Date(periodDate);
          forecastTime.setUTCMinutes(minutesSinceMidnight);

          forecasts.push({
            time: forecastTime,
            windSpeed: this.convertMphToKnots(parseFloat(rep.S || '0')),
            windDirection: this.parseWindDirection(rep.D),
            windGust: this.convertMphToKnots(parseFloat(rep.G || rep.S || '0')),
            visibility: this.convertVisibilityToNm(rep.V),
            temperature: parseFloat(rep.T || '15'),
            precipitation: parseInt(rep.Pp || '0', 10),
            pressure: rep.P ? parseFloat(rep.P) : undefined,
            humidity: rep.H ? parseInt(rep.H, 10) : undefined,
            weatherType: this.parseWeatherType(rep.W),
            source: 'ukmo',
            confidence: 'high', // UK Met Office is authoritative for UK waters
          });
        }
      }

      return forecasts;
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to parse UK Met Office forecast');
      throw new WeatherServiceError(
        'Failed to parse UK Met Office forecast data',
        { site: site.id, error: (error as Error).message }
      );
    }
  }

  /**
   * Convert mph to knots
   */
  private convertMphToKnots(mph: number): number {
    return mph * 0.868976;
  }

  /**
   * Parse wind direction from compass direction or degrees
   */
  private parseWindDirection(direction: string): number {
    const compassToDegrees = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5,
    };

    // If it's a compass direction, convert
    if (direction in compassToDegrees) {
      return compassToDegrees[direction as keyof typeof compassToDegrees];
    }

    // Otherwise parse as number
    return parseInt(direction, 10) || 0;
  }

  /**
   * Convert UK Met Office visibility codes to nautical miles
   */
  private convertVisibilityToNm(visibilityCode: string): number {
    // UK Met Office visibility categories:
    // UN = Unknown, VP = Very Poor (<1km), PO = Poor (1-4km), 
    // MO = Moderate (4-10km), GO = Good (10-20km), VG = Very Good (20-40km), EX = Excellent (>40km)
    
    const visibilityMap: Record<string, number> = {
      'UN': 1.0,   // Unknown - assume poor
      'VP': 0.5,   // Very Poor - 0.5nm
      'PO': 1.5,   // Poor - 1.5nm
      'MO': 4.0,   // Moderate - 4nm
      'GO': 8.0,   // Good - 8nm
      'VG': 15.0,  // Very Good - 15nm
      'EX': 25.0,  // Excellent - 25nm
    };

    return visibilityMap[visibilityCode] || 5.0; // Default to moderate
  }

  /**
   * Parse weather type code to description
   */
  private parseWeatherType(code: string): string {
    // UK Met Office weather type codes (simplified subset)
    const weatherTypes: Record<string, string> = {
      '0': 'Clear night',
      '1': 'Sunny day',
      '2': 'Partly cloudy (night)',
      '3': 'Partly cloudy (day)',
      '5': 'Mist',
      '6': 'Fog',
      '7': 'Cloudy',
      '8': 'Overcast',
      '9': 'Light rain shower (night)',
      '10': 'Light rain shower (day)',
      '11': 'Drizzle',
      '12': 'Light rain',
      '13': 'Heavy rain shower (night)',
      '14': 'Heavy rain shower (day)',
      '15': 'Heavy rain',
      '16': 'Sleet shower (night)',
      '17': 'Sleet shower (day)',
      '18': 'Sleet',
      '19': 'Hail shower (night)',
      '20': 'Hail shower (day)',
      '21': 'Hail',
      '22': 'Light snow shower (night)',
      '23': 'Light snow shower (day)',
      '24': 'Light snow',
      '25': 'Heavy snow shower (night)',
      '26': 'Heavy snow shower (day)',
      '27': 'Heavy snow',
      '28': 'Thunder shower (night)',
      '29': 'Thunder shower (day)',
      '30': 'Thunder',
    };

    return weatherTypes[code] || 'Unknown';
  }

  /**
   * Calculate Haversine distance between two points
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3440.1; // Nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get service health status
   */
  getHealth(): {
    available: boolean;
    apiKeyConfigured: boolean;
    sitesLoaded: number;
    lastError?: string;
  } {
    return {
      available: this.isAvailable(),
      apiKeyConfigured: this.apiKey !== null,
      sitesLoaded: this.sitelist.length,
    };
  }

  /**
   * Get API metrics
   */
  getMetrics() {
    if (!this.apiClient) {
      return null;
    }
    return this.apiClient.getMetrics();
  }
}

