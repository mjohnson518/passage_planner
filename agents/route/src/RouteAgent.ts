import { BaseAgent } from '../../base/BaseAgent';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as turf from '@turf/turf';

interface RoutePoint {
  latitude: number;
  longitude: number;
  name?: string;
  arrivalTime?: Date;
}

interface RouteSegment {
  from: RoutePoint;
  to: RoutePoint;
  distance: number;
  bearing: number;
  estimatedTime: number;
}

interface Route {
  waypoints: RoutePoint[];
  segments: RouteSegment[];
  totalDistance: number;
  estimatedDuration: number;
  optimized: boolean;
}

export class RouteAgent extends BaseAgent {
  constructor(redisUrl: string) {
    super({
      name: 'route-agent',
      description: 'Calculates optimal sailing routes',
      version: '1.0.0',
      cacheTTL: 3600 // 1 hour - routes recalculated frequently
    }, redisUrl);
  }

  getTools(): Tool[] {
    return [
      {
        name: 'calculate_route',
        description: 'Calculate optimal route between points',
        inputSchema: {
          type: 'object',
          properties: {
            departure: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                name: { type: 'string' }
              },
              required: ['latitude', 'longitude']
            },
            destination: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                name: { type: 'string' }
              },
              required: ['latitude', 'longitude']
            },
            waypoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  name: { type: 'string' }
                }
              },
              default: []
            },
            vessel_speed: { type: 'number', default: 5 },
            optimization: {
              type: 'string',
              enum: ['distance', 'time', 'comfort', 'fuel'],
              default: 'distance'
            },
            avoid_areas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['circle', 'polygon'] },
                  coordinates: { type: 'array' },
                  radius: { type: 'number' }
                }
              },
              default: []
            }
          },
          required: ['departure', 'destination']
        }
      },
      {
        name: 'calculate_rhumb_line',
        description: 'Calculate rhumb line route',
        inputSchema: {
          type: 'object',
          properties: {
            from: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            to: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            }
          },
          required: ['from', 'to']
        }
      },
      {
        name: 'calculate_great_circle',
        description: 'Calculate great circle route',
        inputSchema: {
          type: 'object',
          properties: {
            from: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            to: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            intermediate_points: { type: 'number', default: 10 }
          },
          required: ['from', 'to']
        }
      },
      {
        name: 'optimize_waypoints',
        description: 'Optimize waypoint order for shortest distance',
        inputSchema: {
          type: 'object',
          properties: {
            waypoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  name: { type: 'string' }
                }
              }
            },
            start_point: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            end_point: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            }
          },
          required: ['waypoints']
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'calculate_route':
        return await this.calculateRoute(args);
      case 'calculate_rhumb_line':
        return await this.calculateRhumbLine(args.from, args.to);
      case 'calculate_great_circle':
        return await this.calculateGreatCircle(args.from, args.to, args.intermediate_points);
      case 'optimize_waypoints':
        return await this.optimizeWaypoints(args.waypoints, args.start_point, args.end_point);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async calculateRoute(params: any): Promise<Route> {
    const { departure, destination, waypoints = [], vessel_speed = 5, optimization = 'distance', avoid_areas = [] } = params;
    
    // Optimize waypoint order if requested (includes departure and destination)
    let orderedWaypoints: any[];
    if (optimization === 'distance' && waypoints.length > 0) {
      orderedWaypoints = await this.optimizeWaypoints(waypoints, departure, destination);
    } else {
      // Create full waypoint list without optimization
      orderedWaypoints = [departure, ...waypoints, destination];
    }
    
    // Calculate segments
    const segments: RouteSegment[] = [];
    let totalDistance = 0;
    let estimatedDuration = 0;
    
    for (let i = 0; i < orderedWaypoints.length - 1; i++) {
      const from = orderedWaypoints[i];
      const to = orderedWaypoints[i + 1];
      
      // Check if route passes through avoid areas
      const routeLine = turf.lineString([
        [from.longitude, from.latitude],
        [to.longitude, to.latitude]
      ]);
      
      let segmentValid = true;
      for (const area of avoid_areas) {
        if (area.type === 'circle') {
          const circle = turf.circle(area.coordinates, area.radius, { units: 'nauticalmiles' });
          if (turf.booleanCrosses(routeLine, circle) || turf.booleanWithin(routeLine, circle)) {
            segmentValid = false;
            break;
          }
        } else if (area.type === 'polygon') {
          const polygon = turf.polygon([area.coordinates]);
          if (turf.booleanCrosses(routeLine, polygon) || turf.booleanWithin(routeLine, polygon)) {
            segmentValid = false;
            break;
          }
        }
      }
      
      if (!segmentValid) {
        // Calculate alternative route around obstacle
        const detour = await this.calculateDetour(from, to, avoid_areas);
        segments.push(...detour);
        detour.forEach(seg => {
          totalDistance += seg.distance;
          estimatedDuration += seg.estimatedTime;
        });
      } else {
        const distance = this.calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
        const bearing = this.calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude);
        const time = distance / vessel_speed;
        
        segments.push({
          from,
          to,
          distance,
          bearing,
          estimatedTime: time
        });
        
        totalDistance += distance;
        estimatedDuration += time;
      }
    }
    
    return {
      waypoints: orderedWaypoints,
      segments,
      totalDistance,
      estimatedDuration,
      optimized: optimization === 'distance'
    };
  }

  private async calculateRhumbLine(from: any, to: any): Promise<any> {
    const point1 = turf.point([from.longitude, from.latitude]);
    const point2 = turf.point([to.longitude, to.latitude]);
    
    const distance = turf.rhumbDistance(point1, point2, { units: 'nauticalmiles' });
    const bearing = turf.rhumbBearing(point1, point2);
    
    return {
      distance,
      bearing: (bearing + 360) % 360, // Normalize to 0-360
      type: 'rhumb',
      from,
      to
    };
  }

  private async calculateGreatCircle(from: any, to: any, intermediatePoints: number = 10): Promise<any> {
    const point1 = turf.point([from.longitude, from.latitude]);
    const point2 = turf.point([to.longitude, to.latitude]);
    
    const distance = turf.distance(point1, point2, { units: 'nauticalmiles' });
    const bearing = turf.bearing(point1, point2);
    
    // Generate intermediate points along great circle
    const line = turf.greatCircle(point1, point2, { npoints: intermediatePoints + 2 });
    const waypoints = line.geometry.coordinates.map((coord, index) => ({
      latitude: coord[1],
      longitude: coord[0],
      sequence: index
    }));
    
    return {
      distance,
      initial_bearing: (bearing + 360) % 360, // Normalize to 0-360
      type: 'great_circle',
      waypoints,
      from,
      to
    };
  }

  private async optimizeWaypoints(waypoints: any[], startPoint?: any, endPoint?: any): Promise<any[]> {
    if (waypoints.length <= 1) return waypoints;
    
    // Use nearest neighbor algorithm for simple optimization (TSP approximation)
    const optimized = [];
    const remaining = [...waypoints];
    let current = startPoint || remaining.shift();
    
    optimized.push(current);
    
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const distance = this.calculateDistance(
          current.latitude,
          current.longitude,
          remaining[i].latitude,
          remaining[i].longitude
        );
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      
      current = remaining.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }
    
    if (endPoint) {
      optimized.push(endPoint);
    }
    
    return optimized;
  }

  /**
   * Calculate a detour around obstacles with verified clearance.
   * SAFETY CRITICAL: Iteratively tries increasing offsets and verifies both new segments
   * clear all avoid areas before returning. Tries both sides of the route.
   */
  private async calculateDetour(from: any, to: any, avoidAreas: any[]): Promise<RouteSegment[]> {
    const bearing = this.calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude);
    const midpoint = {
      latitude: (from.latitude + to.latitude) / 2,
      longitude: (from.longitude + to.longitude) / 2
    };

    const offsetDistances = [10, 20, 30]; // nautical miles
    // Try starboard side first (+90°), then port side (-90°)
    const offsetBearings = [(bearing + 90) % 360, (bearing + 270) % 360];

    for (const offsetBearing of offsetBearings) {
      for (const offsetDistance of offsetDistances) {
        const offsetPoint = this.calculateDestination(
          midpoint.latitude,
          midpoint.longitude,
          offsetDistance,
          offsetBearing
        );

        // Verify BOTH new segments clear all avoid areas
        const seg1Line = turf.lineString([
          [from.longitude, from.latitude],
          [offsetPoint.longitude, offsetPoint.latitude]
        ]);
        const seg2Line = turf.lineString([
          [offsetPoint.longitude, offsetPoint.latitude],
          [to.longitude, to.latitude]
        ]);

        let clearanceVerified = true;
        for (const area of avoidAreas) {
          let areaGeometry;
          if (area.type === 'circle') {
            areaGeometry = turf.circle(area.coordinates, area.radius, { units: 'nauticalmiles' });
          } else if (area.type === 'polygon') {
            areaGeometry = turf.polygon([area.coordinates]);
          } else {
            continue;
          }

          if (
            turf.booleanCrosses(seg1Line, areaGeometry) || turf.booleanWithin(seg1Line, areaGeometry) ||
            turf.booleanCrosses(seg2Line, areaGeometry) || turf.booleanWithin(seg2Line, areaGeometry)
          ) {
            clearanceVerified = false;
            break;
          }
        }

        if (clearanceVerified) {
          const dist1 = this.calculateDistance(from.latitude, from.longitude, offsetPoint.latitude, offsetPoint.longitude);
          const dist2 = this.calculateDistance(offsetPoint.latitude, offsetPoint.longitude, to.latitude, to.longitude);
          return [
            {
              from,
              to: offsetPoint,
              distance: dist1,
              bearing: this.calculateBearing(from.latitude, from.longitude, offsetPoint.latitude, offsetPoint.longitude),
              estimatedTime: 0
            },
            {
              from: offsetPoint,
              to,
              distance: dist2,
              bearing: this.calculateBearing(offsetPoint.latitude, offsetPoint.longitude, to.latitude, to.longitude),
              estimatedTime: 0
            }
          ];
        }
      }
    }

    // No clear detour found - SAFETY: require manual route planning
    throw new Error(
      'Unable to calculate a verified clear detour around obstacles. ' +
      'Manual route planning with official nautical charts is required for this segment.'
    );
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const point1 = turf.point([lon1, lat1]);
    const point2 = turf.point([lon2, lat2]);
    return turf.distance(point1, point2, { units: 'nauticalmiles' });
  }

  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const point1 = turf.point([lon1, lat1]);
    const point2 = turf.point([lon2, lat2]);
    const bearing = turf.bearing(point1, point2);
    return (bearing + 360) % 360; // Normalize to 0-360
  }

  private calculateDestination(lat: number, lon: number, distance: number, bearing: number): RoutePoint {
    const origin = turf.point([lon, lat]);
    const destination = turf.destination(origin, distance, bearing, { units: 'nauticalmiles' });
    return {
      latitude: destination.geometry.coordinates[1],
      longitude: destination.geometry.coordinates[0]
    };
  }
}

