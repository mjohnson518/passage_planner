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
      location: port.location.country === 'USA'
        ? `${port.location.city}, ${port.location.state}`
        : `${port.location.city}, ${port.location.country}`,
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
      },
      'UK': {
        country: 'United Kingdom',
        requirements: {
          entry: [
            'Non-UK vessels must report to Border Force on arrival',
            'Complete C1331 form (Report of Arrival) for non-EU vessels',
            'Fly Q flag until cleared',
            'Report to nearest customs-approved marina or harbour'
          ],
          fees: 'Light dues apply to vessels over 20m',
          documentation: ['Passports for all crew', 'Vessel registration certificate', 'Insurance documentation', 'Part I or SSR registration for UK vessels']
        },
        contacts: {
          borderForce: '+44 300 123 7000',
          hmrc: 'National Yachtline +44 300 123 2012'
        },
        notes: [
          'Post-Brexit: EU vessels must clear customs',
          'VAT status of vessel may be checked',
          'Red Ensign to be flown by UK-registered vessels',
          'Harbour dues vary significantly between ports'
        ]
      },
      'FRANCE': {
        country: 'France',
        requirements: {
          entry: [
            'EU/Schengen area — free movement for EU nationals',
            'Non-EU vessels must clear customs at first port of entry',
            'Fly Q flag until cleared (non-EU vessels)',
            'Droit de Pavillon (flag fee) applies to some vessels'
          ],
          fees: 'Tourist tax (taxe de séjour) varies by commune',
          documentation: ['Passports/ID cards for all crew', 'Vessel registration', 'Insurance certificate (mandatory)', 'Radio license (VHF)']
        },
        contacts: {
          customs: 'Douanes: +33 0 800 944 040',
          affairesMaritime: 'Local Affaires Maritimes office'
        },
        notes: [
          'Schengen 90/180 day rule for non-EU nationals',
          'French courtesy flag required',
          'RIPAM (French navigation rules) apply in territorial waters',
          'Marina reservations strongly recommended Jul-Aug'
        ]
      },
      'SPAIN': {
        country: 'Spain',
        requirements: {
          entry: [
            'EU/Schengen area — free movement for EU nationals',
            'Non-EU vessels clear at designated ports of entry',
            'Matriculation tax (DIEM) may apply to non-EU flagged vessels staying >6 months',
            'Fly Q flag until cleared (non-EU vessels)'
          ],
          fees: 'Navigation tax, light dues, port fees vary by region',
          documentation: ['Passports/ID cards', 'Vessel registration', 'Insurance certificate', 'Title competency (PER/PNB for Spanish waters)']
        },
        contacts: {
          customs: 'Guardia Civil del Mar',
          salvamento: 'Salvamento Marítimo: 900 202 202'
        },
        notes: [
          'Balearics require cruising tax for vessels >8m',
          'Anchoring restrictions in Posidonia seagrass areas',
          'Spanish courtesy flag required',
          'Fishing license required for recreational fishing'
        ]
      },
      'PORTUGAL': {
        country: 'Portugal',
        requirements: {
          entry: [
            'EU/Schengen area — free movement for EU nationals',
            'Non-EU vessels clear customs at first port',
            'SEF (immigration) check for non-EU crew',
            'Vessel must be registered with port captain (Capitania)'
          ],
          fees: 'Port fees and light dues apply',
          documentation: ['Passports/ID cards', 'Vessel registration', 'Insurance certificate', 'Radio license']
        },
        contacts: {
          capitania: 'Local Capitania do Porto',
          mrcc: 'MRCC Lisboa: +351 214 401 919'
        },
        notes: [
          'Excellent cruising ground with well-maintained marinas',
          'Atlantic swell can affect bar crossings — check conditions',
          'Portuguese courtesy flag required',
          'Azores and Madeira have separate port authorities'
        ]
      },
      'ITALY': {
        country: 'Italy',
        requirements: {
          entry: [
            'EU/Schengen area — free movement for EU nationals',
            'Non-EU vessels clear at Guardia di Finanza',
            'Constituto (transit log) required — obtained at first Italian port',
            'All vessels must carry safety equipment per Italian regulations'
          ],
          fees: 'Tassa di stazionamento for vessels >10m (non-EU flagged)',
          documentation: ['Passports/ID cards', 'Vessel registration', 'Insurance certificate', 'Constituto (transit log)', 'Radio license']
        },
        contacts: {
          guardiaCoste: 'Guardia Costiera: 1530',
          guardiaDiFinanza: 'Local Guardia di Finanza office'
        },
        notes: [
          'Marine protected areas require permits (e.g. Cinque Terre)',
          'Many ports require stern-to Mediterranean mooring',
          'Italian courtesy flag required',
          'August is peak season — book marinas well in advance'
        ]
      },
      'GREECE': {
        country: 'Greece',
        requirements: {
          entry: [
            'EU/Schengen area — free movement for EU nationals',
            'Non-EU vessels obtain Transit Log (DEKPA) at first port',
            'Crew list required at each port',
            'DEKPA must be stamped at port police in each island visited'
          ],
          fees: 'Cruising tax (TPP/ΤΠΠ) based on vessel length, €1-3/ft/day',
          documentation: ['Passports/ID cards', 'Vessel registration', 'Insurance certificate', 'DEKPA transit log', 'Radio license', 'Crew list']
        },
        contacts: {
          portPolice: 'Local Limenarchío (port police)',
          coastGuard: 'Hellenic Coast Guard: 108'
        },
        notes: [
          'Meltemi winds (Jul-Aug) can reach Force 7-8 in Aegean',
          'Many islands have limited marina facilities — anchoring common',
          'Archaeological sites: anchoring prohibited within 500m',
          'Greek courtesy flag required',
          'Crew list must be updated at each port'
        ]
      },
      'TURKEY': {
        country: 'Turkey',
        requirements: {
          entry: [
            'Not EU/Schengen — full customs clearance required',
            'Obtain Transit Log at first Turkish port',
            'E-visa required for most nationalities before arrival',
            'Vessel must clear in at designated port of entry'
          ],
          fees: 'Transit log fee ~€100, lighthouse dues, port fees',
          documentation: ['Passports with e-visa', 'Vessel registration', 'Insurance certificate', 'Transit Log', 'Crew list']
        },
        contacts: {
          customs: 'Local Gümrük (customs) office',
          coastGuard: 'Turkish Coast Guard: 158'
        },
        notes: [
          'Transit log must be surrendered when departing Turkey',
          'Vessel cannot be left in Turkey without transit log arrangements',
          'Excellent boatyard and repair facilities at competitive prices',
          'Turkish courtesy flag required',
          'No sailing within 1nm of military areas'
        ]
      },
      'CROATIA': {
        country: 'Croatia',
        requirements: {
          entry: [
            'EU member (Schengen since 2023) — free movement for EU nationals',
            'Non-EU vessels clear at designated ports of entry',
            'Vignette (cruising permit) required for all vessels',
            'Skipper must hold valid certificate of competence'
          ],
          fees: 'Vignette based on vessel length (~€100-800/year), sojourn tax',
          documentation: ['Passports/ID cards', 'Vessel registration', 'Insurance certificate', 'Skipper license/certificate', 'Crew list']
        },
        contacts: {
          harbourMaster: 'Local Lučka kapetanija',
          coastGuard: 'Croatian Coast Guard: +385 195'
        },
        notes: [
          'Bora wind can be sudden and severe on eastern Adriatic',
          'ACI Marina network provides excellent coverage',
          'Nature park anchorages require fees (Kornati, Mljet)',
          'Croatian courtesy flag required',
          'Speed limit 5kn within 300m of shore'
        ]
      },
      'MALTA': {
        country: 'Malta',
        requirements: {
          entry: [
            'EU/Schengen area — free movement for EU nationals',
            'Non-EU vessels clear at Grand Harbour or Msida Marina',
            'Fly Q flag until cleared',
            'All vessels must register with Transport Malta'
          ],
          fees: 'Port dues based on vessel length',
          documentation: ['Passports/ID cards', 'Vessel registration', 'Insurance certificate', 'Radio license']
        },
        contacts: {
          transportMalta: 'Transport Malta: +356 2122 2203',
          vts: 'Valletta VTS: VHF Ch 12'
        },
        notes: [
          'Grand Harbour is busy commercial port — follow VTS instructions',
          'Strong currents between Malta and Gozo',
          'Limited anchoring in peak season',
          'Maltese courtesy flag required',
          'Good boatyard facilities for winter storage'
        ]
      },
      'GIBRALTAR': {
        country: 'Gibraltar (British Overseas Territory)',
        requirements: {
          entry: [
            'Not EU/Schengen — separate customs territory',
            'Report to Gibraltar Port Authority on arrival',
            'Passports required for all crew',
            'Customs clearance required when arriving from/departing to Spain'
          ],
          fees: 'Port dues, light dues apply',
          documentation: ['Passports', 'Vessel registration', 'Insurance certificate']
        },
        contacts: {
          portAuthority: 'Gibraltar Port Authority: +350 200 46254',
          vts: 'Gibraltar VTS: VHF Ch 12'
        },
        notes: [
          'Strait of Gibraltar has strong currents and heavy traffic',
          'TSS (Traffic Separation Scheme) must be followed',
          'Good provisioning and fuel — duty-free',
          'Bridge between Atlantic and Mediterranean — weather window important',
          'Levanter cloud signals strong easterly winds'
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
