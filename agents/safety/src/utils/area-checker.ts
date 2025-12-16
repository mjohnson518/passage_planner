/**
 * Area Checker Utility
 *
 * SAFETY CRITICAL: Checks if routes intersect restricted or hazardous areas.
 * Uses point-in-polygon algorithms to detect area conflicts.
 *
 * Supports both:
 * - Database-backed areas (production) - loaded from PostgreSQL
 * - Default areas (fallback) - hardcoded for resilience
 */

import { Pool } from 'pg';
import { Waypoint, RestrictedArea, GeographicBounds } from '../../../../shared/src/types/safety';

// Database pool for loading restricted areas
let dbPool: Pool | null = null;

/**
 * Initialize the AreaChecker with database support
 * Call this at application startup to enable database loading
 */
export function initializeAreaCheckerDatabase(pool: Pool): void {
  dbPool = pool;
}

export class AreaChecker {
  private restrictedAreas: RestrictedArea[] = [];
  private lastDatabaseRefresh: Date | null = null;
  private readonly REFRESH_INTERVAL_MS = 5 * 60 * 1000; // Refresh every 5 minutes

  constructor() {
    // Initialize with default restricted areas (fallback)
    this.loadDefaultRestrictedAreas();
  }

  /**
   * Initialize and load areas from database
   * SAFETY CRITICAL: Ensures we have the latest restricted area data
   */
  async initialize(): Promise<void> {
    await this.refreshFromDatabase();
  }

  /**
   * Load default restricted areas
   * In production, this would query a database of official restricted areas
   */
  private loadDefaultRestrictedAreas() {
    this.restrictedAreas = [
      {
        id: 'US-MIL-001',
        name: 'Naval Exercise Area - Cape Cod',
        type: 'military',
        bounds: {
          north: 42.5,
          south: 42.0,
          east: -69.5,
          west: -70.5,
        },
        description: 'Naval exercises may be in progress. Contact USCG before entering.',
        restrictions: [
          'Civilian vessels prohibited during active exercises',
          'Monitor VHF Channel 16 for notices',
          'Maintain 5nm standoff when exercises active',
        ],
        active: true,
        schedule: {
          start: 'permanent',
          recurring: 'Variable - announced via NOTAM',
        },
        authority: 'US Navy / USCG',
        penalty: 'Federal offense - may result in vessel seizure',
      },
      {
        id: 'SANCTUARY-001',
        name: 'Stellwagen Bank National Marine Sanctuary',
        type: 'marine_sanctuary',
        bounds: {
          north: 42.75,
          south: 42.08,
          east: -70.02,
          west: -70.60,
        },
        description: 'Protected marine sanctuary. Special regulations apply.',
        restrictions: [
          'No discharge of any kind',
          'Speed restrictions may apply during whale season',
          'No anchoring in designated areas',
          'Report whale sightings to authorities',
        ],
        active: true,
        schedule: {
          start: 'permanent',
        },
        authority: 'NOAA National Marine Sanctuaries',
        penalty: 'Up to $100,000 per violation',
      },
      {
        id: 'SHIPPING-LANE-001',
        name: 'Boston TSS (Traffic Separation Scheme)',
        type: 'shipping_lane',
        bounds: {
          north: 42.45,
          south: 42.25,
          east: -70.75,
          west: -70.95,
        },
        description: 'Traffic Separation Scheme - IMO Collision Regulations apply.',
        restrictions: [
          'Cross at right angles to traffic flow',
          'Do not impede vessels in traffic lanes',
          'Avoid separation zone except when crossing',
          'Monitor VHF Channel 13 (bridge-to-bridge)',
        ],
        active: true,
        schedule: {
          start: 'permanent',
        },
        authority: 'IMO / USCG',
        penalty: 'Violation of COLREGS Rule 10',
      },
    ];
  }

  /**
   * Refresh restricted areas from database
   * Merges database areas with default fallback areas
   */
  async refreshFromDatabase(): Promise<void> {
    if (!dbPool) {
      return; // No database configured, use defaults only
    }

    try {
      const result = await dbPool.query(
        `SELECT
          id, name, type, description, restrictions, active,
          bounds_north, bounds_south, bounds_east, bounds_west,
          polygon, schedule_start, schedule_end, schedule_recurring,
          authority, penalty, source, last_verified, created_at, updated_at
        FROM restricted_areas
        WHERE active = true`
      );

      const dbAreas: RestrictedArea[] = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        bounds: row.bounds_north != null ? {
          north: row.bounds_north,
          south: row.bounds_south,
          east: row.bounds_east,
          west: row.bounds_west,
        } : undefined,
        polygon: row.polygon ? JSON.parse(row.polygon) : undefined,
        description: row.description,
        restrictions: row.restrictions || [],
        active: row.active,
        schedule: row.schedule_start ? {
          start: row.schedule_start,
          end: row.schedule_end,
          recurring: row.schedule_recurring,
        } : undefined,
        authority: row.authority,
        penalty: row.penalty,
      }));

      // Merge database areas with defaults (database takes precedence by ID)
      const defaultAreas = this.restrictedAreas.filter(
        (a) => !dbAreas.find((db) => db.id === a.id)
      );
      this.restrictedAreas = [...dbAreas, ...defaultAreas];
      this.lastDatabaseRefresh = new Date();

    } catch (error) {
      console.error('Failed to refresh restricted areas from database:', error);
      // Keep using current areas (defaults or previous DB load)
    }
  }

  /**
   * Ensure areas are fresh, refresh if needed
   */
  private async ensureFreshData(): Promise<void> {
    if (!dbPool) return;

    const shouldRefresh =
      !this.lastDatabaseRefresh ||
      Date.now() - this.lastDatabaseRefresh.getTime() > this.REFRESH_INTERVAL_MS;

    if (shouldRefresh) {
      await this.refreshFromDatabase();
    }
  }

  /**
   * Check if a waypoint is within a restricted area
   */
  checkWaypoint(waypoint: Waypoint): RestrictedArea[] {
    const conflicts: RestrictedArea[] = [];

    for (const area of this.restrictedAreas) {
      if (!area.active) continue;

      if (area.bounds) {
        if (this.isPointInBounds(waypoint, area.bounds)) {
          conflicts.push(area);
        }
      } else if (area.polygon) {
        if (this.isPointInPolygon(waypoint, area.polygon)) {
          conflicts.push(area);
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if route passes through any restricted areas
   */
  checkRoute(waypoints: Waypoint[]): Map<string, RestrictedArea> {
    const conflicts = new Map<string, RestrictedArea>();

    for (const waypoint of waypoints) {
      const waypointConflicts = this.checkWaypoint(waypoint);
      for (const conflict of waypointConflicts) {
        conflicts.set(conflict.id, conflict);
      }
    }

    // Also check line segments between waypoints for area crossings
    for (let i = 0; i < waypoints.length - 1; i++) {
      const segmentConflicts = this.checkLineSegment(waypoints[i], waypoints[i + 1]);
      for (const conflict of segmentConflicts) {
        conflicts.set(conflict.id, conflict);
      }
    }

    return conflicts;
  }

  /**
   * Check if a line segment passes through restricted areas
   */
  private checkLineSegment(start: Waypoint, end: Waypoint): RestrictedArea[] {
    const conflicts: RestrictedArea[] = [];

    // Sample points along the line segment
    const samples = 20; // Check 20 points between waypoints
    for (let i = 0; i <= samples; i++) {
      const fraction = i / samples;
      const samplePoint: Waypoint = {
        latitude: start.latitude + (end.latitude - start.latitude) * fraction,
        longitude: start.longitude + (end.longitude - start.longitude) * fraction,
      };

      const pointConflicts = this.checkWaypoint(samplePoint);
      for (const conflict of pointConflicts) {
        if (!conflicts.find(c => c.id === conflict.id)) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if point is within geographic bounds
   */
  private isPointInBounds(point: Waypoint, bounds: GeographicBounds): boolean {
    return (
      point.latitude >= bounds.south &&
      point.latitude <= bounds.north &&
      point.longitude >= bounds.west &&
      point.longitude <= bounds.east
    );
  }

  /**
   * Check if point is within a polygon using ray casting algorithm
   */
  private isPointInPolygon(point: Waypoint, polygon: Waypoint[]): boolean {
    if (polygon.length < 3) return false;

    let inside = false;
    const x = point.longitude;
    const y = point.latitude;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].longitude;
      const yi = polygon[i].latitude;
      const xj = polygon[j].longitude;
      const yj = polygon[j].latitude;

      const intersect = ((yi > y) !== (yj > y)) &&
                       (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Add a new restricted area (for dynamic updates)
   */
  addRestrictedArea(area: RestrictedArea): void {
    // Check if area already exists
    const existingIndex = this.restrictedAreas.findIndex(a => a.id === area.id);
    if (existingIndex >= 0) {
      this.restrictedAreas[existingIndex] = area;
    } else {
      this.restrictedAreas.push(area);
    }
  }

  /**
   * Remove a restricted area
   */
  removeRestrictedArea(areaId: string): boolean {
    const initialLength = this.restrictedAreas.length;
    this.restrictedAreas = this.restrictedAreas.filter(a => a.id !== areaId);
    return this.restrictedAreas.length < initialLength;
  }

  /**
   * Get all active restricted areas
   */
  getActiveAreas(): RestrictedArea[] {
    return this.restrictedAreas.filter(a => a.active);
  }

  /**
   * Get restricted areas of a specific type
   */
  getAreasByType(type: RestrictedArea['type']): RestrictedArea[] {
    return this.restrictedAreas.filter(a => a.type === type && a.active);
  }

  /**
   * Query restricted areas by geographic bounds from database
   * SAFETY CRITICAL: Used to find all areas in a passage region
   */
  async queryAreasByBounds(bounds: GeographicBounds): Promise<RestrictedArea[]> {
    // First ensure we have fresh data
    await this.ensureFreshData();

    // Filter in-memory areas by bounds
    return this.restrictedAreas.filter((area) => {
      if (!area.active) return false;

      if (area.bounds) {
        // Check if area bounds overlap with query bounds
        return this.boundsOverlap(area.bounds, bounds);
      } else if (area.polygon && area.polygon.length > 0) {
        // Check if any polygon point is within bounds
        return area.polygon.some((p) => this.isPointInBounds(p, bounds));
      }
      return false;
    });
  }

  /**
   * Check if two bounds rectangles overlap
   */
  private boundsOverlap(a: GeographicBounds, b: GeographicBounds): boolean {
    return !(
      a.east < b.west ||
      a.west > b.east ||
      a.north < b.south ||
      a.south > b.north
    );
  }

  /**
   * Get restricted areas near a point (within a given radius in nm)
   */
  async queryAreasNearPoint(
    point: Waypoint,
    radiusNm: number = 50
  ): Promise<Array<{ area: RestrictedArea; distanceNm: number }>> {
    await this.ensureFreshData();

    const results: Array<{ area: RestrictedArea; distanceNm: number }> = [];

    for (const area of this.restrictedAreas) {
      if (!area.active) continue;

      const distance = this.calculateDistanceToArea(point, area);
      if (distance <= radiusNm) {
        results.push({ area, distanceNm: distance });
      }
    }

    // Sort by distance
    return results.sort((a, b) => a.distanceNm - b.distanceNm);
  }

  /**
   * Get count of areas by type (for analytics)
   */
  getAreaCountsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const area of this.restrictedAreas) {
      if (area.active) {
        counts[area.type] = (counts[area.type] || 0) + 1;
      }
    }
    return counts;
  }

  /**
   * Get last refresh timestamp
   */
  getLastRefreshTime(): Date | null {
    return this.lastDatabaseRefresh;
  }

  /**
   * Calculate closest distance from a point to a restricted area
   */
  calculateDistanceToArea(point: Waypoint, area: RestrictedArea): number {
    if (!area.bounds) {
      // For polygon areas, calculate minimum distance to any edge
      return this.distanceToPolygon(point, area.polygon || []);
    }

    // For rectangular bounds, calculate distance to nearest edge
    return this.distanceToBounds(point, area.bounds);
  }

  /**
   * Calculate distance from point to nearest edge of bounds
   */
  private distanceToBounds(point: Waypoint, bounds: GeographicBounds): number {
    // Check if point is inside bounds
    if (this.isPointInBounds(point, bounds)) {
      return 0; // Inside the area
    }

    // Calculate distance to nearest edge
    const latDist = Math.min(
      Math.abs(point.latitude - bounds.north),
      Math.abs(point.latitude - bounds.south)
    );
    const lonDist = Math.min(
      Math.abs(point.longitude - bounds.east),
      Math.abs(point.longitude - bounds.west)
    );

    // Convert to nautical miles (very approximate)
    const latNm = latDist * 60;
    const lonNm = lonDist * 60 * Math.cos(point.latitude * Math.PI / 180);

    return Math.min(latNm, lonNm);
  }

  /**
   * Calculate distance from point to polygon
   */
  private distanceToPolygon(point: Waypoint, polygon: Waypoint[]): number {
    if (this.isPointInPolygon(point, polygon)) {
      return 0; // Inside the polygon
    }

    // Calculate minimum distance to any edge
    let minDistance = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const dist = this.distanceToLineSegment(point, polygon[i], polygon[j]);
      minDistance = Math.min(minDistance, dist);
    }

    return minDistance;
  }

  /**
   * Calculate distance from point to line segment
   */
  private distanceToLineSegment(point: Waypoint, start: Waypoint, end: Waypoint): number {
    // Simplified calculation - in production would use proper geodesic math
    const dx = end.longitude - start.longitude;
    const dy = end.latitude - start.latitude;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // start and end are the same point
      return this.haversineDistance(point, start);
    }

    const t = Math.max(0, Math.min(1,
      ((point.longitude - start.longitude) * dx + (point.latitude - start.latitude) * dy) / lengthSquared
    ));

    const nearest: Waypoint = {
      latitude: start.latitude + t * dy,
      longitude: start.longitude + t * dx,
    };

    return this.haversineDistance(point, nearest);
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private haversineDistance(p1: Waypoint, p2: Waypoint): number {
    const R = 3440.1; // Earth radius in nautical miles
    const lat1 = p1.latitude * Math.PI / 180;
    const lat2 = p2.latitude * Math.PI / 180;
    const deltaLat = (p2.latitude - p1.latitude) * Math.PI / 180;
    const deltaLon = (p2.longitude - p1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

