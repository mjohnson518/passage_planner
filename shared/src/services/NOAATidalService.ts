import axios, { AxiosInstance } from 'axios';
import { Logger } from 'pino';
import { CacheManager } from './CacheManager';

export interface TidalStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance: number; // km from query point
}

export interface TidalPrediction {
  time: Date;
  height: number; // meters
  type: 'high' | 'low';
}

export interface TidalCurrent {
  time: Date;
  velocity: number; // knots
  direction: number; // degrees
  type: 'max_flood' | 'max_ebb' | 'slack';
}

export interface TidalData {
  station: TidalStation;
  predictions: TidalPrediction[];
  currents: TidalCurrent[];
  datum: string;
  timeZone: string;
}

export interface TidalWindow {
  start: Date;
  end: Date;
  type: 'rising' | 'falling' | 'slack_water';
  averageHeight: number;
  currentVelocity?: number;
}

export class NOAATidalService {
  private axios: AxiosInstance;
  private cache: CacheManager;
  private logger: Logger;
  
  private readonly NOAA_TIDES_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
  private readonly NOAA_STATIONS_BASE = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations';
  
  constructor(cache: CacheManager, logger: Logger) {
    this.cache = cache;
    this.logger = logger;
    
    this.axios = axios.create({
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    });
  }
  
  /**
   * Find nearest tidal stations to a given location
   */
  async findNearestStations(
    latitude: number, 
    longitude: number, 
    maxDistance: number = 50
  ): Promise<TidalStation[]> {
    const cacheKey = `tidal:stations:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    
    const cached = await this.cache.get<TidalStation[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Get all tide stations
      const response = await this.axios.get(`${this.NOAA_STATIONS_BASE}.json`, {
        params: {
          type: 'tidepredictions',
          units: 'metric'
        }
      });
      
      // Calculate distances and sort
      const stations = response.data.stations
        .map((station: any) => {
          const distance = this.calculateDistance(
            latitude, longitude,
            station.lat, station.lng
          );
          
          return {
            id: station.id,
            name: station.name,
            latitude: station.lat,
            longitude: station.lng,
            distance
          };
        })
        .filter((station: TidalStation) => station.distance <= maxDistance)
        .sort((a: TidalStation, b: TidalStation) => a.distance - b.distance)
        .slice(0, 5); // Return top 5 nearest stations
      
      await this.cache.set(cacheKey, stations, 86400); // Cache for 24 hours
      return stations;
    } catch (error) {
      this.logger.error({ error }, 'Failed to find tidal stations');
      throw new Error('Unable to find nearby tidal stations');
    }
  }
  
  /**
   * Get tidal predictions for a specific station
   */
  async getTidalPredictions(
    stationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TidalData> {
    const cacheKey = `tidal:predictions:${stationId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    
    const cached = await this.cache.get<TidalData>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Format dates for NOAA API
      const beginDate = this.formatDate(startDate);
      const endDateStr = this.formatDate(endDate);
      
      // Get both high/low predictions and hourly heights
      const [extremes, hourly] = await Promise.all([
        // High/low tide predictions
        this.axios.get(this.NOAA_TIDES_BASE, {
          params: {
            station: stationId,
            product: 'predictions',
            datum: 'MLLW',
            interval: 'hilo',
            units: 'metric',
            time_zone: 'gmt',
            begin_date: beginDate,
            end_date: endDateStr,
            format: 'json'
          }
        }),
        // Hourly tide heights
        this.axios.get(this.NOAA_TIDES_BASE, {
          params: {
            station: stationId,
            product: 'predictions',
            datum: 'MLLW',
            interval: 'h',
            units: 'metric',
            time_zone: 'gmt',
            begin_date: beginDate,
            end_date: endDateStr,
            format: 'json'
          }
        })
      ]);
      
      // Get station metadata
      const stationInfo = await this.getStationInfo(stationId);
      
      // Process predictions
      const predictions = extremes.data.predictions?.map((pred: any) => ({
        time: new Date(pred.t),
        height: parseFloat(pred.v),
        type: pred.type === 'H' ? 'high' : 'low'
      })) || [];
      
      // Get current predictions if available
      const currents = await this.getCurrentPredictions(stationId, startDate, endDate);
      
      const tidalData: TidalData = {
        station: stationInfo,
        predictions,
        currents,
        datum: 'MLLW',
        timeZone: 'GMT'
      };
      
      await this.cache.set(cacheKey, tidalData, 3600); // Cache for 1 hour
      return tidalData;
    } catch (error) {
      this.logger.error({ error, stationId }, 'Failed to get tidal predictions');
      throw new Error('Unable to retrieve tidal predictions');
    }
  }
  
  /**
   * Get current predictions for stations that support it
   */
  private async getCurrentPredictions(
    stationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TidalCurrent[]> {
    try {
      const response = await this.axios.get(this.NOAA_TIDES_BASE, {
        params: {
          station: stationId,
          product: 'currents_predictions',
          units: 'english', // Currents are typically in knots
          time_zone: 'gmt',
          begin_date: this.formatDate(startDate),
          end_date: this.formatDate(endDate),
          format: 'json'
        }
      });
      
      return response.data.current_predictions?.map((curr: any) => ({
        time: new Date(curr.Time),
        velocity: Math.abs(parseFloat(curr.Velocity_Major)),
        direction: parseFloat(curr.Direction),
        type: this.getCurrentType(parseFloat(curr.Velocity_Major))
      })) || [];
    } catch (error) {
      // Many stations don't have current data
      this.logger.debug({ stationId }, 'No current data available for station');
      return [];
    }
  }
  
  /**
   * Calculate safe tidal windows for passage
   */
  async calculateTidalWindows(
    stationId: string,
    startTime: Date,
    duration: number, // hours
    preferences: {
      minTideHeight?: number; // minimum tide height in meters
      maxCurrent?: number; // maximum current in knots
      preferRising?: boolean; // prefer rising tide
    }
  ): Promise<TidalWindow[]> {
    const endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const tidalData = await this.getTidalPredictions(stationId, startTime, endTime);
    
    const windows: TidalWindow[] = [];
    const minHeight = preferences.minTideHeight || 0;
    const maxCurrent = preferences.maxCurrent || 999;
    
    // Sort predictions by time
    const sortedPredictions = [...tidalData.predictions].sort(
      (a, b) => a.time.getTime() - b.time.getTime()
    );
    
    // Find windows between tide extremes
    for (let i = 0; i < sortedPredictions.length - 1; i++) {
      const current = sortedPredictions[i];
      const next = sortedPredictions[i + 1];
      
      const windowStart = new Date(current.time);
      const windowEnd = new Date(next.time);
      const windowDuration = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60);
      
      // Check if window is long enough
      if (windowDuration >= duration) {
        const isRising = current.type === 'low' && next.type === 'high';
        const averageHeight = (current.height + next.height) / 2;
        
        // Check preferences
        if (averageHeight >= minHeight) {
          if (!preferences.preferRising || isRising) {
            // Check currents if available
            const windowCurrents = tidalData.currents.filter(
              c => c.time >= windowStart && c.time <= windowEnd
            );
            
            const maxWindowCurrent = Math.max(
              ...windowCurrents.map(c => c.velocity),
              0
            );
            
            if (maxWindowCurrent <= maxCurrent) {
              windows.push({
                start: windowStart,
                end: windowEnd,
                type: isRising ? 'rising' : 'falling',
                averageHeight,
                currentVelocity: maxWindowCurrent || undefined
              });
            }
          }
        }
      }
    }
    
    return windows;
  }
  
  /**
   * Calculate tidal gates (passages that must be transited at specific tide states)
   */
  async calculateTidalGate(
    latitude: number,
    longitude: number,
    requirements: {
      minDepth: number; // meters
      channelDepth: number; // meters at MLLW
      transitTime: number; // hours to transit
    }
  ): Promise<TidalWindow[]> {
    // Find nearest station
    const stations = await this.findNearestStations(latitude, longitude);
    if (stations.length === 0) {
      throw new Error('No tidal stations found nearby');
    }
    
    const station = stations[0];
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const tidalData = await this.getTidalPredictions(station.id, startTime, endTime);
    
    const windows: TidalWindow[] = [];
    const requiredTideHeight = requirements.minDepth - requirements.channelDepth;
    
    // Find all periods where tide height is sufficient
    let inWindow = false;
    let windowStart: Date | null = null;
    
    // Check hourly predictions
    for (const pred of tidalData.predictions) {
      if (pred.height >= requiredTideHeight && !inWindow) {
        inWindow = true;
        windowStart = pred.time;
      } else if (pred.height < requiredTideHeight && inWindow && windowStart) {
        const windowEnd = pred.time;
        const duration = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60);
        
        if (duration >= requirements.transitTime) {
          windows.push({
            start: windowStart,
            end: windowEnd,
            type: 'slack_water',
            averageHeight: requiredTideHeight + requirements.channelDepth
          });
        }
        
        inWindow = false;
        windowStart = null;
      }
    }
    
    return windows;
  }
  
  /**
   * Get station information
   */
  private async getStationInfo(stationId: string): Promise<TidalStation> {
    try {
      const response = await this.axios.get(`${this.NOAA_STATIONS_BASE}/${stationId}.json`);
      const station = response.data.stations[0];
      
      return {
        id: station.id,
        name: station.name,
        latitude: station.lat,
        longitude: station.lng,
        distance: 0
      };
    } catch (error) {
      return {
        id: stationId,
        name: `Station ${stationId}`,
        latitude: 0,
        longitude: 0,
        distance: 0
      };
    }
  }
  
  /**
   * Format date for NOAA API
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  /**
   * Calculate distance between two points
   */
  private calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
  
  private getCurrentType(velocity: number): TidalCurrent['type'] {
    if (Math.abs(velocity) < 0.1) return 'slack';
    return velocity > 0 ? 'max_flood' : 'max_ebb';
  }
} 