/**
 * Weather Service - NOAA Integration
 * Provides real-time weather data from NOAA's API
 * Fails safely with conservative defaults if data unavailable
 */

import axios from 'axios';

export interface WeatherData {
  forecast: string;
  windSpeed: number;
  windDirection: number;
  waveHeight: number;
  temperature: number;
  conditions: string;
  warnings: string[];
  source: string;
  timestamp: string;
}

/**
 * Get weather data from NOAA for given coordinates
 * @param lat Latitude
 * @param lon Longitude
 * @returns Weather data with forecast, wind, waves, and warnings
 */
export async function getWeatherData(lat: number, lon: number): Promise<WeatherData> {
  try {
    console.log(`Fetching weather for ${lat}, ${lon}`);
    
    // Get grid point from NOAA
    const pointResponse = await axios.get(
      `https://api.weather.gov/points/${lat},${lon}`,
      { 
        headers: { 'User-Agent': 'Helmwise/1.0 (contact@helmwise.co)' },
        timeout: 5000 
      }
    );
    
    const forecastUrl = pointResponse.data.properties.forecast;
    console.log(`Forecast URL: ${forecastUrl}`);
    
    // Get forecast data
    const forecastResponse = await axios.get(forecastUrl, {
      headers: { 'User-Agent': 'Helmwise/1.0 (contact@helmwise.co)' },
      timeout: 5000
    });
    
    const period = forecastResponse.data.properties.periods[0];
    
    // Extract wind speed from detailed forecast
    const windMatch = period.detailedForecast.match(/winds? (\d+) to (\d+) mph/i);
    const windSpeed = windMatch 
      ? (parseInt(windMatch[1]) + parseInt(windMatch[2])) / 2 
      : parseWindSpeedFromShort(period.shortForecast);
    
    // Convert wind direction string to degrees
    const windDirection = period.windDirection 
      ? parseWindDirection(period.windDirection) 
      : 0;
    
    // Estimate wave height from wind speed
    const waveHeight = estimateWaveHeight(windSpeed);
    
    // Extract warnings from forecast text
    const warnings = extractWarnings(period.detailedForecast);
    
    return {
      forecast: period.detailedForecast,
      windSpeed: Math.round(windSpeed * 10) / 10,
      windDirection,
      waveHeight,
      temperature: period.temperature,
      conditions: period.shortForecast,
      warnings,
      source: 'NOAA Weather Service',
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Weather fetch failed:', error.message);
    
    // Return safe defaults with warning - fail safely for maritime safety
    return {
      forecast: 'Weather data temporarily unavailable. Use official weather services for passage planning.',
      windSpeed: 15, // Conservative assumption
      windDirection: 0,
      waveHeight: 3, // Conservative assumption
      temperature: 60,
      conditions: 'Unknown - Data unavailable',
      warnings: [
        'CRITICAL: Weather data unavailable',
        'Do not proceed with passage planning',
        'Consult official weather sources before departure'
      ],
      source: 'System Default (NOAA unavailable)',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Parse wind direction string to degrees
 */
function parseWindDirection(dir: string): number {
  const directions: Record<string, number> = {
    'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
    'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
    'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
    'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
  };
  return directions[dir] || 0;
}

/**
 * Parse wind speed from short forecast if detailed match fails
 */
function parseWindSpeedFromShort(forecast: string): number {
  const match = forecast.match(/(\d+)\s*mph/i);
  return match ? parseInt(match[1]) : 10;
}

/**
 * Estimate wave height based on wind speed
 * Conservative estimates for maritime safety
 */
function estimateWaveHeight(windSpeed: number): number {
  if (windSpeed < 5) return 0.5;
  if (windSpeed < 10) return 1;
  if (windSpeed < 15) return 2;
  if (windSpeed < 20) return 3;
  if (windSpeed < 25) return 4;
  if (windSpeed < 30) return 6;
  return 8; // High seas
}

/**
 * Extract weather warnings from forecast text
 */
function extractWarnings(forecast: string): string[] {
  const warnings = [];
  const lowerForecast = forecast.toLowerCase();
  
  // Severe weather warnings
  if (lowerForecast.includes('gale')) warnings.push('Gale warning in effect');
  if (lowerForecast.includes('storm')) warnings.push('Storm conditions possible');
  if (lowerForecast.includes('hurricane')) warnings.push('Hurricane warning');
  
  // Visibility warnings
  if (lowerForecast.includes('fog')) warnings.push('Reduced visibility - fog');
  if (lowerForecast.includes('haze')) warnings.push('Reduced visibility - haze');
  
  // Sea state warnings
  if (lowerForecast.includes('rough')) warnings.push('Rough sea conditions');
  if (lowerForecast.includes('heavy seas')) warnings.push('Heavy seas');
  
  // Precipitation warnings
  if (lowerForecast.includes('thunderstorm')) warnings.push('Thunderstorms possible');
  if (lowerForecast.includes('heavy rain')) warnings.push('Heavy precipitation');
  
  return warnings;
}

/**
 * Generate formatted wind description
 */
export function formatWindDescription(speed: number, direction: number): string {
  const dirNames = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(direction / 22.5) % 16;
  const dirName = dirNames[index];
  
  let strength = 'Light';
  if (speed >= 25) strength = 'Strong';
  else if (speed >= 15) strength = 'Moderate';
  
  return `${strength} ${dirName} at ${speed} mph`;
}

