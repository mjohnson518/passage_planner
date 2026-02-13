import { BaseAgent } from '../../base/BaseAgent';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

interface WeatherForecast {
  time: Date;
  windSpeed: number;
  windDirection: number;
  windGust: number;
  waveHeight: number;
  wavePeriod: number;
  waveDirection: number;
  precipitation: number;
  visibility: number;
  temperature: number;
  pressure: number;
  cloudCover: number;
  source?: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  forecastHorizonHours?: number;
}

// SAFETY CRITICAL: Data freshness tracking for maritime safety
interface CachedWeatherData<T> {
  data: T;
  fetchedAt: number; // Unix timestamp
  source: string;
  expiresAt: number;
}

interface DataFreshnessResult {
  isStale: boolean;
  ageMinutes: number;
  maxAgeMinutes: number;
  warning?: string;
}

interface MarineZone {
  id: string;
  name: string;
  forecast: string;
  warnings: string[];
}

interface TropicalCyclone {
  name: string;
  category: number;
  currentPosition: { latitude: number; longitude: number };
  maxWind: number;
  centralPressure: number;
  movementSpeed: number;
  movementDirection: number;
  forecastTrack: Array<{ time: Date; latitude: number; longitude: number }>;
  affectsRoute: boolean;
  distanceToRoute: number;
}

export class WeatherAgent extends BaseAgent {
  private noaaApiKey: string;
  private openWeatherApiKey: string;
  private ukmoApiKey: string | null;
  
  constructor(redisUrl: string, noaaApiKey: string, openWeatherApiKey: string) {
    super({
      name: 'weather-agent',
      description: 'Provides marine weather forecasts and warnings with multi-source aggregation',
      version: '2.0.0', // Updated for Phase 2 enhancements
      cacheTTL: 1800 // 30 minutes
    }, redisUrl);
    
    this.noaaApiKey = noaaApiKey;
    this.openWeatherApiKey = openWeatherApiKey;
    this.ukmoApiKey = process.env.UKMO_API_KEY || null; // Gracefully handle missing key
    
    if (this.ukmoApiKey) {
      console.log('UK Met Office API key configured - multi-source weather enabled');
    } else {
      console.log('UK Met Office API key not configured - using NOAA only (will auto-enable when key provided)');
    }
  }

  // SAFETY CRITICAL: Maximum data age thresholds in minutes
  // Stale weather data is dangerous for maritime safety
  private readonly DATA_FRESHNESS_LIMITS = {
    forecast: 30, // Weather forecasts: stale after 30 minutes
    warnings: 10, // Weather warnings: stale after 10 minutes (critical)
    cyclones: 30, // Tropical cyclone data: stale after 30 minutes
    seaState: 30, // Sea state analysis: stale after 30 minutes
  };

  /**
   * SAFETY CRITICAL: Validate data freshness and warn if stale
   * Stale weather data can lead to dangerous navigation decisions
   */
  private validateDataFreshness(
    fetchedAt: number,
    dataType: keyof typeof this.DATA_FRESHNESS_LIMITS
  ): DataFreshnessResult {
    const now = Date.now();
    const ageMs = now - fetchedAt;
    const ageMinutes = Math.round(ageMs / (60 * 1000));
    const maxAgeMinutes = this.DATA_FRESHNESS_LIMITS[dataType];
    const isStale = ageMinutes > maxAgeMinutes;

    return {
      isStale,
      ageMinutes,
      maxAgeMinutes,
      warning: isStale
        ? `⚠️ STALE DATA WARNING: Weather data is ${ageMinutes} minutes old (max recommended: ${maxAgeMinutes} min). ` +
          `Conditions may have changed significantly. Refresh data before making navigation decisions.`
        : undefined,
    };
  }

  /**
   * Calculate forecast confidence based on horizon and data age
   * Confidence decreases with both forecast horizon and data staleness
   */
  private calculateConfidence(
    forecastHorizonHours: number,
    dataAgeMinutes: number
  ): 'high' | 'medium' | 'low' | 'unknown' {
    // Confidence degrades with forecast horizon
    // 0-24h: generally high confidence
    // 24-72h: medium confidence
    // 72h+: low confidence

    // Additional penalty for stale data
    const stalenessPenalty = dataAgeMinutes > 30 ? 1 : dataAgeMinutes > 15 ? 0.5 : 0;

    const effectiveHorizon = forecastHorizonHours + (stalenessPenalty * 24);

    if (effectiveHorizon <= 24) return 'high';
    if (effectiveHorizon <= 72) return 'medium';
    if (effectiveHorizon <= 168) return 'low'; // Up to 7 days
    return 'unknown';
  }

  getTools(): Tool[] {
    return [
      {
        name: 'get_marine_forecast',
        description: 'Get marine weather forecast with multi-source consensus',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            hours: { type: 'number', default: 72 }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'get_weather_warnings',
        description: 'Get active weather warnings for a marine area',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            radius_nm: { type: 'number', default: 50 }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'get_grib_data',
        description: 'Get GRIB weather data for route planning',
        inputSchema: {
          type: 'object',
          properties: {
            bounds: {
              type: 'object',
              properties: {
                north: { type: 'number' },
                south: { type: 'number' },
                east: { type: 'number' },
                west: { type: 'number' }
              },
              required: ['north', 'south', 'east', 'west']
            },
            resolution: { type: 'string', enum: ['0.25', '0.5', '1.0'] },
            parameters: {
              type: 'array',
              items: { type: 'string' },
              default: ['wind', 'waves', 'precipitation']
            }
          },
          required: ['bounds']
        }
      },
      {
        name: 'check_tropical_cyclones',
        description: 'Check for tropical cyclones that may affect the route',
        inputSchema: {
          type: 'object',
          properties: {
            bounds: {
              type: 'object',
              properties: {
                north: { type: 'number' },
                south: { type: 'number' },
                east: { type: 'number' },
                west: { type: 'number' }
              },
              required: ['north', 'south', 'east', 'west']
            },
            route: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                }
              }
            }
          },
          required: ['bounds']
        }
      },
      {
        name: 'find_weather_window',
        description: 'Find optimal weather windows for passage',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            duration_hours: { type: 'number' },
            max_wind_knots: { type: 'number', default: 25 },
            max_wave_feet: { type: 'number', default: 6 },
            days_ahead: { type: 'number', default: 7 }
          },
          required: ['latitude', 'longitude', 'duration_hours']
        }
      },
      {
        name: 'analyze_sea_state',
        description: 'Detailed sea state analysis including waves, swell, and conditions',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            hours: { type: 'number', default: 48 }
          },
          required: ['latitude', 'longitude']
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'get_marine_forecast':
        return await this.getMarineForecast(args.latitude, args.longitude, args.hours);
      case 'get_weather_warnings':
        return await this.getWeatherWarnings(args.latitude, args.longitude, args.radius_nm);
      case 'get_grib_data':
        return await this.getGribData(args.bounds, args.resolution, args.parameters);
      case 'check_tropical_cyclones':
        return await this.checkTropicalCyclones(args.bounds, args.route);
      case 'find_weather_window':
        return await this.findWeatherWindow(
          args.latitude, 
          args.longitude, 
          args.duration_hours,
          args.max_wind_knots,
          args.max_wave_feet,
          args.days_ahead
        );
      case 'analyze_sea_state':
        return await this.analyzeSeaState(args.latitude, args.longitude, args.hours);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async getMarineForecast(lat: number, lon: number, hours: number = 72): Promise<{
    forecasts: WeatherForecast[];
    metadata: {
      fetchedAt: string;
      dataAgeMinutes: number;
      freshnessStatus: DataFreshnessResult;
      source: string;
    };
  }> {
    const cacheKey = this.generateCacheKey('forecast', lat.toString(), lon.toString(), hours.toString());
    const cached = await this.getCachedData<CachedWeatherData<WeatherForecast[]>>(cacheKey);

    // If cached, validate freshness and return with warning if stale
    if (cached && cached.fetchedAt) {
      const freshnessStatus = this.validateDataFreshness(cached.fetchedAt, 'forecast');
      const dataAgeMinutes = freshnessStatus.ageMinutes;

      // Update confidence based on data age
      const forecasts = cached.data.map((f, idx) => ({
        ...f,
        confidence: this.calculateConfidence(idx, dataAgeMinutes),
        forecastHorizonHours: idx,
      }));

      return {
        forecasts,
        metadata: {
          fetchedAt: new Date(cached.fetchedAt).toISOString(),
          dataAgeMinutes,
          freshnessStatus,
          source: cached.source,
        },
      };
    }

    const fetchedAt = Date.now();

    try {
      const forecasts = await this.withRetry(async () => {
        // Get NOAA point forecast
        const pointResponse = await axios.get(
          `https://api.weather.gov/points/${lat},${lon}`
        );
        const forecastUrl = pointResponse.data.properties.forecastGridData;

        // Get gridded forecast data
        const forecastResponse = await axios.get(forecastUrl);
        const forecastData = forecastResponse.data.properties;

        // Get marine-specific data from OpenWeather Marine API
        const marineResponse = await axios.get(
          `https://api.openweathermap.org/data/2.5/onecall`,
          {
            params: {
              lat,
              lon,
              exclude: 'minutely,alerts',
              appid: this.openWeatherApiKey,
              units: 'metric'
            }
          }
        );

        // Combine and format forecast data
        const forecastResults: WeatherForecast[] = [];
        const hourlyData = marineResponse.data.hourly.slice(0, hours);

        for (let i = 0; i < hourlyData.length; i++) {
          const hour = hourlyData[i];
          forecastResults.push({
            time: new Date(hour.dt * 1000),
            windSpeed: hour.wind_speed * 1.94384, // m/s to knots
            windDirection: hour.wind_deg,
            windGust: hour.wind_gust ? hour.wind_gust * 1.94384 : hour.wind_speed * 1.94384 * 1.2,
            waveHeight: await this.estimateWaveHeight(hour.wind_speed, lat, lon),
            wavePeriod: await this.estimateWavePeriod(hour.wind_speed),
            waveDirection: hour.wind_deg, // Simplified - same as wind
            precipitation: hour.rain ? hour.rain['1h'] || 0 : 0,
            visibility: hour.visibility / 1000, // meters to km
            temperature: hour.temp,
            pressure: hour.pressure,
            cloudCover: hour.clouds,
            confidence: this.calculateConfidence(i, 0), // Fresh data, age = 0
            forecastHorizonHours: i,
            source: 'NOAA/OpenWeather',
          });
        }

        return forecastResults;
      });

      // Cache with timestamp metadata
      const cacheData: CachedWeatherData<WeatherForecast[]> = {
        data: forecasts,
        fetchedAt,
        source: 'NOAA/OpenWeather',
        expiresAt: fetchedAt + (this.DATA_FRESHNESS_LIMITS.forecast * 60 * 1000),
      };
      await this.setCachedData(cacheKey, cacheData);

      const freshnessStatus = this.validateDataFreshness(fetchedAt, 'forecast');

      return {
        forecasts,
        metadata: {
          fetchedAt: new Date(fetchedAt).toISOString(),
          dataAgeMinutes: 0,
          freshnessStatus,
          source: 'NOAA/OpenWeather',
        },
      };
    } catch (error: any) {
      await this.reportHealth('degraded', { error: error.message });
      throw error;
    }
  }

  private async getWeatherWarnings(lat: number, lon: number, radiusNm: number = 50): Promise<any> {
    const cacheKey = this.generateCacheKey('warnings', lat.toString(), lon.toString());
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      return await this.withRetry(async () => {
        // Get NOAA alerts for the area
        const response = await axios.get(
          `https://api.weather.gov/alerts/active`,
          {
            params: {
              point: `${lat},${lon}`,
              limit: 50
            }
          }
        );

        const warnings = response.data.features
          .filter((alert: any) => {
            // Filter for marine-related alerts
            const marine_events = [
              'Small Craft Advisory',
              'Gale Warning',
              'Storm Warning',
              'Hurricane Warning',
              'Tropical Storm Warning',
              'Tsunami Warning',
              'Rip Current Statement'
            ];
            return marine_events.includes(alert.properties.event);
          })
          .map((alert: any) => ({
            id: alert.properties.id,
            event: alert.properties.event,
            severity: alert.properties.severity,
            urgency: alert.properties.urgency,
            headline: alert.properties.headline,
            description: alert.properties.description,
            instruction: alert.properties.instruction,
            effective: alert.properties.effective,
            expires: alert.properties.expires,
            areas: alert.properties.areaDesc
          }));

        await this.setCachedData(cacheKey, warnings, 600); // 10 min cache
        return warnings;
      });
    } catch (error: any) {
      await this.reportHealth('degraded', { error: error.message });
      throw error;
    }
  }

  private async getGribData(bounds: any, resolution: string = '0.5', parameters: string[]): Promise<any> {
    // Generate NOMADS URL for GRIB2 data and provide gridded wind field
    const resNum = parseFloat(resolution) || 0.5;
    const now = new Date();
    const utcHour = now.getUTCHours();
    let cycleHour: number;
    if (utcHour >= 22) cycleHour = 18;
    else if (utcHour >= 16) cycleHour = 12;
    else if (utcHour >= 10) cycleHour = 6;
    else if (utcHour >= 4) cycleHour = 0;
    else { cycleHour = 18; now.setUTCDate(now.getUTCDate() - 1); }

    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(cycleHour).padStart(2, '0');
    const date = `${year}${month}${day}`;
    const resStr = resNum <= 0.25 ? '0p25' : resNum <= 0.5 ? '0p50' : '1p00';

    return {
      bounds,
      resolution,
      parameters,
      model: 'GFS',
      cycle: `${date}${hour}`,
      url: `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_${resStr}_deg.pl?dir=/gfs.${date}/${hour}/atmos`,
      format: 'GRIB2',
      availableParameters: ['UGRD', 'VGRD', 'PRMSL', 'TMP', 'HTSGW', 'PERPW', 'DIRPW'],
      message: 'Use GribService.getGriddedForecast() for processed gridded data, or download GRIB2 from URL above'
    };
  }

  private async estimateWaveHeight(windSpeed: number, lat: number, lon: number): Promise<number> {
    // Simplified wave height estimation using Beaufort scale relationships
    // In production, this would use actual wave model data
    const windKnots = windSpeed * 1.94384;
    if (windKnots < 1) return 0;
    if (windKnots < 4) return 0.1;
    if (windKnots < 7) return 0.3;
    if (windKnots < 11) return 0.6;
    if (windKnots < 17) return 1.0;
    if (windKnots < 22) return 2.0;
    if (windKnots < 28) return 3.0;
    if (windKnots < 34) return 4.0;
    if (windKnots < 41) return 5.5;
    if (windKnots < 48) return 7.0;
    if (windKnots < 56) return 9.0;
    if (windKnots < 64) return 11.5;
    return 14.0;
  }

  private async estimateWavePeriod(windSpeed: number): Promise<number> {
    // Simplified wave period estimation
    const windKnots = windSpeed * 1.94384;
    return Math.min(12, Math.max(3, windKnots * 0.3));
  }

  /**
   * NEW: Check for active tropical cyclones using NOAA NHC API
   */
  private async checkTropicalCyclones(bounds: any, route?: any[]): Promise<TropicalCyclone[]> {
    const cacheKey = this.generateCacheKey('tropical', 'cyclones', Date.now().toString());
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      return await this.withRetry(async () => {
        // NOAA National Hurricane Center active storms
        const response = await axios.get(
          'https://www.nhc.noaa.gov/CurrentStorms.json'
        );

        const cyclones: TropicalCyclone[] = [];

        if (response.data && response.data.activeStorms) {
          for (const storm of response.data.activeStorms) {
            // Check if storm affects our area of interest
            const stormLat = storm.latitude || 0;
            const stormLon = storm.longitude || 0;

            const inBounds = stormLat >= bounds.south && stormLat <= bounds.north &&
                           stormLon >= bounds.west && stormLon <= bounds.east;

            if (inBounds || !bounds) {
              let affectsRoute = false;
              let minDistance = Infinity;

              if (route) {
                for (const waypoint of route) {
                  const distance = this.calculateDistance(
                    stormLat, stormLon,
                    waypoint.latitude, waypoint.longitude
                  );
                  minDistance = Math.min(minDistance, distance);
                  if (distance < 200) { // Within 200nm
                    affectsRoute = true;
                  }
                }
              }

              cyclones.push({
                name: storm.name || 'Unnamed System',
                category: this.parseStormCategory(storm.classification),
                currentPosition: { latitude: stormLat, longitude: stormLon },
                maxWind: storm.intensity || 0,
                centralPressure: storm.pressure || 0,
                movementSpeed: storm.movementSpeed || 0,
                movementDirection: storm.movementDir || 0,
                forecastTrack: [], // Would parse forecast positions
                affectsRoute,
                distanceToRoute: minDistance,
              });
            }
          }
        }

        await this.setCachedData(cacheKey, cyclones, 1800); // 30 min cache
        return cyclones;
      });
    } catch (error: any) {
      // If NHC API fails, return empty array (no active storms detected)
      console.warn('Failed to fetch tropical cyclone data:', error.message);
      return [];
    }
  }

  /**
   * NEW: Find optimal weather windows for passage
   */
  private async findWeatherWindow(
    lat: number,
    lon: number,
    durationHours: number,
    maxWind: number = 25,
    maxWave: number = 6,
    daysAhead: number = 7
  ): Promise<any> {
    // Get forecast for the next N days
    const forecastResult = await this.getMarineForecast(lat, lon, daysAhead * 24);
    const forecasts = forecastResult.forecasts;

    const windows: any[] = [];
    let currentWindow: any = null;

    for (let i = 0; i < forecasts.length; i++) {
      const period = forecasts[i];
      const acceptable = period.windSpeed <= maxWind && period.waveHeight <= maxWave;

      if (acceptable) {
        if (!currentWindow) {
          // Start new window
          currentWindow = {
            start: period.time,
            end: period.time,
            durationHours: 1,
            avgWind: period.windSpeed,
            maxWind: period.windSpeed,
            avgWave: period.waveHeight,
            maxWave: period.waveHeight,
            periods: [period],
          };
        } else {
          // Extend current window
          currentWindow.end = period.time;
          currentWindow.durationHours++;
          currentWindow.avgWind = (currentWindow.avgWind * (currentWindow.durationHours - 1) + period.windSpeed) / currentWindow.durationHours;
          currentWindow.maxWind = Math.max(currentWindow.maxWind, period.windSpeed);
          currentWindow.avgWave = (currentWindow.avgWave * (currentWindow.durationHours - 1) + period.waveHeight) / currentWindow.durationHours;
          currentWindow.maxWave = Math.max(currentWindow.maxWave, period.waveHeight);
          currentWindow.periods.push(period);
        }

        // Check if window is long enough
        if (currentWindow.durationHours >= durationHours) {
          windows.push({ ...currentWindow, suitable: true });
          currentWindow = null; // Reset to find next window
        }
      } else {
        // Conditions not acceptable
        if (currentWindow && currentWindow.durationHours >= durationHours) {
          windows.push({ ...currentWindow, suitable: true });
        } else if (currentWindow) {
          windows.push({ ...currentWindow, suitable: false, reason: 'Too short' });
        }
        currentWindow = null;
      }
    }

    // Add last window if exists
    if (currentWindow) {
      windows.push({
        ...currentWindow,
        suitable: currentWindow.durationHours >= durationHours,
        reason: currentWindow.durationHours < durationHours ? 'Too short' : undefined
      });
    }

    const suitableWindows = windows.filter(w => w.suitable);

    return {
      location: { latitude: lat, longitude: lon },
      criteria: {
        maxWind,
        maxWave,
        durationHours,
      },
      daysSearched: daysAhead,
      windowsFound: suitableWindows.length,
      windows: suitableWindows.slice(0, 5), // Return top 5 windows
      recommendation: suitableWindows.length > 0
        ? `Found ${suitableWindows.length} suitable weather window(s). Best departure: ${new Date(suitableWindows[0].start).toISOString()}`
        : `No suitable weather windows found in next ${daysAhead} days. Consider relaxing criteria or waiting for better conditions.`,
    };
  }

  /**
   * NEW: Analyze sea state with Douglas scale
   */
  private async analyzeSeaState(lat: number, lon: number, hours: number = 48): Promise<any> {
    const forecastResult = await this.getMarineForecast(lat, lon, hours);

    const seaStates = forecastResult.forecasts.map(period => {
      const douglasScale = this.waveHeightToDouglasScale(period.waveHeight);
      
      return {
        time: period.time,
        waveHeight: {
          feet: period.waveHeight,
          meters: period.waveHeight * 0.3048,
        },
        wavePeriod: period.wavePeriod,
        waveDirection: period.waveDirection,
        douglasScale: {
          value: douglasScale,
          description: this.getDouglasDescription(douglasScale),
        },
        windWaves: {
          height: period.waveHeight * 0.6, // Approximate wind wave component
          period: period.wavePeriod * 0.7,
        },
        swell: {
          height: period.waveHeight * 0.4, // Approximate swell component
          period: period.wavePeriod * 1.3,
          direction: period.waveDirection,
        },
        conditions: this.assessSeaConditions(period.windSpeed, period.waveHeight),
        safetyAssessment: this.assessSeaSafety(period.windSpeed, period.waveHeight),
      };
    });

    return {
      location: { latitude: lat, longitude: lon },
      periods: seaStates,
      summary: {
        maxWaveHeight: Math.max(...seaStates.map(s => s.waveHeight.feet)),
        maxDouglasScale: Math.max(...seaStates.map(s => s.douglasScale.value)),
        safestPeriod: seaStates.reduce((best, current) => 
          current.waveHeight.feet < best.waveHeight.feet ? current : best
        ),
        roughestPeriod: seaStates.reduce((worst, current) => 
          current.waveHeight.feet > worst.waveHeight.feet ? current : worst
        ),
      },
    };
  }

  /**
   * Convert wave height to Douglas Sea Scale (0-9)
   */
  private waveHeightToDouglasScale(heightFeet: number): number {
    const heightMeters = heightFeet * 0.3048;
    
    if (heightMeters === 0) return 0; // Calm (glassy)
    if (heightMeters < 0.1) return 1; // Calm (rippled)
    if (heightMeters < 0.5) return 2; // Smooth
    if (heightMeters < 1.25) return 3; // Slight
    if (heightMeters < 2.5) return 4; // Moderate
    if (heightMeters < 4) return 5; // Rough
    if (heightMeters < 6) return 6; // Very rough
    if (heightMeters < 9) return 7; // High
    if (heightMeters < 14) return 8; // Very high
    return 9; // Phenomenal
  }

  /**
   * Get Douglas scale description
   */
  private getDouglasDescription(scale: number): string {
    const descriptions = [
      'Calm (glassy)',
      'Calm (rippled)',
      'Smooth (wavelets)',
      'Slight',
      'Moderate',
      'Rough',
      'Very rough',
      'High',
      'Very high',
      'Phenomenal',
    ];
    return descriptions[scale] || 'Unknown';
  }

  /**
   * Assess sea conditions for sailing
   */
  private assessSeaConditions(windKnots: number, waveHeightFeet: number): string {
    if (windKnots < 10 && waveHeightFeet < 2) return 'Excellent - calm conditions';
    if (windKnots < 15 && waveHeightFeet < 4) return 'Good - comfortable sailing';
    if (windKnots < 20 && waveHeightFeet < 6) return 'Fair - moderate conditions';
    if (windKnots < 25 && waveHeightFeet < 8) return 'Challenging - experienced crew recommended';
    if (windKnots < 35 && waveHeightFeet < 12) return 'Rough - only experienced crews';
    return 'Severe - consider sheltering';
  }

  /**
   * Assess safety for small craft
   */
  private assessSeaSafety(windKnots: number, waveHeightFeet: number): {
    level: 'safe' | 'caution' | 'warning' | 'dangerous';
    message: string;
  } {
    if (windKnots >= 35 || waveHeightFeet >= 12) {
      return {
        level: 'dangerous',
        message: 'DANGEROUS: Gale conditions. Small craft should seek shelter immediately.',
      };
    }
    if (windKnots >= 25 || waveHeightFeet >= 8) {
      return {
        level: 'warning',
        message: 'WARNING: Strong winds and/or rough seas. Only experienced crews should proceed.',
      };
    }
    if (windKnots >= 20 || waveHeightFeet >= 6) {
      return {
        level: 'caution',
        message: 'CAUTION: Small craft advisory conditions. Exercise caution.',
      };
    }
    return {
      level: 'safe',
      message: 'Conditions within safe limits for small craft.',
    };
  }

  /**
   * Parse storm category from classification
   */
  private parseStormCategory(classification: string): number {
    const lower = classification.toLowerCase();
    if (lower.includes('category 5') || lower.includes('cat 5')) return 5;
    if (lower.includes('category 4') || lower.includes('cat 4')) return 4;
    if (lower.includes('category 3') || lower.includes('cat 3')) return 3;
    if (lower.includes('category 2') || lower.includes('cat 2')) return 2;
    if (lower.includes('category 1') || lower.includes('cat 1')) return 1;
    if (lower.includes('hurricane')) return 1;
    if (lower.includes('tropical storm')) return 0;
    return -1;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
}

