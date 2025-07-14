// Safety Agent Implementation
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode 
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import pino from 'pino';
import { z } from 'zod';
import { createClient } from 'redis';
import { Pool } from 'pg';
import { 
  Coordinate,
  NavigationalHazard,
  ContactInfo,
  TimeWindow
} from '../../../shared/types/core.js';

// Input validation schemas
const SafetyWarningsSchema = z.object({
  area: z.object({
    topLeft: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
    bottomRight: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
  }),
  types: z.array(z.enum(['navigation', 'weather', 'security', 'environmental'])).optional(),
  severity: z.enum(['all', 'urgent', 'important']).default('all'),
});

const EmergencyContactsSchema = z.object({
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  radius_nm: z.number().min(1).max(500).default(100),
  contact_types: z.array(z.enum(['coast_guard', 'marine_police', 'medical', 'towing', 'repairs'])).optional(),
});

const SafetyChecklistSchema = z.object({
  voyage_type: z.enum(['coastal', 'offshore', 'ocean']),
  boat_type: z.enum(['sailboat', 'powerboat', 'catamaran']),
  crew_size: z.number().min(1).max(20),
  departure_date: z.string().datetime(),
});

const FloatPlanSchema = z.object({
  vessel: z.object({
    name: z.string(),
    type: z.string(),
    length: z.number(),
    registration: z.string(),
    color: z.string(),
    sail_number: z.string().optional(),
  }),
  crew: z.array(z.object({
    name: z.string(),
    age: z.number(),
    experience: z.enum(['novice', 'intermediate', 'experienced']),
    medical_conditions: z.string().optional(),
  })),
  voyage: z.object({
    departure_port: z.string(),
    destination_port: z.string(),
    departure_time: z.string().datetime(),
    eta: z.string().datetime(),
    route: z.array(z.object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string().optional(),
    })),
  }),
  emergency_contacts: z.array(z.object({
    name: z.string(),
    relationship: z.string(),
    phone: z.string(),
    email: z.string().optional(),
  })),
  safety_equipment: z.object({
    epirb: z.boolean(),
    life_raft: z.boolean(),
    vhf_radio: z.boolean(),
    flares: z.boolean(),
    first_aid: z.boolean(),
  }),
});

export class SafetyAgent {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  private redis: ReturnType<typeof createClient>;
  private db: Pool;
  private noaaApiKey: string;
  private cacheExpiry = 1800; // 30 minutes for safety data
  
  constructor() {
    this.server = new Server(
      {
        name: 'safety-agent',
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
    
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    
    this.noaaApiKey = process.env.NOAA_API_KEY || '';
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));
    
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        this.logger.info({ tool: name, args }, 'Processing safety tool request');
        
        switch (name) {
          case 'get_safety_warnings':
            return await this.getSafetyWarnings(args);
          case 'get_emergency_contacts':
            return await this.getEmergencyContacts(args);
          case 'generate_safety_checklist':
            return await this.generateSafetyChecklist(args);
          case 'check_navigation_hazards':
            return await this.checkNavigationHazards(args);
          case 'create_float_plan':
            return await this.createFloatPlan(args);
          case 'get_weather_alerts':
            return await this.getWeatherAlerts(args);
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
        name: 'get_safety_warnings',
        description: 'Get active safety warnings and notices for a specific area',
        inputSchema: {
          type: 'object',
          properties: {
            area: {
              type: 'object',
              properties: {
                topLeft: {
                  type: 'object',
                  properties: {
                    latitude: { type: 'number' },
                    longitude: { type: 'number' }
                  },
                  required: ['latitude', 'longitude']
                },
                bottomRight: {
                  type: 'object',
                  properties: {
                    latitude: { type: 'number' },
                    longitude: { type: 'number' }
                  },
                  required: ['latitude', 'longitude']
                }
              },
              required: ['topLeft', 'bottomRight']
            },
            types: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['navigation', 'weather', 'security', 'environmental']
              }
            },
            severity: {
              type: 'string',
              enum: ['all', 'urgent', 'important'],
              default: 'all'
            }
          },
          required: ['area']
        },
      },
      {
        name: 'get_emergency_contacts',
        description: 'Get emergency contacts for a specific location',
        inputSchema: {
          type: 'object',
          properties: {
            coordinates: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              },
              required: ['latitude', 'longitude']
            },
            radius_nm: {
              type: 'number',
              default: 100,
              description: 'Search radius in nautical miles'
            },
            contact_types: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['coast_guard', 'marine_police', 'medical', 'towing', 'repairs']
              }
            }
          },
          required: ['coordinates']
        },
      },
      {
        name: 'generate_safety_checklist',
        description: 'Generate a comprehensive safety checklist for the voyage',
        inputSchema: {
          type: 'object',
          properties: {
            voyage_type: {
              type: 'string',
              enum: ['coastal', 'offshore', 'ocean']
            },
            boat_type: {
              type: 'string',
              enum: ['sailboat', 'powerboat', 'catamaran']
            },
            crew_size: { type: 'number' },
            departure_date: {
              type: 'string',
              format: 'date-time'
            }
          },
          required: ['voyage_type', 'boat_type', 'crew_size', 'departure_date']
        },
      },
      {
        name: 'check_navigation_hazards',
        description: 'Check for navigation hazards along a route',
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
            corridor_width_nm: {
              type: 'number',
              default: 5,
              description: 'Width of corridor to check in nautical miles'
            }
          },
          required: ['route']
        },
      },
      {
        name: 'create_float_plan',
        description: 'Create a float plan to file with authorities or emergency contacts',
        inputSchema: {
          type: 'object',
          properties: {
            vessel: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                length: { type: 'number' },
                registration: { type: 'string' },
                color: { type: 'string' },
                sail_number: { type: 'string' }
              },
              required: ['name', 'type', 'length', 'registration', 'color']
            },
            crew: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  age: { type: 'number' },
                  experience: {
                    type: 'string',
                    enum: ['novice', 'intermediate', 'experienced']
                  },
                  medical_conditions: { type: 'string' }
                },
                required: ['name', 'age', 'experience']
              }
            },
            voyage: {
              type: 'object',
              properties: {
                departure_port: { type: 'string' },
                destination_port: { type: 'string' },
                departure_time: { type: 'string', format: 'date-time' },
                eta: { type: 'string', format: 'date-time' },
                route: {
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
                }
              },
              required: ['departure_port', 'destination_port', 'departure_time', 'eta', 'route']
            },
            emergency_contacts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  relationship: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string' }
                },
                required: ['name', 'relationship', 'phone']
              }
            },
            safety_equipment: {
              type: 'object',
              properties: {
                epirb: { type: 'boolean' },
                life_raft: { type: 'boolean' },
                vhf_radio: { type: 'boolean' },
                flares: { type: 'boolean' },
                first_aid: { type: 'boolean' }
              }
            }
          },
          required: ['vessel', 'crew', 'voyage', 'emergency_contacts', 'safety_equipment']
        },
      },
      {
        name: 'get_weather_alerts',
        description: 'Get severe weather alerts for maritime areas',
        inputSchema: {
          type: 'object',
          properties: {
            zones: {
              type: 'array',
              items: { type: 'string' },
              description: 'Marine zone IDs (e.g., ANZ250)'
            },
            severity: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['extreme', 'severe', 'moderate', 'minor']
              }
            }
          },
          required: ['zones']
        },
      }
    ];
  }

  private async getSafetyWarnings(args: any) {
    const validated = SafetyWarningsSchema.parse(args);
    
    const cacheKey = `safety:warnings:${JSON.stringify(validated)}`;
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
      // Fetch from multiple sources
      const [noaaWarnings, localNotices, piracyReports] = await Promise.all([
        this.fetchNOAAWarnings(validated.area),
        this.fetchLocalNotices(validated.area),
        this.fetchPiracyReports(validated.area),
      ]);
      
      // Filter by type if specified
      let warnings = [...noaaWarnings, ...localNotices, ...piracyReports];
      
      if (validated.types && validated.types.length > 0) {
        warnings = warnings.filter(w => validated.types!.includes(w.type));
      }
      
      // Filter by severity
      if (validated.severity !== 'all') {
        warnings = warnings.filter(w => {
          if (validated.severity === 'urgent') return w.severity === 'urgent';
          if (validated.severity === 'important') return ['urgent', 'important'].includes(w.severity);
          return true;
        });
      }
      
      // Sort by severity and date
      warnings.sort((a, b) => {
        const severityOrder: Record<string, number> = { urgent: 0, important: 1, routine: 2 };
        const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (sevDiff !== 0) return sevDiff;
        return new Date(b.issued).getTime() - new Date(a.issued).getTime();
      });
      
      const response = {
        warnings,
        total: warnings.length,
        area: validated.area,
        last_updated: new Date().toISOString(),
        sources: ['NOAA', 'Local Notice to Mariners', 'ICC Piracy Reporting Centre'],
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
      this.logger.error({ error }, 'Failed to get safety warnings');
      throw error;
    }
  }

  private async getEmergencyContacts(args: any) {
    const validated = EmergencyContactsSchema.parse(args);
    
    try {
      // Query database for emergency contacts
      let query = `
        SELECT ec.*, 
               ST_Distance(
                 ec.coordinates::geography,
                 ST_MakePoint($2, $1)::geography
               ) / 1852 as distance_nm
        FROM emergency_contacts ec
        WHERE ST_DWithin(
          ec.coordinates::geography,
          ST_MakePoint($2, $1)::geography,
          $3 * 1852
        )
      `;
      
      const params: any[] = [
        validated.coordinates.latitude,
        validated.coordinates.longitude,
        validated.radius_nm
      ];
      
      if (validated.contact_types && validated.contact_types.length > 0) {
        query += ` AND contact_type = ANY($4)`;
        params.push(validated.contact_types);
      }
      
      const result = await this.db.query(query + ` ORDER BY distance_nm LIMIT 20`, params);
      
      // Group contacts by type
      const contactsByType: Record<string, any[]> = {};
      
      result.rows.forEach(row => {
        if (!contactsByType[row.contact_type]) {
          contactsByType[row.contact_type] = [];
        }
        
        contactsByType[row.contact_type].push({
          name: row.name,
          distance_nm: parseFloat(row.distance_nm.toFixed(1)),
          phone: row.phone,
          vhf_channel: row.vhf_channel,
          email: row.email,
          available_24h: row.available_24h,
          coordinates: {
            latitude: row.latitude,
            longitude: row.longitude,
          },
          services: row.services,
          languages: row.languages,
        });
      });
      
      // Add international emergency numbers
      const internationalContacts = {
        maritime_distress: {
          vhf: 'Channel 16',
          dsc: 'Channel 70',
          phone: '+1-999 (via satellite)',
        },
        medical_advice: {
          service: 'Radio Medical',
          phone: '+32 2 479 0690',
          email: 'radiomedical@health.fgov.be',
        },
      };
      
      const response = {
        local_contacts: contactsByType,
        international_contacts: internationalContacts,
        search_center: validated.coordinates,
        search_radius_nm: validated.radius_nm,
        emergency_procedures: this.getEmergencyProcedures(),
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to get emergency contacts');
      throw error;
    }
  }

  private async generateSafetyChecklist(args: any) {
    const validated = SafetyChecklistSchema.parse(args);
    
    const checklist = {
      voyage_type: validated.voyage_type,
      boat_type: validated.boat_type,
      crew_size: validated.crew_size,
      departure_date: validated.departure_date,
      categories: {
        pre_departure: {
          weather: [
            'Check weather forecast for entire route',
            'Identify potential weather windows',
            'Review seasonal weather patterns',
            'Check for tropical storms/hurricanes',
          ],
          vessel: [
            'Complete engine checks',
            'Test all navigation lights',
            'Check bilge pumps',
            'Verify steering system',
            'Test VHF radio and DSC',
            'Check EPIRB registration and battery',
          ],
          safety_equipment: this.getSafetyEquipmentChecklist(validated.voyage_type),
          crew: [
            'Brief crew on safety procedures',
            'Assign watch schedules',
            'Review man overboard procedures',
            'Check crew medical conditions and medications',
          ],
          navigation: [
            'Update charts and publications',
            'Plot intended route',
            'Identify safe harbors and bailout ports',
            'Check GPS and backup navigation',
          ],
          documentation: [
            'Vessel registration',
            'Crew passports and visas',
            'Insurance documents',
            'Float plan filed',
            'Emergency contact list',
          ],
        },
        underway: {
          watchkeeping: [
            'Maintain proper lookout',
            'Log position hourly',
            'Monitor weather updates',
            'Check for traffic',
          ],
          safety: [
            'Crew wearing appropriate safety gear',
            'Jacklines rigged in rough weather',
            'Regular bilge checks',
            'Monitor fuel consumption',
          ],
        },
        emergency_procedures: {
          man_overboard: [
            'Shout "Man Overboard"',
            'Throw flotation immediately',
            'Assign spotter',
            'Mark MOB on GPS',
            'Execute recovery maneuver',
          ],
          fire: [
            'Alert all crew',
            'Shut off fuel/gas',
            'Use appropriate extinguisher',
            'Prepare to abandon ship if needed',
          ],
          flooding: [
            'Locate source of water',
            'Start all bilge pumps',
            'Use damage control materials',
            'Prepare to abandon ship if needed',
          ],
          abandon_ship: [
            'Send distress signal',
            'Don survival suits/PFDs',
            'Launch life raft',
            'Grab ditch bag',
            'Stay together',
          ],
        },
      },
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(checklist, null, 2),
      }],
    };
  }

  private async checkNavigationHazards(args: any) {
    const validated = z.object({
      route: z.array(z.object({
        latitude: z.number(),
        longitude: z.number(),
      })),
      corridor_width_nm: z.number().default(5),
    }).parse(args);
    
    try {
      // Create route corridor polygon
      const corridorPolygon = this.createRouteCorridor(
        validated.route,
        validated.corridor_width_nm
      );
      
      // Query hazards within corridor
      const hazardsResult = await this.db.query(
        `SELECT h.*,
                ST_Distance(
                  h.location::geography,
                  ST_MakeLine(
                    ARRAY[${validated.route.map((p, i) => 
                      `ST_MakePoint(${p.longitude}, ${p.latitude})`
                    ).join(',')}]
                  )::geography
                ) / 1852 as distance_from_route_nm
         FROM navigation_hazards h
         WHERE ST_Intersects(
           h.location::geometry,
           ST_GeomFromText($1, 4326)
         )
         ORDER BY distance_from_route_nm`,
        [corridorPolygon]
      );
      
      // Group hazards by type
      const hazardsByType: Record<string, NavigationalHazard[]> = {};
      
      hazardsResult.rows.forEach(row => {
        const hazard: NavigationalHazard = {
          type: row.hazard_type,
          location: {
            latitude: row.latitude,
            longitude: row.longitude,
          },
          description: row.description,
          avoidanceRadius: row.avoidance_radius_m,
        };
        
        if (!hazardsByType[row.hazard_type]) {
          hazardsByType[row.hazard_type] = [];
        }
        hazardsByType[row.hazard_type].push(hazard);
      });
      
      // Check for restricted areas
      const restrictedAreas = await this.checkRestrictedAreas(validated.route);
      
      const response = {
        route_hazards: hazardsByType,
        restricted_areas: restrictedAreas,
        total_hazards: hazardsResult.rows.length,
        corridor_width_nm: validated.corridor_width_nm,
        recommendations: this.generateHazardRecommendations(hazardsByType),
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to check navigation hazards');
      throw error;
    }
  }

  private async createFloatPlan(args: any) {
    const validated = FloatPlanSchema.parse(args);
    
    try {
      // Generate float plan document
      const floatPlan = {
        plan_id: `FP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        vessel: validated.vessel,
        crew: validated.crew,
        voyage: {
          ...validated.voyage,
          distance_nm: this.calculateRouteDistance(validated.voyage.route),
          estimated_duration_hours: this.calculateEstimatedDuration(
            validated.voyage.departure_time,
            validated.voyage.eta
          ),
        },
        emergency_contacts: validated.emergency_contacts,
        safety_equipment: validated.safety_equipment,
        float_plan_contacts: [
          {
            organization: 'US Coast Guard',
            instructions: 'If vessel is overdue by 4 hours, contact USCG',
          },
          ...validated.emergency_contacts.map(ec => ({
            name: ec.name,
            phone: ec.phone,
            instructions: `Emergency contact - ${ec.relationship}`,
          })),
        ],
        search_and_rescue_info: {
          vessel_description: `${validated.vessel.color} ${validated.vessel.type}, ${validated.vessel.length}ft`,
          distinguishing_features: validated.vessel.sail_number || 'N/A',
          last_known_position_plan: validated.voyage.route,
          survival_equipment: this.getSurvivalEquipmentList(validated.safety_equipment),
        },
        filing_instructions: [
          'File this plan with a responsible person on shore',
          'Provide copies to all emergency contacts',
          'Check in at predetermined times during voyage',
          'Close float plan upon safe arrival',
        ],
      };
      
      // Store float plan in database
      await this.db.query(
        `INSERT INTO float_plans 
         (id, vessel_name, departure_time, eta, route, emergency_contacts, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          floatPlan.plan_id,
          validated.vessel.name,
          validated.voyage.departure_time,
          validated.voyage.eta,
          JSON.stringify(validated.voyage.route),
          JSON.stringify(validated.emergency_contacts),
          new Date(),
        ]
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(floatPlan, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to create float plan');
      throw error;
    }
  }

  private async getWeatherAlerts(args: any) {
    const validated = z.object({
      zones: z.array(z.string()),
      severity: z.array(z.string()).optional(),
    }).parse(args);
    
    try {
      const alerts: any[] = [];
      
      // Fetch alerts for each zone
      for (const zone of validated.zones) {
        const response = await axios.get(
          `https://api.weather.gov/alerts/active/zone/${zone}`,
          {
            headers: {
              'User-Agent': 'PassagePlanner/1.0',
            },
          }
        );
        
        if (response.data.features) {
          alerts.push(...response.data.features.map((feature: any) => ({
            id: feature.id,
            zone: zone,
            event: feature.properties.event,
            severity: feature.properties.severity,
            urgency: feature.properties.urgency,
            headline: feature.properties.headline,
            description: feature.properties.description,
            instruction: feature.properties.instruction,
            effective: feature.properties.effective,
            expires: feature.properties.expires,
            areas: feature.properties.areaDesc,
          })));
        }
      }
      
      // Filter by severity if specified
      let filteredAlerts = alerts;
      if (validated.severity && validated.severity.length > 0) {
        filteredAlerts = alerts.filter(a => 
          validated.severity!.includes(a.severity.toLowerCase())
        );
      }
      
      // Sort by severity and effective date
      filteredAlerts.sort((a, b) => {
        const severityOrder: Record<string, number> = { 
          extreme: 0, 
          severe: 1, 
          moderate: 2, 
          minor: 3 
        };
        const sevDiff = severityOrder[a.severity.toLowerCase()] - 
                       severityOrder[b.severity.toLowerCase()];
        if (sevDiff !== 0) return sevDiff;
        return new Date(a.effective).getTime() - new Date(b.effective).getTime();
      });
      
      const response = {
        alerts: filteredAlerts,
        total: filteredAlerts.length,
        zones: validated.zones,
        summary: this.summarizeAlerts(filteredAlerts),
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to get weather alerts');
      throw error;
    }
  }

  // Helper methods
  private async fetchNOAAWarnings(area: any): Promise<any[]> {
    // Implementation would fetch from NOAA API
    return [];
  }

  private async fetchLocalNotices(area: any): Promise<any[]> {
    // Implementation would fetch from Local Notice to Mariners
    return [];
  }

  private async fetchPiracyReports(area: any): Promise<any[]> {
    // Implementation would fetch from ICC Piracy Reporting Centre
    return [];
  }

  private getEmergencyProcedures(): any {
    return {
      distress_signals: {
        vhf: 'MAYDAY on Channel 16',
        dsc: 'Distress button on Channel 70',
        epirb: 'Activate EPIRB',
        visual: 'Red flares, orange smoke',
      },
      abandon_ship: [
        'Send distress signal',
        'Don life jackets',
        'Launch life raft',
        'Take EPIRB and ditch bag',
        'Stay together',
      ],
    };
  }

  private getSafetyEquipmentChecklist(voyageType: string): string[] {
    const basic = [
      'Life jackets for all crew',
      'Throwable flotation device',
      'Fire extinguishers',
      'Sound signals',
      'Visual distress signals',
      'First aid kit',
    ];
    
    const coastal = [
      ...basic,
      'VHF radio with DSC',
      'GPS chartplotter',
      'Anchor with adequate rode',
      'Bilge pump',
    ];
    
    const offshore = [
      ...coastal,
      'Life raft',
      'EPIRB',
      'SSB radio or satellite phone',
      'Abandon ship bag',
      'Storm sails',
      'Sea anchor/drogue',
    ];
    
    const ocean = [
      ...offshore,
      'Watermaker or extra water',
      'Extended medical kit',
      'Spare parts kit',
      'Emergency rudder',
      'Multiple means of communication',
    ];
    
    switch (voyageType) {
      case 'coastal': return coastal;
      case 'offshore': return offshore;
      case 'ocean': return ocean;
      default: return basic;
    }
  }

  private createRouteCorridor(route: Coordinate[], widthNm: number): string {
    // Simplified implementation - would use proper GIS calculations
    const points: string[] = [];
    route.forEach(point => {
      points.push(`${point.longitude} ${point.latitude}`);
    });
    return `LINESTRING(${points.join(',')})`;
  }

  private async checkRestrictedAreas(route: Coordinate[]): Promise<any[]> {
    // Would check against database of restricted areas
    return [];
  }

  private generateHazardRecommendations(hazards: Record<string, NavigationalHazard[]>): string[] {
    const recommendations: string[] = [];
    
    if (hazards.shoal?.length > 0) {
      recommendations.push('Monitor depth carefully near marked shoals');
    }
    if (hazards.rock?.length > 0) {
      recommendations.push('Give wide berth to charted rocks');
    }
    if (hazards.wreck?.length > 0) {
      recommendations.push('Avoid areas with submerged wrecks');
    }
    if (hazards.restricted_area?.length > 0) {
      recommendations.push('Check restrictions and obtain permissions if needed');
    }
    
    return recommendations;
  }

  private calculateRouteDistance(route: any[]): number {
    let distance = 0;
    for (let i = 1; i < route.length; i++) {
      distance += this.calculateDistance(
        route[i-1].latitude,
        route[i-1].longitude,
        route[i].latitude,
        route[i].longitude
      );
    }
    return Math.round(distance);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private calculateEstimatedDuration(departure: string, eta: string): number {
    const dep = new Date(departure);
    const arr = new Date(eta);
    return (arr.getTime() - dep.getTime()) / (1000 * 60 * 60);
  }

  private getSurvivalEquipmentList(equipment: any): string[] {
    const list: string[] = [];
    if (equipment.epirb) list.push('EPIRB');
    if (equipment.life_raft) list.push('Life raft');
    if (equipment.vhf_radio) list.push('VHF radio');
    if (equipment.flares) list.push('Flares');
    if (equipment.first_aid) list.push('First aid kit');
    return list;
  }

  private summarizeAlerts(alerts: any[]): any {
    const summary: Record<string, number> = {
      extreme: 0,
      severe: 0,
      moderate: 0,
      minor: 0,
    };
    
    alerts.forEach(alert => {
      const severity = alert.severity.toLowerCase();
      if (severity in summary) {
        summary[severity]++;
      }
    });
    
    return summary;
  }

  async start() {
    try {
      await this.redis.connect();
      this.logger.info('Connected to Redis');
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.logger.info('Safety agent started');
      
      // Register with orchestrator
      await this.registerWithOrchestrator();
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start safety agent');
      process.exit(1);
    }
  }
  
  private async registerWithOrchestrator() {
    try {
      const response = await fetch('http://localhost:8081/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'safety-agent',
          name: 'Safety Agent',
          description: 'Provides safety warnings, emergency contacts, and voyage safety planning',
          version: '1.0.0',
          status: 'active',
          tools: this.getTools(),
          resources: [],
          prompts: [],
          lastUpdated: new Date(),
          healthEndpoint: 'http://localhost:8085/health',
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
  const agent = new SafetyAgent();
  agent.start().catch(console.error);
} 