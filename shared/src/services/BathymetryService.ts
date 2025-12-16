/**
 * BathymetryService - SAFETY CRITICAL
 *
 * Provides real bathymetric (water depth) data for maritime safety calculations.
 * Uses NOAA GEBCO (General Bathymetric Chart of the Oceans) data.
 *
 * CRITICAL: This service provides depth data used to prevent vessel groundings.
 * Incorrect depth data can lead to serious maritime incidents.
 */

import axios from 'axios';
import { Logger } from 'pino';

export interface DepthResult {
  latitude: number;
  longitude: number;
  depth: number; // Depth in meters (positive = water depth, negative = land elevation)
  depthFeet: number; // Depth converted to feet
  source: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  timestamp: Date;
  gridResolution?: string;
  chartDatum: string;
}

export interface BathymetryQueryOptions {
  /** Prefer cached data if available and fresh (default: true) */
  useCache?: boolean;
  /** Maximum age of cached data in seconds (default: 86400 - 24 hours) */
  maxCacheAge?: number;
  /** Minimum acceptable confidence level (default: 'low') */
  minConfidence?: 'high' | 'medium' | 'low' | 'unknown';
}

interface CachedDepth {
  result: DepthResult;
  fetchedAt: number;
}

/**
 * BathymetryService provides water depth data from multiple sources
 * with caching and fallback capabilities.
 */
export class BathymetryService {
  private logger: Logger;
  private cache: Map<string, CachedDepth> = new Map();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours - depth data changes slowly

  // NOAA ETOPO API endpoints
  private readonly NOAA_ETOPO_URL = 'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/identify';

  // OpenSeaMap depth API (fallback)
  private readonly OPENSEAMAP_URL = 'https://depth.openseamap.org/getDepth';

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'BathymetryService' });
  }

  /**
   * Get water depth at a specific location
   *
   * SAFETY CRITICAL: This data is used for grounding prevention.
   * Always validate results before making navigation decisions.
   *
   * @param latitude - Latitude in decimal degrees
   * @param longitude - Longitude in decimal degrees
   * @param options - Query options
   * @returns Depth result with confidence information
   */
  async getDepth(
    latitude: number,
    longitude: number,
    options: BathymetryQueryOptions = {}
  ): Promise<DepthResult> {
    const {
      useCache = true,
      maxCacheAge = 86400,
      minConfidence = 'low',
    } = options;

    // Validate coordinates
    if (latitude < -90 || latitude > 90) {
      throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90.`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180.`);
    }

    // Check cache first
    const cacheKey = this.getCacheKey(latitude, longitude);
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.fetchedAt) < (maxCacheAge * 1000)) {
        this.logger.debug({ latitude, longitude }, 'Returning cached depth data');
        return cached.result;
      }
    }

    // Try primary source: NOAA ETOPO
    try {
      const result = await this.fetchFromNOAAETOPO(latitude, longitude);
      if (result && this.meetsConfidenceThreshold(result.confidence, minConfidence)) {
        this.cacheResult(cacheKey, result);
        return result;
      }
    } catch (error) {
      this.logger.warn({ error, latitude, longitude }, 'NOAA ETOPO query failed, trying fallback');
    }

    // Fallback: OpenSeaMap
    try {
      const result = await this.fetchFromOpenSeaMap(latitude, longitude);
      if (result) {
        this.cacheResult(cacheKey, result);
        return result;
      }
    } catch (error) {
      this.logger.warn({ error, latitude, longitude }, 'OpenSeaMap query failed');
    }

    // If all sources fail, return unknown depth with warning
    this.logger.error({ latitude, longitude }, 'CRITICAL: All depth data sources failed');

    return {
      latitude,
      longitude,
      depth: NaN,
      depthFeet: NaN,
      source: 'none',
      confidence: 'unknown',
      timestamp: new Date(),
      chartDatum: 'unknown',
    };
  }

  /**
   * Get depth data for multiple points along a route
   * Optimized for batch queries with rate limiting
   */
  async getDepthsAlongRoute(
    waypoints: Array<{ latitude: number; longitude: number }>,
    options: BathymetryQueryOptions = {}
  ): Promise<DepthResult[]> {
    const results: DepthResult[] = [];

    // Process in batches to avoid overwhelming APIs
    const batchSize = 10;
    for (let i = 0; i < waypoints.length; i += batchSize) {
      const batch = waypoints.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(wp => this.getDepth(wp.latitude, wp.longitude, options))
      );

      results.push(...batchResults);

      // Rate limiting: wait 100ms between batches
      if (i + batchSize < waypoints.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Find minimum depth along a route segment
   * SAFETY CRITICAL: Used to identify shallowest point for safety calculations
   */
  async findMinimumDepthAlongRoute(
    waypoints: Array<{ latitude: number; longitude: number }>,
    sampleInterval: number = 0.01 // ~1km intervals
  ): Promise<{
    minimumDepth: DepthResult;
    allDepths: DepthResult[];
    routeAnalysis: {
      waypointsChecked: number;
      averageDepth: number;
      shallowAreas: number;
    };
  }> {
    // Generate sample points along route at regular intervals
    const samplePoints: Array<{ latitude: number; longitude: number }> = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];

      // Calculate number of samples for this segment
      const distance = this.calculateDistance(start, end);
      const numSamples = Math.max(2, Math.ceil(distance / sampleInterval));

      for (let j = 0; j < numSamples; j++) {
        const fraction = j / numSamples;
        samplePoints.push({
          latitude: start.latitude + (end.latitude - start.latitude) * fraction,
          longitude: start.longitude + (end.longitude - start.longitude) * fraction,
        });
      }
    }

    // Add final waypoint
    samplePoints.push(waypoints[waypoints.length - 1]);

    // Get depths for all sample points
    const allDepths = await this.getDepthsAlongRoute(samplePoints);

    // Find minimum depth
    let minimumDepth = allDepths[0];
    let totalDepth = 0;
    let shallowAreas = 0;
    const SHALLOW_THRESHOLD_METERS = 10; // 10 meters = ~33 feet

    for (const depth of allDepths) {
      if (!isNaN(depth.depth) && depth.depth > 0) {
        totalDepth += depth.depth;

        if (depth.depth < minimumDepth.depth || isNaN(minimumDepth.depth)) {
          minimumDepth = depth;
        }

        if (depth.depth < SHALLOW_THRESHOLD_METERS) {
          shallowAreas++;
        }
      }
    }

    const validDepths = allDepths.filter(d => !isNaN(d.depth) && d.depth > 0);

    return {
      minimumDepth,
      allDepths,
      routeAnalysis: {
        waypointsChecked: allDepths.length,
        averageDepth: validDepths.length > 0 ? totalDepth / validDepths.length : NaN,
        shallowAreas,
      },
    };
  }

  /**
   * Fetch depth from NOAA ETOPO global elevation/bathymetry model
   */
  private async fetchFromNOAAETOPO(
    latitude: number,
    longitude: number
  ): Promise<DepthResult | null> {
    try {
      const response = await axios.get(this.NOAA_ETOPO_URL, {
        params: {
          geometry: JSON.stringify({ x: longitude, y: latitude }),
          geometryType: 'esriGeometryPoint',
          returnGeometry: false,
          returnCatalogItems: false,
          f: 'json',
        },
        timeout: 10000,
      });

      if (response.data && response.data.value !== undefined) {
        const elevationMeters = parseFloat(response.data.value);

        // Positive values = land elevation above sea level
        // Negative values = water depth below sea level
        // For bathymetry, we want the absolute value of negative numbers
        const depthMeters = elevationMeters < 0 ? Math.abs(elevationMeters) : 0;

        return {
          latitude,
          longitude,
          depth: depthMeters,
          depthFeet: depthMeters * 3.28084, // Convert to feet
          source: 'NOAA ETOPO',
          confidence: depthMeters > 0 ? 'high' : 'medium',
          timestamp: new Date(),
          gridResolution: '15 arc-second',
          chartDatum: 'MSL', // Mean Sea Level
        };
      }

      return null;
    } catch (error) {
      this.logger.error({ error, latitude, longitude }, 'NOAA ETOPO API error');
      throw error;
    }
  }

  /**
   * Fallback: Fetch from OpenSeaMap depth data
   */
  private async fetchFromOpenSeaMap(
    latitude: number,
    longitude: number
  ): Promise<DepthResult | null> {
    try {
      // Note: OpenSeaMap depth API may have limited coverage
      const response = await axios.get(this.OPENSEAMAP_URL, {
        params: {
          lat: latitude,
          lon: longitude,
        },
        timeout: 10000,
      });

      if (response.data && response.data.depth !== undefined) {
        const depthMeters = parseFloat(response.data.depth);

        return {
          latitude,
          longitude,
          depth: depthMeters,
          depthFeet: depthMeters * 3.28084,
          source: 'OpenSeaMap',
          confidence: 'medium', // Community-sourced data has medium confidence
          timestamp: new Date(),
          chartDatum: 'LAT', // Lowest Astronomical Tide (typical for nautical charts)
        };
      }

      return null;
    } catch (error) {
      this.logger.error({ error, latitude, longitude }, 'OpenSeaMap API error');
      throw error;
    }
  }

  /**
   * Generate cache key for a coordinate
   * Rounds to 4 decimal places (~11m precision) for cache efficiency
   */
  private getCacheKey(latitude: number, longitude: number): string {
    const roundedLat = Math.round(latitude * 10000) / 10000;
    const roundedLon = Math.round(longitude * 10000) / 10000;
    return `depth:${roundedLat}:${roundedLon}`;
  }

  /**
   * Cache a depth result
   */
  private cacheResult(key: string, result: DepthResult): void {
    this.cache.set(key, {
      result,
      fetchedAt: Date.now(),
    });

    // Clean old cache entries periodically
    if (this.cache.size > 10000) {
      this.cleanCache();
    }
  }

  /**
   * Remove expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.fetchedAt > this.CACHE_TTL_MS) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Check if a confidence level meets the minimum threshold
   */
  private meetsConfidenceThreshold(
    actual: 'high' | 'medium' | 'low' | 'unknown',
    minimum: 'high' | 'medium' | 'low' | 'unknown'
  ): boolean {
    const levels = { high: 3, medium: 2, low: 1, unknown: 0 };
    return levels[actual] >= levels[minimum];
  }

  /**
   * Calculate distance between two points in degrees (approximate)
   */
  private calculateDistance(
    p1: { latitude: number; longitude: number },
    p2: { latitude: number; longitude: number }
  ): number {
    const dLat = Math.abs(p2.latitude - p1.latitude);
    const dLon = Math.abs(p2.longitude - p1.longitude);
    return Math.sqrt(dLat * dLat + dLon * dLon);
  }

  /**
   * Clear all cached data (for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Bathymetry cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; oldestEntry: Date | null } {
    let oldestTimestamp = Infinity;
    for (const value of this.cache.values()) {
      if (value.fetchedAt < oldestTimestamp) {
        oldestTimestamp = value.fetchedAt;
      }
    }

    return {
      size: this.cache.size,
      oldestEntry: oldestTimestamp === Infinity ? null : new Date(oldestTimestamp),
    };
  }
}

export default BathymetryService;
