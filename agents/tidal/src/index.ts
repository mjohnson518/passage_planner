import { BaseAgent } from '@passage-planner/shared/agents/BaseAgent';
import { NOAATidalService } from '@passage-planner/shared/services/NOAATidalService';
import { CacheManager } from '@passage-planner/shared/services/CacheManager';
import { Logger } from 'pino';
import pino from 'pino';

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
        id: 'tidal-agent',
        name: 'Tidal Prediction Agent',
        version: '2.0.0',
        description: 'Provides real-time tidal predictions and current forecasts using NOAA data',
        healthCheckInterval: 30000,
      },
      logger
    );
    
    this.cache = new CacheManager(logger);
    this.tidalService = new NOAATidalService(this.cache, logger);
    
    this.setupTools();
  }
  
  private setupTools() {
    // List available tools
    this.server.setRequestHandler({
      method: 'tools/list',
      handler: async () => ({
        tools: [
          {
            name: 'get_tidal_predictions',
            description: 'Get tidal predictions for a location',
            inputSchema: {
              type: 'object',
              properties: {
                latitude: { type: 'number', minimum: -90, maximum: 90 },
                longitude: { type: 'number', minimum: -180, maximum: 180 },
                days: { type: 'number', minimum: 1, maximum: 7, default: 3 }
              },
              required: ['latitude', 'longitude']
            }
          },
          {
            name: 'find_tidal_stations',
            description: 'Find nearest tidal stations to a location',
            inputSchema: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                maxDistance: { type: 'number', description: 'Maximum distance in km', default: 50 }
              },
              required: ['latitude', 'longitude']
            }
          },
          {
            name: 'calculate_tidal_windows',
            description: 'Calculate safe tidal windows for passage',
            inputSchema: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                departureTime: { type: 'string', format: 'date-time' },
                duration: { type: 'number', description: 'Passage duration in hours' },
                minTideHeight: { type: 'number', description: 'Minimum tide height in meters' },
                maxCurrent: { type: 'number', description: 'Maximum current in knots' },
                preferRising: { type: 'boolean', description: 'Prefer rising tide' }
              },
              required: ['latitude', 'longitude', 'departureTime', 'duration']
            }
          },
          {
            name: 'calculate_tidal_gate',
            description: 'Calculate tidal gate windows for shallow passages',
            inputSchema: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                minDepth: { type: 'number', description: 'Minimum required depth in meters' },
                channelDepth: { type: 'number', description: 'Channel depth at MLLW in meters' },
                transitTime: { type: 'number', description: 'Time needed to transit in hours' }
              },
              required: ['latitude', 'longitude', 'minDepth', 'channelDepth', 'transitTime']
            }
          }
        ]
      })
    });
    
    // Tool call handler
    this.server.setRequestHandler({
      method: 'tools/call',
      handler: async (request) => {
        const { name, arguments: args } = request.params;
        
        try {
          switch (name) {
            case 'get_tidal_predictions':
              return await this.getTidalPredictions(args);
              
            case 'find_tidal_stations':
              return await this.findTidalStations(args);
              
            case 'calculate_tidal_windows':
              return await this.calculateTidalWindows(args);
              
            case 'calculate_tidal_gate':
              return await this.calculateTidalGate(args);
              
            default:
              throw new Error(`Unknown tool: ${name}`);
          }
        } catch (error) {
          this.logger.error({ error, tool: name }, 'Tool execution failed');
          throw error;
        }
      }
    });
  }
  
  private async getTidalPredictions(args: any) {
    const { latitude, longitude, days = 3 } = args;
    
    try {
      // Find nearest tidal station
      const stations = await this.tidalService.findNearestStations(latitude, longitude);
      if (stations.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No tidal stations found within 50km of the specified location'
          }],
          isError: true
        };
      }
      
      const station = stations[0];
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);
      
      // Get predictions
      const tidalData = await this.tidalService.getTidalPredictions(
        station.id,
        startDate,
        endDate
      );
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatTidalSummary(tidalData)
          },
          {
            type: 'data',
            data: {
              station,
              predictions: tidalData.predictions,
              currents: tidalData.currents,
              nearbyStations: stations
            }
          }
        ]
      };
    } catch (error) {
      this.logger.error({ error, args }, 'Failed to get tidal predictions');
      return {
        content: [{
          type: 'text',
          text: `Unable to retrieve tidal predictions: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async findTidalStations(args: any) {
    const { latitude, longitude, maxDistance = 50 } = args;
    
    try {
      const stations = await this.tidalService.findNearestStations(
        latitude, 
        longitude, 
        maxDistance
      );
      
      if (stations.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No tidal stations found within ${maxDistance}km`
          }]
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${stations.length} tidal stations nearby:\n` +
              stations.map(s => `- ${s.name} (${s.id}) - ${s.distance.toFixed(1)}km away`).join('\n')
          },
          {
            type: 'data',
            data: stations
          }
        ]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Unable to find tidal stations: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async calculateTidalWindows(args: any) {
    const {
      latitude,
      longitude,
      departureTime,
      duration,
      minTideHeight,
      maxCurrent,
      preferRising
    } = args;
    
    try {
      // Find nearest station
      const stations = await this.tidalService.findNearestStations(latitude, longitude);
      if (stations.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No tidal stations found nearby'
          }],
          isError: true
        };
      }
      
      const station = stations[0];
      const windows = await this.tidalService.calculateTidalWindows(
        station.id,
        new Date(departureTime),
        duration,
        { minTideHeight, maxCurrent, preferRising }
      );
      
      if (windows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No suitable tidal windows found in the next 7 days'
          }]
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${windows.length} suitable tidal windows:\n` +
              windows.slice(0, 5).map(w => 
                `- ${w.start.toLocaleString()} to ${w.end.toLocaleString()} (${w.type} tide, avg height: ${w.averageHeight.toFixed(1)}m)`
              ).join('\n')
          },
          {
            type: 'data',
            data: {
              station,
              windows
            }
          }
        ]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Unable to calculate tidal windows: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async calculateTidalGate(args: any) {
    const {
      latitude,
      longitude,
      minDepth,
      channelDepth,
      transitTime
    } = args;
    
    try {
      const windows = await this.tidalService.calculateTidalGate(
        latitude,
        longitude,
        { minDepth, channelDepth, transitTime }
      );
      
      if (windows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No safe transit windows found. The channel requires ${(minDepth - channelDepth).toFixed(1)}m of tide.`
          }]
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${windows.length} safe transit windows for the tidal gate:\n` +
              windows.slice(0, 5).map(w => 
                `- ${w.start.toLocaleString()} to ${w.end.toLocaleString()} (${((w.end.getTime() - w.start.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours)`
              ).join('\n')
          },
          {
            type: 'data',
            data: {
              requiredTide: minDepth - channelDepth,
              windows
            }
          }
        ]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Unable to calculate tidal gate: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private formatTidalSummary(tidalData: any): string {
    const lines = [
      `🌊 Tidal Predictions for ${tidalData.station.name}`,
      `Station ID: ${tidalData.station.id}`,
      `Distance: ${tidalData.station.distance.toFixed(1)}km from requested location`,
      `Datum: ${tidalData.datum}`,
      ''
    ];
    
    // Group predictions by day
    const predictionsByDay = new Map<string, any[]>();
    tidalData.predictions.forEach(pred => {
      const dayKey = pred.time.toLocaleDateString();
      if (!predictionsByDay.has(dayKey)) {
        predictionsByDay.set(dayKey, []);
      }
      predictionsByDay.get(dayKey)!.push(pred);
    });
    
    // Format predictions
    lines.push('**Tide Times:**');
    let dayCount = 0;
    for (const [day, predictions] of predictionsByDay.entries()) {
      if (dayCount >= 3) break; // Show only first 3 days
      
      lines.push(`\n${day}:`);
      predictions.forEach(pred => {
        const emoji = pred.type === 'high' ? '⬆️' : '⬇️';
        lines.push(`  ${emoji} ${pred.type.toUpperCase()}: ${pred.time.toLocaleTimeString()} - ${pred.height.toFixed(1)}m`);
      });
      
      dayCount++;
    }
    
    // Add current information if available
    if (tidalData.currents.length > 0) {
      lines.push('\n**Tidal Currents:**');
      tidalData.currents.slice(0, 6).forEach(curr => {
        const emoji = curr.type === 'max_flood' ? '➡️' : curr.type === 'max_ebb' ? '⬅️' : '⏸️';
        lines.push(`  ${emoji} ${curr.time.toLocaleString()}: ${curr.velocity.toFixed(1)}kt @ ${curr.direction}°`);
      });
    }
    
    return lines.join('\n');
  }
} 