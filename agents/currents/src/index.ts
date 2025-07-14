// agents/currents/src/index.ts
// Currents Agent - Provides tidal current predictions and analysis

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import pino from 'pino';
import { z } from 'zod';

const app = express();
app.use(cors());
app.use(express.json());

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// NOAA Currents API configuration
const NOAA_API_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const NOAA_METADATA_BASE = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi';

// Cache for API responses
const cache = new Map<string, { data: any; expiry: number }>();

// Input schemas
const CurrentPredictionSchema = z.object({
  stationId: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional(),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }),
  interval: z.enum(['6', '30', '60']).optional().default('30')
});

const CurrentPatternSchema = z.object({
  coordinates: z.array(z.object({
    latitude: z.number(),
    longitude: z.number()
  })),
  time: z.string()
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'currents-agent',
    timestamp: new Date().toISOString()
  });
});

// Capabilities endpoint
app.get('/capabilities', (req, res) => {
  res.json({
    name: 'Currents Agent',
    version: '1.0.0',
    description: 'Provides tidal current predictions and analysis',
    capabilities: [
      'get_current_predictions',
      'get_current_patterns',
      'find_slack_water',
      'analyze_current_impact'
    ]
  });
});

// Get current predictions
app.post('/tools/get_current_predictions', async (req, res) => {
  try {
    const input = CurrentPredictionSchema.parse(req.body);
    logger.info({ input }, 'Getting current predictions');
    
    // Find nearest station if coordinates provided
    let stationId = input.stationId;
    if (!stationId && input.coordinates) {
      stationId = await findNearestCurrentStation(input.coordinates);
    }
    
    if (!stationId) {
      return res.status(400).json({ 
        error: 'No current station found for location' 
      });
    }
    
    // Check cache
    const cacheKey = `currents:${stationId}:${input.timeRange.start}:${input.timeRange.end}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    // Fetch from NOAA
    const response = await axios.get(NOAA_API_BASE, {
      params: {
        product: 'currents_predictions',
        station: stationId,
        begin_date: formatDate(input.timeRange.start),
        end_date: formatDate(input.timeRange.end),
        interval: input.interval,
        units: 'english',
        time_zone: 'gmt',
        format: 'json'
      }
    });
    
    const predictions = transformCurrentPredictions(response.data);
    
    // Add analysis
    const result = {
      stationId,
      predictions,
      analysis: analyzeCurrents(predictions),
      metadata: {
        station: response.data.metadata?.name,
        latitude: response.data.metadata?.lat,
        longitude: response.data.metadata?.lon
      }
    };
    
    // Cache for 1 hour
    setCache(cacheKey, result, 3600);
    
    res.json(result);
    
  } catch (error) {
    logger.error({ error }, 'Failed to get current predictions');
    res.status(500).json({ 
      error: 'Failed to get current predictions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current patterns along a route
app.post('/tools/get_current_patterns', async (req, res) => {
  try {
    const input = CurrentPatternSchema.parse(req.body);
    logger.info({ points: input.coordinates.length }, 'Getting current patterns');
    
    // Get predictions for each point
    const patterns = await Promise.all(
      input.coordinates.map(async (coord, index) => {
        const stationId = await findNearestCurrentStation(coord);
        if (!stationId) return null;
        
        const predictions = await getCurrentsForStation(
          stationId,
          input.time,
          new Date(new Date(input.time).getTime() + 24 * 3600000).toISOString()
        );
        
        return {
          point: index,
          coordinates: coord,
          stationId,
          current: interpolateCurrentAtTime(predictions, input.time)
        };
      })
    );
    
    // Filter out nulls and analyze pattern
    const validPatterns = patterns.filter(p => p !== null);
    
    res.json({
      patterns: validPatterns,
      summary: summarizeCurrentPatterns(validPatterns),
      recommendations: generateCurrentRecommendations(validPatterns)
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to get current patterns');
    res.status(500).json({ 
      error: 'Failed to get current patterns',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Find slack water times
app.post('/tools/find_slack_water', async (req, res) => {
  try {
    const { stationId, coordinates, timeRange } = req.body;
    logger.info({ stationId, coordinates }, 'Finding slack water times');
    
    // Get station ID if not provided
    let station = stationId;
    if (!station && coordinates) {
      station = await findNearestCurrentStation(coordinates);
    }
    
    if (!station) {
      return res.status(400).json({ 
        error: 'No current station found' 
      });
    }
    
    // Get predictions
    const predictions = await getCurrentsForStation(
      station,
      timeRange.start,
      timeRange.end
    );
    
    // Find slack water (current speed near zero)
    const slackTimes = findSlackWaterTimes(predictions);
    
    res.json({
      stationId: station,
      slackWater: slackTimes,
      recommendations: generateSlackWaterRecommendations(slackTimes)
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to find slack water');
    res.status(500).json({ 
      error: 'Failed to find slack water',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analyze current impact on passage
app.post('/tools/analyze_current_impact', async (req, res) => {
  try {
    const { route, departureTime, boatSpeed } = req.body;
    logger.info({ waypoints: route.length }, 'Analyzing current impact');
    
    // Calculate passage times for each segment
    const segments = [];
    let currentTime = new Date(departureTime);
    
    for (let i = 0; i < route.length - 1; i++) {
      const start = route[i];
      const end = route[i + 1];
      const distance = calculateDistance(start, end);
      const baseTime = distance / boatSpeed; // hours
      
      // Get current at midpoint
      const midpoint = {
        latitude: (start.latitude + end.latitude) / 2,
        longitude: (start.longitude + end.longitude) / 2
      };
      
      const current = await getCurrentAtLocation(midpoint, currentTime.toISOString());
      
      // Calculate impact
      const bearing = calculateBearing(start, end);
      const currentImpact = calculateCurrentImpact(
        current,
        bearing,
        boatSpeed
      );
      
      segments.push({
        from: i,
        to: i + 1,
        distance,
        baseTime,
        current,
        impact: currentImpact,
        adjustedTime: baseTime * (1 + currentImpact.timeFactor),
        adjustedSpeed: boatSpeed + currentImpact.speedChange
      });
      
      // Update time for next segment
      currentTime = new Date(currentTime.getTime() + segments[i].adjustedTime * 3600000);
    }
    
    res.json({
      segments,
      totalImpact: summarizeCurrentImpact(segments),
      recommendations: generatePassageRecommendations(segments)
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to analyze current impact');
    res.status(500).json({ 
      error: 'Failed to analyze current impact',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions
async function findNearestCurrentStation(coordinates: any): Promise<string | null> {
  try {
    const response = await axios.get(`${NOAA_METADATA_BASE}/stations`, {
      params: {
        type: 'currentpredictions',
        units: 'english',
        format: 'json'
      }
    });
    
    const stations = response.data.stations || [];
    let nearest = null;
    let minDistance = Infinity;
    
    for (const station of stations) {
      const distance = calculateDistance(
        coordinates,
        { latitude: station.lat, longitude: station.lng }
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearest = station.id;
      }
    }
    
    return minDistance < 50 ? nearest : null; // Within 50nm
    
  } catch (error) {
    logger.error({ error }, 'Failed to find nearest station');
    return null;
  }
}

async function getCurrentsForStation(
  stationId: string,
  start: string,
  end: string
): Promise<any[]> {
  const response = await axios.get(NOAA_API_BASE, {
    params: {
      product: 'currents_predictions',
      station: stationId,
      begin_date: formatDate(start),
      end_date: formatDate(end),
      interval: '6',
      units: 'english',
      time_zone: 'gmt',
      format: 'json'
    }
  });
  
  return response.data.current_predictions || [];
}

function transformCurrentPredictions(data: any): any[] {
  const predictions = data.current_predictions || [];
  
  return predictions.map((p: any) => ({
    time: new Date(p.t),
    speed: parseFloat(p.s),
    direction: parseInt(p.d),
    type: p.type || 'predicted'
  }));
}

function analyzeCurrents(predictions: any[]): any {
  const speeds = predictions.map(p => p.speed);
  const maxSpeed = Math.max(...speeds);
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  
  // Find flood and ebb periods
  const floods = [];
  const ebbs = [];
  let currentPeriod = null;
  
  for (let i = 1; i < predictions.length; i++) {
    const prev = predictions[i - 1];
    const curr = predictions[i];
    
    // Detect direction change (slack water)
    if (Math.abs(curr.direction - prev.direction) > 150) {
      if (currentPeriod) {
        currentPeriod.end = prev.time;
        if (currentPeriod.type === 'flood') {
          floods.push(currentPeriod);
        } else {
          ebbs.push(currentPeriod);
        }
      }
      
      currentPeriod = {
        type: curr.direction < 180 ? 'flood' : 'ebb',
        start: curr.time,
        maxSpeed: curr.speed
      };
    } else if (currentPeriod) {
      currentPeriod.maxSpeed = Math.max(currentPeriod.maxSpeed, curr.speed);
    }
  }
  
  return {
    maxSpeed,
    avgSpeed,
    floods,
    ebbs,
    strongCurrentTimes: predictions.filter(p => p.speed > maxSpeed * 0.8)
  };
}

function interpolateCurrentAtTime(predictions: any[], time: string): any {
  const targetTime = new Date(time).getTime();
  
  // Find surrounding predictions
  let before = null;
  let after = null;
  
  for (let i = 0; i < predictions.length; i++) {
    const predTime = new Date(predictions[i].time).getTime();
    
    if (predTime <= targetTime) {
      before = predictions[i];
    } else if (!after) {
      after = predictions[i];
      break;
    }
  }
  
  if (!before || !after) {
    return before || after || { speed: 0, direction: 0 };
  }
  
  // Linear interpolation
  const ratio = (targetTime - new Date(before.time).getTime()) /
                (new Date(after.time).getTime() - new Date(before.time).getTime());
  
  return {
    speed: before.speed + (after.speed - before.speed) * ratio,
    direction: interpolateDirection(before.direction, after.direction, ratio),
    interpolated: true
  };
}

function interpolateDirection(dir1: number, dir2: number, ratio: number): number {
  // Handle circular interpolation
  let diff = dir2 - dir1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  let result = dir1 + diff * ratio;
  if (result < 0) result += 360;
  if (result >= 360) result -= 360;
  
  return result;
}

function calculateDistance(point1: any, point2: any): number {
  const R = 3440.065; // Nautical miles
  const lat1 = point1.latitude * Math.PI / 180;
  const lat2 = point2.latitude * Math.PI / 180;
  const deltaLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  
  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

function calculateBearing(point1: any, point2: any): number {
  const lat1 = point1.latitude * Math.PI / 180;
  const lat2 = point2.latitude * Math.PI / 180;
  const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function calculateCurrentImpact(current: any, bearing: number, boatSpeed: number): any {
  if (!current || current.speed === 0) {
    return { speedChange: 0, timeFactor: 0, driftAngle: 0 };
  }
  
  // Calculate relative angle
  const relativeAngle = (current.direction - bearing + 360) % 360;
  const angleRad = relativeAngle * Math.PI / 180;
  
  // Component along course
  const alongCourse = current.speed * Math.cos(angleRad);
  const acrossCourse = current.speed * Math.sin(angleRad);
  
  // Speed over ground
  const sog = Math.sqrt(
    Math.pow(boatSpeed + alongCourse, 2) + 
    Math.pow(acrossCourse, 2)
  );
  
  // Drift angle
  const drift = Math.atan2(acrossCourse, boatSpeed + alongCourse) * 180 / Math.PI;
  
  return {
    speedChange: alongCourse,
    timeFactor: (boatSpeed / sog) - 1,
    driftAngle: drift,
    crossTrackError: acrossCourse
  };
}

function findSlackWaterTimes(predictions: any[]): any[] {
  const slackTimes = [];
  const threshold = 0.2; // knots
  
  for (let i = 1; i < predictions.length - 1; i++) {
    const prev = predictions[i - 1];
    const curr = predictions[i];
    const next = predictions[i + 1];
    
    // Look for speed minimum
    if (curr.speed < threshold && 
        curr.speed <= prev.speed && 
        curr.speed <= next.speed) {
      slackTimes.push({
        time: curr.time,
        speed: curr.speed,
        type: determineSlackType(prev, curr, next),
        duration: estimateSlackDuration(predictions, i, threshold)
      });
    }
  }
  
  return slackTimes;
}

function determineSlackType(prev: any, curr: any, next: any): string {
  // Check direction change
  const dirChange = Math.abs(next.direction - prev.direction);
  
  if (dirChange > 150) {
    return next.direction < 180 ? 'before_flood' : 'before_ebb';
  }
  
  return 'slack_water';
}

function estimateSlackDuration(predictions: any[], index: number, threshold: number): number {
  let startIndex = index;
  let endIndex = index;
  
  // Find start of slack period
  while (startIndex > 0 && predictions[startIndex - 1].speed < threshold) {
    startIndex--;
  }
  
  // Find end of slack period
  while (endIndex < predictions.length - 1 && predictions[endIndex + 1].speed < threshold) {
    endIndex++;
  }
  
  const startTime = new Date(predictions[startIndex].time).getTime();
  const endTime = new Date(predictions[endIndex].time).getTime();
  
  return (endTime - startTime) / 60000; // minutes
}

async function getCurrentAtLocation(coordinates: any, time: string): Promise<any> {
  const stationId = await findNearestCurrentStation(coordinates);
  if (!stationId) {
    return { speed: 0, direction: 0 };
  }
  
  const predictions = await getCurrentsForStation(
    stationId,
    time,
    new Date(new Date(time).getTime() + 6 * 3600000).toISOString()
  );
  
  return interpolateCurrentAtTime(predictions, time);
}

function summarizeCurrentPatterns(patterns: any[]): any {
  const speeds = patterns.map(p => p.current.speed);
  const maxCurrent = Math.max(...speeds);
  const avgCurrent = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  
  return {
    maxCurrent,
    avgCurrent,
    favorableSegments: patterns.filter(p => p.current.speedChange > 0.5).length,
    adverseSegments: patterns.filter(p => p.current.speedChange < -0.5).length
  };
}

function generateCurrentRecommendations(patterns: any[]): string[] {
  const recommendations = [];
  const maxCurrent = Math.max(...patterns.map(p => p.current.speed));
  
  if (maxCurrent > 2) {
    recommendations.push('Strong currents detected - plan departure times carefully');
  }
  
  const adverseCount = patterns.filter(p => p.current.speedChange < -1).length;
  if (adverseCount > patterns.length / 2) {
    recommendations.push('Consider alternative timing to avoid adverse currents');
  }
  
  return recommendations;
}

function generateSlackWaterRecommendations(slackTimes: any[]): string[] {
  const recommendations = [];
  
  if (slackTimes.length > 0) {
    recommendations.push(`${slackTimes.length} slack water periods available`);
    
    const longSlacks = slackTimes.filter(s => s.duration > 30);
    if (longSlacks.length > 0) {
      recommendations.push(`${longSlacks.length} extended slack periods (>30 min) for easier navigation`);
    }
  }
  
  return recommendations;
}

function summarizeCurrentImpact(segments: any[]): any {
  const totalBase = segments.reduce((sum, s) => sum + s.baseTime, 0);
  const totalAdjusted = segments.reduce((sum, s) => sum + s.adjustedTime, 0);
  
  return {
    baseTime: totalBase,
    adjustedTime: totalAdjusted,
    timeDifference: totalAdjusted - totalBase,
    percentChange: ((totalAdjusted - totalBase) / totalBase) * 100
  };
}

function generatePassageRecommendations(segments: any[]): string[] {
  const recommendations = [];
  const impact = summarizeCurrentImpact(segments);
  
  if (impact.percentChange > 20) {
    recommendations.push('Significant current impact - consider departure time adjustment');
  }
  
  const strongAdverse = segments.filter(s => s.impact.speedChange < -2);
  if (strongAdverse.length > 0) {
    recommendations.push(`${strongAdverse.length} segments with strong adverse current`);
  }
  
  return recommendations;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function getCached(key: string): any {
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any, ttlSeconds: number) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000
  });
  
  // Clean old entries
  for (const [k, v] of cache.entries()) {
    if (v.expiry < Date.now()) {
      cache.delete(k);
    }
  }
}

// Start server
const PORT = process.env.PORT || 8108;
app.listen(PORT, () => {
  logger.info(`Currents agent listening on port ${PORT}`);
}); 