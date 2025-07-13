// Wind Agent Implementation
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';

export class WindAgent {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
  });
  
  constructor() {
    this.server = new Server(
      {
        name: 'wind-agent',
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
          case 'get_wind_forecast':
            return await this.getWindForecast(args);
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
        name: 'get_wind_forecast',
        description: 'Get detailed wind forecast for sailing',
        inputSchema: {
          type: 'object',
          properties: {
            coordinates: { type: 'object' },
            hours: { type: 'number' },
          },
          required: ['coordinates'],
        },
      },
    ];
  }
  
  private async getWindForecast(args: any) {
    // Mock implementation
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          forecast: [
            { time: '2024-07-15T12:00:00Z', speed: 12, direction: 'NW', gusts: 18 },
            { time: '2024-07-15T18:00:00Z', speed: 15, direction: 'W', gusts: 22 },
            { time: '2024-07-16T00:00:00Z', speed: 10, direction: 'SW', gusts: 15 }
          ]
        }, null, 2),
      }],
    };
  }
  
  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logger.info('Wind agent started');
    } catch (error) {
      this.logger.error({ error }, 'Failed to start wind agent');
      process.exit(1);
    }
  }
}

// Start the agent
if (require.main === module) {
  const agent = new WindAgent();
  agent.start().catch(console.error);
}
