// agents/anchorages/src/index.ts
// Anchorages Agent - Provides safe anchoring locations and analysis

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

// Cache for API responses
const cache = new Map<string, { data: any; expiry: number }>();

// Anchorage database (in production, this would be in PostgreSQL)
const ANCHORAGES_DB = [
  {
    id: 'anc-001',
    name: 'Cuttyhunk Pond',
    coordinates: { latitude: 41.4142, longitude: -70.9005 },
    description: 'Well-protected harbor, popular in summer',
    depth: { min: 12, max: 25, unit: 'feet' },
    holding: 'Good in mud',
    protection: { N: true, S: true, E: true, W: true },
    amenities: ['dinghy_dock', 'water', 'fuel'],
    capacity: 50,
    restrictions: ['No anchoring in mooring field'],
    tides: { range: 4 },
    approach: 'Enter from south, watch for rocks on east side'
  },
  {
    id: 'anc-002',
    name: 'Block Island - Great Salt Pond',
    coordinates: { latitude: 41.1633, longitude: -71.5783 },
    description: 'Large protected pond, very popular',
    depth: { min: 8, max: 20, unit: 'feet' },
    holding: 'Good in sand and mud',
    protection: { N: true, S: true, E: true, W: true },
    amenities: ['dinghy_dock', 'water', 'fuel', 'provisions', 'restaurants'],
    capacity: 200,
    restrictions: ['Speed limit 5 knots', 'Anchoring fee required'],
    tides: { range: 3 },
    approach: 'Enter through channel, follow markers'
  }
  // In production, this would be a comprehensive database
];

// Input schemas
const FindAnchoragesSchema = z.object({
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number()
  }),
  radius: z.number().optional().default(50), // nautical miles
  criteria: z.object({
    minDepth: z.number().optional(),
    maxDepth: z.number().optional(),
    protection: z.array(z.enum(['N', 'S', 'E', 'W'])).optional(),
    amenities: z.array(z.string()).optional(),
    minCapacity: z.number().optional()
  }).optional()
});

const AnalyzeAnchorageSchema = z.object({
  anchorageId: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional(),
  weather: z.object({
    windDirection: z.string(),
    windSpeed: z.number(),
    waveHeight: z.number()
  }),
  vessel: z.object({
    draft: z.number(),
    length: z.number(),
    type: z.enum(['sailboat', 'powerboat', 'catamaran'])
  })
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'anchorages-agent',
    timestamp: new Date().toISOString()
  });
});

// Capabilities endpoint
app.get('/capabilities', (req, res) => {
  res.json({
    name: 'Anchorages Agent',
    version: '1.0.0',
    description: 'Provides safe anchoring locations and analysis',
    capabilities: [
      'find_anchorages',
      'analyze_anchorage',
      'get_anchorage_details',
      'check_anchoring_conditions'
    ]
  });
});

// Find anchorages near a location
app.post('/tools/find_anchorages', async (req, res) => {
  try {
    const input = FindAnchoragesSchema.parse(req.body);
    logger.info({ input }, 'Finding anchorages');
    
    // Filter anchorages by distance and criteria
    const nearbyAnchorages = ANCHORAGES_DB.filter(anchorage => {
      const distance = calculateDistance(input.coordinates, anchorage.coordinates);
      if (distance > input.radius) return false;
      
      // Apply criteria filters
      if (input.criteria) {
        const { minDepth, maxDepth, protection, amenities, minCapacity } = input.criteria;
        
        if (minDepth && anchorage.depth.min < minDepth) return false;
        if (maxDepth && anchorage.depth.max > maxDepth) return false;
        if (minCapacity && anchorage.capacity < minCapacity) return false;
        
        if (protection && protection.length > 0) {
          const hasProtection = protection.every(dir => 
            anchorage.protection[dir as keyof typeof anchorage.protection]
          );
          if (!hasProtection) return false;
        }
        
        if (amenities && amenities.length > 0) {
          const hasAmenities = amenities.every(amenity =>
            anchorage.amenities.includes(amenity)
          );
          if (!hasAmenities) return false;
        }
      }
      
      return true;
    });
    
    // Sort by distance
    const sorted = nearbyAnchorages.map(anchorage => ({
      ...anchorage,
      distance: calculateDistance(input.coordinates, anchorage.coordinates)
    })).sort((a, b) => a.distance - b.distance);
    
    // Get current conditions for each anchorage
    const anchoragesWithConditions = await Promise.all(
      sorted.map(async (anchorage) => {
        const conditions = await getCurrentConditions(anchorage.coordinates);
        return {
          ...anchorage,
          currentConditions: conditions,
          suitability: assessSuitability(anchorage, conditions)
        };
      })
    );
    
    res.json({
      anchorages: anchoragesWithConditions,
      total: anchoragesWithConditions.length,
      searchRadius: input.radius
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to find anchorages');
    res.status(500).json({ 
      error: 'Failed to find anchorages',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analyze specific anchorage for conditions
app.post('/tools/analyze_anchorage', async (req, res) => {
  try {
    const input = AnalyzeAnchorageSchema.parse(req.body);
    logger.info({ input }, 'Analyzing anchorage');
    
    // Find anchorage
    let anchorage;
    if (input.anchorageId) {
      anchorage = ANCHORAGES_DB.find(a => a.id === input.anchorageId);
    } else if (input.coordinates) {
      anchorage = findNearestAnchorage(input.coordinates);
    }
    
    if (!anchorage) {
      return res.status(404).json({ error: 'Anchorage not found' });
    }
    
    // Analyze conditions
    const analysis = {
      anchorage,
      conditions: input.weather,
      vessel: input.vessel,
      analysis: {
        depthSuitable: analyzeDepth(anchorage, input.vessel),
        protectionAdequate: analyzeProtection(anchorage, input.weather),
        holdingAdequate: analyzeHolding(anchorage, input.weather),
        swingRoom: calculateSwingRoom(anchorage, input.vessel),
        overall: overallAssessment(anchorage, input.weather, input.vessel)
      },
      recommendations: generateRecommendations(anchorage, input.weather, input.vessel)
    };
    
    res.json(analysis);
    
  } catch (error) {
    logger.error({ error }, 'Failed to analyze anchorage');
    res.status(500).json({ 
      error: 'Failed to analyze anchorage',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get detailed anchorage information
app.post('/tools/get_anchorage_details', async (req, res) => {
  try {
    const { anchorageId, includeReviews } = req.body;
    logger.info({ anchorageId }, 'Getting anchorage details');
    
    const anchorage = ANCHORAGES_DB.find(a => a.id === anchorageId);
    if (!anchorage) {
      return res.status(404).json({ error: 'Anchorage not found' });
    }
    
    // Get current conditions
    const conditions = await getCurrentConditions(anchorage.coordinates);
    
    // Get tide information
    const tides = await getTideInfo(anchorage.coordinates);
    
    // In production, would fetch real reviews
    const reviews = includeReviews ? generateMockReviews(anchorageId) : [];
    
    res.json({
      ...anchorage,
      currentConditions: conditions,
      tides,
      reviews,
      nearbyServices: findNearbyServices(anchorage.coordinates),
      chartReference: getChartReference(anchorage.coordinates)
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to get anchorage details');
    res.status(500).json({ 
      error: 'Failed to get anchorage details',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check anchoring conditions for a route
app.post('/tools/check_anchoring_conditions', async (req, res) => {
  try {
    const { route, vessel, preferences } = req.body;
    logger.info({ waypoints: route.length }, 'Checking anchoring conditions');
    
    // Find potential anchorages along the route
    const potentialStops = [];
    
    for (let i = 0; i < route.length - 1; i++) {
      const start = route[i];
      const end = route[i + 1];
      
      // Find anchorages between waypoints
      const midpoint = {
        latitude: (start.latitude + end.latitude) / 2,
        longitude: (start.longitude + end.longitude) / 2
      };
      
      const distance = calculateDistance(start, end);
      const searchRadius = Math.min(distance / 2, 25); // Max 25nm off route
      
      const anchorages = ANCHORAGES_DB.filter(anchorage => {
        const distToRoute = calculateDistanceToRoute(anchorage.coordinates, start, end);
        return distToRoute <= searchRadius;
      });
      
      if (anchorages.length > 0) {
        potentialStops.push({
          segment: i,
          from: start,
          to: end,
          anchorages: anchorages.map(a => ({
            ...a,
            distanceOffRoute: calculateDistanceToRoute(a.coordinates, start, end),
            addedDistance: calculateAddedDistance(start, a.coordinates, end)
          }))
        });
      }
    }
    
    // Analyze each potential stop
    const analyzed = await Promise.all(
      potentialStops.map(async (stop) => {
        const conditions = await getCurrentConditions(stop.from);
        return {
          ...stop,
          conditions,
          recommendations: stop.anchorages
            .filter(a => isAnchorageSuitable(a, vessel, preferences))
            .sort((a, b) => a.addedDistance - b.addedDistance)
            .slice(0, 3) // Top 3 options
        };
      })
    );
    
    res.json({
      potentialStops: analyzed,
      summary: summarizeAnchorageOptions(analyzed),
      emergencyAnchorages: findEmergencyAnchorages(route)
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to check anchoring conditions');
    res.status(500).json({ 
      error: 'Failed to check anchoring conditions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions
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

function calculateDistanceToRoute(point: any, start: any, end: any): number {
  // Simplified - in production would use proper great circle calculations
  const crossTrack = calculateCrossTrackDistance(point, start, end);
  return Math.abs(crossTrack);
}

function calculateCrossTrackDistance(point: any, start: any, end: any): number {
  // Simplified cross-track distance calculation
  const R = 3440.065;
  const d13 = calculateDistance(start, point) / R;
  const brng13 = calculateBearing(start, point) * Math.PI / 180;
  const brng12 = calculateBearing(start, end) * Math.PI / 180;
  
  const crossTrack = Math.asin(Math.sin(d13) * Math.sin(brng13 - brng12)) * R;
  return crossTrack;
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

function calculateAddedDistance(start: any, anchorage: any, end: any): number {
  const direct = calculateDistance(start, end);
  const viaAnchorage = calculateDistance(start, anchorage) + calculateDistance(anchorage, end);
  return viaAnchorage - direct;
}

async function getCurrentConditions(coordinates: any): Promise<any> {
  // In production, would fetch from weather service
  return {
    wind: { direction: 'SW', speed: 15 },
    waves: { height: 3, period: 8, direction: 'S' },
    visibility: 10,
    timestamp: new Date()
  };
}

function assessSuitability(anchorage: any, conditions: any): string {
  const windSpeed = conditions.wind?.speed || 0;
  const waveHeight = conditions.waves?.height || 0;
  
  if (windSpeed > 25 || waveHeight > 6) {
    return 'poor';
  } else if (windSpeed > 15 || waveHeight > 4) {
    return 'fair';
  } else {
    return 'good';
  }
}

function findNearestAnchorage(coordinates: any): any {
  let nearest = null;
  let minDistance = Infinity;
  
  for (const anchorage of ANCHORAGES_DB) {
    const distance = calculateDistance(coordinates, anchorage.coordinates);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = anchorage;
    }
  }
  
  return nearest;
}

function analyzeDepth(anchorage: any, vessel: any): any {
  const requiredDepth = vessel.draft + 5; // 5 feet under keel
  const tideFactor = anchorage.tides?.range || 0;
  
  return {
    suitable: anchorage.depth.min - tideFactor >= requiredDepth,
    minDepth: anchorage.depth.min,
    lowTideDepth: anchorage.depth.min - tideFactor,
    requiredDepth,
    margin: anchorage.depth.min - tideFactor - requiredDepth
  };
}

function analyzeProtection(anchorage: any, weather: any): any {
  const windDir = compassToDirection(weather.windDirection);
  const hasProtection = anchorage.protection[windDir];
  
  return {
    adequate: hasProtection,
    windDirection: weather.windDirection,
    protectedFrom: Object.keys(anchorage.protection).filter(dir => 
      anchorage.protection[dir as keyof typeof anchorage.protection]
    )
  };
}

function analyzeHolding(anchorage: any, weather: any): any {
  const windSpeed = weather.windSpeed;
  const holdingPower = getHoldingPower(anchorage.holding);
  
  return {
    adequate: holdingPower >= getRequiredHolding(windSpeed),
    holding: anchorage.holding,
    windSpeed,
    recommendation: windSpeed > 20 ? 'Use two anchors or seek better shelter' : 'Single anchor sufficient'
  };
}

function calculateSwingRoom(anchorage: any, vessel: any): any {
  const scope = 7; // 7:1 scope
  const rodeLength = anchorage.depth.max * scope;
  const swingRadius = Math.sqrt(Math.pow(rodeLength, 2) - Math.pow(anchorage.depth.max, 2)) + vessel.length;
  
  return {
    radius: Math.round(swingRadius),
    scope,
    rodeLength: Math.round(rodeLength),
    adequate: swingRadius < 200 // Assuming 200ft is safe in most anchorages
  };
}

function overallAssessment(anchorage: any, weather: any, vessel: any): string {
  const depth = analyzeDepth(anchorage, vessel);
  const protection = analyzeProtection(anchorage, weather);
  const holding = analyzeHolding(anchorage, weather);
  
  if (!depth.suitable || !protection.adequate || !holding.adequate) {
    return 'not recommended';
  } else if (weather.windSpeed > 20) {
    return 'marginal';
  } else {
    return 'recommended';
  }
}

function generateRecommendations(anchorage: any, weather: any, vessel: any): string[] {
  const recommendations = [];
  const depth = analyzeDepth(anchorage, vessel);
  const protection = analyzeProtection(anchorage, weather);
  
  if (!depth.suitable) {
    recommendations.push(`Insufficient depth - wait for high tide or find deeper anchorage`);
  }
  
  if (!protection.adequate) {
    recommendations.push(`Exposed to ${weather.windDirection} winds - monitor conditions closely`);
  }
  
  if (weather.windSpeed > 15) {
    recommendations.push('Set anchor carefully and consider using anchor alarm');
  }
  
  if (anchorage.restrictions.length > 0) {
    recommendations.push(`Note restrictions: ${anchorage.restrictions.join(', ')}`);
  }
  
  return recommendations;
}

function compassToDirection(compass: string): string {
  const directions: Record<string, string> = {
    'N': 'N', 'NNE': 'N', 'NE': 'N', 'ENE': 'E',
    'E': 'E', 'ESE': 'E', 'SE': 'S', 'SSE': 'S',
    'S': 'S', 'SSW': 'S', 'SW': 'W', 'WSW': 'W',
    'W': 'W', 'WNW': 'W', 'NW': 'N', 'NNW': 'N'
  };
  return directions[compass] || 'N';
}

function getHoldingPower(description: string): number {
  if (description.includes('excellent') || description.includes('clay')) return 5;
  if (description.includes('good') || description.includes('mud')) return 4;
  if (description.includes('fair') || description.includes('sand')) return 3;
  if (description.includes('poor') || description.includes('rock')) return 2;
  return 1;
}

function getRequiredHolding(windSpeed: number): number {
  if (windSpeed < 15) return 2;
  if (windSpeed < 25) return 3;
  if (windSpeed < 35) return 4;
  return 5;
}

async function getTideInfo(coordinates: any): Promise<any> {
  // In production, would fetch from tidal service
  return {
    current: { height: 5.2, time: new Date() },
    nextHigh: { height: 9.8, time: new Date(Date.now() + 6 * 3600000) },
    nextLow: { height: 0.5, time: new Date(Date.now() + 12 * 3600000) },
    range: 9.3
  };
}

function generateMockReviews(anchorageId: string): any[] {
  return [
    {
      author: 'SailorJohn',
      date: '2024-08-15',
      rating: 4,
      comment: 'Good holding, but crowded in summer weekends'
    },
    {
      author: 'CruisingCouple',
      date: '2024-07-20',
      rating: 5,
      comment: 'Excellent protection, easy dinghy access to town'
    }
  ];
}

function findNearbyServices(coordinates: any): any[] {
  // In production, would query services database
  return [
    { type: 'fuel', name: 'Marina Fuel Dock', distance: 0.5 },
    { type: 'provisions', name: 'Harbor Market', distance: 0.8 },
    { type: 'repair', name: 'Boat Works', distance: 1.2 }
  ];
}

function getChartReference(coordinates: any): any {
  // In production, would return actual chart numbers
  return {
    noaa: '13218',
    detail: 'Harbor Chart 13218-1',
    note: 'Check latest Notice to Mariners'
  };
}

function isAnchorageSuitable(anchorage: any, vessel: any, preferences: any): boolean {
  if (anchorage.depth.min < vessel.draft + 5) return false;
  if (preferences?.minAmenities) {
    const hasRequired = preferences.minAmenities.every((a: string) => 
      anchorage.amenities.includes(a)
    );
    if (!hasRequired) return false;
  }
  return true;
}

function summarizeAnchorageOptions(stops: any[]): any {
  const totalOptions = stops.reduce((sum, stop) => sum + stop.anchorages.length, 0);
  const withGoodOptions = stops.filter(stop => stop.recommendations.length > 0).length;
  
  return {
    totalSegments: stops.length,
    segmentsWithAnchorages: withGoodOptions,
    totalAnchorages: totalOptions,
    recommendation: withGoodOptions > 0 ? 
      'Multiple anchoring options available' : 
      'Limited anchoring options - plan fuel and provisions carefully'
  };
}

function findEmergencyAnchorages(route: any[]): any[] {
  // Find all anchorages within 10nm of route
  const emergency = [];
  
  for (let i = 0; i < route.length - 1; i++) {
    const nearbyAnchorages = ANCHORAGES_DB.filter(anchorage => {
      const dist = calculateDistanceToRoute(anchorage.coordinates, route[i], route[i + 1]);
      return dist <= 10;
    });
    
    emergency.push(...nearbyAnchorages.map(a => ({
      ...a,
      nearestRouteSegment: i,
      distanceFromRoute: calculateDistanceToRoute(a.coordinates, route[i], route[i + 1])
    })));
  }
  
  // Remove duplicates and sort by protection
  const unique = Array.from(new Map(emergency.map(a => [a.id, a])).values());
  return unique.sort((a, b) => {
    const aProtection = Object.values(a.protection).filter(p => p).length;
    const bProtection = Object.values(b.protection).filter(p => p).length;
    return bProtection - aProtection;
  });
}

// Start server
const PORT = process.env.PORT || 8109;
app.listen(PORT, () => {
  logger.info(`Anchorages agent listening on port ${PORT}`);
}); 