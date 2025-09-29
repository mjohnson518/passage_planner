import { BaseAgent } from '@passage-planner/shared';
import { Tool } from '@modelcontextprotocol/sdk/types';
import { Logger } from 'pino';
import pino from 'pino';
import axios from 'axios';

export class SafetyAgent extends BaseAgent {
  private noaaApiKey: string;

  constructor() {
    const logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    });

    super(
      {
        name: 'Safety Planning Agent',
        version: '1.0.0',
        description: 'Provides safety information, navigation warnings, and emergency procedures',
        healthCheckInterval: 30000
      },
      logger
    );

    this.noaaApiKey = process.env.NOAA_API_KEY || '';
    this.setupTools();
  }

  protected getAgentSpecificHealth(): any {
    return {
      apiKeyConfigured: !!this.noaaApiKey,
      lastSafetyCheck: new Date(),
      warningsActive: true
    };
  }

  private setupTools() {
    const tools: Tool[] = [
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
              },
              description: 'Array of waypoints defining the route'
            },
            departure_time: {
              type: 'string',
              format: 'date-time',
              description: 'Planned departure time'
            },
            vessel_draft: {
              type: 'number',
              description: 'Vessel draft in feet'
            }
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
            country: {
              type: 'string',
              description: 'Country code (e.g., US, CA, UK)'
            }
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
            route_distance: { type: 'number', description: 'Distance in nautical miles' },
            estimated_duration: { type: 'string' },
            crew_size: { type: 'number' },
            vessel_type: {
              type: 'string',
              enum: ['sailboat', 'powerboat', 'catamaran']
            }
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
      }
    ];

    // Register tools with MCP server
    this.server.setRequestHandler('tools/list', async () => ({ tools }));

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request;

      try {
        this.logger.info({ tool: name, args }, 'Handling safety tool call');

        switch (name) {
          case 'check_route_safety':
            return await this.checkRouteSafety(args);
          case 'get_navigation_warnings':
            return await this.getNavigationWarnings(args.bounds);
          case 'get_emergency_contacts':
            return await this.getEmergencyContacts(args.latitude, args.longitude, args.country);
          case 'generate_safety_brief':
            return await this.generateSafetyBrief(args);
          case 'check_weather_hazards':
            return await this.checkWeatherHazards(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Safety tool call failed');
        throw error;
      }
    });
  }

  private async checkRouteSafety(args: any): Promise<any> {
    const { route, departure_time, vessel_draft } = args;

    const warnings = [];
    const hazards = [];
    const recommendations = [];

    // Analyze each segment of the route
    for (let i = 0; i < route.length - 1; i++) {
      const segment = {
        from: route[i],
        to: route[i + 1],
        distance: this.calculateDistance(route[i], route[i + 1])
      };

      // Check for known hazards (in production, query actual hazard databases)
      if (vessel_draft && vessel_draft > 10) {
        if (Math.random() > 0.7) {
          hazards.push({
            type: 'shallow_water',
            location: segment.from,
            description: `Shallow water area - minimum depth 12ft at MLW`,
            severity: 'moderate',
            avoidance: 'Stay in marked channel'
          });
        }
      }

      // Check for traffic separation schemes
      if (Math.random() > 0.8) {
        warnings.push({
          type: 'traffic_separation',
          location: segment.from,
          description: 'Traffic Separation Scheme in effect',
          action: 'Follow IMO ColRegs Rule 10'
        });
      }
    }

    // Add general safety recommendations
    recommendations.push('Ensure all safety equipment is accessible and functional');
    recommendations.push('File a float plan with a trusted contact');
    recommendations.push('Monitor VHF Channel 16 continuously');
    recommendations.push('Check weather updates every 4-6 hours');

    if (route.length > 10) {
      recommendations.push('Consider planning rest stops for long passage');
    }

    const safetyAnalysis = {
      routeAnalyzed: true,
      totalWaypoints: route.length,
      safetyScore: hazards.length === 0 ? 'Good' : hazards.length < 3 ? 'Fair' : 'Poor',
      warnings,
      hazards,
      recommendations,
      emergencyProcedures: {
        manOverboard: 'Execute immediate turn, deploy MOB equipment, call MAYDAY on Ch 16',
        engineFailure: 'Deploy sea anchor if needed, attempt repair, call for assistance if required',
        medicalEmergency: 'Administer first aid, contact USCG on Ch 16 for medical advice',
        collision: 'Check for injuries, assess damage, deploy life raft if sinking'
      }
    };

    this.logger.info({ hazards: hazards.length, warnings: warnings.length }, 'Route safety analyzed');
    return { content: [{ type: 'text', text: JSON.stringify(safetyAnalysis, null, 2) }] };
  }

  private async getNavigationWarnings(bounds: any): Promise<any> {
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

    // Mock weather hazard analysis
    const hazards = {
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
}

// Start the agent if run directly
if (require.main === module) {
  const agent = new SafetyAgent();
  agent.start().catch(console.error);
}

export default SafetyAgent;