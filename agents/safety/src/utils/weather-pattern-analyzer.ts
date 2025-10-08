/**
 * Weather Pattern Analyzer
 * 
 * SAFETY CRITICAL: Detects severe weather patterns and recommends passage delays.
 * Analyzes forecast data to identify dangerous conditions for small vessels.
 */

import { SevereWeatherPattern, Waypoint, GeographicBounds } from '../../../../shared/src/types/safety';

export interface WeatherDataPoint {
  time: string;
  location: Waypoint;
  windSpeed: number; // knots
  windGust?: number; // knots
  waveHeight?: number; // feet
  pressure?: number; // millibars
  visibility?: number; // nautical miles
  precipitation?: number; // inches/hour
}

export interface WeatherThresholds {
  galeWindSpeed: number; // knots, default 34
  stormWindSpeed: number; // knots, default 48
  hurricaneWindSpeed: number; // knots, default 64
  smallCraftWindSpeed: number; // knots, default 20
  smallCraftWaveHeight: number; // feet, default 6
  dangerousWaveHeight: number; // feet, default 12
  lowVisibility: number; // nautical miles, default 1
  rapidPressureDrop: number; // millibars/3hours, default 6
}

export class WeatherPatternAnalyzer {
  private thresholds: WeatherThresholds;

  constructor(thresholds?: Partial<WeatherThresholds>) {
    this.thresholds = {
      galeWindSpeed: 34,
      stormWindSpeed: 48,
      hurricaneWindSpeed: 64,
      smallCraftWindSpeed: 20,
      smallCraftWaveHeight: 6,
      dangerousWaveHeight: 12,
      lowVisibility: 1,
      rapidPressureDrop: 6,
      ...thresholds,
    };
  }

  /**
   * Analyze weather data for severe patterns
   */
  analyzePattern(weatherData: WeatherDataPoint[]): SevereWeatherPattern | null {
    if (weatherData.length === 0) return null;

    // Check for tropical cyclone indicators
    const cyclonePattern = this.detectTropicalCyclone(weatherData);
    if (cyclonePattern) return cyclonePattern;

    // Check for gale series (sustained high winds)
    const galePattern = this.detectGaleSeries(weatherData);
    if (galePattern) return galePattern;

    // Check for rapid pressure drop (storm approach)
    const pressurePattern = this.detectRapidPressureDrop(weatherData);
    if (pressurePattern) return pressurePattern;

    // Check for cold front
    const frontPattern = this.detectColdFront(weatherData);
    if (frontPattern) return frontPattern;

    return null;
  }

  /**
   * Detect tropical cyclone indicators
   */
  private detectTropicalCyclone(data: WeatherDataPoint[]): SevereWeatherPattern | null {
    // Look for sustained winds above hurricane threshold
    const hurricaneForceWinds = data.filter(d => d.windSpeed >= this.thresholds.hurricaneWindSpeed);
    
    if (hurricaneForceWinds.length > 0) {
      const bounds = this.calculateBounds(data.map(d => d.location));
      
      return {
        type: 'tropical_cyclone',
        name: 'Detected Tropical System',
        currentPosition: hurricaneForceWinds[0].location,
        forecastTrack: hurricaneForceWinds.map(d => d.location),
        affectedArea: bounds,
        intensity: this.classifyTropicalIntensity(Math.max(...hurricaneForceWinds.map(d => d.windSpeed))),
        movementSpeed: this.estimateMovementSpeed(hurricaneForceWinds.map(d => d.location)),
        movementDirection: this.estimateMovementDirection(hurricaneForceWinds.map(d => d.location)),
        predictedImpact: {
          timing: hurricaneForceWinds[0].time,
          windSpeed: Math.max(...hurricaneForceWinds.map(d => d.windSpeed)),
          waveHeight: Math.max(...hurricaneForceWinds.map(d => d.waveHeight || 0)),
          recommendedAction: 'shelter_immediately',
        },
        dataSource: 'Weather Analysis',
        lastUpdated: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Detect gale series (sustained high winds)
   */
  private detectGaleSeries(data: WeatherDataPoint[]): SevereWeatherPattern | null {
    // Look for multiple consecutive points with gale force winds
    let galeCount = 0;
    const galePoints: WeatherDataPoint[] = [];

    for (const point of data) {
      if (point.windSpeed >= this.thresholds.galeWindSpeed) {
        galeCount++;
        galePoints.push(point);
      }
    }

    // If 3+ consecutive forecasts show gale conditions
    if (galeCount >= 3) {
      const bounds = this.calculateBounds(galePoints.map(d => d.location));
      const maxWind = Math.max(...galePoints.map(d => d.windSpeed));

      return {
        type: 'gale_series',
        affectedArea: bounds,
        intensity: `Gale force winds ${maxWind} knots`,
        movementSpeed: 15, // Default estimate
        movementDirection: 0,
        predictedImpact: {
          timing: galePoints[0].time,
          windSpeed: maxWind,
          waveHeight: Math.max(...galePoints.map(d => d.waveHeight || 0)),
          recommendedAction: galeCount > 6 ? 'shelter_immediately' : 'delay_departure',
        },
        dataSource: 'Weather Analysis',
        lastUpdated: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Detect rapid pressure drop (storm approach)
   */
  private detectRapidPressureDrop(data: WeatherDataPoint[]): SevereWeatherPattern | null {
    if (data.length < 2) return null;

    const pressureData = data.filter(d => d.pressure !== undefined);
    if (pressureData.length < 2) return null;

    // Check for rapid pressure drops over 3-hour periods
    for (let i = 0; i < pressureData.length - 1; i++) {
      const timeDiff = new Date(pressureData[i + 1].time).getTime() - new Date(pressureData[i].time).getTime();
      const hours = timeDiff / (1000 * 60 * 60);
      
      if (hours >= 2 && hours <= 4) {
        const pressureDrop = pressureData[i].pressure! - pressureData[i + 1].pressure!;
        const dropPer3Hours = (pressureDrop / hours) * 3;

        if (dropPer3Hours >= this.thresholds.rapidPressureDrop) {
          const bounds = this.calculateBounds([pressureData[i].location, pressureData[i + 1].location]);

          return {
            type: 'rapid_pressure_drop',
            affectedArea: bounds,
            intensity: `Pressure dropping ${dropPer3Hours.toFixed(1)} mb/3hr`,
            movementSpeed: 20,
            movementDirection: 0,
            predictedImpact: {
              timing: pressureData[i + 1].time,
              windSpeed: 40, // Estimate based on pressure drop
              waveHeight: 10,
              recommendedAction: 'delay_departure',
            },
            dataSource: 'Barometric Pressure Analysis',
            lastUpdated: new Date().toISOString(),
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect cold front passage
   */
  private detectColdFront(data: WeatherDataPoint[]): SevereWeatherPattern | null {
    // Look for wind shifts and pressure changes characteristic of fronts
    // This is a simplified detection - real implementation would be more sophisticated

    const strongWinds = data.filter(d => d.windSpeed > this.thresholds.smallCraftWindSpeed);
    if (strongWinds.length > 2) {
      const bounds = this.calculateBounds(strongWinds.map(d => d.location));

      return {
        type: 'cold_front',
        affectedArea: bounds,
        intensity: 'Cold front passage',
        movementSpeed: 25,
        movementDirection: 270, // Typically west to east
        predictedImpact: {
          timing: strongWinds[0].time,
          windSpeed: Math.max(...strongWinds.map(d => d.windSpeed)),
          waveHeight: 8,
          recommendedAction: 'monitor_closely',
        },
        dataSource: 'Weather Pattern Analysis',
        lastUpdated: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Classify tropical cyclone intensity
   */
  private classifyTropicalIntensity(maxWind: number): string {
    if (maxWind >= 137) return 'Category 5 Hurricane';
    if (maxWind >= 113) return 'Category 4 Hurricane';
    if (maxWind >= 96) return 'Category 3 Hurricane';
    if (maxWind >= 83) return 'Category 2 Hurricane';
    if (maxWind >= 64) return 'Category 1 Hurricane';
    if (maxWind >= 39) return 'Tropical Storm';
    if (maxWind >= 34) return 'Tropical Depression';
    return 'Developing System';
  }

  /**
   * Estimate movement speed from track
   */
  private estimateMovementSpeed(track: Waypoint[]): number {
    if (track.length < 2) return 0;

    // Simple average of movement between points
    const distances: number[] = [];
    for (let i = 0; i < track.length - 1; i++) {
      distances.push(this.haversineDistance(track[i], track[i + 1]));
    }

    return distances.reduce((a, b) => a + b, 0) / distances.length;
  }

  /**
   * Estimate movement direction from track
   */
  private estimateMovementDirection(track: Waypoint[]): number {
    if (track.length < 2) return 0;

    // Calculate bearing from first to last point
    const start = track[0];
    const end = track[track.length - 1];

    return this.calculateBearing(start, end);
  }

  /**
   * Calculate geographic bounds from waypoints
   */
  private calculateBounds(waypoints: Waypoint[]): GeographicBounds {
    if (waypoints.length === 0) {
      return { north: 0, south: 0, east: 0, west: 0 };
    }

    return {
      north: Math.max(...waypoints.map(w => w.latitude)),
      south: Math.min(...waypoints.map(w => w.latitude)),
      east: Math.max(...waypoints.map(w => w.longitude)),
      west: Math.min(...waypoints.map(w => w.longitude)),
    };
  }

  /**
   * Calculate bearing between two points
   */
  private calculateBearing(from: Waypoint, to: Waypoint): number {
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const lon1 = from.longitude * Math.PI / 180;
    const lon2 = to.longitude * Math.PI / 180;

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  /**
   * Calculate distance using Haversine formula
   */
  private haversineDistance(p1: Waypoint, p2: Waypoint): number {
    const R = 3440.1; // Nautical miles
    const lat1 = p1.latitude * Math.PI / 180;
    const lat2 = p2.latitude * Math.PI / 180;
    const deltaLat = (p2.latitude - p1.latitude) * Math.PI / 180;
    const deltaLon = (p2.longitude - p1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Check if weather window exists for safe passage
   */
  checkWeatherWindow(
    data: WeatherDataPoint[],
    durationHours: number,
    maxWind: number = 25,
    maxWave: number = 6
  ): { exists: boolean; start?: string; end?: string; confidence: string } {
    if (data.length === 0) {
      return { exists: false, confidence: 'none' };
    }

    // Find continuous periods meeting criteria
    let windowStart: string | undefined;
    let windowLength = 0;

    for (const point of data) {
      const acceptable = point.windSpeed <= maxWind && (point.waveHeight || 0) <= maxWave;

      if (acceptable) {
        if (!windowStart) {
          windowStart = point.time;
          windowLength = 1;
        } else {
          windowLength++;
        }

        // Check if window is long enough
        if (windowLength >= durationHours) {
          return {
            exists: true,
            start: windowStart,
            end: point.time,
            confidence: 'high',
          };
        }
      } else {
        // Window broken
        windowStart = undefined;
        windowLength = 0;
      }
    }

    // No adequate window found
    return {
      exists: false,
      confidence: windowLength > 0 ? 'partial' : 'none',
    };
  }

  /**
   * Recommend passage delay based on weather forecast
   */
  recommendDelay(
    weatherData: WeatherDataPoint[],
    plannedDuration: number
  ): {
    shouldDelay: boolean;
    reason: string;
    suggestedDelay: number; // hours
    alternativeDeparture?: string;
  } {
    const severePattern = this.analyzePattern(weatherData);

    if (severePattern) {
      const delayHours = this.calculateRequiredDelay(severePattern);

      return {
        shouldDelay: true,
        reason: `Severe weather detected: ${severePattern.intensity}. ${severePattern.predictedImpact.recommendedAction}`,
        suggestedDelay: delayHours,
        alternativeDeparture: new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString(),
      };
    }

    // Check if a good weather window exists
    const window = this.checkWeatherWindow(weatherData, plannedDuration);

    if (!window.exists) {
      return {
        shouldDelay: true,
        reason: `No adequate weather window found for ${plannedDuration}-hour passage. Winds exceed safe limits or waves too high.`,
        suggestedDelay: 24, // Check again in 24 hours
      };
    }

    return {
      shouldDelay: false,
      reason: 'Weather conditions acceptable for planned passage',
      suggestedDelay: 0,
    };
  }

  /**
   * Calculate required delay based on weather pattern
   */
  private calculateRequiredDelay(pattern: SevereWeatherPattern): number {
    switch (pattern.type) {
      case 'tropical_cyclone':
        return 72; // Wait 3 days minimum for tropical systems
      case 'gale_series':
        return 48; // Wait 2 days for gale conditions to pass
      case 'rapid_pressure_drop':
        return 24; // Wait 1 day for storm to develop and pass
      case 'cold_front':
        return 12; // Front typically passes in 12-24 hours
      case 'storm_system':
        return 36; // Wait 1.5 days
      default:
        return 24;
    }
  }
}

