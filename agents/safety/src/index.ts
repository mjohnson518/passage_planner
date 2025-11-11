import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Tool } from '@modelcontextprotocol/sdk/types';
import { Logger } from 'pino';
import pino from 'pino';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { DepthCalculator } from './utils/depth-calculator';
import { AreaChecker } from './utils/area-checker';
import { SafetyAuditLogger } from './utils/audit-logger';
import { WeatherPatternAnalyzer } from './utils/weather-pattern-analyzer';
import { SafetyOverrideManager } from './utils/override-manager';
import { CrewExperience } from '../../../shared/src/types/safety';

export class SafetyAgent {
  private server: Server;
  private noaaApiKey: string;
  protected logger: Logger;
  
  // Production-grade utilities
  private depthCalculator: DepthCalculator;
  private areaChecker: AreaChecker;
  private auditLogger: SafetyAuditLogger;
  private weatherAnalyzer: WeatherPatternAnalyzer;
  private overrideManager: SafetyOverrideManager;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    });

    this.server = new Server(
      {
        name: 'Safety Planning Agent',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.noaaApiKey = process.env.NOAA_API_KEY || '';
    
    // Initialize production-grade utilities
    this.depthCalculator = new DepthCalculator();
    this.areaChecker = new AreaChecker();
    this.auditLogger = new SafetyAuditLogger(this.logger);
    this.weatherAnalyzer = new WeatherPatternAnalyzer();
    this.overrideManager = new SafetyOverrideManager(this.logger);
    
    this.setupTools();
  }

  async initialize(): Promise<void> {
    this.logger.info('Safety Agent initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Safety Agent shutdown');
  }

  getTools(): Tool[] {
    // Return all 8 safety tools (5 original + 3 new production features)
    return [
      {
        name: 'check_route_safety',
        description: 'Analyze safety considerations along a planned route',
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
            departure_time: { type: 'string', format: 'date-time' },
            vessel_draft: { type: 'number' }
          },
          required: ['route']
        }
      },
      {
        name: 'get_navigation_warnings',
        description: 'Get current navigation warnings for an area',
        inputSchema: {
          type: 'object',
          properties: {
            bounds: {
              type: 'object',
              properties: {
                north: { type: 'number' },
                south: { type: 'number' },
                east: { type: 'number' },
                west: { type: 'number' }
              },
              required: ['north', 'south', 'east', 'west']
            }
          },
          required: ['bounds']
        }
      },
      {
        name: 'get_emergency_contacts',
        description: 'Get emergency contact information for a region',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            country: { type: 'string' }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'generate_safety_brief',
        description: 'Generate a comprehensive safety briefing for a passage',
        inputSchema: {
          type: 'object',
          properties: {
            departure_port: { type: 'string' },
            destination_port: { type: 'string' },
            route_distance: { type: 'number' },
            estimated_duration: { type: 'string' },
            crew_size: { type: 'number' },
            vessel_type: { type: 'string', enum: ['sailboat', 'powerboat', 'catamaran'] }
          },
          required: ['departure_port', 'destination_port']
        }
      },
      {
        name: 'check_weather_hazards',
        description: 'Check for weather-related safety hazards',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            time_range: {
              type: 'object',
              properties: {
                start: { type: 'string', format: 'date-time' },
                end: { type: 'string', format: 'date-time' }
              }
            }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'check_depth_safety',
        description: 'Check for shallow water hazards with safety margins',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              },
              required: ['latitude', 'longitude']
            },
            charted_depth: { type: 'number', description: 'Charted depth in feet at MLW' },
            vessel_draft: { type: 'number', description: 'Vessel draft in feet' },
            tidal_height: { type: 'number', description: 'Tidal height adjustment in feet (optional)' },
            crew_experience: { 
              type: 'string', 
              enum: ['novice', 'intermediate', 'advanced', 'professional'],
              description: 'Crew experience level affects safety margins'
            }
          },
          required: ['location', 'charted_depth', 'vessel_draft']
        }
      },
      {
        name: 'check_restricted_areas',
        description: 'Check if route passes through restricted or hazardous areas',
        inputSchema: {
          type: 'object',
          properties: {
            waypoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                },
                required: ['latitude', 'longitude']
              }
            }
          },
          required: ['waypoints']
        }
      },
      {
        name: 'apply_safety_override',
        description: 'Apply user override to a safety warning (with justification)',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            warning_id: { type: 'string' },
            warning_type: { type: 'string' },
            justification: { type: 'string', description: 'Minimum 10 characters explaining override decision' },
            witnessed_by: { type: 'string', description: 'Crew member witness (required for critical warnings)' },
            expiration_hours: { type: 'number', description: 'Hours until override expires (optional)' }
          },
          required: ['user_id', 'warning_id', 'warning_type', 'justification']
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    const requestId = uuidv4();
    
    try {
      this.logger.info({ tool: name, args, requestId }, 'Handling safety tool call');

      switch (name) {
        case 'check_route_safety':
          return await this.checkRouteSafety(args, requestId);
        case 'get_navigation_warnings':
          return await this.getNavigationWarnings(args.bounds);
        case 'get_emergency_contacts':
          return await this.getEmergencyContacts(args.latitude, args.longitude, args.country);
        case 'generate_safety_brief':
          return await this.generateSafetyBrief(args);
        case 'check_weather_hazards':
          return await this.checkWeatherHazards(args);
        case 'check_depth_safety':
          return await this.checkDepthSafety(args);
        case 'check_restricted_areas':
          return await this.checkRestrictedAreas(args);
        case 'apply_safety_override':
          return await this.applySafetyOverride(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      this.logger.error({ error, tool: name, requestId }, 'Safety tool call failed');
      throw error;
    }
  }

  protected getAgentSpecificHealth(): any {
    return {
      apiKeyConfigured: !!this.noaaApiKey,
      lastSafetyCheck: new Date(),
      warningsActive: true
    };
  }

  private setupTools() {
    // Register tools with MCP server - tools will be accessed via getTools() by tests
    // MCP server handlers would be set up here in production
  }

  private async checkRouteSafety(args: any, requestId: string): Promise<any> {
    const { route, departure_time, vessel_draft, crew_experience } = args;

    // Validate required parameters
    if (!route || !Array.isArray(route) || route.length === 0) {
      throw new Error('Route is required and must be a non-empty array');
    }

    // Validate each waypoint
    for (const waypoint of route) {
      if (!waypoint.latitude || !waypoint.longitude) {
        throw new Error('Each waypoint must have latitude and longitude');
      }
      if (waypoint.latitude < -90 || waypoint.latitude > 90) {
        throw new Error(`Invalid latitude: ${waypoint.latitude}. Must be between -90 and 90`);
      }
      if (waypoint.longitude < -180 || waypoint.longitude > 180) {
        throw new Error(`Invalid longitude: ${waypoint.longitude}. Must be between -180 and 180`);
      }
    }

    const warnings = [];
    const hazards = [];
    const recommendations = [];

    // Check for restricted areas along the route
    const restrictedAreaConflicts = this.areaChecker.checkRoute(route);
    
    for (const [areaId, area] of restrictedAreaConflicts) {
      warnings.push({
        id: uuidv4(),
        type: 'regulatory',
        area: area.bounds,
        description: `Route passes through ${area.name} (${area.type})`,
        action: area.restrictions.join('; '),
        severity: area.type === 'military' ? 'urgent' : 'warning',
        issued: new Date().toISOString(),
        source: area.authority,
      });

      hazards.push({
        id: areaId,
        type: 'restricted_area',
        location: route[0], // Approximate
        severity: area.type === 'military' ? 'high' : 'moderate',
        description: `${area.name}: ${area.description}`,
        avoidance: area.restrictions[0],
      });

      this.auditLogger.logHazardDetected(
        requestId,
        undefined,
        'restricted_area',
        route[0],
        area.type === 'military' ? 'high' : 'moderate',
        area.name
      );
    }

    // Analyze each segment of the route
    for (let i = 0; i < route.length - 1; i++) {
      const segment = {
        from: route[i],
        to: route[i + 1],
        distance: this.calculateDistance(route[i], route[i + 1])
      };

      // Check for shallow water hazards if vessel draft is provided
      if (vessel_draft) {
        // In production, this would query actual depth database
        // For now, simulate depth checking
        const simulatedDepth = 15 + Math.random() * 20; // 15-35 feet
        const simulatedTide = -1 + Math.random() * 3; // -1 to +2 feet
        
        try {
          const depthCalc = this.depthCalculator.calculateDepthSafety(
            segment.from,
            simulatedDepth,
            vessel_draft,
            simulatedTide
          );

          if (depthCalc.isGroundingRisk) {
            hazards.push({
              id: uuidv4(),
              type: 'shallow_water',
              location: segment.from,
              description: `Shallow water: ${depthCalc.recommendation}`,
              severity: depthCalc.severity,
              avoidance: depthCalc.severity === 'critical' 
                ? 'DO NOT PROCEED - find alternative route' 
                : 'Monitor depth closely, consider waiting for higher tide',
            });

            this.auditLogger.logHazardDetected(
              requestId,
              undefined,
              'shallow_water',
              segment.from,
              depthCalc.severity,
              depthCalc.recommendation
            );
          }
        } catch (error) {
          this.logger.warn({ error, segment }, 'Depth calculation failed for segment');
        }
      }
    }

    // Add general safety recommendations
    recommendations.push('Ensure all safety equipment is accessible and functional');
    recommendations.push('File a float plan with a trusted contact');
    recommendations.push('Monitor VHF Channel 16 continuously');
    recommendations.push('Check weather updates every 4-6 hours');

    // Adjust recommendations based on crew experience
    if (crew_experience) {
      const experienceLevel = crew_experience as CrewExperience['level'];
      if (experienceLevel === 'novice') {
        recommendations.push('NOVICE CREW: Consider having experienced crew aboard or delaying until more experience gained');
        recommendations.push('NOVICE CREW: Practice MOB drills before departure');
        recommendations.push('NOVICE CREW: Avoid night passages and heavy weather');
      } else if (experienceLevel === 'intermediate') {
        recommendations.push('Consider weather conditions carefully given experience level');
        recommendations.push('Have experienced crew available for consultation via radio');
      }
    }

    if (route.length > 10) {
      recommendations.push('Consider planning rest stops for long passage');
    }

    // Calculate safety score with crew experience factoring
    let safetyScore: string;
    const hazardCount = hazards.length;
    const warningCount = warnings.length;
    
    if (hazardCount === 0 && warningCount === 0) {
      safetyScore = 'Excellent';
    } else if (hazardCount === 0 && warningCount < 2) {
      safetyScore = 'Good';
    } else if (hazardCount < 2 && warningCount < 4) {
      safetyScore = crew_experience === 'novice' ? 'Fair' : 'Good';
    } else if (hazardCount < 4) {
      safetyScore = 'Fair';
    } else {
      safetyScore = 'Poor';
    }

    const safetyAnalysis = {
      requestId,
      routeAnalyzed: true,
      totalWaypoints: route.length,
      safetyScore,
      warnings,
      hazards,
      recommendations,
      crewExperienceConsidered: !!crew_experience,
      emergencyProcedures: {
        manOverboard: 'Execute immediate turn, deploy MOB equipment, call MAYDAY on Ch 16',
        engineFailure: 'Deploy sea anchor if needed, attempt repair, call for assistance if required',
        medicalEmergency: 'Administer first aid, contact USCG on Ch 16 for medical advice',
        collision: 'Check for injuries, assess damage, deploy life raft if sinking'
      }
    };

    // Log the analysis to audit trail
    this.auditLogger.logRouteAnalysis(
      requestId,
      undefined,
      route,
      hazards.length,
      warnings.length,
      safetyScore,
      ['Safety Agent Analysis', 'Restricted Area Database'],
      hazards.length === 0 ? 'high' : 'medium'
    );

    this.logger.info({ hazards: hazards.length, warnings: warnings.length, requestId }, 'Route safety analyzed');
    return { content: [{ type: 'text', text: JSON.stringify(safetyAnalysis, null, 2) }] };
  }

  private async getNavigationWarnings(bounds: any): Promise<any> {
    // Validate bounds
    if (!bounds) {
      throw new Error('Bounds are required');
    }
    if (!bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      throw new Error('Bounds must include north, south, east, and west');
    }
    if (bounds.north < bounds.south) {
      throw new Error('North latitude must be greater than south latitude');
    }
    
    try {
      // In production, query NOAA or other navigation warning services
      const warnings = [
        {
          id: 'LNM-2024-0123',
          type: 'obstruction',
          title: 'Submerged Object Reported',
          description: 'Submerged container reported 2nm SW of Point Alpha',
          location: {
            latitude: (bounds.north + bounds.south) / 2,
            longitude: (bounds.east + bounds.west) / 2
          },
          issued: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          expires: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
          severity: 'urgent'
        },
        {
          id: 'NTM-2024-0456',
          type: 'military_exercise',
          title: 'Military Exercise Area',
          description: 'Naval exercises in progress, area closed to civilian traffic',
          area: 'Box bounded by coordinates...',
          schedule: 'Daily 0800-1600 local',
          issued: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          severity: 'warning'
        },
        {
          id: 'SM-2024-0789',
          type: 'weather',
          title: 'Small Craft Advisory',
          description: 'Winds 20-25 kts, seas 6-8 ft',
          area: 'Coastal waters from Cape X to Cape Y',
          issued: new Date().toISOString(),
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          severity: 'advisory'
        }
      ];

      this.logger.info({ count: warnings.length }, 'Navigation warnings retrieved');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            area: bounds,
            warningCount: warnings.length,
            warnings,
            lastUpdated: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      this.logger.error({ error, bounds }, 'Failed to get navigation warnings');
      throw error;
    }
  }

  private async getEmergencyContacts(lat: number, lon: number, country?: string): Promise<any> {
    // Validate coordinates
    if (lat === undefined || lon === undefined) {
      throw new Error('Latitude and longitude are required');
    }
    if (lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90`);
    }
    if (lon < -180 || lon > 180) {
      throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180`);
    }
    
    // Determine country from coordinates if not provided
    const detectedCountry = country || 'US';

    const contacts = {
      location: { latitude: lat, longitude: lon },
      country: detectedCountry,
      emergency: {
        coastGuard: {
          name: 'US Coast Guard',
          vhf: 'Channel 16 (156.8 MHz)',
          phone: '+1-800-368-5647',
          mmsi: '003669999',
          email: 'D1-SMB-D1CommandCenter@uscg.mil'
        },
        rescue: {
          name: 'Search and Rescue',
          phone: '911 (US) or 112 (International)',
          vhf: 'Channel 16'
        }
      },
      towingServices: [
        {
          name: 'SeaTow',
          phone: '+1-800-473-2869',
          vhf: 'Channel 16, then switch to working channel',
          coverage: 'US Coastal waters',
          membership: 'Required for free service'
        },
        {
          name: 'BoatUS',
          phone: '+1-800-391-4869',
          vhf: 'Channel 16, then switch to working channel',
          coverage: 'US Coastal waters',
          membership: 'Required for free service'
        }
      ],
      medical: {
        poisonControl: '+1-800-222-1222',
        medicalAdvice: {
          service: 'USCG Medical Advisory',
          contact: 'Via Coast Guard on Channel 16'
        },
        nearestHospital: {
          name: 'Coastal Regional Medical Center',
          distance: '15.3 nm',
          phone: '+1-555-0199',
          helicopterCapable: true
        }
      },
      weather: {
        vhf: {
          wx1: '162.550 MHz',
          wx2: '162.400 MHz',
          wx3: '162.475 MHz'
        },
        phone: '+1-800-472-0039',
        text: 'Text WX to 77177'
      },
      customs: {
        cbp: {
          name: 'Customs and Border Protection',
          phone: '+1-800-973-2867',
          app: 'CBP ROAM',
          requirement: 'Report arrival immediately'
        }
      }
    };

    this.logger.info({ lat, lon, country: detectedCountry }, 'Emergency contacts retrieved');
    return { content: [{ type: 'text', text: JSON.stringify(contacts, null, 2) }] };
  }

  private async generateSafetyBrief(args: any): Promise<any> {
    const {
      departure_port,
      destination_port,
      route_distance = 100,
      estimated_duration = '24 hours',
      crew_size = 2,
      vessel_type = 'sailboat'
    } = args;

    // Validate required parameters
    if (!departure_port) {
      throw new Error('Departure port is required');
    }
    if (!destination_port) {
      throw new Error('Destination port is required');
    }
    if (crew_size <= 0) {
      throw new Error('Crew size must be greater than 0');
    }

    const safetyBrief = {
      passage: {
        from: departure_port,
        to: destination_port,
        distance: `${route_distance} nm`,
        duration: estimated_duration,
        crew: crew_size,
        vessel: vessel_type
      },
      preDeparture: {
        checklist: [
          'Weather briefing obtained and reviewed',
          'Float plan filed with shore contact',
          'All safety equipment checked and accessible',
          'Life jackets fitted for all crew',
          'Fire extinguishers checked and accessible',
          'First aid kit stocked and location known',
          'EPIRB/PLB registered and tested',
          'Flares within date and accessible',
          'Navigation lights tested',
          'VHF radio tested on Channel 16',
          'Engine and systems checked',
          'Fuel and water supplies adequate (+20% reserve)',
          'Provisions for duration plus 48 hours',
          'Charts and navigation equipment ready',
          'Anchor and ground tackle inspected'
        ]
      },
      crewBriefing: {
        topics: [
          'Watch schedule and responsibilities',
          'Location of all safety equipment',
          'Man overboard procedures',
          'Fire fighting procedures',
          'Abandon ship procedures',
          'Use of VHF radio and MAYDAY procedures',
          'Location and use of through-hulls',
          'Seasickness management',
          'Harness and tether policy',
          'Night watch procedures'
        ],
        watchSchedule: this.generateWatchSchedule(crew_size, estimated_duration)
      },
      emergencyProcedures: {
        manOverboard: [
          'Shout "MAN OVERBOARD"',
          'Throw flotation immediately',
          'Point continuously at person',
          'Hit MOB on GPS',
          'Execute Quick Stop or Williamson Turn',
          'Prepare recovery equipment',
          'Call MAYDAY if unable to recover'
        ],
        fire: [
          'Shout "FIRE" and location',
          'Attack base of fire with extinguisher',
          'Turn off fuel/gas/electricity to area',
          'If uncontrollable, prepare to abandon ship',
          'Call MAYDAY with position'
        ],
        flooding: [
          'Locate source of water ingress',
          'Start manual and electric pumps',
          'Use damage control kit if hull breach',
          'Prepare to abandon if uncontrollable',
          'Call MAYDAY with position and POB'
        ],
        medicalEmergency: [
          'Administer first aid as trained',
          'Call Coast Guard on Ch 16 for medical advice',
          'Document symptoms and vital signs',
          'Prepare for medevac if advised',
          'Divert to nearest port if necessary'
        ]
      },
      communication: {
        vhf: {
          emergency: 'Channel 16',
          working: 'Channel 68, 69, 71, 72, 78A',
          weather: 'WX1-7 as appropriate for area'
        },
        checkIn: {
          schedule: 'Every 6 hours or at waypoints',
          contact: 'Shore contact via phone/text when in range',
          backup: 'Email via satellite if equipped'
        }
      },
      weatherMonitoring: {
        sources: [
          'VHF Weather broadcasts',
          'Weather apps when in cell range',
          'Barometer readings every 4 hours',
          'Visual observation of clouds and seas'
        ],
        abortCriteria: [
          'Sustained winds over 30 kts',
          'Seas over 10 ft',
          'Visibility under 1 nm',
          'Thunderstorms likely',
          'Crew injury or severe seasickness'
        ]
      }
    };

    this.logger.info({ from: departure_port, to: destination_port }, 'Safety brief generated');
    return { content: [{ type: 'text', text: JSON.stringify(safetyBrief, null, 2) }] };
  }

  private async checkWeatherHazards(args: any): Promise<any> {
    const { latitude, longitude, time_range } = args;

    // Validate coordinates
    if (latitude === undefined || longitude === undefined) {
      throw new Error('Latitude and longitude are required');
    }
    if (latitude < -90 || latitude > 90) {
      throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180`);
    }

    // Mock weather hazard analysis
    const hazards: any = {
      location: { latitude, longitude },
      timeRange: time_range || {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      },
      hazardsDetected: [],
      marine: {
        windSpeed: { max: 25, average: 15, unit: 'knots' },
        waveHeight: { max: 8, average: 4, unit: 'feet' },
        visibility: { min: 3, unit: 'nm' }
      }
    };

    // Check for various weather hazards
    if (hazards.marine.windSpeed.max > 30) {
      hazards.hazardsDetected.push({
        type: 'gale_warning',
        severity: 'high',
        description: 'Gale force winds expected',
        timing: '12-24 hours'
      });
    }

    if (hazards.marine.windSpeed.max > 20) {
      hazards.hazardsDetected.push({
        type: 'small_craft_advisory',
        severity: 'moderate',
        description: 'Small craft should exercise caution',
        timing: 'Next 24 hours'
      });
    }

    if (hazards.marine.visibility.min < 1) {
      hazards.hazardsDetected.push({
        type: 'fog',
        severity: 'moderate',
        description: 'Dense fog possible',
        timing: 'Early morning hours'
      });
    }

    // Add thunderstorm risk (mock)
    if (Math.random() > 0.7) {
      hazards.hazardsDetected.push({
        type: 'thunderstorms',
        severity: 'high',
        description: 'Thunderstorms possible with dangerous lightning',
        timing: 'Afternoon hours',
        action: 'Seek shelter, avoid being highest point'
      });
    }

    this.logger.info({ lat: latitude, lon: longitude, hazards: hazards.hazardsDetected.length }, 'Weather hazards checked');
    return { content: [{ type: 'text', text: JSON.stringify(hazards, null, 2) }] };
  }

  private calculateDistance(from: any, to: any): number {
    // Haversine formula for distance between two points
    const R = 3440; // Earth radius in nautical miles
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const deltaLat = (to.latitude - from.latitude) * Math.PI / 180;
    const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c * 10) / 10;
  }

  private generateWatchSchedule(crewSize: number, duration: string): any {
    if (crewSize === 1) {
      return {
        type: 'single-handed',
        notes: 'Set alarms every 20 minutes, heave-to for rest when needed'
      };
    } else if (crewSize === 2) {
      return {
        type: 'two-watch',
        schedule: [
          '0000-0400: Crew A',
          '0400-0800: Crew B',
          '0800-1200: Crew A',
          '1200-1600: Crew B',
          '1600-2000: Crew A',
          '2000-0000: Crew B'
        ]
      };
    } else {
      return {
        type: 'three-watch',
        schedule: [
          '0000-0400: Watch 1',
          '0400-0800: Watch 2',
          '0800-1200: Watch 3',
          '1200-1600: Watch 1',
          '1600-2000: Watch 2',
          '2000-0000: Watch 3'
        ]
      };
    }
  }

  /**
   * NEW TOOL: Check depth safety with comprehensive margin calculations
   */
  private async checkDepthSafety(args: any): Promise<any> {
    const { location, charted_depth, vessel_draft, tidal_height, crew_experience } = args;

    // Validate inputs
    if (!location || !location.latitude || !location.longitude) {
      throw new Error('Location with latitude and longitude is required');
    }
    if (charted_depth === undefined || charted_depth < 0) {
      throw new Error('Charted depth is required and must be non-negative');
    }
    if (vessel_draft === undefined || vessel_draft <= 0) {
      throw new Error('Vessel draft is required and must be positive');
    }

    // Calculate depth safety
    const depthAnalysis = this.depthCalculator.calculateDepthSafety(
      location,
      charted_depth,
      vessel_draft,
      tidal_height || 0
    );

    // Adjust clearance requirements based on crew experience
    if (crew_experience) {
      const adjustedClearance = this.depthCalculator.adjustForCrewExperience(
        depthAnalysis.minimumClearance,
        crew_experience
      );
      
      depthAnalysis.minimumClearance = adjustedClearance;
      depthAnalysis.isGroundingRisk = depthAnalysis.clearanceAvailable < adjustedClearance;
    }

    const result = {
      location,
      analysis: depthAnalysis,
      crewExperienceAdjusted: !!crew_experience,
      chartDatum: 'MLW', // Mean Low Water
      safetyMargins: {
        standard: '20% of draft or 2ft minimum',
        applied: crew_experience === 'novice' ? '30% of draft (novice crew)' : '20% of draft (standard)'
      }
    };

    this.logger.info({ 
      location, 
      chartedDepth: charted_depth, 
      vesselDraft: vessel_draft,
      clearance: depthAnalysis.clearanceAvailable,
      isGroundingRisk: depthAnalysis.isGroundingRisk,
      severity: depthAnalysis.severity
    }, 'Depth safety checked');

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  /**
   * NEW TOOL: Check restricted areas along route
   */
  private async checkRestrictedAreas(args: any): Promise<any> {
    const { waypoints } = args;

    // Validate inputs
    if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
      throw new Error('Waypoints array is required and must not be empty');
    }

    // Check route against restricted areas
    const conflicts = this.areaChecker.checkRoute(waypoints);

    const result = {
      waypoints_checked: waypoints.length,
      restricted_areas_found: conflicts.size,
      conflicts: Array.from(conflicts.values()).map(area => ({
        id: area.id,
        name: area.name,
        type: area.type,
        description: area.description,
        restrictions: area.restrictions,
        authority: area.authority,
        penalty: area.penalty,
        schedule: area.schedule,
        severity: area.type === 'military' ? 'critical' : area.type === 'marine_sanctuary' ? 'high' : 'moderate'
      })),
      recommendations: conflicts.size > 0 
        ? ['Adjust route to avoid restricted areas', 'Contact authorities for permission if area must be transited', 'Maintain required distance from boundaries']
        : ['No restricted area conflicts detected']
    };

    this.logger.info({ 
      waypointsChecked: waypoints.length, 
      conflictsFound: conflicts.size 
    }, 'Restricted areas checked');

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  /**
   * NEW TOOL: Apply safety override with justification
   */
  private async applySafetyOverride(args: any): Promise<any> {
    const { user_id, warning_id, warning_type, justification, witnessed_by, expiration_hours } = args;

    // Validate override request
    const validation = this.overrideManager.validateOverride({
      userId: user_id,
      warningId: warning_id,
      warningType: warning_type,
      justification,
      witnessedBy: witnessed_by,
      expirationHours: expiration_hours,
    });

    if (!validation.isValid || !validation.canOverride) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            canOverride: validation.canOverride,
            reason: validation.reason,
            requiresWitness: validation.requiresWitness,
            requiresAdditionalApproval: validation.requiresAdditionalApproval,
          }, null, 2)
        }]
      };
    }

    // Apply the override
    const override = this.overrideManager.applyOverride({
      userId: user_id,
      warningId: warning_id,
      warningType: warning_type,
      justification,
      witnessedBy: witnessed_by,
      expirationHours: expiration_hours,
    });

    // Log to audit trail
    this.auditLogger.logOverride(uuidv4(), override);

    const result = {
      success: true,
      override: {
        id: override.id,
        timestamp: override.timestamp,
        expiresAt: override.expiresAt,
        justification: override.justification,
        witnessedBy: override.witnessedBy,
      },
      warning: '⚠️ SAFETY OVERRIDE APPLIED - You have acknowledged and accepted responsibility for overriding this safety warning. This override has been logged and may be reviewed in case of incident.',
      acknowledgment: 'I understand that by overriding this safety warning, I accept full responsibility for any consequences.'
    };

    this.logger.warn({ 
      userId: user_id,
      warningId: warning_id,
      overrideId: override.id 
    }, '⚠️ SAFETY OVERRIDE APPLIED');

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
}

// Start the agent if run directly
/* istanbul ignore next */
if (require.main === module) {
  const agent = new SafetyAgent();
  agent.initialize().then(() => {
    console.log('Safety Agent running...');
  }).catch(console.error);
}

export default SafetyAgent;