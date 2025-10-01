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
}

interface MarineZone {
  id: string;
  name: string;
  forecast: string;
  warnings: string[];
}

export class WeatherAgent extends BaseAgent {
  private noaaApiKey: string;
  private openWeatherApiKey: string;
  
  constructor(redisUrl: string, noaaApiKey: string, openWeatherApiKey: string) {
    super({
      name: 'weather-agent',
      description: 'Provides marine weather forecasts and warnings',
      version: '1.0.0',
      cacheTTL: 1800 // 30 minutes
    }, redisUrl);
    
    this.noaaApiKey = noaaApiKey;
    this.openWeatherApiKey = openWeatherApiKey;
  }

  getTools(): Tool[] {
    return [
      {
        name: 'get_marine_forecast',
        description: 'Get marine weather forecast for a specific location',
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
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async getMarineForecast(lat: number, lon: number, hours: number = 72): Promise<WeatherForecast[]> {
    const cacheKey = this.generateCacheKey('forecast', lat.toString(), lon.toString(), hours.toString());
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      return await this.withRetry(async () => {
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
        const forecasts: WeatherForecast[] = [];
        const hourlyData = marineResponse.data.hourly.slice(0, hours);
        
        for (let i = 0; i < hourlyData.length; i++) {
          const hour = hourlyData[i];
          forecasts.push({
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
            cloudCover: hour.clouds
          });
        }

        await this.setCachedData(cacheKey, forecasts);
        return forecasts;
      });
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
    // Implementation would connect to NOAA NOMADS or similar GRIB service
    // This is a placeholder for the actual GRIB data retrieval
    return {
      bounds,
      resolution,
      parameters,
      url: `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_${resolution}deg.pl`,
      format: 'GRIB2',
      message: 'GRIB data URL generated for download'
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
}

