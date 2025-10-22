/**
 * Custom assertion helpers for maritime calculations
 * Provides domain-specific validations for safety-critical testing
 */

/**
 * Assert a value is within a percentage tolerance
 * Used for validating navigation calculations with acceptable margins
 */
export function assertWithinTolerance(
  actual: number,
  expected: number,
  tolerancePercent: number,
  context?: string
): void {
  const tolerance = Math.abs(expected * (tolerancePercent / 100));
  const difference = Math.abs(actual - expected);
  
  if (difference > tolerance) {
    const message = context 
      ? `${context}: Expected ${actual} to be within ${tolerancePercent}% of ${expected}, but difference was ${difference.toFixed(4)} (tolerance: ${tolerance.toFixed(4)})`
      : `Expected ${actual} to be within ${tolerancePercent}% of ${expected}`;
    throw new Error(message);
  }
}

/**
 * Assert a value is within an absolute tolerance
 * Used for distance/bearing calculations requiring specific precision
 */
export function assertWithinAbsolute(
  actual: number,
  expected: number,
  tolerance: number,
  unit: string = 'units',
  context?: string
): void {
  const difference = Math.abs(actual - expected);
  
  if (difference > tolerance) {
    const message = context
      ? `${context}: Expected ${actual} ${unit} to be within ${tolerance} ${unit} of ${expected} ${unit}, but difference was ${difference.toFixed(4)} ${unit}`
      : `Expected ${actual} ${unit} to be within ${tolerance} ${unit} of ${expected} ${unit}`;
    throw new Error(message);
  }
}

/**
 * Assert bearing is in valid range (0-360 degrees)
 */
export function assertValidBearing(bearing: number, context?: string): void {
  if (bearing < 0 || bearing > 360) {
    const message = context
      ? `${context}: Bearing ${bearing}° is out of valid range (0-360°)`
      : `Bearing ${bearing}° is out of valid range (0-360°)`;
    throw new Error(message);
  }
}

/**
 * Assert coordinates are valid
 */
export function assertValidCoordinates(lat: number, lon: number, context?: string): void {
  if (lat < -90 || lat > 90) {
    const message = context
      ? `${context}: Invalid latitude ${lat}° (must be -90 to 90)`
      : `Invalid latitude ${lat}° (must be -90 to 90)`;
    throw new Error(message);
  }
  
  if (lon < -180 || lon > 180) {
    const message = context
      ? `${context}: Invalid longitude ${lon}° (must be -180 to 180)`
      : `Invalid longitude ${lon}° (must be -180 to 180)`;
    throw new Error(message);
  }
}

/**
 * Assert route object has required properties
 */
export function assertValidRoute(route: any): void {
  if (!route) {
    throw new Error('Route is null or undefined');
  }
  
  if (typeof route.totalDistance !== 'number' || route.totalDistance < 0) {
    throw new Error(`Invalid route totalDistance: ${route.totalDistance}`);
  }
  
  if (typeof route.estimatedDuration !== 'number' || route.estimatedDuration < 0) {
    throw new Error(`Invalid route estimatedDuration: ${route.estimatedDuration}`);
  }
  
  if (!Array.isArray(route.waypoints) || route.waypoints.length < 2) {
    throw new Error(`Invalid route waypoints: ${route.waypoints}`);
  }
  
  // Validate each waypoint
  route.waypoints.forEach((wp: any, index: number) => {
    if (typeof wp.lat !== 'number' || typeof wp.lon !== 'number') {
      throw new Error(`Waypoint ${index} has invalid coordinates`);
    }
    assertValidCoordinates(wp.lat, wp.lon, `Waypoint ${index}`);
  });
}

/**
 * Assert safety warning is present in result
 */
export function assertSafetyWarningPresent(
  result: any,
  warningType: string
): void {
  if (!result.warnings || !Array.isArray(result.warnings)) {
    throw new Error('Result does not contain warnings array');
  }
  
  const hasWarning = result.warnings.some((w: any) => 
    w.type === warningType || w.code === warningType || w.message?.includes(warningType)
  );
  
  if (!hasWarning) {
    throw new Error(`Expected warning type '${warningType}' not found in result.warnings`);
  }
}

/**
 * Assert cache was hit based on logs or metadata
 */
export function assertCacheHit(
  logs: string[],
  cacheKey: string
): void {
  const cacheHitLog = logs.some(log => 
    log.includes('cache') && 
    log.includes('hit') && 
    log.includes(cacheKey)
  );
  
  if (!cacheHitLog) {
    throw new Error(`Expected cache hit for key '${cacheKey}' but not found in logs`);
  }
}

/**
 * Assert value is a valid timestamp
 */
export function assertValidTimestamp(value: any, context?: string): void {
  const timestamp = new Date(value);
  
  if (isNaN(timestamp.getTime())) {
    const message = context
      ? `${context}: Invalid timestamp '${value}'`
      : `Invalid timestamp '${value}'`;
    throw new Error(message);
  }
}

/**
 * Assert data freshness (not stale)
 */
export function assertDataFresh(
  timestamp: string | Date,
  maxAgeHours: number,
  context?: string
): void {
  const date = new Date(timestamp);
  const ageHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  
  if (ageHours > maxAgeHours) {
    const message = context
      ? `${context}: Data is ${ageHours.toFixed(1)} hours old (max: ${maxAgeHours} hours)`
      : `Data is ${ageHours.toFixed(1)} hours old (max: ${maxAgeHours} hours)`;
    throw new Error(message);
  }
}

