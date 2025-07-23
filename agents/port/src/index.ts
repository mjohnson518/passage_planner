import { BaseAgent, PortDatabaseService, CacheManager } from '@passage-planner/shared';
import { Logger } from 'pino';
import pino from 'pino';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

export class PortAgent extends BaseAgent {
  private portService: PortDatabaseService;
  private cache: CacheManager;
  
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
        name: 'Port Information Agent',
        version: '2.0.0',
        description: 'Provides port and marina information using OpenStreetMap data',
        healthCheckInterval: 30000,
      },
      logger
    );
    
    this.cache = new CacheManager(logger);
    this.portService = new PortDatabaseService(this.cache, logger);
    
    this.setupTools();
  }
  
  protected getAgentSpecificHealth(): any {
    return {
      portServiceActive: true,
      cacheStatus: 'active',
      lastQueryTime: new Date()
    };
  }
  
  private setupTools() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_ports',
            description: 'Search for ports near a location or by name',
            inputSchema: {
              type: 'object',
              properties: {
                latitude: { type: 'number', minimum: -90, maximum: 90 },
                longitude: { type: 'number', minimum: -180, maximum: 180 },
                radius: { type: 'number', minimum: 1, maximum: 500, default: 50 },
                name: { type: 'string', description: 'Optional port name filter' },
                facilities: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by facilities (fuel, water, repair, etc.)'
                }
              },
              required: ['latitude', 'longitude']
            }
          },
          {
            name: 'get_port_details',
            description: 'Get detailed information about a specific port',
            inputSchema: {
              type: 'object',
              properties: {
                portId: { type: 'string' }
              },
              required: ['portId']
            }
          },
          {
            name: 'find_emergency_harbors',
            description: 'Find safe harbors for emergency situations',
            inputSchema: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                maxDistance: { type: 'number', description: 'Maximum distance in nm', default: 50 },
                draft: { type: 'number', description: 'Vessel draft in meters' }
              },
              required: ['latitude', 'longitude']
            }
          }
        ]
      };
    });
    
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'search_ports':
            return await this.searchPorts(args);
            
          case 'get_port_details':
            return await this.getPortDetails(args);
            
          case 'find_emergency_harbors':
            return await this.findEmergencyHarbors(args);
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Tool execution failed');
        throw error;
      }
    });
  }
  
  private async searchPorts(args: any): Promise<any> {
    const { latitude, longitude, radius = 50, name, facilities } = args;
    
    try {
      let ports = await this.portService.searchPortsNearby(
        latitude,
        longitude,
        radius
      );
      
      // Apply name filter if provided
      if (name) {
        ports = ports.filter(p => p.name.toLowerCase().includes(name.toLowerCase()));
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${ports.length} ports within ${radius}nm of ${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
          },
          {
            type: 'data',
            data: ports
          }
        ]
      };
    } catch (error) {
      this.logger.error({ error, args }, 'Failed to search ports');
      return {
        content: [{
          type: 'text',
          text: `Unable to search ports: ${(error as Error).message}`
        }],
        isError: true
      };
    }
  }
  
  private async getPortDetails(args: any): Promise<any> {
    const { portId } = args;
    
    try {
      const details = await this.portService.getPortDetails(portId);
      
      if (!details) {
        return {
          content: [{
            type: 'text',
            text: `Port ${portId} not found`
          }],
          isError: true
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatPortDetails(details)
          },
          {
            type: 'data',
            data: details
          }
        ]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Unable to retrieve port details: ${(error as Error).message}`
        }],
        isError: true
      };
    }
  }
  
  private async findEmergencyHarbors(args: any): Promise<any> {
    const { latitude, longitude, maxDistance = 50, draft } = args;
    
    try {
      // Get multiple safe harbors by searching nearby
      const nearbyPorts = await this.portService.searchPortsNearby(
        latitude,
        longitude,
        maxDistance
      );
      
      // Filter for safe harbors
      const safeHarbors = [];
      for (const port of nearbyPorts) {
        const details = await this.portService.getPortDetails(port.id);
        if (details && details.type !== 'anchorage') {
          // Filter by draft if provided
          if (!draft || !details.navigation?.depth || details.navigation.depth >= draft) {
            safeHarbors.push(details);
          }
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: safeHarbors.length > 0
              ? `Found ${safeHarbors.length} emergency harbors within ${maxDistance}nm`
              : 'No suitable emergency harbors found in range'
          },
          {
            type: 'data',
            data: safeHarbors
          }
        ]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Unable to find emergency harbors: ${(error as Error).message}`
        }],
        isError: true
      };
    }
  }
  
  private formatPortDetails(port: any): string {
    const lines = [
      `⚓ ${port.name}`,
      `Type: ${port.type || 'Marina'}`,
      `Location: ${port.coordinates.latitude.toFixed(4)}°, ${port.coordinates.longitude.toFixed(4)}°`,
      ''
    ];
    
    if (port.facilities) {
      lines.push('**Facilities:**');
      const facilities = port.facilities;
      if (facilities.fuel) lines.push('⛽ Fuel available');
      if (facilities.water) lines.push('💧 Water available');
      if (facilities.electricity) lines.push('⚡ Shore power');
      if (facilities.repair) lines.push('🔧 Repair services');
      if (facilities.haulOut) lines.push('🏗️ Haul out facilities');
      if (facilities.customs) lines.push('🛂 Customs clearance');
      lines.push('');
    }
    
    if (port.navigation) {
      lines.push('**Navigation:**');
      if (port.navigation.depth) lines.push(`Depth: ${port.navigation.depth}m`);
      if (port.navigation.tidal) lines.push('⚠️ Tidal restrictions apply');
      if (port.navigation.approach) lines.push(`Approach: ${port.navigation.approach}`);
      lines.push('');
    }
    
    if (port.contact) {
      lines.push('**Contact:**');
      if (port.contact.vhf) lines.push(`VHF: Channel ${port.contact.vhf}`);
      if (port.contact.phone) lines.push(`Phone: ${port.contact.phone}`);
      if (port.contact.email) lines.push(`Email: ${port.contact.email}`);
    }
    
    return lines.join('\n');
  }
}

// Start the agent if run directly
if (require.main === module) {
  const agent = new PortAgent();
  agent.start().catch(console.error);
} 