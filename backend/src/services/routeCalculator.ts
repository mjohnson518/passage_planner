/**
 * Route Calculation Service
 * Calculates distance, bearing, and estimated passage time
 * Uses geolib for geographic calculations
 */

import * as geolib from 'geolib';

export interface Coordinate {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface RouteResult {
  distance: number; // nautical miles
  distanceKm: number;
  bearing: number; // degrees true
  estimatedDuration: number; // hours
  waypoints: Coordinate[];
}

/**
 * Calculate route between two points
 * @param departure Starting coordinates
 * @param destination Ending coordinates
 * @param cruiseSpeed Vessel speed in knots (default 5)
 * @returns Route calculations with distance, bearing, duration
 */
export function calculateRoute(
  departure: Coordinate,
  destination: Coordinate,
  cruiseSpeed: number = 5
): RouteResult {
  // Validate inputs
  if (!departure.latitude || !departure.longitude) {
    throw new Error('Departure coordinates required');
  }
  if (!destination.latitude || !destination.longitude) {
    throw new Error('Destination coordinates required');
  }
  if (cruiseSpeed <= 0) {
    throw new Error('Cruise speed must be positive');
  }

  // Calculate distance in meters
  const distanceMeters = geolib.getDistance(
    { latitude: departure.latitude, longitude: departure.longitude },
    { latitude: destination.latitude, longitude: destination.longitude }
  );

  // Convert to nautical miles (1 nm = 1852 meters)
  const distanceNm = distanceMeters / 1852;
  const distanceKm = distanceMeters / 1000;

  // Calculate bearing (rhumb line for simplicity)
  const bearing = geolib.getRhumbLineBearing(
    { latitude: departure.latitude, longitude: departure.longitude },
    { latitude: destination.latitude, longitude: destination.longitude }
  );

  // Calculate estimated duration
  const estimatedDuration = distanceNm / cruiseSpeed;

  return {
    distance: parseFloat(distanceNm.toFixed(1)),
    distanceKm: parseFloat(distanceKm.toFixed(1)),
    bearing,
    estimatedDuration: parseFloat(estimatedDuration.toFixed(1)),
    waypoints: [departure, destination]
  };
}

/**
 * Format duration as human-readable string
 * @param hours Duration in decimal hours
 * @returns Formatted string like "14h 30m"
 */
export function formatDuration(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${wholeHours}h ${minutes}m`;
}

