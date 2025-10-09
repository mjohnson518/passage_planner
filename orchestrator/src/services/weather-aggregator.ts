/**
 * Weather Aggregator Service
 * 
 * SAFETY CRITICAL: Aggregates weather forecasts from multiple sources and creates
 * consensus forecasts with confidence levels. Identifies discrepancies that could
 * indicate forecast uncertainty.
 */

import { Logger } from 'pino';
import { UKMOForecast } from '../../../shared/src/services/UKMetOfficeService';

export interface WeatherSource {
  name: 'noaa' | 'ukmo' | 'openweather';
  priority: number; // 1 = highest
  regionalStrength?: {
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
    strengthMultiplier: number; // >1 means stronger in this region
  };
}

export interface AggregateForecast {
  time: Date;
  windSpeed: {
    value: number; // knots
    min: number;
    max: number;
    sources: { name: string; value: number }[];
  };
  windDirection: {
    value: number; // degrees
    sources: { name: string; value: number }[];
  };
  windGust: {
    value: number; // knots
    min: number;
    max: number;
  };
  waveHeight?: {
    value: number; // feet
    min: number;
    max: number;
  };
  visibility?: {
    value: number; // nautical miles
    min: number;
    max: number;
  };
  temperature?: number; // Celsius
  pressure?: number; // hPa
  precipitation?: number; // probability %
  confidence: 'high' | 'medium' | 'low';
  consensus: boolean; // Do sources agree within tolerance?
  sources: string[];
  discrepancies?: string[]; // List of significant differences
}

export interface ConsensusCriteria {
  windSpeedTolerancePercent: number; // Default: 20%
  windDirectionToleranceDegrees: number; // Default: 30°
  waveHeightTolerancePercent: number; // Default: 25%
  visibilityTolerancePercent: number; // Default: 30%
}

export class WeatherAggregator {
  private logger: Logger;
  private criteria: ConsensusCriteria;

  // Regional source preferences
  private readonly regionalPreferences: Map<string, WeatherSource[]> = new Map([
    // UK and North Atlantic - UK Met Office is authoritative
    ['north-atlantic', [
      { name: 'ukmo', priority: 1, regionalStrength: {
        bounds: { north: 62, south: 48, east: -5, west: -60 },
        strengthMultiplier: 1.5
      }},
      { name: 'noaa', priority: 2 },
    ]],
    // European waters - UK Met Office strong
    ['europe', [
      { name: 'ukmo', priority: 1, regionalStrength: {
        bounds: { north: 72, south: 35, east: 40, west: -15 },
        strengthMultiplier: 1.3
      }},
      { name: 'noaa', priority: 2 },
    ]],
    // North American waters - NOAA is authoritative  
    ['north-america', [
      { name: 'noaa', priority: 1, regionalStrength: {
        bounds: { north: 60, south: 20, east: -50, west: -140 },
        strengthMultiplier: 1.5
      }},
      { name: 'ukmo', priority: 2 },
    ]],
    // Global default
    ['global', [
      { name: 'noaa', priority: 1 },
      { name: 'ukmo', priority: 2 },
    ]],
  ]);

  constructor(logger: Logger, criteria?: Partial<ConsensusCriteria>) {
    this.logger = logger;
    this.criteria = {
      windSpeedTolerancePercent: criteria?.windSpeedTolerancePercent ?? 20,
      windDirectionToleranceDegrees: criteria?.windDirectionToleranceDegrees ?? 30,
      waveHeightTolerancePercent: criteria?.waveHeightTolerancePercent ?? 25,
      visibilityTolerancePercent: criteria?.visibilityTolerancePercent ?? 30,
    };
  }

  /**
   * Aggregate forecasts from multiple sources into consensus forecast
   */
  aggregateForecasts(
    noaaForecast: any[] | null,
    ukmoForecast: UKMOForecast[] | null,
    location: { latitude: number; longitude: number }
  ): AggregateForecast[] {
    const region = this.determineRegion(location.latitude, location.longitude);
    const sourcePreferences = this.getSourcePreferences(region);

    // Organize forecasts by time
    const forecastsByTime = this.organizeForecastsByTime(noaaForecast, ukmoForecast);

    const aggregated: AggregateForecast[] = [];

    for (const [timeKey, forecasts] of forecastsByTime) {
      if (forecasts.length === 0) continue;

      const aggregateForecast = this.createConsensus(forecasts, sourcePreferences);
      aggregated.push(aggregateForecast);
    }

    this.logger.info({
      region,
      noaaForecasts: noaaForecast?.length || 0,
      ukmoForecasts: ukmoForecast?.length || 0,
      aggregatedForecasts: aggregated.length,
      sources: aggregated[0]?.sources || [],
    }, 'Weather forecasts aggregated');

    return aggregated.sort((a, b) => a.time.getTime() - b.time.getTime());
  }

  /**
   * Organize forecasts by time buckets (nearest hour)
   */
  private organizeForecastsByTime(
    noaaForecast: any[] | null,
    ukmoForecast: UKMOForecast[] | null
  ): Map<string, Array<{ source: string; data: any }>> {
    const byTime = new Map<string, Array<{ source: string; data: any }>>();

    // Add NOAA forecasts
    if (noaaForecast) {
      for (const forecast of noaaForecast) {
        const timeKey = this.getTimeKey(forecast.time);
        const existing = byTime.get(timeKey) || [];
        existing.push({ source: 'noaa', data: forecast });
        byTime.set(timeKey, existing);
      }
    }

    // Add UK Met Office forecasts
    if (ukmoForecast) {
      for (const forecast of ukmoForecast) {
        const timeKey = this.getTimeKey(forecast.time);
        const existing = byTime.get(timeKey) || [];
        existing.push({ source: 'ukmo', data: forecast });
        byTime.set(timeKey, existing);
      }
    }

    return byTime;
  }

  /**
   * Create consensus forecast from multiple sources
   */
  private createConsensus(
    forecasts: Array<{ source: string; data: any }>,
    sourcePreferences: WeatherSource[]
  ): AggregateForecast {
    const sources = forecasts.map(f => f.source);
    const windSpeeds = forecasts.map(f => f.data.windSpeed).filter((v: number) => v !== undefined);
    const windDirections = forecasts.map(f => f.data.windDirection).filter((v: number) => v !== undefined);
    const windGusts = forecasts.map(f => f.data.windGust).filter((v: number) => v !== undefined);
    const waveHeights = forecasts.map(f => f.data.waveHeight).filter((v: number) => v !== undefined);
    const visibilities = forecasts.map(f => f.data.visibility).filter((v: number) => v !== undefined);

    // Calculate weighted averages based on source preferences
    const avgWindSpeed = this.weightedAverage(
      windSpeeds,
      forecasts.map(f => this.getSourceWeight(f.source, sourcePreferences))
    );
    const avgWindDirection = this.circularMean(windDirections);
    const avgWindGust = this.weightedAverage(windGusts, forecasts.map(() => 1));
    const avgWaveHeight = waveHeights.length > 0 ? this.average(waveHeights) : undefined;
    const avgVisibility = visibilities.length > 0 ? this.average(visibilities) : undefined;

    // Check consensus
    const windSpeedConsensus = this.checkConsensus(windSpeeds, avgWindSpeed, this.criteria.windSpeedTolerancePercent / 100);
    const windDirConsensus = this.checkAngularConsensus(windDirections, avgWindDirection, this.criteria.windDirectionToleranceDegrees);
    const waveHeightConsensus = waveHeights.length > 1 
      ? this.checkConsensus(waveHeights, avgWaveHeight!, this.criteria.waveHeightTolerancePercent / 100)
      : true;

    const overallConsensus = windSpeedConsensus && windDirConsensus && waveHeightConsensus;

    // Identify discrepancies
    const discrepancies: string[] = [];
    if (!windSpeedConsensus) {
      const diff = Math.max(...windSpeeds) - Math.min(...windSpeeds);
      discrepancies.push(`Wind speed varies by ${diff.toFixed(1)} knots between sources`);
    }
    if (!windDirConsensus) {
      discrepancies.push(`Wind direction differs by more than ${this.criteria.windDirectionToleranceDegrees}° between sources`);
    }
    if (!waveHeightConsensus && waveHeights.length > 1) {
      const diff = Math.max(...waveHeights) - Math.min(...waveHeights);
      discrepancies.push(`Wave height varies by ${diff.toFixed(1)} feet between sources`);
    }

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low';
    if (forecasts.length >= 2 && overallConsensus) {
      confidence = 'high';
    } else if (forecasts.length >= 2 && discrepancies.length <= 1) {
      confidence = 'medium';
    } else if (forecasts.length === 1) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      time: forecasts[0].data.time,
      windSpeed: {
        value: avgWindSpeed,
        min: Math.min(...windSpeeds),
        max: Math.max(...windSpeeds),
        sources: forecasts.map(f => ({ name: f.source, value: f.data.windSpeed })),
      },
      windDirection: {
        value: avgWindDirection,
        sources: forecasts.map(f => ({ name: f.source, value: f.data.windDirection })),
      },
      windGust: {
        value: avgWindGust,
        min: Math.min(...windGusts),
        max: Math.max(...windGusts),
      },
      waveHeight: avgWaveHeight ? {
        value: avgWaveHeight,
        min: Math.min(...waveHeights),
        max: Math.max(...waveHeights),
      } : undefined,
      visibility: avgVisibility ? {
        value: avgVisibility,
        min: Math.min(...visibilities),
        max: Math.max(...visibilities),
      } : undefined,
      temperature: forecasts[0].data.temperature,
      pressure: forecasts[0].data.pressure,
      precipitation: forecasts[0].data.precipitation,
      confidence,
      consensus: overallConsensus,
      sources,
      discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
    };
  }

  /**
   * Determine geographic region for source selection
   */
  private determineRegion(latitude: number, longitude: number): string {
    // North Atlantic
    if (latitude >= 48 && latitude <= 62 && longitude >= -60 && longitude <= -5) {
      return 'north-atlantic';
    }

    // European waters
    if (latitude >= 35 && latitude <= 72 && longitude >= -15 && longitude <= 40) {
      return 'europe';
    }

    // North American waters
    if (latitude >= 20 && latitude <= 60 && longitude >= -140 && longitude <= -50) {
      return 'north-america';
    }

    return 'global';
  }

  /**
   * Get source preferences for region
   */
  private getSourcePreferences(region: string): WeatherSource[] {
    return this.regionalPreferences.get(region) || this.regionalPreferences.get('global')!;
  }

  /**
   * Get source weight based on preferences
   */
  private getSourceWeight(sourceName: string, preferences: WeatherSource[]): number {
    const source = preferences.find(s => s.name === sourceName);
    if (!source) return 1.0;

    // Higher priority = higher weight
    // Priority 1 = weight 2.0, Priority 2 = weight 1.0
    return 3 - source.priority;
  }

  /**
   * Calculate weighted average
   */
  private weightedAverage(values: number[], weights: number[]): number {
    if (values.length === 0) return 0;
    if (values.length !== weights.length) {
      return this.average(values);
    }

    const weightedSum = values.reduce((sum, val, i) => sum + val * weights[i], 0);
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    return weightedSum / weightSum;
  }

  /**
   * Calculate simple average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate circular mean for wind direction
   */
  private circularMean(directions: number[]): number {
    if (directions.length === 0) return 0;

    const radians = directions.map(d => d * Math.PI / 180);
    const sinSum = radians.reduce((sum, r) => sum + Math.sin(r), 0);
    const cosSum = radians.reduce((sum, r) => sum + Math.cos(r), 0);

    const meanRadians = Math.atan2(sinSum / directions.length, cosSum / directions.length);
    const meanDegrees = meanRadians * 180 / Math.PI;

    return (meanDegrees + 360) % 360;
  }

  /**
   * Check if values are in consensus (within tolerance)
   */
  private checkConsensus(values: number[], mean: number, tolerancePercent: number): boolean {
    if (values.length <= 1) return true;

    return values.every(value => {
      const diff = Math.abs(value - mean);
      const percentDiff = diff / mean;
      return percentDiff <= tolerancePercent;
    });
  }

  /**
   * Check if angular values (directions) are in consensus
   */
  private checkAngularConsensus(directions: number[], mean: number, toleranceDegrees: number): boolean {
    if (directions.length <= 1) return true;

    return directions.every(direction => {
      let diff = Math.abs(direction - mean);
      // Handle circular nature (350° and 10° are only 20° apart, not 340°)
      if (diff > 180) diff = 360 - diff;
      return diff <= toleranceDegrees;
    });
  }

  /**
   * Get time key for grouping forecasts (hour resolution)
   */
  private getTimeKey(time: Date): string {
    const d = new Date(time);
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  }
}

