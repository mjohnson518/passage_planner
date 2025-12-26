import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { Logger } from 'pino';
import pino from 'pino';
import { CacheManager } from './CacheManager';
import { CircuitBreakerFactory } from './resilience/circuit-breaker';
import CircuitBreaker from 'opossum';

/**
 * NDBC (National Data Buoy Center) Service
 *
 * CRITICAL SAFETY COMPONENT: Provides real-time wave height and marine conditions
 * from NOAA's network of ocean buoys.
 *
 * API Documentation: https://www.ndbc.noaa.gov/docs/ndbc_web_data_guide.pdf
 * Station List: https://www.ndbc.noaa.gov/to_station.shtml
 *
 * Data fields used:
 * - WVHT: Significant wave height (meters)
 * - DPD: Dominant wave period (seconds)
 * - MWD: Mean wave direction (degrees)
 * - WTMP: Water temperature (Celsius)
 * - WDIR: Wind direction (degrees)
 * - WSPD: Wind speed (m/s)
 */

export interface BuoyStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: 'buoy' | 'ship' | 'cman'; // CMAN = Coastal Marine Automated Network
  owner: string;
}

export interface WaveObservation {
  timestamp: Date;
  stationId: string;
  significantWaveHeight: number | null; // WVHT in meters
  dominantWavePeriod: number | null;    // DPD in seconds
  meanWaveDirection: number | null;      // MWD in degrees true
  waterTemperature: number | null;       // WTMP in Celsius
  windSpeed: number | null;              // WSPD in m/s
  windDirection: number | null;          // WDIR in degrees true
  windGusts: number | null;              // GST in m/s
  airTemperature: number | null;         // ATMP in Celsius
  pressure: number | null;               // PRES in hPa
  visibility: number | null;             // VIS in nautical miles
}

export interface WaveHazardLevel {
  level: 'safe' | 'moderate' | 'elevated' | 'dangerous';
  description: string;
  advisory?: string;
}

export interface BuoyData {
  station: BuoyStation;
  observations: WaveObservation[];
  currentConditions: WaveObservation | null;
  hazardLevel: WaveHazardLevel;
  dataAge: number; // minutes since last observation
  quality: 'good' | 'stale' | 'unavailable';
}

// Known active NDBC stations for US coastal waters
// These are the primary stations - full list at https://www.ndbc.noaa.gov/to_station.shtml
const NDBC_STATIONS: BuoyStation[] = [
  // Northeast Atlantic
  { id: '44013', name: 'Boston 16 NM East of Boston', lat: 42.346, lon: -70.651, type: 'buoy', owner: 'NDBC' },
  { id: '44017', name: 'Montauk Point', lat: 40.694, lon: -72.048, type: 'buoy', owner: 'NDBC' },
  { id: '44025', name: 'Long Island 30 NM South', lat: 40.251, lon: -73.166, type: 'buoy', owner: 'NDBC' },
  { id: '44065', name: 'New York Harbor Entrance', lat: 40.369, lon: -73.703, type: 'buoy', owner: 'NDBC' },
  { id: '44008', name: 'Nantucket 54 NM SE', lat: 40.502, lon: -69.247, type: 'buoy', owner: 'NDBC' },
  { id: '44005', name: 'Gulf of Maine', lat: 43.201, lon: -69.128, type: 'buoy', owner: 'NDBC' },
  { id: '44027', name: 'Jonesport ME', lat: 44.280, lon: -67.300, type: 'buoy', owner: 'NDBC' },

  // Mid-Atlantic
  { id: '44009', name: 'Delaware Bay 26 NM SE', lat: 38.457, lon: -74.702, type: 'buoy', owner: 'NDBC' },
  { id: '44014', name: 'Virginia Beach 64 NM East', lat: 36.611, lon: -74.836, type: 'buoy', owner: 'NDBC' },
  { id: '41025', name: 'Diamond Shoals NC', lat: 35.006, lon: -75.402, type: 'buoy', owner: 'NDBC' },

  // Southeast Atlantic & Gulf
  { id: '41008', name: 'Grays Reef GA', lat: 31.402, lon: -80.869, type: 'buoy', owner: 'NDBC' },
  { id: '41009', name: 'Canaveral 20 NM East', lat: 28.519, lon: -80.166, type: 'buoy', owner: 'NDBC' },
  { id: '42036', name: 'West Tampa FL', lat: 28.500, lon: -84.517, type: 'buoy', owner: 'NDBC' },
  { id: '42012', name: 'Orange Beach AL', lat: 30.065, lon: -87.555, type: 'buoy', owner: 'NDBC' },
  { id: '42035', name: 'Galveston TX', lat: 29.232, lon: -94.413, type: 'buoy', owner: 'NDBC' },

  // Pacific Northwest
  { id: '46005', name: 'Washington - 300 NM West', lat: 46.100, lon: -131.001, type: 'buoy', owner: 'NDBC' },
  { id: '46029', name: 'Columbia River Bar', lat: 46.144, lon: -124.514, type: 'buoy', owner: 'NDBC' },
  { id: '46050', name: 'Stonewall Bank OR', lat: 44.641, lon: -124.526, type: 'buoy', owner: 'NDBC' },

  // California
  { id: '46026', name: 'San Francisco 18 NM West', lat: 37.759, lon: -122.833, type: 'buoy', owner: 'NDBC' },
  { id: '46011', name: 'Santa Maria CA', lat: 34.868, lon: -120.857, type: 'buoy', owner: 'NDBC' },
  { id: '46025', name: 'Santa Monica Basin', lat: 33.749, lon: -119.053, type: 'buoy', owner: 'NDBC' },
  { id: '46047', name: 'Tanner Bank CA', lat: 32.433, lon: -119.533, type: 'buoy', owner: 'NDBC' },

  // Hawaii
  { id: '51001', name: 'NW Hawaii 170 NM West', lat: 23.445, lon: -162.279, type: 'buoy', owner: 'NDBC' },
  { id: '51002', name: 'SW Hawaii 215 NM SW', lat: 17.094, lon: -157.808, type: 'buoy', owner: 'NDBC' },
  { id: '51003', name: 'SE Hawaii 210 NM SE', lat: 19.087, lon: -160.662, type: 'buoy', owner: 'NDBC' },

  // Alaska
  { id: '46001', name: 'Gulf of Alaska 175 NM SW', lat: 56.300, lon: -148.021, type: 'buoy', owner: 'NDBC' },
  { id: '46060', name: 'West Orca Bay AK', lat: 60.584, lon: -146.806, type: 'buoy', owner: 'NDBC' },
  { id: '46080', name: 'Cape Cleare AK', lat: 59.502, lon: -147.000, type: 'buoy', owner: 'NDBC' },

  // Great Lakes
  { id: '45007', name: 'Lake Michigan South', lat: 42.674, lon: -87.026, type: 'buoy', owner: 'NDBC' },
  { id: '45012', name: 'Lake Ontario', lat: 43.623, lon: -77.400, type: 'buoy', owner: 'NDBC' },
  { id: '45003', name: 'Lake Huron North', lat: 45.351, lon: -82.841, type: 'buoy', owner: 'NDBC' },
];

export class NDBCBuoyService {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private cache: CacheManager;
  private stationCache = new Map<string, BuoyStation>();
  private buoyDataBreaker: CircuitBreaker;

  // NDBC data endpoints
  private readonly NDBC_REALTIME_BASE = 'https://www.ndbc.noaa.gov/data/realtime2';
  private readonly NDBC_SPEC_DATA = 'https://www.ndbc.noaa.gov/data/latest_obs';

  // Wave hazard thresholds (in meters)
  private readonly WAVE_THRESHOLDS = {
    safe: 1.2,        // < 4 feet - generally safe
    moderate: 1.8,    // 4-6 feet - small craft advisory possible
    elevated: 3.0,    // 6-10 feet - caution advised
    dangerous: 3.0    // > 10 feet - avoid
  };

  constructor(cache: CacheManager, logger?: Logger) {
    this.cache = cache;
    this.logger = logger || pino({
      level: process.env.LOG_LEVEL || 'info'
    });

    // Create axios instance for NDBC API
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Accept': 'text/plain, application/json',
        'User-Agent': 'Helmwise-PassagePlanner/1.0 (Maritime Safety Application)'
      }
    });

    // Configure retry logic for unreliable endpoints
    axiosRetry(this.httpClient, {
      retries: 3,
      retryDelay: (retryCount) => retryCount * 1000,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response?.status || 0) >= 500;
      },
      onRetry: (retryCount, error) => {
        this.logger.warn(`NDBC API retry attempt ${retryCount} for ${error.config?.url}`);
      }
    });

    // Initialize circuit breaker for NDBC API calls
    this.buoyDataBreaker = CircuitBreakerFactory.create(
      'ndbc-buoy-data',
      this.fetchBuoyData.bind(this),
      {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 60000
      }
    );

    // Initialize station cache
    for (const station of NDBC_STATIONS) {
      this.stationCache.set(station.id, station);
    }

    this.logger.info('NDBC Buoy Service initialized - Wave data service ready');
  }

  /**
   * Find nearest buoy stations to a location
   */
  async findNearestStations(
    lat: number,
    lon: number,
    radiusNM: number = 100,
    maxStations: number = 3
  ): Promise<BuoyStation[]> {
    const cacheKey = `ndbc:stations:${lat.toFixed(2)}:${lon.toFixed(2)}:${radiusNM}`;

    // Check cache first (1 hour TTL)
    const cachedData = await this.cache.get<BuoyStation[]>(cacheKey);
    if (cachedData) {
      this.logger.debug({ lat, lon, count: cachedData.length }, 'Returning cached buoy stations');
      return cachedData;
    }

    const stations = Array.from(this.stationCache.values());

    // Calculate distances and filter by radius
    const stationsWithDistance = stations
      .map(station => ({
        station,
        distance: this.calculateDistanceNM(lat, lon, station.lat, station.lon)
      }))
      .filter(s => s.distance <= radiusNM)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxStations)
      .map(s => s.station);

    // Cache the results (1 hour - stations don't move)
    await this.cache.setWithTTL(cacheKey, stationsWithDistance, 3600);

    this.logger.debug({
      lat,
      lon,
      found: stationsWithDistance.length,
      stations: stationsWithDistance.map(s => s.id)
    }, 'Found nearby buoy stations');

    return stationsWithDistance;
  }

  /**
   * Get wave data for a specific buoy station
   */
  async getBuoyData(stationId: string): Promise<BuoyData | null> {
    const cacheKey = `ndbc:buoy:${stationId}`;

    // Check cache first (30 minute TTL for real-time data)
    const cachedData = await this.cache.getWithMetadata<BuoyData>(cacheKey);
    if (cachedData && cachedData.value && cachedData.age < 1800) {
      this.logger.debug({ stationId, age: cachedData.age }, 'Returning cached buoy data');
      return cachedData.value;
    }

    try {
      // Fetch with circuit breaker protection
      const buoyData = await this.buoyDataBreaker
        .fire(stationId)
        .then((result: any) => result as BuoyData)
        .catch(async (error) => {
          this.logger.warn({ error: error.message, stationId }, 'Circuit breaker open for buoy data');
          // Return stale cache if available
          if (cachedData?.value) {
            this.logger.info({ stationId }, 'Using stale cached buoy data');
            return { ...cachedData.value, quality: 'stale' as const };
          }
          return null;
        });

      return buoyData;
    } catch (error) {
      this.logger.error({ error, stationId }, 'Failed to get buoy data');
      return null;
    }
  }

  /**
   * Internal method to fetch buoy data from NDBC
   */
  private async fetchBuoyData(stationId: string): Promise<BuoyData | null> {
    const station = this.stationCache.get(stationId);
    if (!station) {
      this.logger.warn({ stationId }, 'Unknown buoy station');
      return null;
    }

    try {
      // Fetch real-time standard meteorological data
      const url = `${this.NDBC_REALTIME_BASE}/${stationId}.txt`;
      const response = await this.httpClient.get(url);

      const observations = this.parseNDBCData(response.data, stationId);

      if (observations.length === 0) {
        return {
          station,
          observations: [],
          currentConditions: null,
          hazardLevel: { level: 'safe', description: 'No data available' },
          dataAge: -1,
          quality: 'unavailable'
        };
      }

      const currentConditions = observations[0];
      const dataAge = Math.round((Date.now() - currentConditions.timestamp.getTime()) / 60000);

      const buoyData: BuoyData = {
        station,
        observations,
        currentConditions,
        hazardLevel: this.assessWaveHazard(currentConditions),
        dataAge,
        quality: dataAge <= 60 ? 'good' : dataAge <= 180 ? 'stale' : 'unavailable'
      };

      // Cache the result (30 minutes)
      await this.cache.setWithTTL(`ndbc:buoy:${stationId}`, buoyData, 1800);

      this.logger.debug({
        stationId,
        waveHeight: currentConditions.significantWaveHeight,
        dataAge
      }, 'Fetched buoy data');

      return buoyData;
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.debug({ stationId }, 'Buoy data not available (station may be offline)');
      } else {
        this.logger.error({ error: error.message, stationId }, 'Failed to fetch buoy data');
      }
      return null;
    }
  }

  /**
   * Parse NDBC text data format
   * Format: https://www.ndbc.noaa.gov/data/realtime2/
   * Each line after headers: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE
   */
  private parseNDBCData(data: string, stationId: string): WaveObservation[] {
    const lines = data.split('\n').filter(line => line.trim());

    if (lines.length < 3) return [];

    // First two lines are headers
    const observations: WaveObservation[] = [];

    for (let i = 2; i < Math.min(lines.length, 50); i++) { // Get up to 48 hours of data
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 14) continue;

      try {
        // Parse timestamp: YY MM DD hh mm
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const hour = parseInt(parts[3], 10);
        const minute = parseInt(parts[4], 10);

        // Handle 2-digit year
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        const timestamp = new Date(Date.UTC(fullYear, month, day, hour, minute));

        // Parse values - MM means missing data
        const observation: WaveObservation = {
          timestamp,
          stationId,
          windDirection: this.parseNDBCValue(parts[5]),
          windSpeed: this.parseNDBCValue(parts[6]),
          windGusts: this.parseNDBCValue(parts[7]),
          significantWaveHeight: this.parseNDBCValue(parts[8]),
          dominantWavePeriod: this.parseNDBCValue(parts[9]),
          meanWaveDirection: parts.length > 11 ? this.parseNDBCValue(parts[11]) : null,
          pressure: parts.length > 12 ? this.parseNDBCValue(parts[12]) : null,
          airTemperature: parts.length > 13 ? this.parseNDBCValue(parts[13]) : null,
          waterTemperature: parts.length > 14 ? this.parseNDBCValue(parts[14]) : null,
          visibility: parts.length > 16 ? this.parseNDBCValue(parts[16]) : null,
        };

        observations.push(observation);
      } catch (e) {
        // Skip malformed lines
        continue;
      }
    }

    return observations;
  }

  /**
   * Parse NDBC value (handles 'MM' for missing data)
   */
  private parseNDBCValue(value: string): number | null {
    if (value === 'MM' || value === 'N/A' || value === '999' || value === '9999.0') {
      return null;
    }
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Assess wave hazard level based on significant wave height
   * Thresholds based on Coast Guard small craft advisories
   */
  private assessWaveHazard(observation: WaveObservation): WaveHazardLevel {
    const waveHeight = observation.significantWaveHeight;

    if (waveHeight === null) {
      return {
        level: 'safe',
        description: 'Wave data unavailable - check local conditions'
      };
    }

    // Convert meters to feet for user-friendly advisory
    const waveHeightFt = waveHeight * 3.28084;

    if (waveHeight > this.WAVE_THRESHOLDS.dangerous) {
      return {
        level: 'dangerous',
        description: `Dangerous seas: ${waveHeightFt.toFixed(1)} ft waves`,
        advisory: 'HAZARDOUS CONDITIONS - All vessels should seek safe harbor. Seas exceeding 10 feet.'
      };
    }

    if (waveHeight > this.WAVE_THRESHOLDS.elevated) {
      return {
        level: 'elevated',
        description: `Elevated seas: ${waveHeightFt.toFixed(1)} ft waves`,
        advisory: 'CAUTION ADVISED - Rough conditions. Experience and seaworthy vessel required.'
      };
    }

    if (waveHeight > this.WAVE_THRESHOLDS.moderate) {
      return {
        level: 'moderate',
        description: `Moderate seas: ${waveHeightFt.toFixed(1)} ft waves`,
        advisory: 'Small Craft Advisory may be in effect. Check Coast Guard broadcasts.'
      };
    }

    return {
      level: 'safe',
      description: `Calm to light seas: ${waveHeightFt.toFixed(1)} ft waves`
    };
  }

  /**
   * Get wave data for a passage route
   * Returns combined wave data from all nearby buoys along the route
   */
  async getWaveDataForRoute(
    waypoints: Array<{ lat: number; lon: number }>,
    radiusNM: number = 50
  ): Promise<{
    buoys: BuoyData[];
    worstConditions: WaveObservation | null;
    overallHazard: WaveHazardLevel;
    coverage: 'good' | 'partial' | 'none';
  }> {
    const allBuoys = new Map<string, BuoyData>();

    // Find buoys near each waypoint
    for (const waypoint of waypoints) {
      const nearbyStations = await this.findNearestStations(waypoint.lat, waypoint.lon, radiusNM, 2);

      for (const station of nearbyStations) {
        if (!allBuoys.has(station.id)) {
          const buoyData = await this.getBuoyData(station.id);
          if (buoyData) {
            allBuoys.set(station.id, buoyData);
          }
        }
      }
    }

    const buoys = Array.from(allBuoys.values());

    if (buoys.length === 0) {
      return {
        buoys: [],
        worstConditions: null,
        overallHazard: { level: 'safe', description: 'No buoy data available for route area' },
        coverage: 'none'
      };
    }

    // Find worst conditions across all buoys
    let worstConditions: WaveObservation | null = null;
    let maxWaveHeight = -1;

    for (const buoy of buoys) {
      const conditions = buoy.currentConditions;
      if (conditions && conditions.significantWaveHeight !== null) {
        const height = conditions.significantWaveHeight;
        if (height > maxWaveHeight) {
          maxWaveHeight = height;
          worstConditions = conditions;
        }
      }
    }

    // Determine overall hazard based on worst conditions
    const overallHazard = worstConditions
      ? this.assessWaveHazard(worstConditions)
      : { level: 'safe' as const, description: 'Unable to determine conditions' };

    // Assess coverage
    const goodDataBuoys = buoys.filter(b => b.quality === 'good').length;
    const coverage = goodDataBuoys >= waypoints.length / 2 ? 'good'
                   : goodDataBuoys > 0 ? 'partial'
                   : 'none';

    return {
      buoys,
      worstConditions,
      overallHazard,
      coverage
    };
  }

  /**
   * Calculate distance between two points in nautical miles
   */
  private calculateDistanceNM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get all available stations (for debugging/monitoring)
   */
  getAvailableStations(): BuoyStation[] {
    return Array.from(this.stationCache.values());
  }

  /**
   * Health check for the NDBC service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    stationsKnown: number;
    circuitBreakerState: string;
  }> {
    const breakerState = this.buoyDataBreaker.opened ? 'open' :
                        this.buoyDataBreaker.halfOpen ? 'half-open' : 'closed';

    return {
      status: breakerState === 'closed' ? 'healthy' :
              breakerState === 'half-open' ? 'degraded' : 'unhealthy',
      stationsKnown: this.stationCache.size,
      circuitBreakerState: breakerState
    };
  }
}
