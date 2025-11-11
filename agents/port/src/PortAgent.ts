/**
 * Port Agent - Comprehensive Port and Marina Information
 * 
 * Provides detailed information about ports, marinas, anchorages including:
 * - Facilities and services
 * - Navigation approach details
 * - Customs/immigration requirements
 * - Local knowledge and recommendations
 * - Emergency harbor identification
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Tool } from '@modelcontextprotocol/sdk/types';
import { Logger } from 'pino';
import pino from 'pino';
import { 
  PORT_DATABASE, 
  Port,
  getPortById,
  searchPortsByName,
  findNearestPorts,
  findPortsForDraft
} from './data/portDatabase';

export class PortAgent {
  private server: Server;
  protected logger: Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    });

    this.server = new Server(
      {
        name: 'Port Information Agent',
        version: '2.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    this.setupTools();
  }

  async initialize(): Promise<void> {
    this.logger.info({ ports: PORT_DATABASE.length }, 'Port Agent initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Port Agent shutdown');
  }

  getTools(): Tool[] {
    return [
      {
        name: 'search_ports',
        description: 'Search for ports and marinas near a location',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            radius: { type: 'number', minimum: 1, maximum: 500, default: 50 },
            name: { type: 'string' },
            draft: { type: 'number', description: 'Vessel draft in feet for suitability filtering' }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'get_port_details',
        description: 'Get comprehensive information about a specific port',
        inputSchema: {
          type: 'object',
          properties: {
            portId: { type: 'string' },
            portName: { type: 'string' }
          }
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
            maxDistance: { type: 'number', default: 50 },
            draft: { type: 'number', description: 'Vessel draft in feet' },
            requiredServices: {
              type: 'array',
              items: { type: 'string' },
              description: 'Required services (fuel, repair, etc.)'
            }
          },
          required: ['latitude', 'longitude']
        }
      },
      {
        name: 'get_customs_info',
        description: 'Get customs and immigration information for a port',
        inputSchema: {
          type: 'object',
          properties: {
            portId: { type: 'string' },
            country: { type: 'string' }
          }
        }
      }
    ];
  }

  async handleToolCall(name: string, args: any): Promise<any> {
    try {
      this.logger.info({ tool: name, args }, 'Handling port tool call');

      switch (name) {
        case 'search_ports':
          return await this.searchPorts(args);
        case 'get_port_details':
          return await this.getPortDetails(args);
        case 'find_emergency_harbors':
          return await this.findEmergencyHarbors(args);
        case 'get_customs_info':
          return await this.getCustomsInfo(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      this.logger.error({ error, tool: name }, 'Port tool call failed');
      throw error;
    }
  }

  private setupTools() {
    // MCP server tool setup would go here
  }

  private async searchPorts(args: any): Promise<any> {
    const { latitude, longitude, radius = 50, name, draft } = args;

    // Validate coordinates
    if (latitude === undefined || longitude === undefined) {
      throw new Error('Latitude and longitude are required');
    }
    if (latitude < -90 || latitude > 90) {
      throw new Error(`Invalid latitude: ${latitude}`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error(`Invalid longitude: ${longitude}`);
    }

    let results;

    if (draft) {
      // Filter by suitable depth for vessel
      results = findPortsForDraft(latitude, longitude, draft, radius);
    } else {
      // Standard search
      results = findNearestPorts(latitude, longitude, radius);
    }

    // Apply name filter if provided
    if (name) {
      results = results.filter(p => 
        p.name.toLowerCase().includes(name.toLowerCase()) ||
        p.location.city.toLowerCase().includes(name.toLowerCase())
      );
    }

    const summary = this.formatSearchSummary(results, draft);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          searchCenter: { latitude, longitude },
          radius,
          resultsFound: results.length,
          draftConsidered: draft,
          summary,
          ports: results.map(p => this.formatPortSummary(p))
        }, null, 2)
      }]
    };
  }

  private async getPortDetails(args: any): Promise<any> {
    const { portId, portName } = args;

    let port: Port | undefined;

    if (portId) {
      port = getPortById(portId);
    } else if (portName) {
      const results = searchPortsByName(portName);
      port = results[0];
    }

    if (!port) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            found: false,
            message: `Port ${portId || portName} not found in database`
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          found: true,
          port: this.formatDetailedPort(port)
        }, null, 2)
      }]
    };
  }

  private async findEmergencyHarbors(args: any): Promise<any> {
    const { latitude, longitude, maxDistance = 50, draft, requiredServices = [] } = args;

    // Find all nearby ports
    let harbors = findNearestPorts(latitude, longitude, maxDistance);

    // Filter by draft if specified
    if (draft) {
      harbors = harbors.filter(h => h.navigation.dockDepth >= draft * 1.2);
    }

    // Filter by required services
    if (requiredServices.length > 0) {
      harbors = harbors.filter(h => {
        return requiredServices.every((service: string) => {
          switch (service.toLowerCase()) {
            case 'fuel':
              return h.facilities.fuel;
            case 'repair':
              return h.facilities.repair.available;
            case 'water':
              return h.facilities.water;
            default:
              return true;
          }
        });
      });
    }

    // Sort by protection and facilities for emergency situations
    harbors.sort((a, b) => {
      const scoreA = a.rating.protection + a.rating.facilities;
      const scoreB = b.rating.protection + b.rating.facilities;
      return scoreB - scoreA; // Higher scores first
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          emergencyLocation: { latitude, longitude },
          maxDistance,
          harborsFound: harbors.length,
          draftRequirement: draft,
          requiredServices,
          recommendations: harbors.slice(0, 5).map(h => ({
            name: h.name,
            distance: h.distance,
            type: h.type,
            vhf: h.contact.vhf,
            protection: h.rating.protection,
            facilities: h.rating.facilities,
            approachDepth: h.navigation.approachDepth,
            suitableForEmergency: true,
            reason: this.getEmergencySuitabilityReason(h)
          }))
        }, null, 2)
      }]
    };
  }

  private async getCustomsInfo(args: any): Promise<any> {
    const { portId, country } = args;

    if (!portId && !country) {
      throw new Error('Either portId or country is required');
    }

    if (portId) {
      const port = getPortById(portId);
      if (!port) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              found: false,
              message: `Port ${portId} not found`
            }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            port: port.name,
            portOfEntry: port.customs.portOfEntry,
            requirements: port.customs,
            procedures: port.customs.procedures || 'Standard CBP procedures apply',
            notes: port.customs.portOfEntry 
              ? 'Port of Entry - customs clearance available'
              : 'Not a Port of Entry - clear customs at nearest designated port'
          }, null, 2)
        }]
      };
    }

    // Country-level customs info
    const customsInfo = this.getCountryCustomsInfo(country);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(customsInfo, null, 2)
      }]
    };
  }

  private formatSearchSummary(results: any[], draft?: number): string {
    if (results.length === 0) {
      return 'No ports found in search area';
    }

    const summary = [`Found ${results.length} port(s)`];
    
    const marinas = results.filter(p => p.type === 'marina').length;
    const harbors = results.filter(p => p.type === 'harbor').length;
    const anchorages = results.filter(p => p.type === 'anchorage').length;

    if (marinas > 0) summary.push(`${marinas} marina(s)`);
    if (harbors > 0) summary.push(`${harbors} harbor(s)`);
    if (anchorages > 0) summary.push(`${anchorages} anchorage(s)`);

    if (draft) {
      const suitable = results.filter((p: any) => p.suitable).length;
      summary.push(`${suitable} suitable for ${draft}ft draft`);
    }

    return summary.join(', ');
  }

  private formatPortSummary(port: any): any {
    return {
      id: port.id,
      name: port.name,
      type: port.type,
      location: `${port.location.city}, ${port.location.state}`,
      distance: port.distance ? `${port.distance} nm` : undefined,
      vhf: port.contact.vhf,
      facilities: {
        fuel: !!port.facilities.fuel,
        water: port.facilities.water,
        repair: port.facilities.repair.available,
        provisions: port.facilities.provisions
      },
      navigation: {
        depth: `${port.navigation.dockDepth}ft`,
        tidalRange: `${port.navigation.tidalRange}ft`
      },
      rating: port.rating.overall,
      suitable: port.suitable !== undefined ? port.suitable : true,
      clearance: port.clearanceMargin !== undefined ? `${port.clearanceMargin.toFixed(1)}ft` : undefined
    };
  }

  private formatDetailedPort(port: Port): any {
    return {
      basic: {
        id: port.id,
        name: port.name,
        type: port.type,
        location: port.location,
        coordinates: port.coordinates
      },
      facilities: port.facilities,
      navigation: {
        ...port.navigation,
        safetyNotes: port.navigation.hazards || []
      },
      services: port.services,
      contact: port.contact,
      customs: port.customs,
      localKnowledge: port.localKnowledge,
      amenities: port.amenities,
      rating: port.rating,
      recommendations: this.generatePortRecommendations(port)
    };
  }

  private generatePortRecommendations(port: Port): string[] {
    const recommendations: string[] = [];

    // Navigation recommendations
    if (port.navigation.hazards && port.navigation.hazards.length > 0) {
      recommendations.push(`⚠️ Navigation hazards: ${port.navigation.hazards.join(', ')}`);
    }

    if (port.navigation.bestTideState) {
      recommendations.push(`⏰ Tidal timing: ${port.navigation.bestTideState}`);
    }

    if (port.navigation.tidalRange > 8) {
      recommendations.push(`🌊 Large tidal range (${port.navigation.tidalRange}ft) - monitor depth at low water`);
    }

    // Service recommendations
    if (port.facilities.fuel) {
      recommendations.push(`⛽ Fuel available: ${port.facilities.fuel.hours || 'Check hours'}`);
    }

    if (port.services.slips.reservation) {
      recommendations.push(`📞 ${port.services.slips.reservation}`);
    }

    // Local knowledge
    if (port.localKnowledge.bestApproach) {
      recommendations.push(`🧭 ${port.localKnowledge.bestApproach}`);
    }

    // Customs
    if (port.customs.portOfEntry) {
      recommendations.push(`🛂 Port of Entry - customs clearance available`);
      if (port.customs.procedures) {
        recommendations.push(`  ${port.customs.procedures}`);
      }
    }

    return recommendations;
  }

  private getEmergencySuitabilityReason(port: any): string {
    const reasons: string[] = [];

    if (port.rating.protection >= 4) {
      reasons.push('Excellent weather protection');
    }

    if (port.facilities.repair.available) {
      reasons.push('Repair services available');
    }

    if (port.facilities.fuel) {
      reasons.push('Fuel available');
    }

    if (port.navigation.approachDepth >= 12) {
      reasons.push('Deep water approach');
    }

    return reasons.join('; ') || 'Basic services available';
  }

  private getCountryCustomsInfo(country: string): any {
    const customsDB: { [key: string]: any } = {
      'USA': {
        country: 'United States',
        requirements: {
          entry: [
            'All persons must clear customs at designated Port of Entry',
            'File eAPIS (Electronic Advance Passenger Information System) before arrival',
            'Have passports ready for all aboard',
            'Declare all items purchased abroad',
            'Agriculture items subject to inspection'
          ],
          portOfEntry: 'Must enter at designated Port of Entry',
          reporting: 'Call CBP at +1-800-973-2867 upon arrival',
          fees: 'User fee $27.50 per person (recreational vessels may be exempt)',
          documentation: ['Vessel documentation or state registration', 'Passports for all crew', 'Fishing license if applicable']
        },
        contacts: {
          cbp: '+1-800-973-2867',
          roamApp: 'CBP ROAM app for small vessels'
        },
        notes: [
          'Use CBP ROAM app for easier reporting',
          'Keep ship papers readily accessible',
          'Declare alcohol and tobacco purchases',
          'Pet health certificates required'
        ]
      },
      'BAHAMAS': {
        country: 'Bahamas',
        requirements: {
          entry: [
            'Clear in at first Bahamian port',
            'Yellow quarantine flag until cleared',
            'All persons must go to customs/immigration',
            'Cruising permit required for stays over 90 days'
          ],
          fees: '$300 departure tax, $150 entry fee (varies by vessel size)',
          documentation: ['Passports', 'Vessel registration', 'Proof of citizenship', 'Fishing license ($20)']
        },
        contacts: {
          customs: 'VHF Channel 16',
          immigration: 'Located with customs at each port of entry'
        },
        notes: [
          'Must clear in and out at each island',
          'Keep yellow quarantine flag ready',
          'Spearfishing prohibited',
          'Marine park fees apply in some areas'
        ]
      }
    };

    return customsDB[country.toUpperCase()] || {
      country,
      message: 'Customs information not available for this country. Contact local authorities before arrival.'
    };
  }
}

export default PortAgent;
