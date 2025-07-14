import { z } from 'zod';
import { Coordinate } from './core';

// Unified weather data format
export interface UnifiedWeatherData {
  source: WeatherDataSource | WeatherDataSource[];
  timestamp: Date;
  coordinates: Coordinate;
  current: CurrentWeatherData;
  marine?: MarineWeatherData;
  forecast?: WeatherForecast[];
  alerts?: WeatherAlert[];
  metadata: WeatherMetadata;
}

export type WeatherDataSource = 'noaa' | 'openweather' | 'windy' | 'fallback';

export interface CurrentWeatherData {
  temperature: number; // Celsius
  feelsLike?: number;
  humidity: number; // Percentage
  pressure: number; // hPa
  windSpeed: number; // knots
  windDirection: number; // degrees
  windGust?: number; // knots
  visibility: number; // km
  cloudCover: number; // percentage
  precipitation: number; // mm/hr
  uvIndex?: number;
  conditions: string;
}

export interface MarineWeatherData {
  waveHeight?: number; // meters
  wavePeriod?: number; // seconds
  waveDirection?: number; // degrees
  swellHeight?: number; // meters
  swellPeriod?: number; // seconds
  swellDirection?: number; // degrees
  seaTemperature?: number; // Celsius
  seaLevelPressure?: number; // hPa
  currentSpeed?: number; // knots
  currentDirection?: number; // degrees
}

export interface WeatherForecast extends CurrentWeatherData {
  time: Date;
  marine?: MarineWeatherData;
}

export interface WeatherAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  start: Date;
  end: Date;
  areas: string[];
}

export type AlertType = 
  | 'gale'
  | 'storm'
  | 'hurricane'
  | 'fog'
  | 'thunderstorm'
  | 'small_craft'
  | 'other';

export type AlertSeverity = 'advisory' | 'watch' | 'warning' | 'emergency';

export interface WeatherMetadata {
  fetchedAt: Date;
  cacheExpiry?: Date;
  quality: DataQuality;
  errors?: string[];
}

export type DataQuality = 'high' | 'medium' | 'low' | 'fallback';

// Validation schemas
export const CurrentWeatherDataSchema = z.object({
  temperature: z.number(),
  feelsLike: z.number().optional(),
  humidity: z.number().min(0).max(100),
  pressure: z.number(),
  windSpeed: z.number().min(0),
  windDirection: z.number().min(0).max(360),
  windGust: z.number().min(0).optional(),
  visibility: z.number().min(0),
  cloudCover: z.number().min(0).max(100),
  precipitation: z.number().min(0),
  uvIndex: z.number().min(0).max(11).optional(),
  conditions: z.string(),
});

export const MarineWeatherDataSchema = z.object({
  waveHeight: z.number().min(0).optional(),
  wavePeriod: z.number().min(0).optional(),
  waveDirection: z.number().min(0).max(360).optional(),
  swellHeight: z.number().min(0).optional(),
  swellPeriod: z.number().min(0).optional(),
  swellDirection: z.number().min(0).max(360).optional(),
  seaTemperature: z.number().optional(),
  seaLevelPressure: z.number().optional(),
  currentSpeed: z.number().min(0).optional(),
  currentDirection: z.number().min(0).max(360).optional(),
});

// Conversion utilities
export class WeatherDataConverter {
  // Convert temperature
  static celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9/5) + 32;
  }
  
  static fahrenheitToCelsius(fahrenheit: number): number {
    return (fahrenheit - 32) * 5/9;
  }
  
  // Convert wind speed
  static knotsToMs(knots: number): number {
    return knots * 0.514444;
  }
  
  static msToKnots(ms: number): number {
    return ms * 1.94384;
  }
  
  static knotsToKmh(knots: number): number {
    return knots * 1.852;
  }
  
  static kmhToKnots(kmh: number): number {
    return kmh / 1.852;
  }
  
  static knotsToMph(knots: number): number {
    return knots * 1.15078;
  }
  
  static mphToKnots(mph: number): number {
    return mph / 1.15078;
  }
  
  // Convert distance
  static kmToNm(km: number): number {
    return km / 1.852;
  }
  
  static nmToKm(nm: number): number {
    return nm * 1.852;
  }
  
  // Convert pressure
  static hpaToInhg(hpa: number): number {
    return hpa * 0.02953;
  }
  
  static inhgToHpa(inhg: number): number {
    return inhg / 0.02953;
  }
  
  // Wind direction
  static degreesToCardinal(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
  
  static cardinalToDegrees(cardinal: string): number {
    const directions: Record<string, number> = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5,
    };
    return directions[cardinal.toUpperCase()] || 0;
  }
  
  // Beaufort scale
  static knotsToBeaufort(knots: number): number {
    if (knots < 1) return 0;
    if (knots < 4) return 1;
    if (knots < 7) return 2;
    if (knots < 11) return 3;
    if (knots < 17) return 4;
    if (knots < 22) return 5;
    if (knots < 28) return 6;
    if (knots < 34) return 7;
    if (knots < 41) return 8;
    if (knots < 48) return 9;
    if (knots < 56) return 10;
    if (knots < 64) return 11;
    return 12;
  }
  
  static beaufortDescription(beaufort: number): string {
    const descriptions = [
      'Calm',
      'Light air',
      'Light breeze',
      'Gentle breeze',
      'Moderate breeze',
      'Fresh breeze',
      'Strong breeze',
      'Near gale',
      'Gale',
      'Strong gale',
      'Storm',
      'Violent storm',
      'Hurricane',
    ];
    return descriptions[Math.min(beaufort, 12)];
  }
}

// Weather data normalizer
export class WeatherDataNormalizer {
  static normalizeNOAA(data: any): Partial<UnifiedWeatherData> {
    const current: CurrentWeatherData = {
      temperature: data.temperature?.value || 0,
      humidity: data.relativeHumidity?.value || 0,
      pressure: data.barometricPressure?.value ? data.barometricPressure.value / 100 : 1013,
      windSpeed: data.windSpeed?.value ? WeatherDataConverter.msToKnots(data.windSpeed.value) : 0,
      windDirection: data.windDirection?.value || 0,
      windGust: data.windGust?.value ? WeatherDataConverter.msToKnots(data.windGust.value) : undefined,
      visibility: data.visibility?.value ? data.visibility.value / 1000 : 10,
      cloudCover: this.estimateCloudCover(data.cloudLayers),
      precipitation: data.precipitationLastHour?.value || 0,
      conditions: data.textDescription || 'Unknown',
    };
    
    return {
      source: 'noaa',
      current,
      metadata: {
        fetchedAt: new Date(),
        quality: 'high',
      },
    };
  }
  
  static normalizeOpenWeather(data: any): Partial<UnifiedWeatherData> {
    const current: CurrentWeatherData = {
      temperature: data.main?.temp || 0,
      feelsLike: data.main?.feels_like,
      humidity: data.main?.humidity || 0,
      pressure: data.main?.pressure || 1013,
      windSpeed: data.wind?.speed ? WeatherDataConverter.msToKnots(data.wind.speed) : 0,
      windDirection: data.wind?.deg || 0,
      windGust: data.wind?.gust ? WeatherDataConverter.msToKnots(data.wind.gust) : undefined,
      visibility: data.visibility ? data.visibility / 1000 : 10,
      cloudCover: data.clouds?.all || 0,
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      uvIndex: data.uvi,
      conditions: data.weather?.[0]?.description || 'Unknown',
    };
    
    const marine: MarineWeatherData | undefined = data.current?.waves ? {
      waveHeight: data.current.waves.height,
      wavePeriod: data.current.waves.period,
      waveDirection: data.current.waves.direction,
      seaTemperature: data.current.sea_temp,
    } : undefined;
    
    return {
      source: 'openweather',
      current,
      marine,
      metadata: {
        fetchedAt: new Date(),
        quality: 'high',
      },
    };
  }
  
  static normalizeWindy(data: any): Partial<UnifiedWeatherData> {
    const current: CurrentWeatherData = {
      temperature: data.temp || 0,
      humidity: data.rh || 0,
      pressure: data.pressure || 1013,
      windSpeed: data['wind-10m']?.speed || 0,
      windDirection: data['wind-10m']?.direction || 0,
      windGust: data.windGust?.speed || undefined,
      visibility: 10, // Windy doesn't provide visibility
      cloudCover: data.clouds?.all || 0,
      precipitation: data.prcp || 0,
      conditions: this.getWindyConditions(data),
    };
    
    const marine: MarineWeatherData | undefined = {
      waveHeight: data.waves?.height,
      wavePeriod: data.waves?.period,
      waveDirection: data.waves?.direction,
      swellHeight: data.swell1?.height,
      swellPeriod: data.swell1?.period,
      swellDirection: data.swell1?.direction,
    };
    
    return {
      source: 'windy',
      current,
      marine,
      metadata: {
        fetchedAt: new Date(),
        quality: 'high',
      },
    };
  }
  
  private static estimateCloudCover(cloudLayers: any[]): number {
    if (!cloudLayers || cloudLayers.length === 0) return 0;
    
    const coverageMap: Record<string, number> = {
      'CLR': 0,
      'FEW': 25,
      'SCT': 50,
      'BKN': 75,
      'OVC': 100,
    };
    
    let maxCoverage = 0;
    for (const layer of cloudLayers) {
      const coverage = coverageMap[layer.amount] || 0;
      maxCoverage = Math.max(maxCoverage, coverage);
    }
    
    return maxCoverage;
  }
  
  private static getWindyConditions(data: any): string {
    if (data.prcp > 0) {
      if (data.temp < 0) return 'Snow';
      return 'Rain';
    }
    
    const cloudCover = data.clouds?.all || 0;
    if (cloudCover < 20) return 'Clear';
    if (cloudCover < 50) return 'Partly cloudy';
    if (cloudCover < 80) return 'Mostly cloudy';
    return 'Overcast';
  }
  
  static merge(...sources: Partial<UnifiedWeatherData>[]): UnifiedWeatherData {
    const merged: any = {
      source: [],
      timestamp: new Date(),
      coordinates: sources[0]?.coordinates || { latitude: 0, longitude: 0 },
      current: {},
      marine: {},
      forecast: [],
      alerts: [],
      metadata: {
        fetchedAt: new Date(),
        quality: 'medium' as DataQuality,
        errors: [],
      },
    };
    
    // Merge sources
    for (const source of sources) {
      if (source.source) {
        merged.source.push(source.source);
      }
      
      // Merge current weather data
      if (source.current) {
        Object.assign(merged.current, source.current);
      }
      
      // Merge marine data
      if (source.marine) {
        Object.assign(merged.marine, source.marine);
      }
      
      // Combine forecasts
      if (source.forecast) {
        merged.forecast.push(...source.forecast);
      }
      
      // Combine alerts
      if (source.alerts) {
        merged.alerts.push(...source.alerts);
      }
      
      // Merge metadata
      if (source.metadata?.errors) {
        merged.metadata.errors.push(...source.metadata.errors);
      }
    }
    
    // Determine overall quality
    if (merged.source.includes('noaa') || merged.source.includes('openweather')) {
      merged.metadata.quality = 'high';
    } else if (merged.source.includes('windy')) {
      merged.metadata.quality = 'medium';
    } else {
      merged.metadata.quality = 'low';
    }
    
    return merged;
  }
} 