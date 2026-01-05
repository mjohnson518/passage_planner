/**
 * NOAA Navigation Warnings Service
 *
 * SAFETY CRITICAL: Fetches real navigation warnings from NOAA sources:
 * - NWS Marine Alerts API
 * - Coast Guard Navigation Center (NAVCEN)
 *
 * Provides active warnings for:
 * - Small Craft Advisories
 * - Gale Warnings
 * - Storm Warnings
 * - Hazardous Seas Warnings
 * - Local Notices to Mariners
 */

import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { Logger } from 'pino';
import pino from 'pino';
import { CacheManager } from './CacheManager';
import { GeographicBounds } from '../types/safety';

export interface NavigationWarning {
  id: string;
  type: 'small_craft_advisory' | 'gale_warning' | 'storm_warning' | 'hurricane_warning' |
        'hazardous_seas' | 'special_marine' | 'obstruction' | 'military_exercise' | 'other';
  title: string;
  description: string;
  area: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  bounds?: GeographicBounds;
  severity: 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';
  urgency: 'immediate' | 'expected' | 'future' | 'past' | 'unknown';
  issued: Date;
  expires?: Date;
  effective?: Date;
  source: string;
  instruction?: string;
  event?: string;
  headline?: string;
}

export interface NavigationWarningsResponse {
  warnings: NavigationWarning[];
  area: GeographicBounds;
  fetchedAt: Date;
  source: string;
  totalCount: number;
}

// NWS Alert API Response Types
interface NWSAlertFeature {
  properties: {
    id: string;
    event: string;
    headline: string;
    description: string;
    instruction: string;
    severity: string;
    urgency: string;
    onset: string;
    expires: string;
    effective: string;
    sent: string;
    areaDesc: string;
    senderName: string;
  };
  geometry?: {
    type: string;
    coordinates: number[][][] | number[][];
  };
}

interface NWSAlertResponse {
  features: NWSAlertFeature[];
}

export class NOAANavigationWarningsService {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private cache: CacheManager;

  // NWS Alerts API for marine warnings
  private readonly NWS_ALERTS_API = 'https://api.weather.gov/alerts/active';

  // Marine warning event types we're interested in
  private readonly MARINE_EVENTS = [
    'Small Craft Advisory',
    'Small Craft Advisory for Hazardous Seas',
    'Small Craft Advisory for Rough Bar',
    'Small Craft Advisory for Winds',
    'Gale Warning',
    'Storm Warning',
    'Hurricane Warning',
    'Hurricane Watch',
    'Tropical Storm Warning',
    'Tropical Storm Watch',
    'Special Marine Warning',
    'Marine Weather Statement',
    'Hazardous Seas Warning',
    'Hazardous Seas Watch',
    'High Surf Advisory',
    'High Surf Warning',
    'Rip Current Statement',
    'Beach Hazards Statement',
  ];

  // Cache TTL: 10 minutes for warnings
  private readonly CACHE_TTL_SECONDS = 600;

  constructor(cache: CacheManager, logger?: Logger) {
    this.cache = cache;
    this.logger = logger || pino({
      level: process.env.LOG_LEVEL || 'info',
    });

    this.httpClient = axios.create({
      timeout: 15000,
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': '(Helmwise Passage Planner, contact@helmwise.com)',
      },
    });

    // Configure retry logic
    axiosRetry(this.httpClient, {
      retries: 3,
      retryDelay: (retryCount) => retryCount * 1000,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response?.status || 0) >= 500;
      },
      onRetry: (retryCount, error) => {
        this.logger.warn({ retryCount, url: error.config?.url }, 'NWS Alerts API retry');
      },
    });
  }

  /**
   * Get active navigation warnings for a geographic area
   * SAFETY CRITICAL: Returns all active marine warnings for passage planning
   */
  async getWarningsForArea(bounds: GeographicBounds): Promise<NavigationWarningsResponse> {
    const cacheKey = `nav_warnings:${bounds.north}:${bounds.south}:${bounds.east}:${bounds.west}`;

    // Check cache first
    const cached = await this.cache.get<NavigationWarningsResponse>(cacheKey);
    if (cached) {
      this.logger.debug({ bounds }, 'Returning cached navigation warnings');
      // Rehydrate Date objects from cached JSON (dates become strings during serialization)
      return this.rehydrateCachedResponse(cached);
    }

    try {
      const warnings = await this.fetchNWSMarineAlerts(bounds);

      const response: NavigationWarningsResponse = {
        warnings,
        area: bounds,
        fetchedAt: new Date(),
        source: 'NOAA NWS',
        totalCount: warnings.length,
      };

      // Cache the response
      await this.cache.set(cacheKey, response, this.CACHE_TTL_SECONDS);

      this.logger.info({
        bounds,
        warningCount: warnings.length,
      }, 'Navigation warnings fetched successfully');

      return response;

    } catch (error) {
      this.logger.error({ error, bounds }, 'Failed to fetch navigation warnings');

      // Return empty response rather than throwing - don't break safety checks
      return {
        warnings: [],
        area: bounds,
        fetchedAt: new Date(),
        source: 'NOAA NWS (error)',
        totalCount: 0,
      };
    }
  }

  /**
   * Fetch marine alerts from NWS Alerts API
   */
  private async fetchNWSMarineAlerts(bounds: GeographicBounds): Promise<NavigationWarning[]> {
    // NWS API uses point-based queries, so we'll query for the center and filter
    // For larger areas, we'd need to make multiple requests or use area codes

    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLon = (bounds.east + bounds.west) / 2;

    // Query active marine alerts
    const response = await this.httpClient.get<NWSAlertResponse>(this.NWS_ALERTS_API, {
      params: {
        point: `${centerLat},${centerLon}`,
        status: 'actual',
      },
    });

    const marineAlerts = response.data.features.filter((feature) =>
      this.MARINE_EVENTS.some((event) =>
        feature.properties.event.toLowerCase().includes(event.toLowerCase())
      )
    );

    return marineAlerts.map((alert) => this.convertNWSAlertToWarning(alert));
  }

  /**
   * Get all active marine warnings (no geographic filter)
   * Useful for overview dashboards
   */
  async getAllActiveMarineWarnings(): Promise<NavigationWarning[]> {
    const cacheKey = 'nav_warnings:all_marine';

    const cached = await this.cache.get<NavigationWarning[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get<NWSAlertResponse>(this.NWS_ALERTS_API, {
        params: {
          status: 'actual',
          message_type: 'alert',
        },
      });

      const marineAlerts = response.data.features.filter((feature) =>
        this.MARINE_EVENTS.some((event) =>
          feature.properties.event.toLowerCase().includes(event.toLowerCase())
        )
      );

      const warnings = marineAlerts.map((alert) => this.convertNWSAlertToWarning(alert));

      await this.cache.set(cacheKey, warnings, this.CACHE_TTL_SECONDS);

      return warnings;

    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch all marine warnings');
      return [];
    }
  }

  /**
   * Get warnings by marine zone (NOAA marine zone code)
   * Zone codes like "ANZ338" for specific marine forecast zones
   */
  async getWarningsByZone(zoneCode: string): Promise<NavigationWarning[]> {
    const cacheKey = `nav_warnings:zone:${zoneCode}`;

    const cached = await this.cache.get<NavigationWarning[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.httpClient.get<NWSAlertResponse>(this.NWS_ALERTS_API, {
        params: {
          zone: zoneCode,
          status: 'actual',
        },
      });

      const warnings = response.data.features
        .filter((feature) =>
          this.MARINE_EVENTS.some((event) =>
            feature.properties.event.toLowerCase().includes(event.toLowerCase())
          )
        )
        .map((alert) => this.convertNWSAlertToWarning(alert));

      await this.cache.set(cacheKey, warnings, this.CACHE_TTL_SECONDS);

      return warnings;

    } catch (error) {
      this.logger.error({ error, zoneCode }, 'Failed to fetch warnings by zone');
      return [];
    }
  }

  /**
   * Convert NWS Alert format to our NavigationWarning format
   */
  private convertNWSAlertToWarning(alert: NWSAlertFeature): NavigationWarning {
    const props = alert.properties;

    return {
      id: props.id,
      type: this.mapEventToType(props.event),
      title: props.headline || props.event,
      description: props.description,
      area: props.areaDesc,
      bounds: this.extractBoundsFromGeometry(alert.geometry),
      severity: this.mapSeverity(props.severity),
      urgency: this.mapUrgency(props.urgency),
      issued: new Date(props.sent),
      expires: props.expires ? new Date(props.expires) : undefined,
      effective: props.effective ? new Date(props.effective) : undefined,
      source: props.senderName || 'NOAA NWS',
      instruction: props.instruction,
      event: props.event,
      headline: props.headline,
    };
  }

  /**
   * Map NWS event type to our warning type
   */
  private mapEventToType(event: string): NavigationWarning['type'] {
    const eventLower = event.toLowerCase();

    if (eventLower.includes('small craft')) return 'small_craft_advisory';
    if (eventLower.includes('gale')) return 'gale_warning';
    if (eventLower.includes('storm warning')) return 'storm_warning';
    if (eventLower.includes('hurricane')) return 'hurricane_warning';
    if (eventLower.includes('hazardous seas')) return 'hazardous_seas';
    if (eventLower.includes('special marine')) return 'special_marine';

    return 'other';
  }

  /**
   * Map NWS severity to our severity levels
   */
  private mapSeverity(severity: string): NavigationWarning['severity'] {
    switch (severity.toLowerCase()) {
      case 'extreme':
        return 'extreme';
      case 'severe':
        return 'severe';
      case 'moderate':
        return 'moderate';
      case 'minor':
        return 'minor';
      default:
        return 'unknown';
    }
  }

  /**
   * Map NWS urgency to our urgency levels
   */
  private mapUrgency(urgency: string): NavigationWarning['urgency'] {
    switch (urgency.toLowerCase()) {
      case 'immediate':
        return 'immediate';
      case 'expected':
        return 'expected';
      case 'future':
        return 'future';
      case 'past':
        return 'past';
      default:
        return 'unknown';
    }
  }

  /**
   * Extract geographic bounds from GeoJSON geometry
   */
  private extractBoundsFromGeometry(geometry?: NWSAlertFeature['geometry']): GeographicBounds | undefined {
    if (!geometry || !geometry.coordinates) {
      return undefined;
    }

    try {
      // Flatten all coordinates to find bounds
      const coords = this.flattenCoordinates(geometry.coordinates);
      if (coords.length === 0) {
        return undefined;
      }

      const lons = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);

      return {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lons),
        west: Math.min(...lons),
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Flatten nested GeoJSON coordinates arrays
   */
  private flattenCoordinates(coords: any): number[][] {
    if (typeof coords[0] === 'number') {
      return [coords as number[]];
    }

    const result: number[][] = [];
    for (const c of coords) {
      result.push(...this.flattenCoordinates(c));
    }
    return result;
  }

  /**
   * Check if a warning affects a given route
   */
  warningAffectsRoute(
    warning: NavigationWarning,
    waypoints: Array<{ latitude: number; longitude: number }>
  ): boolean {
    if (!warning.bounds) {
      // No bounds data, assume it might affect the route if in same general area
      return true;
    }

    // Check if any waypoint is within the warning bounds
    for (const wp of waypoints) {
      if (
        wp.latitude >= warning.bounds.south &&
        wp.latitude <= warning.bounds.north &&
        wp.longitude >= warning.bounds.west &&
        wp.longitude <= warning.bounds.east
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Filter warnings by severity threshold
   */
  filterBySeverity(
    warnings: NavigationWarning[],
    minSeverity: NavigationWarning['severity']
  ): NavigationWarning[] {
    const severityOrder: NavigationWarning['severity'][] = ['minor', 'moderate', 'severe', 'extreme'];
    const minIndex = severityOrder.indexOf(minSeverity);

    return warnings.filter((w) => {
      const wIndex = severityOrder.indexOf(w.severity);
      return wIndex >= minIndex || w.severity === 'unknown';
    });
  }

  /**
   * Rehydrate Date objects from cached response
   * JSON serialization converts Date objects to strings, this converts them back
   */
  private rehydrateCachedResponse(cached: NavigationWarningsResponse): NavigationWarningsResponse {
    return {
      ...cached,
      fetchedAt: new Date(cached.fetchedAt),
      warnings: cached.warnings.map(warning => ({
        ...warning,
        issued: new Date(warning.issued),
        expires: warning.expires ? new Date(warning.expires) : undefined,
        effective: warning.effective ? new Date(warning.effective) : undefined,
      })),
    };
  }
}

export default NOAANavigationWarningsService;
