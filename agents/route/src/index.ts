// Route Agent Implementation
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode 
} from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import { z } from 'zod';
import { createClient } from 'redis';
import * as turf from '@turf/turf';
import { 
  Coordinate,
  Route,
  Waypoint,
  Port
} from '../../../shared/types/core.js';

// Input validation schemas
const RouteCalculationSchema = z.object({
  departure: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    name: z.string().optional(),
  }),
  destination: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    name: z.string().optional(),
  }),
  waypoints: z.array(z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    name: z.string().optional(),
  })).optional(),
  boat_type: z.enum(['sailboat', 'powerboat', 'catamaran']).optional(),
  cruising_speed_kts: z.number().min(1).max(50).optional(),
  avoid_areas: z.array(z.object({
    center: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
    radius_nm: z.number(),
  })).optional(),
});

const WaypointOptimizationSchema = z.object({
  waypoints: z.array(z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    name: z.string().optional(),
    required: z.boolean().default(false),
  })),
  optimization_goal: z.enum(['shortest_distance', 'fastest_time', 'safest_route']).default('shortest_distance'),
  constraints: z.object({
    max_leg_distance_nm: z.number().optional(),
    daylight_only: z.boolean().optional(),
    weather_routing: z.boolean().optional(),
  }).optional(),
});

const AlternativeRoutesSchema = z.object({
  departure: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  destination: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  num_alternatives: z.number().min(1).max(5).default(3),
  preferences: z.object({
    avoid_shipping_lanes: z.boolean().optional(),
    prefer_deep_water: z.boolean().optional(),
    scenic_route: z.boolean().optional(),
  }).optional(),
});

export class RouteAgent {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  private redis: ReturnType<typeof createClient>;
  private cacheExpiry = 7200; // 2 hours for route data
  
  constructor() {
    this.server = new Server(
      {
        name: 'route-agent',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );
    
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));
    
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        this.logger.info({ tool: name, args }, 'Processing route tool request');
        
        switch (name) {
          case 'calculate_route':
            return await this.calculateRoute(args);
          case 'optimize_waypoints':
            return await this.optimizeWaypoints(args);
          case 'calculate_distance':
            return await this.calculateDistance(args);
          case 'get_alternative_routes':
            return await this.getAlternativeRoutes(args);
          case 'calculate_fuel_stops':
            return await this.calculateFuelStops(args);
          case 'check_route_weather':
            return await this.checkRouteWeather(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Tool request failed');
        
        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`
          );
        }
        
        if (error instanceof Error) {
          throw error;
        }
        
        throw new Error('Unknown error occurred');
      }
    });
  }

  private getTools() {
    return [
      {
        name: 'calculate_route',
        description: 'Calculate the optimal route between two points with optional waypoints',
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
                },
                required: ['latitude', 'longitude']
              }
            },
            boat_type: {
              type: 'string',
              enum: ['sailboat', 'powerboat', 'catamaran']
            },
            cruising_speed_kts: { type: 'number' },
            avoid_areas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  center: {
                    type: 'object',
                    properties: {
                      latitude: { type: 'number' },
                      longitude: { type: 'number' }
                    }
                  },
                  radius_nm: { type: 'number' }
                }
              }
            }
          },
          required: ['departure', 'destination']
        },
      },
      {
        name: 'optimize_waypoints',
        description: 'Optimize the order of waypoints for shortest distance or other goals',
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
                  name: { type: 'string' },
                  required: { type: 'boolean', default: false }
                },
                required: ['latitude', 'longitude']
              }
            },
            optimization_goal: {
              type: 'string',
              enum: ['shortest_distance', 'fastest_time', 'safest_route'],
              default: 'shortest_distance'
            },
            constraints: {
              type: 'object',
              properties: {
                max_leg_distance_nm: { type: 'number' },
                daylight_only: { type: 'boolean' },
                weather_routing: { type: 'boolean' }
              }
            }
          },
          required: ['waypoints']
        },
      },
      {
        name: 'calculate_distance',
        description: 'Calculate distance and bearing between two points',
        inputSchema: {
          type: 'object',
          properties: {
            from: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              },
              required: ['latitude', 'longitude']
            },
            to: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              },
              required: ['latitude', 'longitude']
            },
            unit: {
              type: 'string',
              enum: ['nm', 'km', 'mi'],
              default: 'nm'
            }
          },
          required: ['from', 'to']
        },
      },
      {
        name: 'get_alternative_routes',
        description: 'Generate alternative routes between two points',
        inputSchema: {
          type: 'object',
          properties: {
            departure: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              },
              required: ['latitude', 'longitude']
            },
            destination: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              },
              required: ['latitude', 'longitude']
            },
            num_alternatives: {
              type: 'number',
              default: 3,
              minimum: 1,
              maximum: 5
            },
            preferences: {
              type: 'object',
              properties: {
                avoid_shipping_lanes: { type: 'boolean' },
                prefer_deep_water: { type: 'boolean' },
                scenic_route: { type: 'boolean' }
              }
            }
          },
          required: ['departure', 'destination']
        },
      },
      {
        name: 'calculate_fuel_stops',
        description: 'Calculate required fuel stops based on vessel range',
        inputSchema: {
          type: 'object',
          properties: {
            route: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                },
                required: ['latitude', 'longitude']
              }
            },
            vessel_range_nm: { type: 'number' },
            safety_margin: {
              type: 'number',
              default: 0.2,
              description: 'Safety margin as percentage of range'
            },
            fuel_consumption_gph: { type: 'number' },
            cruising_speed_kts: { type: 'number' }
          },
          required: ['route', 'vessel_range_nm']
        },
      },
      {
        name: 'check_route_weather',
        description: 'Check weather conditions along the route',
        inputSchema: {
          type: 'object',
          properties: {
            route: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  eta: { type: 'string', format: 'date-time' }
                },
                required: ['latitude', 'longitude', 'eta']
              }
            },
            weather_concerns: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['wind_speed', 'wave_height', 'visibility', 'storms']
              }
            }
          },
          required: ['route']
        },
      }
    ];
  }

  private async calculateRoute(args: any) {
    const validated = RouteCalculationSchema.parse(args);
    
    const cacheKey = `route:${JSON.stringify(validated)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return {
        content: [{
          type: 'text',
          text: cached,
        }],
      };
    }
    
    try {
      // Calculate great circle route
      const directRoute = this.calculateGreatCircle(
        validated.departure,
        validated.destination
      );
      
      // Add intermediate waypoints for long passages
      let routePoints: Waypoint[] = [
        {
          id: 'DEP',
          name: validated.departure.name || 'Departure',
          coordinates: {
            latitude: validated.departure.latitude,
            longitude: validated.departure.longitude,
          },
          estimatedArrival: new Date(),
        }
      ];
      
      // Add user-specified waypoints
      if (validated.waypoints && validated.waypoints.length > 0) {
        validated.waypoints.forEach((wp, index) => {
          routePoints.push({
            id: `WP${index + 1}`,
            name: wp.name || `Waypoint ${index + 1}`,
            coordinates: {
              latitude: wp.latitude,
              longitude: wp.longitude,
            },
            estimatedArrival: new Date(), // Will be calculated
          });
        });
      } else if (directRoute.distance > 100) {
        // Add intermediate points for long passages
        const intermediatePoints = this.generateIntermediatePoints(
          validated.departure,
          validated.destination,
          Math.floor(directRoute.distance / 100)
        );
        
        intermediatePoints.forEach((point, index) => {
          routePoints.push({
            id: `IP${index + 1}`,
            name: `Intermediate ${index + 1}`,
            coordinates: point,
            estimatedArrival: new Date(), // Will be calculated
          });
        });
      }
      
      // Add destination
      routePoints.push({
        id: 'DEST',
        name: validated.destination.name || 'Destination',
        coordinates: {
          latitude: validated.destination.latitude,
          longitude: validated.destination.longitude,
        },
        estimatedArrival: new Date(), // Will be calculated
      });
      
      // Apply avoidance areas if specified
      if (validated.avoid_areas && validated.avoid_areas.length > 0) {
        routePoints = this.applyAvoidanceAreas(routePoints, validated.avoid_areas);
      }
      
      // Calculate distances and ETAs
      const cruisingSpeed = validated.cruising_speed_kts || 
        (validated.boat_type === 'sailboat' ? 6 : 20);
      
      let totalDistance = 0;
      let currentTime = new Date();
      
      for (let i = 1; i < routePoints.length; i++) {
        const legDistance = this.calculateDistance(
          routePoints[i-1].coordinates.latitude,
          routePoints[i-1].coordinates.longitude,
          routePoints[i].coordinates.latitude,
          routePoints[i].coordinates.longitude
        );
        
        totalDistance += legDistance;
        const legDuration = legDistance / cruisingSpeed * 60 * 60 * 1000; // ms
        currentTime = new Date(currentTime.getTime() + legDuration);
        routePoints[i].estimatedArrival = currentTime;
      }
      
      // Create route object
      const route: Route = {
        id: `ROUTE-${Date.now()}`,
        name: `${validated.departure.name || 'Departure'} to ${validated.destination.name || 'Destination'}`,
        waypoints: routePoints,
        distance: totalDistance,
        estimatedDuration: (currentTime.getTime() - new Date().getTime()) / (1000 * 60 * 60),
        advantages: this.getRouteAdvantages(routePoints, validated),
        disadvantages: this.getRouteDisadvantages(routePoints, validated),
      };
      
      const response = {
        route,
        summary: {
          total_distance_nm: Math.round(totalDistance),
          estimated_duration_hours: Math.round(route.estimatedDuration),
          average_speed_kts: cruisingSpeed,
          num_waypoints: routePoints.length,
          longest_leg_nm: this.getLongestLeg(routePoints),
        },
        navigation_notes: this.generateNavigationNotes(route),
      };
      
      const responseText = JSON.stringify(response, null, 2);
      await this.redis.setEx(cacheKey, this.cacheExpiry, responseText);
      
      return {
        content: [{
          type: 'text',
          text: responseText,
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to calculate route');
      throw error;
    }
  }

  private async optimizeWaypoints(args: any) {
    const validated = WaypointOptimizationSchema.parse(args);
    
    try {
      // Separate required and optional waypoints
      const required = validated.waypoints.filter(wp => wp.required);
      const optional = validated.waypoints.filter(wp => !wp.required);
      
      if (optional.length === 0) {
        // No optimization needed if all waypoints are required
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              optimized_route: validated.waypoints,
              distance_nm: this.calculateTotalDistance(validated.waypoints),
              optimization_performed: false,
              reason: 'All waypoints are required',
            }, null, 2),
          }],
        };
      }
      
      // Use different optimization strategies based on goal
      let optimizedRoute: any[];
      
      switch (validated.optimization_goal) {
        case 'shortest_distance':
          optimizedRoute = this.optimizeForDistance(required, optional);
          break;
        case 'fastest_time':
          optimizedRoute = await this.optimizeForTime(required, optional);
          break;
        case 'safest_route':
          optimizedRoute = await this.optimizeForSafety(required, optional);
          break;
        default:
          optimizedRoute = this.optimizeForDistance(required, optional);
      }
      
      // Apply constraints
      if (validated.constraints?.max_leg_distance_nm) {
        optimizedRoute = this.enforceMaxLegDistance(
          optimizedRoute,
          validated.constraints.max_leg_distance_nm
        );
      }
      
      const response = {
        optimized_route: optimizedRoute,
        original_distance_nm: this.calculateTotalDistance(validated.waypoints),
        optimized_distance_nm: this.calculateTotalDistance(optimizedRoute),
        distance_saved_nm: this.calculateTotalDistance(validated.waypoints) - 
                          this.calculateTotalDistance(optimizedRoute),
        optimization_goal: validated.optimization_goal,
        constraints_applied: validated.constraints,
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to optimize waypoints');
      throw error;
    }
  }

  private async calculateDistance(args: any) {
    const validated = z.object({
      from: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
      to: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
      unit: z.enum(['nm', 'km', 'mi']).default('nm'),
    }).parse(args);
    
    const distanceNm = this.calculateDistanceNm(
      validated.from.latitude,
      validated.from.longitude,
      validated.to.latitude,
      validated.to.longitude
    );
    
    const bearing = this.calculateBearing(
      validated.from.latitude,
      validated.from.longitude,
      validated.to.latitude,
      validated.to.longitude
    );
    
    let distance: number;
    switch (validated.unit) {
      case 'km':
        distance = distanceNm * 1.852;
        break;
      case 'mi':
        distance = distanceNm * 1.15078;
        break;
      default:
        distance = distanceNm;
    }
    
    const response = {
      from: validated.from,
      to: validated.to,
      distance: Math.round(distance * 100) / 100,
      unit: validated.unit,
      bearing_true: Math.round(bearing),
      bearing_magnetic: Math.round(bearing - this.getMagneticVariation(validated.from)),
      reciprocal_bearing: Math.round((bearing + 180) % 360),
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  }

  private async getAlternativeRoutes(args: any) {
    const validated = AlternativeRoutesSchema.parse(args);
    
    try {
      const alternatives: Route[] = [];
      
      // 1. Direct great circle route
      const directRoute = this.createDirectRoute(
        validated.departure,
        validated.destination
      );
      alternatives.push(directRoute);
      
      // 2. Rhumb line route (constant bearing)
      const rhumbRoute = this.createRhumbLineRoute(
        validated.departure,
        validated.destination
      );
      if (this.routesDiffer(directRoute, rhumbRoute)) {
        alternatives.push(rhumbRoute);
      }
      
      // 3. Coastal route (if applicable)
      const coastalRoute = await this.createCoastalRoute(
        validated.departure,
        validated.destination
      );
      if (coastalRoute && this.routesDiffer(directRoute, coastalRoute)) {
        alternatives.push(coastalRoute);
      }
      
      // 4. Deep water route (avoiding shallow areas)
      if (validated.preferences?.prefer_deep_water) {
        const deepWaterRoute = await this.createDeepWaterRoute(
          validated.departure,
          validated.destination
        );
        if (deepWaterRoute && this.routesDiffer(directRoute, deepWaterRoute)) {
          alternatives.push(deepWaterRoute);
        }
      }
      
      // 5. Scenic route (if requested)
      if (validated.preferences?.scenic_route) {
        const scenicRoute = await this.createScenicRoute(
          validated.departure,
          validated.destination
        );
        if (scenicRoute && this.routesDiffer(directRoute, scenicRoute)) {
          alternatives.push(scenicRoute);
        }
      }
      
      // Sort by distance and limit to requested number
      alternatives.sort((a, b) => a.distance - b.distance);
      const limitedAlternatives = alternatives.slice(0, validated.num_alternatives);
      
      const response = {
        alternatives: limitedAlternatives,
        comparison: {
          shortest_distance_nm: Math.min(...limitedAlternatives.map(r => r.distance)),
          longest_distance_nm: Math.max(...limitedAlternatives.map(r => r.distance)),
          direct_distance_nm: directRoute.distance,
        },
        recommendations: this.generateRouteRecommendations(limitedAlternatives),
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to get alternative routes');
      throw error;
    }
  }

  private async calculateFuelStops(args: any) {
    const validated = z.object({
      route: z.array(z.object({
        latitude: z.number(),
        longitude: z.number(),
      })),
      vessel_range_nm: z.number(),
      safety_margin: z.number().default(0.2),
      fuel_consumption_gph: z.number().optional(),
      cruising_speed_kts: z.number().optional(),
    }).parse(args);
    
    try {
      const effectiveRange = validated.vessel_range_nm * (1 - validated.safety_margin);
      const fuelStops: any[] = [];
      let currentPosition = validated.route[0];
      let accumulatedDistance = 0;
      
      for (let i = 1; i < validated.route.length; i++) {
        const legDistance = this.calculateDistanceNm(
          currentPosition.latitude,
          currentPosition.longitude,
          validated.route[i].latitude,
          validated.route[i].longitude
        );
        
        if (accumulatedDistance + legDistance > effectiveRange) {
          // Need fuel stop before this waypoint
          const fuelPort = await this.findNearestFuelPort(
            currentPosition,
            validated.route[i],
            effectiveRange - accumulatedDistance
          );
          
          if (fuelPort) {
            fuelStops.push({
              location: fuelPort,
              distance_from_start_nm: accumulatedDistance,
              fuel_needed_gallons: validated.fuel_consumption_gph && validated.cruising_speed_kts
                ? (accumulatedDistance / validated.cruising_speed_kts) * validated.fuel_consumption_gph
                : null,
            });
            
            currentPosition = fuelPort.coordinates;
            accumulatedDistance = 0;
          } else {
            // No fuel available, route may not be feasible
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'No fuel stop available within range',
                  problem_leg: {
                    from: currentPosition,
                    to: validated.route[i],
                    distance_nm: legDistance,
                    exceeds_range_by_nm: legDistance - effectiveRange,
                  },
                }, null, 2),
              }],
            };
          }
        } else {
          accumulatedDistance += legDistance;
          currentPosition = validated.route[i];
        }
      }
      
      const response = {
        fuel_stops: fuelStops,
        vessel_range_nm: validated.vessel_range_nm,
        effective_range_nm: effectiveRange,
        safety_margin: validated.safety_margin,
        total_route_distance_nm: this.calculateTotalDistance(validated.route),
        feasible: true,
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to calculate fuel stops');
      throw error;
    }
  }

  private async checkRouteWeather(args: any) {
    const validated = z.object({
      route: z.array(z.object({
        latitude: z.number(),
        longitude: z.number(),
        eta: z.string(),
      })),
      weather_concerns: z.array(z.string()).optional(),
    }).parse(args);
    
    // This would integrate with the weather agent
    // Placeholder implementation
    const weatherChecks = validated.route.map((point, index) => ({
      waypoint: `WP${index}`,
      coordinates: {
        latitude: point.latitude,
        longitude: point.longitude,
      },
      eta: point.eta,
      forecast: {
        wind_speed_kts: Math.random() * 20 + 5,
        wind_direction: Math.floor(Math.random() * 360),
        wave_height_ft: Math.random() * 6 + 1,
        visibility_nm: Math.random() * 10 + 5,
      },
      warnings: [],
    }));
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          weather_checks: weatherChecks,
          summary: {
            max_wind_speed_kts: Math.max(...weatherChecks.map(w => w.forecast.wind_speed_kts)),
            max_wave_height_ft: Math.max(...weatherChecks.map(w => w.forecast.wave_height_ft)),
            min_visibility_nm: Math.min(...weatherChecks.map(w => w.forecast.visibility_nm)),
          },
          go_no_go_recommendation: 'GO',
        }, null, 2),
      }],
    };
  }

  // Helper methods
  private calculateGreatCircle(from: Coordinate, to: Coordinate): { distance: number; bearing: number } {
    const distance = this.calculateDistanceNm(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude
    );
    
    const bearing = this.calculateBearing(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude
    );
    
    return { distance, bearing };
  }

  private calculateDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const point1 = turf.point([lon1, lat1]);
    const point2 = turf.point([lon2, lat2]);
    const distance = turf.distance(point1, point2, { units: 'nauticalmiles' });
    return distance;
  }

  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const point1 = turf.point([lon1, lat1]);
    const point2 = turf.point([lon2, lat2]);
    const bearing = turf.bearing(point1, point2);
    return (bearing + 360) % 360;
  }

  private generateIntermediatePoints(from: any, to: any, numPoints: number): Coordinate[] {
    const line = turf.lineString([[from.longitude, from.latitude], [to.longitude, to.latitude]]);
    const points: Coordinate[] = [];
    
    for (let i = 1; i <= numPoints; i++) {
      const fraction = i / (numPoints + 1);
      const point = turf.along(line, fraction * turf.length(line), { units: 'kilometers' });
      points.push({
        latitude: point.geometry.coordinates[1],
        longitude: point.geometry.coordinates[0],
      });
    }
    
    return points;
  }

  private applyAvoidanceAreas(waypoints: Waypoint[], avoidAreas: any[]): Waypoint[] {
    // Simplified implementation - would use proper path planning
    return waypoints;
  }

  private getRouteAdvantages(waypoints: Waypoint[], params: any): string[] {
    const advantages: string[] = [];
    
    if (waypoints.length <= 2) {
      advantages.push('Direct route with no intermediate stops');
    }
    
    if (params.boat_type === 'sailboat') {
      advantages.push('Route optimized for sailing conditions');
    }
    
    return advantages;
  }

  private getRouteDisadvantages(waypoints: Waypoint[], params: any): string[] {
    const disadvantages: string[] = [];
    
    const longestLeg = this.getLongestLeg(waypoints);
    if (longestLeg > 200) {
      disadvantages.push(`Long passage leg of ${longestLeg}nm without stops`);
    }
    
    return disadvantages;
  }

  private getLongestLeg(waypoints: Waypoint[]): number {
    let maxDistance = 0;
    
    for (let i = 1; i < waypoints.length; i++) {
      const distance = this.calculateDistanceNm(
        waypoints[i-1].coordinates.latitude,
        waypoints[i-1].coordinates.longitude,
        waypoints[i].coordinates.latitude,
        waypoints[i].coordinates.longitude
      );
      maxDistance = Math.max(maxDistance, distance);
    }
    
    return Math.round(maxDistance);
  }

  private generateNavigationNotes(route: Route): string[] {
    const notes: string[] = [];
    
    notes.push(`Total distance: ${Math.round(route.distance)}nm`);
    notes.push(`Estimated duration: ${Math.round(route.estimatedDuration)}h`);
    
    if (route.waypoints.length > 10) {
      notes.push('Route has multiple waypoints - careful navigation required');
    }
    
    return notes;
  }

  private calculateTotalDistance(waypoints: any[]): number {
    let total = 0;
    for (let i = 1; i < waypoints.length; i++) {
      total += this.calculateDistanceNm(
        waypoints[i-1].latitude,
        waypoints[i-1].longitude,
        waypoints[i].latitude,
        waypoints[i].longitude
      );
    }
    return Math.round(total);
  }

  private optimizeForDistance(required: any[], optional: any[]): any[] {
    // Simple nearest neighbor algorithm
    const optimized = [...required];
    const remaining = [...optional];
    
    while (remaining.length > 0) {
      const current = optimized[optimized.length - 1];
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      
      remaining.forEach((point, index) => {
        const distance = this.calculateDistanceNm(
          current.latitude,
          current.longitude,
          point.latitude,
          point.longitude
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      
      optimized.push(remaining[nearestIndex]);
      remaining.splice(nearestIndex, 1);
    }
    
    return optimized;
  }

  private async optimizeForTime(required: any[], optional: any[]): Promise<any[]> {
    // Would consider currents and weather
    return this.optimizeForDistance(required, optional);
  }

  private async optimizeForSafety(required: any[], optional: any[]): Promise<any[]> {
    // Would consider weather, daylight, and shelter
    return this.optimizeForDistance(required, optional);
  }

  private enforceMaxLegDistance(waypoints: any[], maxDistance: number): any[] {
    // Would add intermediate points if legs are too long
    return waypoints;
  }

  private getMagneticVariation(position: Coordinate): number {
    // Would calculate actual magnetic variation
    return 15; // Placeholder
  }

  private createDirectRoute(from: Coordinate, to: Coordinate): Route {
    const gc = this.calculateGreatCircle(from, to);
    return {
      id: 'DIRECT',
      name: 'Great Circle Route',
      waypoints: [
        {
          id: 'START',
          coordinates: from,
          estimatedArrival: new Date(),
        },
        {
          id: 'END',
          coordinates: to,
          estimatedArrival: new Date(Date.now() + gc.distance / 6 * 60 * 60 * 1000),
        },
      ],
      distance: gc.distance,
      estimatedDuration: gc.distance / 6,
      advantages: ['Shortest distance'],
      disadvantages: ['May cross open ocean'],
    };
  }

  private createRhumbLineRoute(from: Coordinate, to: Coordinate): Route {
    const line = turf.lineString([[from.longitude, from.latitude], [to.longitude, to.latitude]]);
    const distance = turf.length(line, { units: 'nauticalmiles' });
    
    return {
      id: 'RHUMB',
      name: 'Rhumb Line Route',
      waypoints: [
        {
          id: 'START',
          coordinates: from,
          estimatedArrival: new Date(),
        },
        {
          id: 'END',
          coordinates: to,
          estimatedArrival: new Date(Date.now() + distance / 6 * 60 * 60 * 1000),
        },
      ],
      distance,
      estimatedDuration: distance / 6,
      advantages: ['Constant compass bearing'],
      disadvantages: ['Longer than great circle'],
    };
  }

  private async createCoastalRoute(from: Coordinate, to: Coordinate): Promise<Route | null> {
    // Would follow coastline
    return null;
  }

  private async createDeepWaterRoute(from: Coordinate, to: Coordinate): Promise<Route | null> {
    // Would avoid shallow areas
    return null;
  }

  private async createScenicRoute(from: Coordinate, to: Coordinate): Promise<Route | null> {
    // Would include scenic waypoints
    return null;
  }

  private routesDiffer(route1: Route, route2: Route): boolean {
    return Math.abs(route1.distance - route2.distance) > 5;
  }

  private generateRouteRecommendations(routes: Route[]): string[] {
    const recommendations: string[] = [];
    
    const shortest = routes.reduce((min, r) => r.distance < min.distance ? r : min);
    recommendations.push(`Shortest route: ${shortest.name} (${Math.round(shortest.distance)}nm)`);
    
    return recommendations;
  }

  private async findNearestFuelPort(from: Coordinate, to: Coordinate, maxRange: number): Promise<any> {
    // Would query port database for fuel facilities
    return null;
  }

  async start() {
    try {
      await this.redis.connect();
      this.logger.info('Connected to Redis');
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.logger.info('Route agent started');
      
      // Register with orchestrator
      await this.registerWithOrchestrator();
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start route agent');
      process.exit(1);
    }
  }
  
  private async registerWithOrchestrator() {
    try {
      const response = await fetch('http://localhost:8081/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'route-agent',
          name: 'Route Planning Agent',
          description: 'Calculates optimal routes, waypoint optimization, and navigation planning',
          version: '1.0.0',
          status: 'active',
          tools: this.getTools(),
          resources: [],
          prompts: [],
          lastUpdated: new Date(),
          healthEndpoint: 'http://localhost:8086/health',
          performance: {
            averageResponseTime: 0,
            successRate: 1,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Registration failed: ${response.statusText}`);
      }
      
      this.logger.info('Registered with orchestrator');
    } catch (error) {
      this.logger.error({ error }, 'Failed to register with orchestrator');
    }
  }
}

// Start the agent
if (require.main === module) {
  const agent = new RouteAgent();
  agent.start().catch(console.error);
} 