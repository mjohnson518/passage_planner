#!/bin/bash

# Setup script for remaining agents

AGENTS=("safety" "route" "wind" "factory")

for agent in "${AGENTS[@]}"; do
  echo "Setting up $agent agent..."
  
  # Create tsconfig.json
  cat > "agents/$agent/tsconfig.json" << TSCONFIG
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"],
  "references": [
    { "path": "../../shared" }
  ]
}
TSCONFIG

  # Create basic index.ts
  cat > "agents/$agent/src/index.ts" << INDEX
// ${agent^} Agent Implementation
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';

export class ${agent^}Agent {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
  });
  
  constructor() {
    this.server = new Server(
      {
        name: '${agent}-agent',
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
        // Tool implementation would go here
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ 
                agent: '${agent}', 
                tool: name, 
                result: 'Mock response' 
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Tool execution failed');
        throw error;
      }
    });
  }
  
  private getTools() {
    return [
      {
        name: '${agent}_tool',
        description: 'Example tool for ${agent} agent',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    ];
  }
  
  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.logger.info('${agent^} agent started');
    } catch (error) {
      this.logger.error({ error }, 'Failed to start ${agent} agent');
      process.exit(1);
    }
  }
}

// Start the agent
if (require.main === module) {
  const agent = new ${agent^}Agent();
  agent.start().catch(console.error);
}
INDEX

done

echo "All agents set up successfully!"
