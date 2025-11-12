/**
 * Great Circle Routing Service
 * Calculates optimal ocean routes using great circle and rhumb line comparisons
 * FREE - No external API required
 */

interface Coordinate {
  latitude: number;
  longitude: number;
  name?: string;
}

interface RouteAnalysis {
  greatCircleDistance: number;
  rhumbLineDistance: number;
  recommendedRoute: 'great-circle' | 'rhumb-line';
  savings: number; // nautical miles saved
  initialBearing: number;
  finalBearing: number;
  midpoint: Coordinate;
  routeType: 'coastal' | 'ocean' | 'trans-ocean';
}

/**
 * Calculate both great circle and rhumb line routes
 * Choose optimal based on distance
 */
export function analyzeRoute(start: Coordinate, end: Coordinate): RouteAnalysis {
  const gcDistance = calculateGreatCircleDistance(start, end);
  const rlDistance = calculateRhumbLineDistance(start, end);
  const savings = rlDistance - gcDistance;

  // For short routes (<100nm), rhumb line is simpler and difference is minimal
  // For long routes (>100nm), great circle saves significant distance
  const recommendedRoute = gcDistance < 100 || savings < 5
    ? 'rhumb-line'
    : 'great-circle';

  const routeType = gcDistance < 100
    ? 'coastal'
    : gcDistance < 500
    ? 'ocean'
    : 'trans-ocean';

  return {
    greatCircleDistance: Math.round(gcDistance * 10) / 10,
    rhumbLineDistance: Math.round(rlDistance * 10) / 10,
    recommendedRoute,
    savings: Math.round(savings * 10) / 10,
    initialBearing: calculateInitialBearing(start, end),
    finalBearing: calculateFinalBearing(start, end),
    midpoint: calculateMidpoint(start, end),
    routeType
  };
}

/**
 * Great circle distance using haversine formula
 */
function calculateGreatCircleDistance(p1: Coordinate, p2: Coordinate): number {
  const R = 3440.1; // Earth radius in nautical miles
  const φ1 = p1.latitude * Math.PI / 180;
  const φ2 = p2.latitude * Math.PI / 180;
  const Δφ = (p2.latitude - p1.latitude) * Math.PI / 180;
  const Δλ = (p2.longitude - p1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Rhumb line distance (constant bearing)
 */
function calculateRhumbLineDistance(p1: Coordinate, p2: Coordinate): number {
  const R = 3440.1; // Earth radius in nautical miles
  const φ1 = p1.latitude * Math.PI / 180;
  const φ2 = p2.latitude * Math.PI / 180;
  const Δφ = φ2 - φ1;
  let Δλ = Math.abs(p2.longitude - p1.longitude) * Math.PI / 180;

  // Adjust for crossing antimeridian
  if (Math.abs(Δλ) > Math.PI) {
    Δλ = Δλ > 0 ? -(2 * Math.PI - Δλ) : (2 * Math.PI + Δλ);
  }

  const Δψ = Math.log(Math.tan(φ2 / 2 + Math.PI / 4) / Math.tan(φ1 / 2 + Math.PI / 4));
  const q = Math.abs(Δψ) > 10e-12 ? Δφ / Δψ : Math.cos(φ1);

  const δ = Math.sqrt(Δφ * Δφ + q * q * Δλ * Δλ);
  
  return δ * R;
}

/**
 * Calculate initial bearing for great circle route
 */
function calculateInitialBearing(p1: Coordinate, p2: Coordinate): number {
  const φ1 = p1.latitude * Math.PI / 180;
  const φ2 = p2.latitude * Math.PI / 180;
  const Δλ = (p2.longitude - p1.longitude) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  const θ = Math.atan2(y, x);
  
  return ((θ * 180 / Math.PI) + 360) % 360; // Normalize to 0-360
}

/**
 * Calculate final bearing (for great circle, bearing changes)
 */
function calculateFinalBearing(p1: Coordinate, p2: Coordinate): number {
  // Final bearing is the initial bearing from destination to start, reversed
  const reverseBearing = calculateInitialBearing(p2, p1);
  return (reverseBearing + 180) % 360;
}

/**
 * Calculate midpoint of great circle route
 */
function calculateMidpoint(p1: Coordinate, p2: Coordinate): Coordinate {
  const φ1 = p1.latitude * Math.PI / 180;
  const λ1 = p1.longitude * Math.PI / 180;
  const φ2 = p2.latitude * Math.PI / 180;
  const Δλ = (p2.longitude - p1.longitude) * Math.PI / 180;

  const Bx = Math.cos(φ2) * Math.cos(Δλ);
  const By = Math.cos(φ2) * Math.sin(Δλ);
  
  const φ3 = Math.atan2(
    Math.sin(φ1) + Math.sin(φ2),
    Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By)
  );
  
  const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);

  return {
    latitude: φ3 * 180 / Math.PI,
    longitude: λ3 * 180 / Math.PI,
    name: 'Route midpoint'
  };
}

/**
 * Generate waypoints along great circle route
 */
export function generateGreatCircleWaypoints(
  start: Coordinate,
  end: Coordinate,
  numWaypoints: number = 5
): Coordinate[] {
  const waypoints: Coordinate[] = [start];
  
  const d = calculateGreatCircleDistance(start, end) / 3440.1; // in radians
  
  for (let i = 1; i < numWaypoints; i++) {
    const f = i / numWaypoints;
    const waypoint = intermediatePoint(start, end, f);
    waypoints.push(waypoint);
  }
  
  waypoints.push(end);
  return waypoints;
}

/**
 * Calculate intermediate point along great circle
 */
function intermediatePoint(p1: Coordinate, p2: Coordinate, fraction: number): Coordinate {
  const φ1 = p1.latitude * Math.PI / 180;
  const λ1 = p1.longitude * Math.PI / 180;
  const φ2 = p2.latitude * Math.PI / 180;
  const λ2 = p2.longitude * Math.PI / 180;

  const δ = calculateGreatCircleDistance(p1, p2) / 3440.1; // angular distance

  const a = Math.sin((1 - fraction) * δ) / Math.sin(δ);
  const b = Math.sin(fraction * δ) / Math.sin(δ);

  const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
  const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
  const z = a * Math.sin(φ1) + b * Math.sin(φ2);

  const φ3 = Math.atan2(z, Math.sqrt(x * x + y * y));
  const λ3 = Math.atan2(y, x);

  return {
    latitude: φ3 * 180 / Math.PI,
    longitude: λ3 * 180 / Math.PI,
    name: `Waypoint ${Math.round(fraction * 100)}%`
  };
}

