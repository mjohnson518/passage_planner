import { BaseAgent } from '@passage-planner/shared';
import { Tool } from '@modelcontextprotocol/sdk/types';
import axios from 'axios';
import { Logger } from 'pino';
import pino from 'pino';

export class PortAgent extends BaseAgent {
  private marineTrafficApiKey: string;

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
        version: '1.0.0',
        description: 'Provides port information, facilities, and marine services',
        healthCheckInterval: 30000
      },
      logger
    );

    this.marineTrafficApiKey = process.env.MARINETRAFFIC_API_KEY || '';
    this.setupTools();
  }

  protected getAgentSpecificHealth(): any {
    return {
      apiKeyConfigured: !!this.marineTrafficApiKey,
      lastPortQuery: new Date(),
      cacheStatus: 'active'
    };
  }

  private setupTools() {
    // Define available tools
    const tools: Tool[] = [
      {
        name: 'get_port_info',
        description: 'Get detailed port information including facilities and services',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number', description: 'Port latitude' },
            longitude: { type: 'number', description: 'Port longitude' },
            name: { type: 'string', description: 'Port name (optional)' }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'search_nearby_ports',
        description: 'Search for ports within a specified radius',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number', description: 'Center latitude' },
            longitude: { type: 'number', description: 'Center longitude' },
            radius_nm: { type: 'number', default: 50, description: 'Search radius in nautical miles' },
            port_type: {
              type: 'string',
              enum: ['marina', 'anchorage', 'commercial', 'all'],
              default: 'all',
              description: 'Type of port to search for'
            }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'get_port_facilities',
        description: 'Get available facilities and services at a port',
        inputSchema: {
          type: 'object',
          properties: {
            port_id: { type: 'string', description: 'Port identifier' }
          },
          required: ['port_id']
        }
      },
      {
        name: 'get_port_weather',
        description: 'Get current weather conditions at a port',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' }
          },
          required: ['latitude', 'longitude']
        }
      }
    ];

    // Register tools with MCP server
    this.server.setRequestHandler('tools/list', async () => ({ tools }));

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request;

      try {
        this.logger.info({ tool: name, args }, 'Handling tool call');

        switch (name) {
          case 'get_port_info':
            return await this.getPortInfo(args.latitude, args.longitude, args.name);
          case 'search_nearby_ports':
            return await this.searchNearbyPorts(
              args.latitude,
              args.longitude,
              args.radius_nm || 50,
              args.port_type || 'all'
            );
          case 'get_port_facilities':
            return await this.getPortFacilities(args.port_id);
          case 'get_port_weather':
            return await this.getPortWeather(args.latitude, args.longitude);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error({ error, tool: name }, 'Tool call failed');
        throw error;
      }
    });
  }

  private async getPortInfo(lat: number, lon: number, name?: string): Promise<any> {
    try {
      // In production, this would call actual marine APIs
      // For now, return comprehensive mock data
      const portInfo = {
        id: `port_${Math.random().toString(36).substr(2, 9)}`,
        name: name || await this.getPortNameFromCoords(lat, lon),
        position: {
          latitude: lat,
          longitude: lon
        },
        type: 'marina',
        country: 'USA',
        depths: {
          approach: { feet: 15, meters: 4.6 },
          harbor: { feet: 12, meters: 3.7 },
          alongside: { feet: 10, meters: 3.0 }
        },
        tides: {
          type: 'semidiurnal',
          range: { feet: 9, meters: 2.7 },
          highTide: '2 hours after Boston'
        },
        facilities: {
          fuel: {
            diesel: true,
            gasoline: true,
            propane: false
          },
          utilities: {
            water: true,
            electricity: '30/50 amp',
            wifi: true,
            showers: true,
            laundry: true
          },
          services: {
            repairs: true,
            haulOut: true,
            chandlery: true,
            provisioning: true,
            customs: false
          },
          moorings: {
            slips: 250,
            mooringBalls: 30,
            anchorage: true,
            maxLOA: { feet: 200, meters: 61 },
            transient: true
          }
        },
        contact: {
          vhf: 'Channel 16/9',
          phone: '+1-555-0100',
          email: 'harbormaster@port.com',
          website: 'www.portexample.com'
        },
        fees: {
          currency: 'USD',
          overnight: 2.50,
          weekly: 15.00,
          monthly: 45.00,
          electric: 0.25,
          water: 'included',
          pumpOut: 'free'
        },
        navigation: {
          approach: 'Clear approach from SW, watch for rocks on port side',
          hazards: 'Shoaling reported east of channel marker #3',
          restrictions: 'No wake zone in harbor',
          charts: ['NOAA 13270', 'NOAA 13272']
        },
        amenities: {
          nearbyTowns: ['Portsmouth', 'Kittery'],
          groceries: '0.5 miles',
          restaurants: 'Multiple on-site and nearby',
          transportation: 'Taxi, Uber, bike rental',
          hospital: '3 miles'
        }
      };

      this.logger.info({ port: portInfo.name }, 'Port information retrieved');
      return { content: [{ type: 'text', text: JSON.stringify(portInfo, null, 2) }] };
    } catch (error) {
      this.logger.error({ error, lat, lon }, 'Failed to get port info');
      throw error;
    }
  }

  private async searchNearbyPorts(
    lat: number,
    lon: number,
    radiusNm: number,
    portType: string
  ): Promise<any> {
    try {
      // Calculate bounding box for search
      const latRange = radiusNm / 60; // 1 degree latitude = 60 nm
      const lonRange = radiusNm / (60 * Math.cos(lat * Math.PI / 180));

      // Mock port database search
      const ports = [
        {
          id: 'port_001',
          name: 'Safe Harbor Marina',
          type: 'marina',
          position: {
            latitude: lat + 0.05,
            longitude: lon + 0.08
          },
          distance: 5.2,
          bearing: 45,
          facilities: {
            fuel: true,
            water: true,
            repairs: true
          },
          vhf: 'Channel 16/71',
          maxDraft: 12
        },
        {
          id: 'port_002',
          name: 'Quiet Cove Anchorage',
          type: 'anchorage',
          position: {
            latitude: lat - 0.07,
            longitude: lon + 0.12
          },
          distance: 8.7,
          bearing: 120,
          facilities: {
            mooringBalls: 15,
            dinglyDock: true
          },
          holding: 'Good in mud, 10-15ft',
          protection: 'Good from N-E, exposed S-W'
        },
        {
          id: 'port_003',
          name: 'City Marina',
          type: 'marina',
          position: {
            latitude: lat + 0.15,
            longitude: lon - 0.05
          },
          distance: 12.3,
          bearing: 350,
          facilities: {
            fuel: true,
            water: true,
            electricity: true,
            pumpOut: true,
            wifi: true
          },
          vhf: 'Channel 16/68',
          slips: 180
        }
      ];

      // Filter by port type if specified
      const filteredPorts = portType === 'all'
        ? ports
        : ports.filter(p => p.type === portType);

      // Sort by distance
      filteredPorts.sort((a, b) => a.distance - b.distance);

      const result = {
        searchCenter: { latitude: lat, longitude: lon },
        searchRadius: radiusNm,
        portType: portType,
        portsFound: filteredPorts.length,
        ports: filteredPorts
      };

      this.logger.info({ count: filteredPorts.length }, 'Nearby ports found');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      this.logger.error({ error, lat, lon }, 'Failed to search nearby ports');
      throw error;
    }
  }

  private async getPortFacilities(portId: string): Promise<any> {
    try {
      const facilities = {
        portId,
        lastUpdated: new Date().toISOString(),
        berths: {
          total: 250,
          visitor: 50,
          liveaboard: 20,
          commercial: 10
        },
        dimensions: {
          maxLOA: { feet: 200, meters: 61 },
          maxBeam: { feet: 40, meters: 12 },
          maxDraft: { feet: 15, meters: 4.6 }
        },
        fuel: {
          diesel: {
            available: true,
            price: 4.25,
            hours: '0700-1800 daily'
          },
          gasoline: {
            available: true,
            price: 4.75,
            hours: '0700-1800 daily'
          },
          propane: {
            available: false
          }
        },
        services: {
          repairs: {
            mechanical: true,
            electrical: true,
            fiberglass: true,
            canvas: true,
            rigging: true
          },
          haulOut: {
            travelift: '75 ton',
            railway: false,
            dryStorage: true
          },
          chandlery: {
            onSite: true,
            hours: '0800-1700 Mon-Sat'
          }
        },
        amenities: {
          showers: {
            available: true,
            number: 6,
            keyAccess: true
          },
          laundry: {
            available: true,
            washers: 4,
            dryers: 4
          },
          wifi: {
            available: true,
            free: true,
            coverage: 'Marina-wide'
          },
          restaurant: {
            onSite: true,
            name: 'The Galley',
            hours: '1130-2100'
          },
          pool: true,
          parking: {
            available: true,
            free: true
          },
          security: {
            gated: true,
            cameras: true,
            nightWatch: false
          }
        }
      };

      this.logger.info({ portId }, 'Port facilities retrieved');
      return { content: [{ type: 'text', text: JSON.stringify(facilities, null, 2) }] };
    } catch (error) {
      this.logger.error({ error, portId }, 'Failed to get port facilities');
      throw error;
    }
  }

  private async getPortWeather(lat: number, lon: number): Promise<any> {
    try {
      // Simple weather data for port
      const weather = {
        location: { latitude: lat, longitude: lon },
        current: {
          time: new Date().toISOString(),
          conditions: 'Partly cloudy',
          temperature: { f: 72, c: 22 },
          wind: {
            speed: 12,
            direction: 225,
            gusts: 18
          },
          visibility: 10,
          pressure: 1013,
          humidity: 65
        },
        marine: {
          seaState: 'Slight',
          waveHeight: { feet: 2, meters: 0.6 },
          wavePeriod: 6,
          swellHeight: { feet: 3, meters: 0.9 },
          swellDirection: 180,
          waterTemp: { f: 68, c: 20 }
        },
        forecast: 'Winds SW 10-15 kts, seas 2-3 ft, partly cloudy'
      };

      this.logger.info({ lat, lon }, 'Port weather retrieved');
      return { content: [{ type: 'text', text: JSON.stringify(weather, null, 2) }] };
    } catch (error) {
      this.logger.error({ error, lat, lon }, 'Failed to get port weather');
      throw error;
    }
  }

  private async getPortNameFromCoords(lat: number, lon: number): Promise<string> {
    // In production, reverse geocode to get actual port name
    return `Port at ${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  }
}

// Export for use in index.ts
export default PortAgent;