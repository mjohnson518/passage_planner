// Safety Agent Implementation
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import pino from 'pino';

export class SafetyAgent {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
  });
  
  constructor() {
    this.server = new Server(
      {
        name: 'safety-agent',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
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
          case 'get_safety_warnings':
            return await this.getSafetyWarnings(args);
          case 'get_emergency_contacts':
            return await this.getEmergencyContacts(args);
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
        name: 'get_safety_warnings',
        description: 'Get active safety warnings for a region',
        inputSchema: {
          type: 'object',
          properties: {
            region: { type: 'string' },
          },
          required: ['region'],
        },
      },
      {
        name: 'get_emergency_contacts',
        description: 'Get emergency contacts for a location',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
        },
      },
    ];
  }
  
  private async getSafetyWarnings(args: any) {
    // Mock implementation
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          warnings: [
            'Small Craft Advisory in effect',
            'Navigation hazard reported near channel entrance'
          ],
          validUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
        }, null, 2),
      }],
    };
  }
  
  private async getEmergencyContacts(args: any) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          coastGuard: {
            vhf: 16,
            phone: '+1-800-424-8802'
          },
          localHarbor: {
            vhf: 9,
            phone: '+1-555-0123'
          }
        }, null, 2),
      }],
    };
  }
  
  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logger.info('Safety agent started');
    } catch (error) {
      this.logger.error({ error }, 'Failed to start safety agent');
      process.exit(1);
    }
  }
}

// Start the agent
if (require.main === module) {
  const agent = new SafetyAgent();
  agent.start().catch(console.error);
}
