"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteAgent = void 0;
const BaseAgent_1 = require("../../base/BaseAgent");
const turf = __importStar(require("@turf/turf"));
class RouteAgent extends BaseAgent_1.BaseAgent {
    constructor(redisUrl) {
        super({
            name: 'route-agent',
            description: 'Calculates optimal sailing routes',
            version: '1.0.0',
            cacheTTL: 3600 // 1 hour - routes recalculated frequently
        }, redisUrl);
    }
    getTools() {
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
    async handleToolCall(name, args) {
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
    async calculateRoute(params) {
        const { departure, destination, waypoints = [], vessel_speed = 5, optimization = 'distance', avoid_areas = [] } = params;
        // Optimize waypoint order if requested (includes departure and destination)
        let orderedWaypoints;
        if (optimization === 'distance' && waypoints.length > 0) {
            orderedWaypoints = await this.optimizeWaypoints(waypoints, departure, destination);
        }
        else {
            // Create full waypoint list without optimization
            orderedWaypoints = [departure, ...waypoints, destination];
        }
        // Calculate segments
        const segments = [];
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
                }
                else if (area.type === 'polygon') {
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
            }
            else {
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
    async calculateRhumbLine(from, to) {
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
    async calculateGreatCircle(from, to, intermediatePoints = 10) {
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
    async optimizeWaypoints(waypoints, startPoint, endPoint) {
        if (waypoints.length <= 1)
            return waypoints;
        // Use nearest neighbor algorithm for simple optimization (TSP approximation)
        const optimized = [];
        const remaining = [...waypoints];
        let current = startPoint || remaining.shift();
        optimized.push(current);
        while (remaining.length > 0) {
            let nearestIndex = 0;
            let nearestDistance = Infinity;
            for (let i = 0; i < remaining.length; i++) {
                const distance = this.calculateDistance(current.latitude, current.longitude, remaining[i].latitude, remaining[i].longitude);
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
    async calculateDetour(from, to, avoidAreas) {
        // Simplified detour calculation - offset midpoint perpendicular to route
        const midpoint = {
            latitude: (from.latitude + to.latitude) / 2,
            longitude: (from.longitude + to.longitude) / 2
        };
        // Offset midpoint perpendicular to route by 10nm
        const bearing = this.calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude);
        const offsetBearing = (bearing + 90) % 360;
        const offsetDistance = 10; // nautical miles
        const offsetPoint = this.calculateDestination(midpoint.latitude, midpoint.longitude, offsetDistance, offsetBearing);
        return [
            {
                from,
                to: offsetPoint,
                distance: this.calculateDistance(from.latitude, from.longitude, offsetPoint.latitude, offsetPoint.longitude),
                bearing: this.calculateBearing(from.latitude, from.longitude, offsetPoint.latitude, offsetPoint.longitude),
                estimatedTime: 0
            },
            {
                from: offsetPoint,
                to,
                distance: this.calculateDistance(offsetPoint.latitude, offsetPoint.longitude, to.latitude, to.longitude),
                bearing: this.calculateBearing(offsetPoint.latitude, offsetPoint.longitude, to.latitude, to.longitude),
                estimatedTime: 0
            }
        ];
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const point1 = turf.point([lon1, lat1]);
        const point2 = turf.point([lon2, lat2]);
        return turf.distance(point1, point2, { units: 'nauticalmiles' });
    }
    calculateBearing(lat1, lon1, lat2, lon2) {
        const point1 = turf.point([lon1, lat1]);
        const point2 = turf.point([lon2, lat2]);
        const bearing = turf.bearing(point1, point2);
        return (bearing + 360) % 360; // Normalize to 0-360
    }
    calculateDestination(lat, lon, distance, bearing) {
        const origin = turf.point([lon, lat]);
        const destination = turf.destination(origin, distance, bearing, { units: 'nauticalmiles' });
        return {
            latitude: destination.geometry.coordinates[1],
            longitude: destination.geometry.coordinates[0]
        };
    }
}
exports.RouteAgent = RouteAgent;
//# sourceMappingURL=RouteAgent.js.map