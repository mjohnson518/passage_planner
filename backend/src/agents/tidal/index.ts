import { BaseAgent } from '../../shared/agents/BaseAgent';
import { NOAATidalService } from '../../shared/services/NOAATidalService';
import { CacheManager } from '../../shared/services/CacheManager';
import { Logger } from 'pino';
import pino from 'pino';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types';

export class TidalAgent extends BaseAgent {
  private tidalService: NOAATidalService;
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
        name: 'Tidal Analysis Agent',
        version: '2.0.0',
        description: 'Provides real-time tidal predictions and navigation windows using NOAA data',
        healthCheckInterval: 30000,
      },
      logger
    );
    
    this.cache = new CacheManager(logger);
    this.tidalService = new NOAATidalService(this.cache, logger);
    
    this.setupTools();
  }
  
  protected getAgentSpecificHealth(): any {
    return {
      tidalServiceActive: true,
      cacheStatus: 'active',
      lastPredictionTime: new Date()
    };
  }
  
  private setupTools() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_tidal_stations',
            description: 'Find nearby tidal stations',
            inputSchema: {
              type: 'object',
              properties: {
                latitude: { type: 'number', minimum: -90, maximum: 90 },
                longitude: { type: 'number', minimum: -180, maximum: 180 },
                radius: { type: 'number', minimum: 1, maximum: 100, default: 50 }
              },
              required: ['latitude', 'longitude']
            }
          },
          {
            name: 'get_tides',
            description: 'Get tidal predictions for a specific station',
            inputSchema: {
              type: 'object',
              properties: {
                stationId: { type: 'string' },
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' }
              },
              required: ['stationId', 'startDate', 'endDate']
            }
          },
          {
            name: 'calculate_tidal_windows',
            description: 'Calculate safe navigation windows based on draft and clearance',
            inputSchema: {
              type: 'object',
              properties: {
                stationId: { type: 'string' },
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
                requiredDepth: { type: 'number', description: 'Required water depth in feet' },
                bridgeClearance: { type: 'number', description: 'Required bridge clearance in feet (optional)' }
              },
              required: ['stationId', 'startDate', 'endDate', 'requiredDepth']
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
          case 'get_tidal_stations':
            return await this.getTidalStations(args);
            
          case 'get_tides':
            return await this.getTides(args);
            
          case 'calculate_tidal_windows':
            return await this.calculateTidalWindows(args);
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Tool execution failed');
        throw error;
      }
    });
  }
  
  private async getTidalStations(args: any): Promise<any> {
    const { latitude, longitude, radius = 50 } = args;
    
    try {
      const stations = await this.tidalService.findNearestStations(
        latitude,
        longitude,
        radius
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${stations.length} tidal stations within ${radius}nm of ${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
          },
          {
            type: 'data',
            data: stations
          }
        ]
      };
    } catch (error) {
      this.logger.error({ error, args }, 'Failed to get tidal stations');
      return {
        content: [{
          type: 'text',
          text: `Unable to retrieve tidal stations: ${(error as Error).message}`
        }],
        isError: true
      };
    }
  }
  
  private async getTides(args: any): Promise<any> {
    const { stationId, startDate, endDate } = args;
    
    try {
      const predictions = await this.tidalService.getTidalPredictions(
        stationId,
        new Date(startDate),
        new Date(endDate)
      );
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatTidalSummary(predictions, stationId)
          },
          {
            type: 'data',
            data: predictions
          }
        ]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Unable to retrieve tidal predictions: ${(error as Error).message}`
        }],
        isError: true
      };
    }
  }
  
  private async calculateTidalWindows(args: any): Promise<any> {
    const { 
      stationId, 
      startDate, 
      endDate, 
      requiredDepth,
      bridgeClearance 
    } = args;
    
    try {
      const duration = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60);
      const windows = await this.tidalService.calculateTidalWindows(
        stationId,
        new Date(startDate),
        duration,
        {
          minTideHeight: requiredDepth * 0.3048, // Convert feet to meters
          preferRising: true
        }
      );
      
      return {
        content: [
          {
            type: 'text',
            text: windows.length > 0
              ? `Found ${windows.length} safe navigation windows`
              : 'No safe navigation windows found for the specified requirements'
          },
          {
            type: 'data',
            data: windows
          }
        ]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Unable to calculate tidal windows: ${(error as Error).message}`
        }],
        isError: true
      };
    }
  }
  
  private formatTidalSummary(predictions: any, stationId: string): string {
    const lines = [
      `🌊 Tidal Predictions for Station ${stationId}`,
      `Period: ${predictions.startDate.toLocaleDateString()} - ${predictions.endDate.toLocaleDateString()}`,
      ''
    ];
    
    if (predictions.extremes && predictions.extremes.length > 0) {
      lines.push('**Tide Times:**');
      predictions.extremes.slice(0, 8).forEach((extreme: any) => {
        const icon = extreme.type === 'high' ? '📈' : '📉';
        lines.push(`${icon} ${extreme.time.toLocaleString()}: ${extreme.height.toFixed(1)}ft (${extreme.type})`);
      });
    }
    
    if (predictions.currentHeight !== undefined) {
      lines.push('');
      lines.push(`Current Height: ${predictions.currentHeight.toFixed(1)}ft`);
    }
    
    return lines.join('\n');
  }
}

// Start the agent if run directly
if (require.main === module) {
  const agent = new TidalAgent();
  agent.start().catch(console.error);
} 