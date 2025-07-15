// agents/fuel/src/index.ts
// Fuel Planning Agent - Provides fuel consumption calculations and planning

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

// Input schemas
const FuelCalculationSchema = z.object({
  vessel: z.object({
    type: z.enum(['powerboat', 'sailboat', 'catamaran']),
    engines: z.array(z.object({
      make: z.string(),
      model: z.string(),
      horsepower: z.number(),
      fuelType: z.enum(['diesel', 'gasoline']),
      cruiseRPM: z.number(),
      maxRPM: z.number()
    })),
    fuelCapacity: z.number(), // gallons
    auxiliaryFuelCapacity: z.number().optional()
  }),
  route: z.array(z.object({
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    }),
    name: z.string().optional()
  })),
  cruiseSpeed: z.number(), // knots
  weatherFactor: z.number().optional().default(1.1), // 10% weather margin
  reserveFactor: z.number().optional().default(0.2) // 20% reserve
});

const FuelStopSchema = z.object({
  route: z.array(z.object({
    latitude: z.number(),
    longitude: z.number()
  })),
  range: z.number(), // nautical miles
  currentFuel: z.number(), // gallons
  fuelCapacity: z.number()
});

// Fuel consumption database (in production, would be comprehensive)
const FUEL_CONSUMPTION_DATA = {
  diesel: {
    economy: 0.05, // gallons per HP per hour at cruise
    specific_gravity: 0.85
  },
  gasoline: {
    economy: 0.08, // gallons per HP per hour at cruise
    specific_gravity: 0.72
  }
};

// Fuel stop database (in production, would be from marina database)
const FUEL_STOPS = [
  {
    id: 'fuel-001',
    name: 'Boston Yacht Haven',
    coordinates: { latitude: 42.3601, longitude: -71.0500 },
    fuelTypes: ['diesel', 'gasoline'],
    hours: '0800-1700',
    approach: 'VHF 9',
    services: ['pump_out', 'water']
  },
  {
    id: 'fuel-002',
    name: 'Portland Yacht Services',
    coordinates: { latitude: 43.6591, longitude: -70.2468 },
    fuelTypes: ['diesel', 'gasoline'],
    hours: '0700-1800',
    approach: 'VHF 10',
    services: ['pump_out', 'water', 'ice']
  }
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'fuel-agent',
    timestamp: new Date().toISOString()
  });
});

// Capabilities endpoint
app.get('/capabilities', (req, res) => {
  res.json({
    name: 'Fuel Planning Agent',
    version: '1.0.0',
    description: 'Provides fuel consumption calculations and planning',
    capabilities: [
      'calculate_fuel_consumption',
      'find_fuel_stops',
      'plan_fuel_strategy',
      'estimate_range'
    ]
  });
});

// Calculate fuel consumption for a route
app.post('/tools/calculate_fuel_consumption', async (req, res) => {
  try {
    const input = FuelCalculationSchema.parse(req.body);
    logger.info({ vessel: input.vessel.type }, 'Calculating fuel consumption');
    
    // Calculate total distance
    let totalDistance = 0;
    const segments = [];
    
    for (let i = 0; i < input.route.length - 1; i++) {
      const distance = calculateDistance(input.route[i].coordinates, input.route[i + 1].coordinates);
      segments.push({
        from: input.route[i].name || `Point ${i}`,
        to: input.route[i + 1].name || `Point ${i + 1}`,
        distance,
        time: distance / input.cruiseSpeed,
        fuelConsumption: 0 // Will calculate below
      });
      totalDistance += distance;
    }
    
    // Calculate fuel consumption
    const totalHP = input.vessel.engines.reduce((sum, engine) => sum + engine.horsepower, 0);
    const avgEconomy = calculateAverageEconomy(input.vessel.engines);
    const baseConsumption = totalHP * avgEconomy * (totalDistance / input.cruiseSpeed);
    const weatherAdjusted = baseConsumption * input.weatherFactor;
    const totalRequired = weatherAdjusted * (1 + input.reserveFactor);
    
    // Update segment fuel consumption
    segments.forEach(segment => {
      segment.fuelConsumption = (segment.distance / totalDistance) * weatherAdjusted;
    });
    
    // Calculate range
    const range = calculateRange(input.vessel, input.cruiseSpeed);
    
    const result = {
      route: {
        totalDistance,
        totalTime: totalDistance / input.cruiseSpeed,
        segments
      },
      consumption: {
        baseConsumption,
        weatherAdjusted,
        totalRequired,
        reserve: totalRequired - weatherAdjusted,
        unit: 'gallons'
      },
      vessel: {
        fuelCapacity: input.vessel.fuelCapacity,
        range: {
          theoretical: range.theoretical,
          practical: range.practical,
          withReserve: range.withReserve
        }
      },
      analysis: {
        sufficient: totalRequired <= input.vessel.fuelCapacity,
        margin: input.vessel.fuelCapacity - totalRequired,
        refuelRequired: totalRequired > input.vessel.fuelCapacity
      },
      recommendations: generateFuelRecommendations(
        totalRequired,
        input.vessel.fuelCapacity,
        totalDistance,
        range
      )
    };
    
    res.json(result);
    
  } catch (error) {
    logger.error({ error }, 'Failed to calculate fuel consumption');
    res.status(500).json({ 
      error: 'Failed to calculate fuel consumption',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Find fuel stops along a route
app.post('/tools/find_fuel_stops', async (req, res) => {
  try {
    const input = FuelStopSchema.parse(req.body);
    logger.info({ points: input.route.length }, 'Finding fuel stops');
    
    // Find fuel stops within range of route
    const availableStops = [];
    
    for (let i = 0; i < input.route.length - 1; i++) {
      const segmentStops = FUEL_STOPS.filter(stop => {
        const distToRoute = calculateDistanceToRoute(
          stop.coordinates,
          input.route[i],
          input.route[i + 1]
        );
        return distToRoute <= 10; // Within 10nm of route
      }).map(stop => ({
        ...stop,
        segment: i,
        distanceFromRoute: calculateDistanceToRoute(
          stop.coordinates,
          input.route[i],
          input.route[i + 1]
        ),
        distanceFromStart: calculateRouteDistance(input.route.slice(0, i + 1)) +
          calculateDistance(input.route[i], stop.coordinates),
        addedDistance: calculateAddedDistance(
          input.route[i],
          stop.coordinates,
          input.route[i + 1]
        )
      }));
      
      availableStops.push(...segmentStops);
    }
    
    // Remove duplicates and sort by distance from start
    const uniqueStops = Array.from(
      new Map(availableStops.map(s => [s.id, s])).values()
    ).sort((a, b) => a.distanceFromStart - b.distanceFromStart);
    
    // Analyze fuel strategy
    const strategy = analyzeFuelStrategy(
      input.route,
      uniqueStops,
      input.range,
      input.currentFuel,
      input.fuelCapacity
    );
    
    res.json({
      fuelStops: uniqueStops,
      strategy,
      recommendations: generateStopRecommendations(strategy, input.range)
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to find fuel stops');
    res.status(500).json({ 
      error: 'Failed to find fuel stops',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Plan complete fuel strategy
app.post('/tools/plan_fuel_strategy', async (req, res) => {
  try {
    const { vessel, route, conditions, preferences } = req.body;
    logger.info({ vessel: vessel.type }, 'Planning fuel strategy');
    
    // Calculate consumption for different scenarios
    const scenarios = [
      { name: 'optimal', speed: vessel.economySpeed || vessel.cruiseSpeed * 0.8, factor: 1.0 },
      { name: 'cruise', speed: vessel.cruiseSpeed, factor: 1.1 },
      { name: 'fast', speed: vessel.cruiseSpeed * 1.2, factor: 1.3 }
    ];
    
    const strategies = await Promise.all(scenarios.map(async scenario => {
      const consumption = await calculateScenarioConsumption(
        vessel,
        route,
        scenario.speed,
        scenario.factor
      );
      
      const fuelStops = await findOptimalFuelStops(
        route,
        consumption,
        vessel.fuelCapacity,
        preferences
      );
      
      return {
        scenario: scenario.name,
        speed: scenario.speed,
        consumption,
        fuelStops,
        totalTime: consumption.totalTime,
        totalFuelCost: estimateFuelCost(consumption.totalFuel, vessel.engines[0].fuelType)
      };
    }));
    
    // Select recommended strategy
    const recommended = selectOptimalStrategy(strategies, preferences);
    
    res.json({
      strategies,
      recommended,
      analysis: analyzeStrategies(strategies),
      tips: generateFuelTips(vessel, conditions)
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to plan fuel strategy');
    res.status(500).json({ 
      error: 'Failed to plan fuel strategy',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Estimate range based on current conditions
app.post('/tools/estimate_range', async (req, res) => {
  try {
    const { vessel, currentFuel, conditions, speed } = req.body;
    logger.info({ vessel: vessel.type, fuel: currentFuel }, 'Estimating range');
    
    // Calculate fuel consumption rate
    const consumptionRate = calculateConsumptionRate(vessel, speed || vessel.cruiseSpeed);
    
    // Adjust for conditions
    const conditionFactor = calculateConditionFactor(conditions);
    const adjustedRate = consumptionRate * conditionFactor;
    
    // Calculate ranges
    const ranges = {
      theoretical: currentFuel / consumptionRate * speed,
      practical: currentFuel / adjustedRate * speed,
      withReserve: (currentFuel * 0.8) / adjustedRate * speed,
      toEmpty: currentFuel / adjustedRate * speed
    };
    
    // Find reachable destinations
    const reachableDestinations = findReachableDestinations(
      conditions.currentPosition,
      ranges.withReserve
    );
    
    res.json({
      currentFuel,
      consumptionRate: {
        base: consumptionRate,
        adjusted: adjustedRate,
        unit: 'gallons/hour'
      },
      range: {
        ...ranges,
        unit: 'nautical miles'
      },
      endurance: {
        theoretical: currentFuel / consumptionRate,
        practical: currentFuel / adjustedRate,
        withReserve: (currentFuel * 0.8) / adjustedRate,
        unit: 'hours'
      },
      reachableDestinations,
      recommendations: generateRangeRecommendations(ranges, vessel.fuelCapacity)
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to estimate range');
    res.status(500).json({ 
      error: 'Failed to estimate range',
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

function calculateAverageEconomy(engines: any[]): number {
  const totalHP = engines.reduce((sum, e) => sum + e.horsepower, 0);
  const weightedEconomy = engines.reduce((sum, engine) => {
    const fuelData = FUEL_CONSUMPTION_DATA[engine.fuelType as keyof typeof FUEL_CONSUMPTION_DATA];
    return sum + (engine.horsepower / totalHP) * fuelData.economy;
  }, 0);
  
  return weightedEconomy;
}

function calculateRange(vessel: any, speed: number): any {
  const consumptionRate = calculateConsumptionRate(vessel, speed);
  
  return {
    theoretical: (vessel.fuelCapacity / consumptionRate) * speed,
    practical: (vessel.fuelCapacity * 0.9 / consumptionRate) * speed, // 90% usable
    withReserve: (vessel.fuelCapacity * 0.8 / consumptionRate) * speed // 20% reserve
  };
}

function calculateConsumptionRate(vessel: any, speed: number): number {
  const totalHP = vessel.engines.reduce((sum: number, e: any) => sum + e.horsepower, 0);
  const avgEconomy = calculateAverageEconomy(vessel.engines);
  
  // Adjust for speed (cube law for displacement vessels)
  const speedFactor = vessel.type === 'sailboat' ? 1 : Math.pow(speed / vessel.cruiseSpeed, 2.5);
  
  return totalHP * avgEconomy * speedFactor;
}

function generateFuelRecommendations(required: number, capacity: number, distance: number, range: any): string[] {
  const recommendations = [];
  
  if (required > capacity) {
    recommendations.push(`Fuel stop required - consumption exceeds capacity by ${(required - capacity).toFixed(1)} gallons`);
    const stops = Math.ceil(distance / range.withReserve);
    recommendations.push(`Plan for ${stops} fuel stop(s) along the route`);
  } else {
    const margin = ((capacity - required) / capacity * 100).toFixed(0);
    recommendations.push(`Adequate fuel capacity with ${margin}% margin`);
  }
  
  if (required > capacity * 0.8) {
    recommendations.push('Consider reducing speed for better fuel economy');
  }
  
  return recommendations;
}

function calculateDistanceToRoute(point: any, start: any, end: any): number {
  // Simplified - in production would use proper great circle calculations
  const d = calculateDistance(start, end);
  const a = calculateDistance(start, point);
  const b = calculateDistance(point, end);
  
  // If point is way off the line
  if (a > d || b > d) {
    return Math.min(a, b);
  }
  
  // Use Heron's formula to find height of triangle
  const s = (d + a + b) / 2;
  const area = Math.sqrt(s * (s - d) * (s - a) * (s - b));
  return 2 * area / d;
}

function calculateAddedDistance(start: any, stop: any, end: any): number {
  const direct = calculateDistance(start, end);
  const viaStop = calculateDistance(start, stop) + calculateDistance(stop, end);
  return viaStop - direct;
}

function calculateRouteDistance(points: any[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(points[i], points[i + 1]);
  }
  return total;
}

function analyzeFuelStrategy(route: any[], stops: any[], range: number, currentFuel: number, capacity: number): any {
  const totalDistance = calculateRouteDistance(route);
  const requiredStops = [];
  
  let remainingDistance = totalDistance;
  let currentRange = range * (currentFuel / capacity);
  let position = 0;
  
  while (remainingDistance > currentRange * 0.8) { // 20% reserve
    // Find next suitable stop
    const nextStop = stops.find(stop => 
      stop.distanceFromStart > position &&
      stop.distanceFromStart <= position + currentRange * 0.8
    );
    
    if (nextStop) {
      requiredStops.push(nextStop);
      position = nextStop.distanceFromStart;
      remainingDistance = totalDistance - position;
      currentRange = range; // Full tank after refuel
    } else {
      // No suitable stop found
      break;
    }
  }
  
  return {
    totalDistance,
    requiredStops,
    feasible: remainingDistance <= currentRange * 0.8,
    segments: createFuelSegments(route, requiredStops, range)
  };
}

function createFuelSegments(route: any[], stops: any[], range: number): any[] {
  const segments = [];
  let lastPosition = 0;
  
  for (const stop of stops) {
    segments.push({
      start: lastPosition,
      end: stop.distanceFromStart,
      distance: stop.distanceFromStart - lastPosition,
      fuelStop: stop,
      margin: range - (stop.distanceFromStart - lastPosition)
    });
    lastPosition = stop.distanceFromStart;
  }
  
  // Final segment
  const totalDistance = calculateRouteDistance(route);
  segments.push({
    start: lastPosition,
    end: totalDistance,
    distance: totalDistance - lastPosition,
    fuelStop: null,
    margin: range - (totalDistance - lastPosition)
  });
  
  return segments;
}

function generateStopRecommendations(strategy: any, range: number): string[] {
  const recommendations = [];
  
  if (!strategy.feasible) {
    recommendations.push('Route requires fuel stops beyond available range');
    recommendations.push('Consider alternative route or additional fuel capacity');
  } else if (strategy.requiredStops.length === 0) {
    recommendations.push('No fuel stops required for this route');
  } else {
    recommendations.push(`${strategy.requiredStops.length} fuel stop(s) recommended`);
    
    const minMargin = Math.min(...strategy.segments.map((s: any) => s.margin));
    if (minMargin < range * 0.2) {
      recommendations.push('Warning: Low fuel margin on some segments');
    }
  }
  
  return recommendations;
}

async function calculateScenarioConsumption(vessel: any, route: any[], speed: number, factor: number): Promise<any> {
  const distance = calculateRouteDistance(route);
  const time = distance / speed;
  const consumptionRate = calculateConsumptionRate(vessel, speed);
  const totalFuel = consumptionRate * time * factor;
  
  return {
    distance,
    speed,
    totalTime: time,
    totalFuel,
    consumptionRate,
    milesPerGallon: distance / totalFuel
  };
}

async function findOptimalFuelStops(route: any[], consumption: any, capacity: number, preferences: any): Promise<any[]> {
  // Simplified - in production would use optimization algorithm
  const stops = [];
  const range = capacity / consumption.consumptionRate * consumption.speed * 0.8; // 20% reserve
  
  if (consumption.totalFuel > capacity) {
    const numStops = Math.ceil(consumption.distance / range);
    const interval = consumption.distance / (numStops + 1);
    
    for (let i = 1; i <= numStops; i++) {
      stops.push({
        location: `Fuel Stop ${i}`,
        distance: interval * i,
        estimatedTime: (interval * i) / consumption.speed
      });
    }
  }
  
  return stops;
}

function estimateFuelCost(gallons: number, fuelType: string): number {
  const prices = {
    diesel: 4.50,
    gasoline: 5.00
  };
  return gallons * (prices[fuelType as keyof typeof prices] || 4.50);
}

function selectOptimalStrategy(strategies: any[], preferences: any): any {
  // Simple selection based on preferences
  if (preferences?.priority === 'speed') {
    return strategies.find(s => s.scenario === 'fast');
  } else if (preferences?.priority === 'economy') {
    return strategies.find(s => s.scenario === 'optimal');
  }
  return strategies.find(s => s.scenario === 'cruise');
}

function analyzeStrategies(strategies: any[]): any {
  const costs = strategies.map(s => s.totalFuelCost);
  const times = strategies.map(s => s.totalTime);
  
  return {
    costDifference: Math.max(...costs) - Math.min(...costs),
    timeDifference: Math.max(...times) - Math.min(...times),
    optimalForCost: strategies[costs.indexOf(Math.min(...costs))].scenario,
    optimalForTime: strategies[times.indexOf(Math.min(...times))].scenario
  };
}

function generateFuelTips(vessel: any, conditions: any): string[] {
  const tips = [];
  
  if (vessel.type === 'powerboat') {
    tips.push('Maintain consistent RPM for optimal fuel economy');
    tips.push('Clean hull reduces fuel consumption by up to 10%');
  }
  
  if (conditions?.seaState > 3) {
    tips.push('Reduce speed in rough conditions to save fuel');
  }
  
  tips.push('Monitor fuel flow meters if available');
  tips.push('Keep detailed fuel logs for accurate consumption data');
  
  return tips;
}

function calculateConditionFactor(conditions: any): number {
  let factor = 1.0;
  
  if (conditions?.windSpeed > 20) factor *= 1.2;
  if (conditions?.waveHeight > 4) factor *= 1.15;
  if (conditions?.currentAgainst > 1) factor *= 1.1;
  
  return factor;
}

function findReachableDestinations(position: any, range: number): any[] {
  // In production, would query ports database
  return FUEL_STOPS.filter(stop => {
    const distance = calculateDistance(position, stop.coordinates);
    return distance <= range;
  }).map(stop => ({
    ...stop,
    distance: calculateDistance(position, stop.coordinates),
    fuelMargin: range - calculateDistance(position, stop.coordinates)
  }));
}

function generateRangeRecommendations(ranges: any, capacity: number): string[] {
  const recommendations = [];
  
  if (ranges.withReserve < 50) {
    recommendations.push('Low fuel - seek nearest fuel stop');
  } else if (ranges.withReserve < 100) {
    recommendations.push('Limited range - plan fuel stop soon');
  }
  
  recommendations.push(`Maximum range with reserve: ${ranges.withReserve.toFixed(0)} nm`);
  
  return recommendations;
}

// Start server
const PORT = process.env.PORT || 8110;
app.listen(PORT, () => {
  logger.info(`Fuel planning agent listening on port ${PORT}`);
}); 