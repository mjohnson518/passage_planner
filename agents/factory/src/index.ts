// Agent Factory Implementation
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode 
} from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import { z } from 'zod';
import { createClient } from 'redis';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// Input validation schemas
const AgentSpecificationSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().min(10).max(500),
  type: z.enum(['api_integration', 'data_processor', 'calculator', 'aggregator']),
  capabilities: z.object({
    tools: z.array(z.object({
      name: z.string(),
      description: z.string(),
      inputSchema: z.any(),
      implementation: z.object({
        type: z.enum(['api_call', 'database_query', 'calculation', 'aggregation']),
        config: z.any(),
      }),
    })),
    resources: z.array(z.object({
      name: z.string(),
      description: z.string(),
      uri: z.string(),
    })).optional(),
  }),
  dependencies: z.object({
    npm: z.array(z.string()).optional(),
    agents: z.array(z.string()).optional(),
  }).optional(),
  configuration: z.object({
    environment: z.record(z.string()).optional(),
    secrets: z.array(z.string()).optional(),
    rate_limits: z.object({
      requests_per_minute: z.number().optional(),
      requests_per_day: z.number().optional(),
    }).optional(),
  }).optional(),
});

const AgentTemplateSchema = z.object({
  template_id: z.string(),
  parameters: z.record(z.any()),
});

export class AgentFactory {
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
  private templatesDir: string;
  private agentsDir: string;
  
  constructor() {
    this.server = new Server(
      {
        name: 'agent-factory',
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
    
    this.templatesDir = path.join(__dirname, '..', 'templates');
    this.agentsDir = path.join(__dirname, '..', '..', '..');
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));
    
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        this.logger.info({ tool: name, args }, 'Processing factory tool request');
        
        switch (name) {
          case 'create_agent':
            return await this.createAgent(args);
          case 'list_templates':
            return await this.listTemplates();
          case 'create_from_template':
            return await this.createFromTemplate(args);
          case 'validate_specification':
            return await this.validateSpecification(args);
          case 'deploy_agent':
            return await this.deployAgent(args);
          case 'update_agent':
            return await this.updateAgent(args);
          case 'delete_agent':
            return await this.deleteAgent(args);
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
        name: 'create_agent',
        description: 'Create a new agent from specification',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Agent name (e.g., "tide-predictor")'
            },
            description: {
              type: 'string',
              description: 'What the agent does'
            },
            type: {
              type: 'string',
              enum: ['api_integration', 'data_processor', 'calculator', 'aggregator'],
              description: 'Type of agent to create'
            },
            capabilities: {
              type: 'object',
              properties: {
                tools: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      inputSchema: { type: 'object' },
                      implementation: {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            enum: ['api_call', 'database_query', 'calculation', 'aggregation']
                          },
                          config: { type: 'object' }
                        }
                      }
                    }
                  }
                },
                resources: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      uri: { type: 'string' }
                    }
                  }
                }
              }
            },
            dependencies: {
              type: 'object',
              properties: {
                npm: {
                  type: 'array',
                  items: { type: 'string' }
                },
                agents: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            },
            configuration: {
              type: 'object',
              properties: {
                environment: {
                  type: 'object',
                  additionalProperties: { type: 'string' }
                },
                secrets: {
                  type: 'array',
                  items: { type: 'string' }
                },
                rate_limits: {
                  type: 'object',
                  properties: {
                    requests_per_minute: { type: 'number' },
                    requests_per_day: { type: 'number' }
                  }
                }
              }
            }
          },
          required: ['name', 'description', 'type', 'capabilities']
        },
      },
      {
        name: 'list_templates',
        description: 'List available agent templates',
        inputSchema: {
          type: 'object',
          properties: {}
        },
      },
      {
        name: 'create_from_template',
        description: 'Create an agent from a predefined template',
        inputSchema: {
          type: 'object',
          properties: {
            template_id: {
              type: 'string',
              description: 'ID of the template to use'
            },
            parameters: {
              type: 'object',
              description: 'Template-specific parameters'
            }
          },
          required: ['template_id', 'parameters']
        },
      },
      {
        name: 'validate_specification',
        description: 'Validate an agent specification without creating it',
        inputSchema: {
          type: 'object',
          properties: {
            specification: { type: 'object' }
          },
          required: ['specification']
        },
      },
      {
        name: 'deploy_agent',
        description: 'Deploy a created agent to production',
        inputSchema: {
          type: 'object',
          properties: {
            agent_id: { type: 'string' },
            environment: {
              type: 'string',
              enum: ['development', 'staging', 'production']
            }
          },
          required: ['agent_id']
        },
      },
      {
        name: 'update_agent',
        description: 'Update an existing agent',
        inputSchema: {
          type: 'object',
          properties: {
            agent_id: { type: 'string' },
            updates: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                capabilities: { type: 'object' },
                configuration: { type: 'object' }
              }
            }
          },
          required: ['agent_id', 'updates']
        },
      },
      {
        name: 'delete_agent',
        description: 'Delete an agent',
        inputSchema: {
          type: 'object',
          properties: {
            agent_id: { type: 'string' },
            force: {
              type: 'boolean',
              default: false,
              description: 'Force deletion even if agent is running'
            }
          },
          required: ['agent_id']
        },
      }
    ];
  }

  private async createAgent(args: any) {
    const validated = AgentSpecificationSchema.parse(args);
    
    try {
      const agentId = `${validated.name.toLowerCase().replace(/\s+/g, '-')}-agent`;
      const agentPath = path.join(this.agentsDir, agentId);
      
      // Check if agent already exists
      try {
        await fs.access(agentPath);
        throw new Error(`Agent ${agentId} already exists`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') throw error;
      }
      
      // Create agent directory structure
      await fs.mkdir(path.join(agentPath, 'src'), { recursive: true });
      await fs.mkdir(path.join(agentPath, 'tests'), { recursive: true });
      
      // Generate agent code
      const agentCode = this.generateAgentCode(validated, agentId);
      await fs.writeFile(
        path.join(agentPath, 'src', 'index.ts'),
        agentCode
      );
      
      // Generate package.json
      const packageJson = this.generatePackageJson(validated, agentId);
      await fs.writeFile(
        path.join(agentPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      // Generate tsconfig.json
      const tsConfig = this.generateTsConfig();
      await fs.writeFile(
        path.join(agentPath, 'tsconfig.json'),
        JSON.stringify(tsConfig, null, 2)
      );
      
      // Generate test file
      const testCode = this.generateTestCode(validated, agentId);
      await fs.writeFile(
        path.join(agentPath, 'tests', 'index.test.ts'),
        testCode
      );
      
      // Store agent metadata in database
      await this.db.query(
        `INSERT INTO agents (id, name, description, type, specification, created_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          agentId,
          validated.name,
          validated.description,
          validated.type,
          JSON.stringify(validated),
          new Date(),
          'created'
        ]
      );
      
      // Install dependencies
      if (validated.dependencies?.npm && validated.dependencies.npm.length > 0) {
        await this.installDependencies(agentPath, validated.dependencies.npm);
      }
      
      const response = {
        agent_id: agentId,
        name: validated.name,
        path: agentPath,
        status: 'created',
        next_steps: [
          `cd ${agentPath}`,
          'npm install',
          'npm run build',
          'npm run dev',
        ],
        files_created: [
          'src/index.ts',
          'package.json',
          'tsconfig.json',
          'tests/index.test.ts',
        ],
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to create agent');
      throw error;
    }
  }

  private async listTemplates() {
    try {
      const templates = [
        {
          id: 'api-integration',
          name: 'API Integration Agent',
          description: 'Agent that integrates with external APIs',
          parameters: {
            api_name: 'string',
            base_url: 'string',
            auth_type: 'none | api_key | oauth2',
            endpoints: 'array of endpoint definitions',
          },
        },
        {
          id: 'data-processor',
          name: 'Data Processing Agent',
          description: 'Agent that processes and transforms data',
          parameters: {
            input_format: 'json | csv | xml',
            output_format: 'json | csv | xml',
            transformations: 'array of transformation rules',
          },
        },
        {
          id: 'calculator',
          name: 'Calculator Agent',
          description: 'Agent that performs calculations',
          parameters: {
            calculations: 'array of calculation definitions',
            units: 'metric | imperial | both',
          },
        },
        {
          id: 'aggregator',
          name: 'Data Aggregator Agent',
          description: 'Agent that aggregates data from multiple sources',
          parameters: {
            sources: 'array of data sources',
            aggregation_method: 'merge | join | union',
            output_schema: 'JSON schema definition',
          },
        },
      ];
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ templates }, null, 2),
        }],
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to list templates');
      throw error;
    }
  }

  private async createFromTemplate(args: any) {
    const validated = AgentTemplateSchema.parse(args);
    
    try {
      // Load template
      const templatePath = path.join(this.templatesDir, `${validated.template_id}.json`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const template = JSON.parse(templateContent);
      
      // Apply parameters to template
      const specification = this.applyTemplateParameters(template, validated.parameters);
      
      // Create agent using the specification
      return await this.createAgent(specification);
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to create from template');
      throw error;
    }
  }

  private async validateSpecification(args: any) {
    try {
      const validated = AgentSpecificationSchema.parse(args.specification);
      
      const validation = {
        valid: true,
        specification: validated,
        warnings: [],
        suggestions: [],
      };
      
      // Check for common issues
      if (!validated.dependencies?.npm?.includes('pino')) {
        validation.suggestions.push('Consider adding pino for logging');
      }
      
      if (validated.capabilities.tools.length === 0) {
        validation.warnings.push('Agent has no tools defined');
      }
      
      validated.capabilities.tools.forEach((tool, index) => {
        if (!tool.inputSchema || Object.keys(tool.inputSchema).length === 0) {
          validation.warnings.push(`Tool ${tool.name} has no input schema`);
        }
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(validation, null, 2),
        }],
      };
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              valid: false,
              errors: error.errors,
            }, null, 2),
          }],
        };
      }
      throw error;
    }
  }

  private async deployAgent(args: any) {
    const validated = z.object({
      agent_id: z.string(),
      environment: z.enum(['development', 'staging', 'production']).default('development'),
    }).parse(args);
    
    try {
      // Get agent details
      const agentResult = await this.db.query(
        'SELECT * FROM agents WHERE id = $1',
        [validated.agent_id]
      );
      
      if (agentResult.rows.length === 0) {
        throw new Error(`Agent ${validated.agent_id} not found`);
      }
      
      const agent = agentResult.rows[0];
      const agentPath = path.join(this.agentsDir, validated.agent_id);
      
      // Build agent
      await this.buildAgent(agentPath);
      
      // Start agent process
      const process = spawn('npm', ['start'], {
        cwd: agentPath,
        env: {
          ...process.env,
          NODE_ENV: validated.environment,
          AGENT_ID: validated.agent_id,
        },
      });
      
      // Update status
      await this.db.query(
        'UPDATE agents SET status = $1, deployed_at = $2 WHERE id = $3',
        ['deployed', new Date(), validated.agent_id]
      );
      
      const response = {
        agent_id: validated.agent_id,
        status: 'deployed',
        environment: validated.environment,
        process_id: process.pid,
        logs: `tail -f ${agentPath}/logs/agent.log`,
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to deploy agent');
      throw error;
    }
  }

  private async updateAgent(args: any) {
    const validated = z.object({
      agent_id: z.string(),
      updates: z.object({
        description: z.string().optional(),
        capabilities: z.any().optional(),
        configuration: z.any().optional(),
      }),
    }).parse(args);
    
    try {
      // Get current agent specification
      const agentResult = await this.db.query(
        'SELECT specification FROM agents WHERE id = $1',
        [validated.agent_id]
      );
      
      if (agentResult.rows.length === 0) {
        throw new Error(`Agent ${validated.agent_id} not found`);
      }
      
      const currentSpec = agentResult.rows[0].specification;
      const updatedSpec = {
        ...currentSpec,
        ...validated.updates,
        capabilities: validated.updates.capabilities 
          ? { ...currentSpec.capabilities, ...validated.updates.capabilities }
          : currentSpec.capabilities,
        configuration: validated.updates.configuration
          ? { ...currentSpec.configuration, ...validated.updates.configuration }
          : currentSpec.configuration,
      };
      
      // Regenerate agent code
      const agentPath = path.join(this.agentsDir, validated.agent_id);
      const agentCode = this.generateAgentCode(updatedSpec, validated.agent_id);
      
      await fs.writeFile(
        path.join(agentPath, 'src', 'index.ts'),
        agentCode
      );
      
      // Update database
      await this.db.query(
        'UPDATE agents SET specification = $1, updated_at = $2 WHERE id = $3',
        [JSON.stringify(updatedSpec), new Date(), validated.agent_id]
      );
      
      const response = {
        agent_id: validated.agent_id,
        status: 'updated',
        updates_applied: Object.keys(validated.updates),
        next_steps: [
          'Rebuild the agent: npm run build',
          'Restart the agent if running',
        ],
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to update agent');
      throw error;
    }
  }

  private async deleteAgent(args: any) {
    const validated = z.object({
      agent_id: z.string(),
      force: z.boolean().default(false),
    }).parse(args);
    
    try {
      // Check if agent exists
      const agentResult = await this.db.query(
        'SELECT status FROM agents WHERE id = $1',
        [validated.agent_id]
      );
      
      if (agentResult.rows.length === 0) {
        throw new Error(`Agent ${validated.agent_id} not found`);
      }
      
      const agent = agentResult.rows[0];
      
      if (agent.status === 'deployed' && !validated.force) {
        throw new Error('Agent is deployed. Use force=true to delete');
      }
      
      // Delete agent files
      const agentPath = path.join(this.agentsDir, validated.agent_id);
      await fs.rm(agentPath, { recursive: true, force: true });
      
      // Delete from database
      await this.db.query(
        'DELETE FROM agents WHERE id = $1',
        [validated.agent_id]
      );
      
      const response = {
        agent_id: validated.agent_id,
        status: 'deleted',
        files_removed: agentPath,
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to delete agent');
      throw error;
    }
  }

  // Helper methods
  private generateAgentCode(spec: any, agentId: string): string {
    return `// Auto-generated agent: ${spec.name}
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode 
} from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
${spec.dependencies?.npm?.includes('axios') ? "import axios from 'axios';" : ''}
${spec.dependencies?.npm?.includes('zod') ? "import { z } from 'zod';" : ''}

export class ${this.toPascalCase(spec.name)} {
  private server: Server;
  private logger = pino({
    level: process.env.LOG_LEVEL || 'info',
  });
  
  constructor() {
    this.server = new Server(
      {
        name: '${agentId}',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ${JSON.stringify(spec.capabilities.tools.map((t: any) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })), null, 2)},
    }));
    
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
${spec.capabilities.tools.map((tool: any) => `          case '${tool.name}':
            return await this.${this.toCamelCase(tool.name)}(args);`).join('\n')}
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              \`Unknown tool: \${name}\`
            );
        }
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Tool request failed');
        throw error;
      }
    });
  }
  
${spec.capabilities.tools.map((tool: any) => this.generateToolMethod(tool)).join('\n\n')}
  
  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.logger.info('${spec.name} started');
      
      // Register with orchestrator
      await this.registerWithOrchestrator();
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start ${spec.name}');
      process.exit(1);
    }
  }
  
  private async registerWithOrchestrator() {
    try {
      const response = await fetch('http://localhost:8081/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: '${agentId}',
          name: '${spec.name}',
          description: '${spec.description}',
          version: '1.0.0',
          status: 'active',
          tools: ${JSON.stringify(spec.capabilities.tools.map((t: any) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })))},
          resources: [],
          prompts: [],
          lastUpdated: new Date(),
          healthEndpoint: 'http://localhost:${8090 + Math.floor(Math.random() * 100)}/health',
          performance: {
            averageResponseTime: 0,
            successRate: 1,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(\`Registration failed: \${response.statusText}\`);
      }
      
      this.logger.info('Registered with orchestrator');
    } catch (error) {
      this.logger.error({ error }, 'Failed to register with orchestrator');
    }
  }
}

// Start the agent
if (require.main === module) {
  const agent = new ${this.toPascalCase(spec.name)}();
  agent.start().catch(console.error);
}`;
  }

  private generateToolMethod(tool: any): string {
    const methodName = this.toCamelCase(tool.name);
    
    let implementation = '';
    switch (tool.implementation.type) {
      case 'api_call':
        implementation = `
    try {
      const response = await axios({
        method: '${tool.implementation.config.method || 'GET'}',
        url: \`${tool.implementation.config.url}\`,
        ${tool.implementation.config.headers ? `headers: ${JSON.stringify(tool.implementation.config.headers)},` : ''}
        ${tool.implementation.config.data ? 'data: args,' : ''}
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        }],
      };
    } catch (error) {
      this.logger.error({ error }, 'API call failed');
      throw error;
    }`;
        break;
        
      case 'calculation':
        implementation = `
    // Perform calculation
    const result = ${tool.implementation.config.formula || '{}'}; 
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ result }, null, 2),
      }],
    };`;
        break;
        
      default:
        implementation = `
    // TODO: Implement ${tool.name}
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ message: 'Not implemented' }, null, 2),
      }],
    };`;
    }
    
    return `  private async ${methodName}(args: any) {${implementation}
  }`;
  }

  private generatePackageJson(spec: any, agentId: string): any {
    return {
      name: `@passage-planner/${agentId}`,
      version: '1.0.0',
      description: spec.description,
      main: 'dist/index.js',
      scripts: {
        build: 'tsc',
        dev: 'nodemon --exec ts-node src/index.ts',
        start: 'node dist/index.js',
        test: 'jest',
        lint: 'eslint src --ext .ts',
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^0.5.0',
        'pino': '^8.0.0',
        'pino-pretty': '^10.0.0',
        ...(spec.dependencies?.npm?.reduce((acc: any, dep: string) => {
          acc[dep] = 'latest';
          return acc;
        }, {}) || {}),
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        'ts-node': '^10.0.0',
        'nodemon': '^3.0.0',
        'jest': '^29.0.0',
        'ts-jest': '^29.0.0',
        'eslint': '^8.0.0',
        '@typescript-eslint/parser': '^6.0.0',
        '@typescript-eslint/eslint-plugin': '^6.0.0',
      },
    };
  }

  private generateTsConfig(): any {
    return {
      compilerOptions: {
        target: 'ES2022',
        module: 'commonjs',
        lib: ['ES2022'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        declaration: true,
        sourceMap: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    };
  }

  private generateTestCode(spec: any, agentId: string): string {
    return `import { ${this.toPascalCase(spec.name)} } from '../src';

describe('${spec.name}', () => {
  let agent: ${this.toPascalCase(spec.name)};
  
  beforeEach(() => {
    agent = new ${this.toPascalCase(spec.name)}();
  });
  
${spec.capabilities.tools.map((tool: any) => `  test('${tool.name} should work', async () => {
    // TODO: Implement test for ${tool.name}
    expect(true).toBe(true);
  });
`).join('\n')}
});`;
  }

  private applyTemplateParameters(template: any, parameters: any): any {
    // Simple template parameter replacement
    let templateStr = JSON.stringify(template);
    
    Object.entries(parameters).forEach(([key, value]) => {
      templateStr = templateStr.replace(
        new RegExp(`{{${key}}}`, 'g'),
        JSON.stringify(value).slice(1, -1)
      );
    });
    
    return JSON.parse(templateStr);
  }

  private async installDependencies(agentPath: string, dependencies: string[]) {
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install', ...dependencies], {
        cwd: agentPath,
      });
      
      npm.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  private async buildAgent(agentPath: string) {
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['run', 'build'], {
        cwd: agentPath,
      });
      
      npm.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`npm build failed with code ${code}`));
        }
      });
    });
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[\s-_]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  async start() {
    try {
      await this.redis.connect();
      this.logger.info('Connected to Redis');
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.logger.info('Agent factory started');
      
      // Register with orchestrator
      await this.registerWithOrchestrator();
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start agent factory');
      process.exit(1);
    }
  }
  
  private async registerWithOrchestrator() {
    try {
      const response = await fetch('http://localhost:8081/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-factory',
          name: 'Agent Factory',
          description: 'Creates and manages dynamic agents',
          version: '1.0.0',
          status: 'active',
          tools: this.getTools(),
          resources: [],
          prompts: [],
          lastUpdated: new Date(),
          healthEndpoint: 'http://localhost:8090/health',
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
  const agent = new AgentFactory();
  agent.start().catch(console.error);
} 