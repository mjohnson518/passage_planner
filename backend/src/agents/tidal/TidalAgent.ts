import { BaseAgent } from '../../shared/agents/BaseAgent';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

interface TidalPrediction {
  time: Date;
  height: number;
  type: 'high' | 'low';
}

interface CurrentPrediction {
  time: Date;
  velocity: number;
  direction: number;
  type: 'flood' | 'ebb' | 'slack';
}

export class TidalAgent extends BaseAgent {
  private noaaApiKey: string;
  
  constructor(redisUrl: string, noaaApiKey: string) {
    super({
      name: 'tidal-agent',
      description: 'Provides tidal and current predictions',
      version: '1.0.0',
      cacheTTL: 86400 // 24 hours - tides are predictable
    }, redisUrl);
    
    this.noaaApiKey = noaaApiKey;
  }

  getTools(): Tool[] {
    return [
      {
        name: 'get_tide_predictions',
        description: 'Get tide predictions for a location',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            start_date: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date-time' },
            datum: { type: 'string', default: 'MLLW' }
          },
          required: ['latitude', 'longitude', 'start_date', 'end_date']
        }
      },
      {
        name: 'get_current_predictions',
        description: 'Get tidal current predictions',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            start_date: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date-time' }
          },
          required: ['latitude', 'longitude', 'start_date', 'end_date']
        }
      },
      {
        name: 'get_water_levels',
        description: 'Get real-time water level data',
        inputSchema: {
          type: 'object',
          properties: {
            station_id: { type: 'string' },
            hours: { type: 'number', default: 24 }
          },
          required: ['station_id']
        }
      },
      {
        name: 'find_nearest_station',
        description: 'Find nearest tidal station',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            type: { type: 'string', enum: ['tide', 'current', 'both'], default: 'both' }
          },
          required: ['latitude', 'longitude']
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'get_tide_predictions':
        return await this.getTidePredictions(
          args.latitude,
          args.longitude,
          args.start_date,
          args.end_date,
          args.datum
        );
      case 'get_current_predictions':
        return await this.getCurrentPredictions(
          args.latitude,
          args.longitude,
          args.start_date,
          args.end_date
        );
      case 'get_water_levels':
        return await this.getWaterLevels(args.station_id, args.hours);
      case 'find_nearest_station':
        return await this.findNearestStation(args.latitude, args.longitude, args.type);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async getTidePredictions(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
    datum: string = 'MLLW'
  ): Promise<TidalPrediction[]> {
    const cacheKey = this.generateCacheKey('tides', lat.toString(), lon.toString(), startDate, endDate);
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      return await this.withRetry(async () => {
        // Find nearest station
        const station = await this.findNearestStation(lat, lon, 'tide');
        
        // Get predictions from NOAA CO-OPS API
        const response = await axios.get(
          'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
          {
            params: {
              begin_date: startDate.replace(/[:\-]/g, '').slice(0, 8),
              end_date: endDate.replace(/[:\-]/g, '').slice(0, 8),
              station: station.id,
              product: 'predictions',
              datum: datum,
              interval: 'hilo',
              units: 'english',
              time_zone: 'gmt',
              format: 'json'
            }
          }
        );

        const predictions: TidalPrediction[] = response.data.predictions.map((pred: any) => ({
          time: new Date(pred.t),
          height: parseFloat(pred.v),
          type: pred.type === 'H' ? 'high' : 'low'
        }));

        await this.setCachedData(cacheKey, predictions);
        return predictions;
      });
    } catch (error: any) {
      await this.reportHealth('degraded', { error: error.message });
      throw error;
    }
  }

  private async getCurrentPredictions(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string
  ): Promise<CurrentPrediction[]> {
    const cacheKey = this.generateCacheKey('currents', lat.toString(), lon.toString(), startDate, endDate);
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      return await this.withRetry(async () => {
        // Find nearest current station
        const station = await this.findNearestStation(lat, lon, 'current');
        
        // Get current predictions
        const response = await axios.get(
          'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
          {
            params: {
              begin_date: startDate.replace(/[:\-]/g, '').slice(0, 8),
              end_date: endDate.replace(/[:\-]/g, '').slice(0, 8),
              station: station.id,
              product: 'currents_predictions',
              units: 'english',
              time_zone: 'gmt',
              format: 'json',
              interval: '30'
            }
          }
        );

        const predictions: CurrentPrediction[] = response.data.current_predictions.map((pred: any) => ({
          time: new Date(pred.t),
          velocity: parseFloat(pred.v),
          direction: parseFloat(pred.d),
          type: this.determineCurrentType(parseFloat(pred.v))
        }));

        await this.setCachedData(cacheKey, predictions);
        return predictions;
      });
    } catch (error: any) {
      await this.reportHealth('degraded', { error: error.message });
      throw error;
    }
  }

  private async getWaterLevels(stationId: string, hours: number = 24): Promise<any> {
    try {
      return await this.withRetry(async () => {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);
        
        const response = await axios.get(
          'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
          {
            params: {
              begin_date: startDate.toISOString().slice(0, 10).replace(/-/g, ''),
              end_date: endDate.toISOString().slice(0, 10).replace(/-/g, ''),
              station: stationId,
              product: 'water_level',
              datum: 'MLLW',
              units: 'english',
              time_zone: 'gmt',
              format: 'json'
            }
          }
        );

        return response.data;
      });
    } catch (error: any) {
      throw error;
    }
  }

  private async findNearestStation(lat: number, lon: number, type: string = 'both'): Promise<any> {
    const cacheKey = this.generateCacheKey('station', lat.toString(), lon.toString(), type);
    const cached = await this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      return await this.withRetry(async () => {
        // Get station metadata
        const response = await axios.get(
          'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json',
          {
            params: {
              type: type === 'both' ? 'waterlevels' : type,
              units: 'english'
            }
          }
        );

        // Calculate distances and find nearest
        const stations = response.data.stations;
        let nearestStation = null;
        let minDistance = Infinity;

        for (const station of stations) {
          const distance = this.calculateDistance(
            lat,
            lon,
            station.lat,
            station.lng
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestStation = {
              id: station.id,
              name: station.name,
              latitude: station.lat,
              longitude: station.lng,
              distance: distance
            };
          }
        }

        await this.setCachedData(cacheKey, nearestStation, 604800); // 1 week cache
        return nearestStation;
      });
    } catch (error: any) {
      throw error;
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3440.1; // Earth radius in nautical miles
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

  private determineCurrentType(velocity: number): 'flood' | 'ebb' | 'slack' {
    if (Math.abs(velocity) < 0.1) return 'slack';
    return velocity > 0 ? 'flood' : 'ebb';
  }
}

