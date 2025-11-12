/**
 * Tidal Service - NOAA Tides and Currents Integration
 * SAFETY-CRITICAL: Provides tidal predictions for safe harbor entry/exit
 * 
 * Uses NOAA CO-OPS API for real tidal station data
 * 
 * FAIL-SAFE PRINCIPLE: Returns empty predictions if data unavailable - warns mariner
 */

import axios from 'axios';
import { calculateAstronomicalTides, getNextTide as getNextAstroTide } from './astronomicalTides';
import { isUSWaters } from './worldPortService';

export interface TidalData {
  station: string;
  stationId?: string;
  distance?: number; // Distance to station in km
  predictions: Array<{
    time: string;
    type: 'high' | 'low';
    height: number;
    unit: string;
  }>;
  currentSpeed?: number;
  currentDirection?: number;
  warning?: string;
  source: string;
}

/**
 * Get tidal predictions for a location
 * SAFETY-CRITICAL: Tidal miscalculations can cause groundings
 * 
 * @param lat Latitude
 * @param lon Longitude
 * @param date Start date for predictions (default: now)
 * @returns Tidal predictions for nearest station
 */
export async function getTidalData(
  lat: number, 
  lon: number, 
  date?: Date
): Promise<TidalData> {
  try {
    console.log(`Fetching tidal data for ${lat}, ${lon}`);
    
    // Find nearest NOAA tidal station (within 50km radius)
    const stationResponse = await axios.get(
      `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json`,
      {
        params: {
          type: 'tidepredictions',
          lat: lat,
          lng: lon,
          radius: 50 // kilometers
        },
        timeout: 5000,
        headers: { 'User-Agent': 'Helmwise/1.0 (contact@helmwise.co)' }
      }
    );
    
    if (stationResponse.data.stations && stationResponse.data.stations.length > 0) {
      const station = stationResponse.data.stations[0];
      console.log(`Found tidal station: ${station.name} (${station.id})`);
      
      const beginDate = date || new Date();
      const endDate = new Date(beginDate.getTime() + 48 * 60 * 60 * 1000); // 48 hours
      
      // Format dates for NOAA API (YYYYMMDD)
      const beginDateStr = formatNOAADate(beginDate);
      const endDateStr = formatNOAADate(endDate);
      
      // Get tidal predictions
      const tidalResponse = await axios.get(
        `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`,
        {
          params: {
            product: 'predictions',
            application: 'Helmwise',
            begin_date: beginDateStr,
            end_date: endDateStr,
            datum: 'MLLW', // Mean Lower Low Water
            station: station.id,
            time_zone: 'gmt',
            units: 'english',
            interval: 'hilo', // High/Low tides only
            format: 'json'
          },
          timeout: 5000,
          headers: { 'User-Agent': 'Helmwise/1.0 (contact@helmwise.co)' }
        }
      );
      
      const predictions = tidalResponse.data.predictions?.map((p: any) => ({
        time: p.t,
        type: p.type === 'H' ? 'high' as const : 'low' as const,
        height: parseFloat(p.v),
        unit: 'feet'
      })) || [];
      
      console.log(`Retrieved ${predictions.length} tidal predictions`);
      
      return {
        station: station.name,
        stationId: station.id,
        distance: station.distance || 0,
        predictions,
        currentSpeed: 0, // Would need separate current predictions API call
        currentDirection: 0,
        source: 'NOAA Tides & Currents'
      };
    }
    
    // No station found nearby
    console.warn(`No tidal station found within 50km of ${lat}, ${lon}`);
    return {
      station: 'No tidal station nearby',
      predictions: [],
      currentSpeed: 0,
      currentDirection: 0,
      warning: 'No tidal prediction station found within 50km. Use local tide tables.',
      source: 'Helmwise System'
    };
    
  } catch (error: any) {
    console.error('Tidal data fetch failed:', error.message);
    
    // FAIL-SAFE: Return warning about unavailable data
    return {
      station: 'Tidal data unavailable',
      predictions: [],
      currentSpeed: 0,
      currentDirection: 0,
      source: 'Helmwise System (Error)',
      warning: 'Unable to retrieve tidal predictions. Consult local tide tables and current charts before passage.'
    };
  }
}

/**
 * Get tidal data with global fallback
 * Uses NOAA for US, astronomical calculations elsewhere
 */
export async function getTidalDataGlobal(lat: number, lon: number, date?: Date): Promise<TidalData> {
  // Try NOAA first (always try, works globally for some stations)
  try {
    const noaaData = await getTidalData(lat, lon, date);
    if (noaaData.predictions.length > 0) {
      return noaaData;
    }
  } catch (error) {
    console.log('NOAA unavailable, using astronomical calculations');
  }

  // Fallback to astronomical calculations
  const astroPredictions = calculateAstronomicalTides(lat, lon, date || new Date());
  const nextTide = getNextAstroTide(astroPredictions);

  return {
    station: `Astronomical calculation (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
    predictions: astroPredictions.map(p => ({
      time: p.time,
      type: p.type,
      height: p.height,
      unit: 'meters'
    })),
    currentSpeed: 0,
    currentDirection: 0,
    source: 'Astronomical Tide Calculation (Global Coverage)',
    warning: 'Predictions based on astronomical calculations - verify with local sources'
  };
}

/**
 * Format date for NOAA API (YYYYMMDD)
 */
function formatNOAADate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Get next high/low tide from predictions
 */
export function getNextTide(predictions: TidalData['predictions']): TidalData['predictions'][0] | null {
  if (predictions.length === 0) return null;
  
  const now = new Date();
  
  for (const prediction of predictions) {
    const predictionTime = new Date(prediction.time);
    if (predictionTime > now) {
      return prediction;
    }
  }
  
  return predictions[0]; // Return first if all are in past
}

/**
 * Get tidal range for a location (useful for navigation)
 */
export function getTidalRange(predictions: TidalData['predictions']): number {
  if (predictions.length < 2) return 0;
  
  const heights = predictions.map(p => p.height);
  const maxHeight = Math.max(...heights);
  const minHeight = Math.min(...heights);
  
  return maxHeight - minHeight;
}

/**
 * Format tidal prediction as human-readable string
 */
export function formatTidalPrediction(prediction: TidalData['predictions'][0]): string {
  const time = new Date(prediction.time);
  const timeStr = time.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  return `${prediction.type === 'high' ? 'High' : 'Low'} tide at ${timeStr}: ${prediction.height.toFixed(1)} ${prediction.unit}`;
}

