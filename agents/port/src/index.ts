// Port Agent Implementation
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import pino from 'pino';

export class PortAgent {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
  });
  private db: Pool;
  
  constructor() {
    this.server = new Server(
      {
        name: 'port-agent',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
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
        switch (name) {
          case 'get_port_info':
            return await this.getPortInfo(args);
          case 'search_ports':
            return await this.searchPorts(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Tool execution failed');
        throw error;
      }
    });
  }
  
  private getTools() {
    return [
      {
        name: 'get_port_info',
        description: 'Get detailed information about a specific port',
        inputSchema: {
          type: 'object',
          properties: {
            portName: { type: 'string' },
          },
          required: ['portName'],
        },
      },
      {
        name: 'search_ports',
        description: 'Search for ports by name or location',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['query'],
        },
      },
    ];
  }
  
  private async getPortInfo(args: any) {
    try {
      // Mock implementation - in production would query database
      const mockPort = {
        id: 'port-123',
        name: args.portName,
        country: 'US',
        coordinates: { latitude: 42.3601, longitude: -71.0589 },
        facilities: [
          { type: 'fuel', available: true },
          { type: 'water', available: true },
          { type: 'provisions', available: true },
        ],
        contacts: [
          {
            type: 'harbormaster',
            phone: '+1-555-0123',
            vhfChannel: 16,
          },
        ],
      };
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockPort, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Unable to fetch port information',
            message: error.message,
          }),
        }],
      };
    }
  }
  
  private async searchPorts(args: any) {
    try {
      // Mock implementation
      const mockResults = [
        {
          id: 'port-123',
          name: 'Boston Harbor',
          country: 'US',
          distance: 0,
        },
        {
          id: 'port-124',
          name: 'Portland Harbor',
          country: 'US',
          distance: 105,
        },
      ];
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockResults, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Unable to search ports',
            message: error.message,
          }),
        }],
      };
    }
  }
  
  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logger.info('Port agent started');
    } catch (error) {
      this.logger.error({ error }, 'Failed to start port agent');
      process.exit(1);
    }
  }
}

// Start the agent
if (require.main === module) {
  const agent = new PortAgent();
  agent.start().catch(console.error);
}
