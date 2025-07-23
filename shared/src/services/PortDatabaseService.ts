import { Logger } from 'pino';
import axios from 'axios';
import { CacheManager } from './CacheManager';

export interface Port {
  id: string;
  name: string;
  alternateNames?: string[];
  type: 'port' | 'marina' | 'anchorage' | 'harbor';
  position: {
    latitude: number;
    longitude: number;
  };
  country: string;
  region?: string;
  timezone: string;
  unlocode?: string; // UN/LOCODE
}

export interface PortFacilities {
  fuel: {
    diesel: boolean;
    gasoline: boolean;
    propane: boolean;
  };
  water: boolean;
  electricity: {
    available: boolean;
    voltages?: number[];
    frequency?: number;
  };
  repairs: {
    haul_out: boolean;
    travel_lift: boolean;
    crane: boolean;
    mechanical: boolean;
    electrical: boolean;
    sail: boolean;
  };
  provisions: {
    groceries: boolean;
    marine_supplies: boolean;
    ice: boolean;
  };
  services: {
    laundry: boolean;
    showers: boolean;
    wifi: boolean;
    customs: boolean;
    immigration: boolean;
  };
}

export interface PortContact {
  vhf_channel?: number;
  phone?: string;
  email?: string;
  website?: string;
  harbormaster?: string;
}

export interface PortNavigation {
  approach?: string;
  charts?: string[];
  tides?: {
    type: 'semidiurnal' | 'diurnal' | 'mixed';
    range: number; // meters
  };
  depth: {
    approach: number;
    harbor: number;
    alongside: number;
  };
  restrictions?: string[];
  localNotices?: string[];
}

export interface PortDetails extends Port {
  facilities: PortFacilities;
  contact: PortContact;
  navigation: PortNavigation;
  description?: string;
  warnings?: string[];
  lastUpdated: Date;
}

export class PortDatabaseService {
  private logger: Logger;
  private cache: CacheManager;
  
  // In production, this would connect to a real port database API
  // For now, using OpenStreetMap Overpass API for basic port data
  private readonly OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  
  // Mock data source - in production would be replaced with real API
  private readonly PORT_DATA_API = process.env.PORT_DATA_API || '';
  
  constructor(cache: CacheManager, logger: Logger) {
    this.cache = cache;
    this.logger = logger;
  }
  
  /**
   * Search for ports near a location
   */
  async searchPortsNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 50,
    types?: Array<Port['type']>
  ): Promise<Port[]> {
    const cacheKey = `ports:nearby:${latitude.toFixed(2)},${longitude.toFixed(2)}:${radiusKm}`;
    
    const cached = await this.cache.get<Port[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Calculate bounds from radius
      const bounds = this.calculateBounds(latitude, longitude, radiusKm);
      
      // Query OpenStreetMap for harbors and marinas
      const query = `
        [out:json][timeout:25];
        (
          node["harbour"="yes"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          way["harbour"="yes"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["leisure"="marina"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          way["leisure"="marina"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["seamark:type"="harbour"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        );
        out body;
      `;
      
      const response = await axios.post(this.OVERPASS_URL, query, {
        headers: { 'Content-Type': 'text/plain' }
      });
      
      const ports: Port[] = [];
      const seen = new Set<string>();
      
      response.data.elements.forEach((element: any) => {
        const name = element.tags.name;
        if (!name || seen.has(name)) return;
        seen.add(name);
        
        const port: Port = {
          id: `osm-${element.type}-${element.id}`,
          name,
          type: this.determinePortType(element.tags),
          position: {
            latitude: element.lat || element.center?.lat,
            longitude: element.lon || element.center?.lon
          },
          country: element.tags['addr:country'] || '',
          region: element.tags['addr:state'] || element.tags['addr:province'],
          timezone: 'UTC' // Would need timezone lookup service
        };
        
        // Filter by requested types
        if (!types || types.includes(port.type)) {
          ports.push(port);
        }
      });
      
      // Sort by distance
      const sortedPorts = this.sortByDistance(ports, latitude, longitude);
      
      await this.cache.set(cacheKey, sortedPorts, 3600); // Cache for 1 hour
      return sortedPorts;
    } catch (error) {
      this.logger.error({ error }, 'Failed to search ports');
      return [];
    }
  }
  
  /**
   * Get detailed port information
   */
  async getPortDetails(portId: string): Promise<PortDetails | null> {
    const cacheKey = `port:details:${portId}`;
    
    const cached = await this.cache.get<PortDetails>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // In production, this would fetch from a comprehensive port database
      // For now, return mock data structure
      if (portId.startsWith('osm-')) {
        // Parse OpenStreetMap ID
        const [, type, id] = portId.split('-');
        
        // Query for more details
        const query = `
          [out:json];
          ${type}(${id});
          out body;
        `;
        
        const response = await axios.post(this.OVERPASS_URL, query, {
          headers: { 'Content-Type': 'text/plain' }
        });
        
        if (response.data.elements.length === 0) {
          return null;
        }
        
        const element = response.data.elements[0];
        const tags = element.tags;
        
        const portDetails: PortDetails = {
          id: portId,
          name: tags.name || 'Unknown Port',
          type: this.determinePortType(tags),
          position: {
            latitude: element.lat || element.center?.lat,
            longitude: element.lon || element.center?.lon
          },
          country: tags['addr:country'] || '',
          timezone: 'UTC',
          facilities: this.parseFacilities(tags),
          contact: this.parseContact(tags),
          navigation: this.parseNavigation(tags),
          description: tags.description,
          warnings: [],
          lastUpdated: new Date()
        };
        
        await this.cache.set(cacheKey, portDetails, 86400); // Cache for 24 hours
        return portDetails;
      }
      
      // For non-OSM ports, would query actual port database
      return null;
    } catch (error) {
      this.logger.error({ error, portId }, 'Failed to get port details');
      return null;
    }
  }
  
  /**
   * Search ports by name
   */
  async searchPortsByName(
    query: string,
    country?: string
  ): Promise<Port[]> {
    const cacheKey = `ports:search:${query}:${country || 'all'}`;
    
    const cached = await this.cache.get<Port[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Query OpenStreetMap
      const osmQuery = `
        [out:json][timeout:25];
        (
          node["harbour"="yes"]["name"~"${query}",i];
          way["harbour"="yes"]["name"~"${query}",i];
          node["leisure"="marina"]["name"~"${query}",i];
          way["leisure"="marina"]["name"~"${query}",i];
        );
        out body;
      `;
      
      const response = await axios.post(this.OVERPASS_URL, osmQuery, {
        headers: { 'Content-Type': 'text/plain' }
      });
      
      const ports: Port[] = [];
      const seen = new Set<string>();
      
      response.data.elements.forEach((element: any) => {
        const name = element.tags.name;
        if (!name || seen.has(name)) return;
        
        // Filter by country if specified
        if (country && element.tags['addr:country'] !== country) {
          return;
        }
        
        seen.add(name);
        
        ports.push({
          id: `osm-${element.type}-${element.id}`,
          name,
          type: this.determinePortType(element.tags),
          position: {
            latitude: element.lat || element.center?.lat,
            longitude: element.lon || element.center?.lon
          },
          country: element.tags['addr:country'] || '',
          region: element.tags['addr:state'],
          timezone: 'UTC'
        });
      });
      
      await this.cache.set(cacheKey, ports, 3600);
      return ports;
    } catch (error) {
      this.logger.error({ error }, 'Failed to search ports by name');
      return [];
    }
  }
  
  /**
   * Get nearest safe harbor for emergency
   */
  async getNearestSafeHarbor(
    latitude: number,
    longitude: number,
    vesselDraft: number
  ): Promise<PortDetails | null> {
    try {
      // Search for nearby ports
      const nearbyPorts = await this.searchPortsNearby(latitude, longitude, 100);
      
      // Filter for ports that can accommodate the vessel
      for (const port of nearbyPorts) {
        const details = await this.getPortDetails(port.id);
        
        if (details && 
            details.navigation.depth.harbor >= vesselDraft + 1 && // 1m clearance
            details.navigation.depth.approach >= vesselDraft + 1) {
          return details;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error({ error }, 'Failed to find nearest safe harbor');
      return null;
    }
  }
  
  /**
   * Determine port type from OSM tags
   */
  private determinePortType(tags: any): Port['type'] {
    if (tags.leisure === 'marina') return 'marina';
    if (tags.harbour === 'yes') {
      if (tags.harbour_type === 'marina') return 'marina';
      if (tags.harbour_type === 'anchorage') return 'anchorage';
    }
    if (tags['seamark:type'] === 'anchorage') return 'anchorage';
    return 'harbor';
  }
  
  /**
   * Parse facilities from OSM tags
   */
  private parseFacilities(tags: any): PortFacilities {
    return {
      fuel: {
        diesel: tags['fuel:diesel'] === 'yes',
        gasoline: tags['fuel:gasoline'] === 'yes',
        propane: tags['fuel:lpg'] === 'yes'
      },
      water: tags['drinking_water'] === 'yes' || tags['water'] === 'yes',
      electricity: {
        available: tags['power_supply'] === 'yes' || tags['electricity'] === 'yes',
        voltages: this.parseVoltages(tags['voltage']),
        frequency: tags['frequency'] ? parseInt(tags['frequency']) : undefined
      },
      repairs: {
        haul_out: tags['repair:haul_out'] === 'yes',
        travel_lift: tags['repair:travel_lift'] === 'yes',
        crane: tags['crane'] === 'yes',
        mechanical: tags['repair:mechanical'] === 'yes',
        electrical: tags['repair:electrical'] === 'yes',
        sail: tags['repair:sail'] === 'yes'
      },
      provisions: {
        groceries: tags['shop'] === 'yes' || tags['shop:convenience'] === 'yes',
        marine_supplies: tags['shop:ship_chandler'] === 'yes',
        ice: tags['ice'] === 'yes'
      },
      services: {
        laundry: tags['laundry'] === 'yes',
        showers: tags['shower'] === 'yes',
        wifi: tags['internet_access'] === 'wifi' || tags['wifi'] === 'yes',
        customs: tags['customs'] === 'yes',
        immigration: tags['immigration'] === 'yes'
      }
    };
  }
  
  /**
   * Parse contact information
   */
  private parseContact(tags: any): PortContact {
    return {
      vhf_channel: tags['vhf'] ? parseInt(tags['vhf']) : undefined,
      phone: tags['phone'] || tags['contact:phone'],
      email: tags['email'] || tags['contact:email'],
      website: tags['website'] || tags['contact:website'],
      harbormaster: tags['operator']
    };
  }
  
  /**
   * Parse navigation information
   */
  private parseNavigation(tags: any): PortNavigation {
    return {
      approach: tags['seamark:information'],
      depth: {
        approach: this.parseDepth(tags['depth:approach']),
        harbor: this.parseDepth(tags['depth']) || 5, // Default 5m if unknown
        alongside: this.parseDepth(tags['depth:alongside']) || 3
      },
      restrictions: tags['access'] === 'private' ? ['Private facility'] : []
    };
  }
  
  /**
   * Parse depth values
   */
  private parseDepth(depthStr: string | undefined): number {
    if (!depthStr) return 0;
    const match = depthStr.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }
  
  /**
   * Parse voltage values
   */
  private parseVoltages(voltageStr: string | undefined): number[] | undefined {
    if (!voltageStr) return undefined;
    return voltageStr.split(';').map(v => parseInt(v)).filter(v => !isNaN(v));
  }
  
  /**
   * Calculate bounds from center and radius
   */
  private calculateBounds(
    lat: number,
    lon: number,
    radiusKm: number
  ): { north: number; south: number; east: number; west: number } {
    const latDelta = radiusKm / 111; // Rough approximation
    const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
    
    return {
      north: lat + latDelta,
      south: lat - latDelta,
      east: lon + lonDelta,
      west: lon - lonDelta
    };
  }
  
  /**
   * Sort ports by distance from a point
   */
  private sortByDistance(
    ports: Port[],
    lat: number,
    lon: number
  ): Port[] {
    return ports.sort((a, b) => {
      const distA = this.calculateDistance(
        lat, lon,
        a.position.latitude, a.position.longitude
      );
      const distB = this.calculateDistance(
        lat, lon,
        b.position.latitude, b.position.longitude
      );
      return distA - distB;
    });
  }
  
  /**
   * Calculate distance between two points
   */
  private calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
} 