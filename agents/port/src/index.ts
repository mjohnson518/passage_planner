// Port Agent Implementation
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode 
} from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import pino from 'pino';
import { z } from 'zod';
import { createClient } from 'redis';
import { 
  Port, 
  PortFacility, 
  ContactInfo, 
  Coordinate 
} from '../../../shared/types/core.js';

// Input validation schemas
const PortInfoSchema = z.object({
  port_name: z.string().optional(),
  port_id: z.string().uuid().optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

const SearchPortsSchema = z.object({
  query: z.string().optional(),
  country: z.string().length(2).optional(),
  facilities: z.array(z.enum(['fuel', 'water', 'provisions', 'repairs', 'customs'])).optional(),
  near: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radius_nm: z.number().min(1).max(500).default(50),
  }).optional(),
  limit: z.number().min(1).max(50).default(10),
});

const MarinaAvailabilitySchema = z.object({
  port_id: z.string().uuid(),
  date: z.string().datetime(),
  boat_length: z.number().min(1).max(500),
  boat_draft: z.number().min(0).max(50),
});

export class PortAgent {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
  private db: Pool;
  private redis: ReturnType<typeof createClient>;
  private cacheExpiry = 3600; // 1 hour
  
  constructor() {
    this.server = new Server(
      {
        name: 'port-agent',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );
    
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    
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
        this.logger.info({ tool: name, args }, 'Processing tool request');
        
        switch (name) {
          case 'get_port_info':
            return await this.getPortInfo(args);
          case 'search_ports':
            return await this.searchPorts(args);
          case 'get_marina_availability':
            return await this.getMarinaAvailability(args);
          case 'get_entry_requirements':
            return await this.getEntryRequirements(args);
          case 'get_nearby_services':
            return await this.getNearbyServices(args);
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
        name: 'get_port_info',
        description: 'Get detailed information about a specific port including facilities and contacts',
        inputSchema: {
          type: 'object',
          properties: {
            port_name: { 
              type: 'string', 
              description: 'Name of the port (e.g., "Boston Harbor")' 
            },
            port_id: { 
              type: 'string', 
              description: 'UUID of the port if known' 
            },
            coordinates: {
              type: 'object',
              description: 'Coordinates to find nearest port',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            }
          }
        },
      },
      {
        name: 'search_ports',
        description: 'Search for ports by name, country, facilities, or proximity',
        inputSchema: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Search query for port name' 
            },
            country: { 
              type: 'string', 
              description: 'ISO 2-letter country code' 
            },
            facilities: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['fuel', 'water', 'provisions', 'repairs', 'customs']
              },
              description: 'Required facilities'
            },
            near: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                radius_nm: { 
                  type: 'number',
                  description: 'Search radius in nautical miles',
                  default: 50
                }
              }
            },
            limit: { 
              type: 'number', 
              default: 10,
              description: 'Maximum number of results' 
            }
          }
        },
      },
      {
        name: 'get_marina_availability',
        description: 'Check marina berth availability for a specific date and boat size',
        inputSchema: {
          type: 'object',
          properties: {
            port_id: { type: 'string' },
            date: { 
              type: 'string', 
              format: 'date-time',
              description: 'Arrival date' 
            },
            boat_length: { 
              type: 'number',
              description: 'Boat length in feet' 
            },
            boat_draft: { 
              type: 'number',
              description: 'Boat draft in feet' 
            }
          },
          required: ['port_id', 'date', 'boat_length', 'boat_draft']
        },
      },
      {
        name: 'get_entry_requirements',
        description: 'Get customs and immigration requirements for entering a port',
        inputSchema: {
          type: 'object',
          properties: {
            port_id: { type: 'string' },
            nationality: { 
              type: 'string',
              description: 'Nationality of crew (ISO 2-letter code)' 
            },
            vessel_flag: { 
              type: 'string',
              description: 'Flag state of vessel (ISO 2-letter code)' 
            }
          },
          required: ['port_id']
        },
      },
      {
        name: 'get_nearby_services',
        description: 'Find nearby marine services and suppliers',
        inputSchema: {
          type: 'object',
          properties: {
            port_id: { type: 'string' },
            service_types: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['chandlery', 'boatyard', 'sailmaker', 'electronics', 'provisioning', 'medical']
              }
            },
            radius_km: { 
              type: 'number',
              default: 10,
              description: 'Search radius in kilometers' 
            }
          },
          required: ['port_id']
        },
      }
    ];
  }
  
  private async getPortInfo(args: any) {
    const validated = PortInfoSchema.parse(args);
    
    // Try cache first
    const cacheKey = `port:${validated.port_id || validated.port_name || JSON.stringify(validated.coordinates)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return {
        content: [{
          type: 'text',
          text: cached,
        }],
      };
    }
    
    let port: Port | null = null;
    
    try {
      if (validated.port_id) {
        // Query by ID
        const result = await this.db.query(
          `SELECT p.*, 
                  ST_Y(p.coordinates::geometry) as latitude,
                  ST_X(p.coordinates::geometry) as longitude,
                  array_agg(DISTINCT pf.*) as facilities,
                  array_agg(DISTINCT pc.*) as contacts
           FROM ports p
           LEFT JOIN port_facilities pf ON p.id = pf.port_id
           LEFT JOIN port_contacts pc ON p.id = pc.port_id
           WHERE p.id = $1
           GROUP BY p.id`,
          [validated.port_id]
        );
        
        if (result.rows.length > 0) {
          port = this.mapRowToPort(result.rows[0]);
        }
      } else if (validated.port_name) {
        // Query by name (fuzzy search)
        const result = await this.db.query(
          `SELECT p.*, 
                  ST_Y(p.coordinates::geometry) as latitude,
                  ST_X(p.coordinates::geometry) as longitude,
                  array_agg(DISTINCT pf.*) as facilities,
                  array_agg(DISTINCT pc.*) as contacts,
                  similarity(p.name, $1) as sim
           FROM ports p
           LEFT JOIN port_facilities pf ON p.id = pf.port_id
           LEFT JOIN port_contacts pc ON p.id = pc.port_id
           WHERE p.name % $1
           GROUP BY p.id
           ORDER BY sim DESC
           LIMIT 1`,
          [validated.port_name]
        );
        
        if (result.rows.length > 0) {
          port = this.mapRowToPort(result.rows[0]);
        }
      } else if (validated.coordinates) {
        // Query by nearest coordinates
        const result = await this.db.query(
          `SELECT p.*, 
                  ST_Y(p.coordinates::geometry) as latitude,
                  ST_X(p.coordinates::geometry) as longitude,
                  ST_Distance(
                    p.coordinates::geography,
                    ST_MakePoint($2, $1)::geography
                  ) / 1852 as distance_nm,
                  array_agg(DISTINCT pf.*) as facilities,
                  array_agg(DISTINCT pc.*) as contacts
           FROM ports p
           LEFT JOIN port_facilities pf ON p.id = pf.port_id
           LEFT JOIN port_contacts pc ON p.id = pc.port_id
           GROUP BY p.id
           ORDER BY p.coordinates <-> ST_MakePoint($2, $1)::geometry
           LIMIT 1`,
          [validated.coordinates.latitude, validated.coordinates.longitude]
        );
        
        if (result.rows.length > 0) {
          port = this.mapRowToPort(result.rows[0]);
        }
      }
      
      if (!port) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Port not found'
        );
      }
      
      // Get additional details
      const tideStation = await this.getNearestTideStation(port.coordinates);
      const weatherZone = await this.getWeatherZone(port.coordinates);
      
      const response = {
        port,
        tide_station: tideStation,
        weather_zone: weatherZone,
        local_notices: await this.getLocalNotices(port.id),
      };
      
      const responseText = JSON.stringify(response, null, 2);
      
      // Cache the result
      await this.redis.setEx(cacheKey, this.cacheExpiry, responseText);
      
      return {
        content: [{
          type: 'text',
          text: responseText,
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to get port info');
      throw error;
    }
  }
  
  private async searchPorts(args: any) {
    const validated = SearchPortsSchema.parse(args);
    
    let query = `
      SELECT p.*, 
             ST_Y(p.coordinates::geometry) as latitude,
             ST_X(p.coordinates::geometry) as longitude,
             array_agg(DISTINCT pf.facility_type) as available_facilities
      FROM ports p
      LEFT JOIN port_facilities pf ON p.id = pf.port_id AND pf.available = true
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 0;
    
    // Add search conditions
    if (validated.query) {
      paramCount++;
      query += ` AND p.name ILIKE $${paramCount}`;
      params.push(`%${validated.query}%`);
    }
    
    if (validated.country) {
      paramCount++;
      query += ` AND p.country = $${paramCount}`;
      params.push(validated.country);
    }
    
    if (validated.near) {
      paramCount += 3;
      query += ` AND ST_DWithin(
        p.coordinates::geography,
        ST_MakePoint($${paramCount-1}, $${paramCount-2})::geography,
        $${paramCount} * 1852
      )`;
      params.push(
        validated.near.latitude,
        validated.near.longitude,
        validated.near.radius_nm
      );
    }
    
    query += ` GROUP BY p.id`;
    
    // Filter by required facilities
    if (validated.facilities && validated.facilities.length > 0) {
      query += ` HAVING array_agg(DISTINCT pf.facility_type) @> ARRAY[${
        validated.facilities.map(() => {
          paramCount++;
          return `$${paramCount}`;
        }).join(',')
      }]::varchar[]`;
      params.push(...validated.facilities);
    }
    
    // Add ordering and limit
    if (validated.near) {
      query += ` ORDER BY p.coordinates <-> ST_MakePoint($${params.indexOf(validated.near.longitude) + 1}, $${params.indexOf(validated.near.latitude) + 1})::geometry`;
    } else {
      query += ` ORDER BY p.name`;
    }
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(validated.limit);
    
    try {
      const result = await this.db.query(query, params);
      
      const ports = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        country: row.country,
        coordinates: {
          latitude: row.latitude,
          longitude: row.longitude,
        },
        facilities: row.available_facilities || [],
        distance_nm: row.distance_nm,
      }));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ ports, total: ports.length }, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to search ports');
      throw error;
    }
  }
  
  private async getMarinaAvailability(args: any) {
    const validated = MarinaAvailabilitySchema.parse(args);
    
    try {
      // Check marina capacity
      const capacityResult = await this.db.query(
        `SELECT m.*, p.name as port_name
         FROM marinas m
         JOIN ports p ON m.port_id = p.id
         WHERE m.port_id = $1`,
        [validated.port_id]
      );
      
      if (capacityResult.rows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ 
              available: false, 
              reason: 'No marina found at this port' 
            }, null, 2),
          }],
        };
      }
      
      const marina = capacityResult.rows[0];
      
      // Check size constraints
      if (validated.boat_length > marina.max_boat_length) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ 
              available: false, 
              reason: `Boat length ${validated.boat_length}ft exceeds marina maximum ${marina.max_boat_length}ft` 
            }, null, 2),
          }],
        };
      }
      
      if (validated.boat_draft > marina.max_draft) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ 
              available: false, 
              reason: `Boat draft ${validated.boat_draft}ft exceeds marina maximum ${marina.max_draft}ft` 
            }, null, 2),
          }],
        };
      }
      
      // Check availability for date
      const bookingResult = await this.db.query(
        `SELECT COUNT(*) as booked_berths
         FROM marina_bookings
         WHERE marina_id = $1
           AND $2::date BETWEEN arrival_date AND departure_date
           AND status = 'confirmed'`,
        [marina.id, validated.date]
      );
      
      const bookedBerths = parseInt(bookingResult.rows[0].booked_berths);
      const availableBerths = marina.total_berths - bookedBerths;
      
      const response = {
        available: availableBerths > 0,
        marina: {
          name: marina.name,
          port: marina.port_name,
          total_berths: marina.total_berths,
          available_berths: availableBerths,
          max_boat_length: marina.max_boat_length,
          max_draft: marina.max_draft,
          amenities: marina.amenities,
          daily_rate: marina.daily_rate,
          weekly_rate: marina.weekly_rate,
          monthly_rate: marina.monthly_rate,
        },
        contact: {
          phone: marina.phone,
          email: marina.email,
          vhf_channel: marina.vhf_channel,
        },
        booking_instructions: availableBerths > 0 
          ? 'Contact marina directly to reserve berth'
          : 'Marina is fully booked for this date',
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to check marina availability');
      throw error;
    }
  }
  
  private async getEntryRequirements(args: any) {
    const validated = z.object({
      port_id: z.string().uuid(),
      nationality: z.string().length(2).optional(),
      vessel_flag: z.string().length(2).optional(),
    }).parse(args);
    
    try {
      // Get port country
      const portResult = await this.db.query(
        'SELECT country FROM ports WHERE id = $1',
        [validated.port_id]
      );
      
      if (portResult.rows.length === 0) {
        throw new McpError(ErrorCode.InvalidRequest, 'Port not found');
      }
      
      const portCountry = portResult.rows[0].country;
      
      // Get entry requirements
      const requirementsResult = await this.db.query(
        `SELECT * FROM entry_requirements 
         WHERE country = $1 
           AND (nationality = $2 OR nationality IS NULL)
           AND (vessel_flag = $3 OR vessel_flag IS NULL)
         ORDER BY nationality DESC, vessel_flag DESC
         LIMIT 1`,
        [portCountry, validated.nationality, validated.vessel_flag]
      );
      
      const requirements = requirementsResult.rows[0] || {
        visa_required: true,
        visa_on_arrival: false,
        max_stay_days: 90,
        customs_declaration_required: true,
        quarantine_required: false,
        cruising_permit_required: true,
      };
      
      // Get required documents
      const documentsResult = await this.db.query(
        `SELECT document_type, description, mandatory
         FROM required_documents
         WHERE country = $1
         ORDER BY mandatory DESC, document_type`,
        [portCountry]
      );
      
      const response = {
        port_country: portCountry,
        nationality: validated.nationality,
        vessel_flag: validated.vessel_flag,
        requirements: {
          visa: {
            required: requirements.visa_required,
            on_arrival_available: requirements.visa_on_arrival,
            max_stay_days: requirements.max_stay_days,
          },
          customs: {
            declaration_required: requirements.customs_declaration_required,
            inspection_likely: requirements.inspection_likely,
          },
          health: {
            quarantine_required: requirements.quarantine_required,
            vaccination_required: requirements.vaccination_required,
            covid_test_required: requirements.covid_test_required,
          },
          cruising: {
            permit_required: requirements.cruising_permit_required,
            permit_cost: requirements.cruising_permit_cost,
            permit_duration_days: requirements.permit_duration_days,
          },
        },
        required_documents: documentsResult.rows,
        notes: requirements.notes,
        last_updated: requirements.last_updated,
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to get entry requirements');
      throw error;
    }
  }
  
  private async getNearbyServices(args: any) {
    const validated = z.object({
      port_id: z.string().uuid(),
      service_types: z.array(z.string()).optional(),
      radius_km: z.number().default(10),
    }).parse(args);
    
    try {
      // Get port coordinates
      const portResult = await this.db.query(
        `SELECT ST_Y(coordinates::geometry) as lat, 
                ST_X(coordinates::geometry) as lon
         FROM ports WHERE id = $1`,
        [validated.port_id]
      );
      
      if (portResult.rows.length === 0) {
        throw new McpError(ErrorCode.InvalidRequest, 'Port not found');
      }
      
      const { lat, lon } = portResult.rows[0];
      
      // Find nearby services
      let query = `
        SELECT s.*,
               ST_Distance(
                 s.coordinates::geography,
                 ST_MakePoint($2, $1)::geography
               ) / 1000 as distance_km
        FROM marine_services s
        WHERE ST_DWithin(
          s.coordinates::geography,
          ST_MakePoint($2, $1)::geography,
          $3 * 1000
        )
      `;
      
      const params = [lat, lon, validated.radius_km];
      
      if (validated.service_types && validated.service_types.length > 0) {
        query += ` AND service_type = ANY($4)`;
        params.push(validated.service_types);
      }
      
      query += ` ORDER BY distance_km LIMIT 20`;
      
      const servicesResult = await this.db.query(query, params);
      
      const services = servicesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.service_type,
        distance_km: parseFloat(row.distance_km.toFixed(2)),
        address: row.address,
        phone: row.phone,
        email: row.email,
        website: row.website,
        hours: row.hours,
        services_offered: row.services_offered,
        brands_carried: row.brands_carried,
        emergency_service: row.emergency_service,
        rating: row.rating,
        reviews_count: row.reviews_count,
      }));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ 
            services, 
            total: services.length,
            search_radius_km: validated.radius_km 
          }, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to get nearby services');
      throw error;
    }
  }
  
  private mapRowToPort(row: any): Port {
    return {
      id: row.id,
      name: row.name,
      coordinates: {
        latitude: row.latitude,
        longitude: row.longitude,
      },
      country: row.country,
      facilities: (row.facilities || [])
        .filter((f: any) => f && f.port_id)
        .map((f: any) => ({
          type: f.facility_type,
          available: f.available,
          details: f.details,
        })),
      contacts: (row.contacts || [])
        .filter((c: any) => c && c.port_id)
        .map((c: any) => ({
          type: c.contact_type,
          name: c.name,
          phone: c.phone,
          email: c.email,
          vhfChannel: c.vhf_channel,
        })),
    };
  }
  
  private async getNearestTideStation(coordinates: Coordinate): Promise<any> {
    // This would query NOAA tide stations
    // Placeholder implementation
    return {
      station_id: 'NEAREST_STATION',
      name: 'Nearest Tide Station',
      distance_nm: 5.2,
    };
  }
  
  private async getWeatherZone(coordinates: Coordinate): Promise<any> {
    // This would determine the marine weather zone
    // Placeholder implementation
    return {
      zone_id: 'ANZ250',
      name: 'Coastal Waters from Cape Cod to Merrimack River',
    };
  }
  
  private async getLocalNotices(portId: string): Promise<any[]> {
    // This would fetch local notices to mariners
    // Placeholder implementation
    return [];
  }
  
  async start() {
    try {
      await this.redis.connect();
      this.logger.info('Connected to Redis');
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.logger.info('Port agent started');
      
      // Register with orchestrator
      await this.registerWithOrchestrator();
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start port agent');
      process.exit(1);
    }
  }
  
  private async registerWithOrchestrator() {
    try {
      const response = await fetch('http://localhost:8081/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'port-agent',
          name: 'Port Information Agent',
          description: 'Provides port facilities, marina availability, and entry requirements',
          version: '1.0.0',
          status: 'active',
          tools: this.getTools(),
          resources: [],
          prompts: [],
          lastUpdated: new Date(),
          healthEndpoint: 'http://localhost:8084/health',
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
  const agent = new PortAgent();
  agent.start().catch(console.error);
}
