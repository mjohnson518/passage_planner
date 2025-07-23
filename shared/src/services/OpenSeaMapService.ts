import { Logger } from 'pino';
import axios from 'axios';

export interface ChartBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface NavigationHazard {
  id: string;
  type: 'rock' | 'wreck' | 'obstruction' | 'shoal' | 'restricted_area';
  position: {
    latitude: number;
    longitude: number;
  };
  name?: string;
  description?: string;
  depth?: number;
  clearance?: number;
}

export interface NavigationAid {
  id: string;
  type: 'lighthouse' | 'beacon' | 'buoy' | 'daymark';
  position: {
    latitude: number;
    longitude: number;
  };
  name?: string;
  characteristics?: string;
  light?: {
    color: string;
    pattern: string;
    period: number;
    range: number;
  };
}

export interface ChartLayer {
  id: string;
  name: string;
  type: 'base' | 'seamark' | 'depth' | 'weather';
  url: string;
  attribution: string;
  minZoom: number;
  maxZoom: number;
}

export interface DepthContour {
  depth: number; // meters
  coordinates: Array<{ latitude: number; longitude: number }>;
}

export class OpenSeaMapService {
  private logger: Logger;
  
  // Chart tile servers
  private readonly OSM_BASE_URL = 'https://tile.openstreetmap.org';
  private readonly SEAMARK_URL = 'https://tiles.openseamap.org/seamark';
  private readonly DEPTH_URL = 'http://tiles.openseamap.org/depth';
  
  // Overpass API for querying navigation features
  private readonly OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  
  constructor(logger: Logger) {
    this.logger = logger;
  }
  
  /**
   * Get chart layers configuration for map display
   */
  getChartLayers(): ChartLayer[] {
    return [
      {
        id: 'osm-base',
        name: 'OpenStreetMap Base',
        type: 'base',
        url: `${this.OSM_BASE_URL}/{z}/{x}/{y}.png`,
        attribution: '© OpenStreetMap contributors',
        minZoom: 1,
        maxZoom: 19
      },
      {
        id: 'seamark',
        name: 'Nautical Marks',
        type: 'seamark',
        url: `${this.SEAMARK_URL}/{z}/{x}/{y}.png`,
        attribution: '© OpenSeaMap contributors',
        minZoom: 9,
        maxZoom: 18
      },
      {
        id: 'depth',
        name: 'Depth Contours',
        type: 'depth',
        url: `${this.DEPTH_URL}/{z}/{x}/{y}.png`,
        attribution: '© OpenSeaMap depth data',
        minZoom: 10,
        maxZoom: 18
      }
    ];
  }
  
  /**
   * Get navigation hazards within bounds
   */
  async getNavigationHazards(bounds: ChartBounds): Promise<NavigationHazard[]> {
    try {
      const query = `
        [out:json][timeout:25];
        (
          node["seamark:type"="rock"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["seamark:type"="wreck"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["seamark:type"="obstruction"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          way["seamark:type"="restricted_area"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        );
        out body;
      `;
      
      const response = await axios.post(this.OVERPASS_URL, query, {
        headers: { 'Content-Type': 'text/plain' }
      });
      
      const hazards: NavigationHazard[] = [];
      
      response.data.elements.forEach((element: any) => {
        const type = this.mapSeamarkType(element.tags['seamark:type']);
        if (!type) return;
        
        hazards.push({
          id: `${element.type}/${element.id}`,
          type,
          position: {
            latitude: element.lat || element.center?.lat,
            longitude: element.lon || element.center?.lon
          },
          name: element.tags['seamark:name'] || element.tags.name,
          description: element.tags['seamark:information'],
          depth: this.parseDepth(element.tags['seamark:rock:water_level'])
        });
      });
      
      return hazards;
    } catch (error) {
      this.logger.error({ error, bounds }, 'Failed to fetch navigation hazards');
      return [];
    }
  }
  
  /**
   * Get navigation aids within bounds
   */
  async getNavigationAids(bounds: ChartBounds): Promise<NavigationAid[]> {
    try {
      const query = `
        [out:json][timeout:25];
        (
          node["seamark:type"="lighthouse"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["seamark:type"="beacon"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["seamark:type"="buoy"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        );
        out body;
      `;
      
      const response = await axios.post(this.OVERPASS_URL, query, {
        headers: { 'Content-Type': 'text/plain' }
      });
      
      const aids: NavigationAid[] = [];
      
      response.data.elements.forEach((element: any) => {
        const type = element.tags['seamark:type'];
        if (!['lighthouse', 'beacon', 'buoy'].includes(type)) return;
        
        const aid: NavigationAid = {
          id: `${element.type}/${element.id}`,
          type: type as NavigationAid['type'],
          position: {
            latitude: element.lat,
            longitude: element.lon
          },
          name: element.tags['seamark:name'] || element.tags.name,
          characteristics: element.tags['seamark:light:character']
        };
        
        // Parse light characteristics if available
        if (element.tags['seamark:light:colour']) {
          aid.light = {
            color: element.tags['seamark:light:colour'],
            pattern: element.tags['seamark:light:character'] || '',
            period: parseFloat(element.tags['seamark:light:period']) || 0,
            range: parseFloat(element.tags['seamark:light:range']) || 0
          };
        }
        
        aids.push(aid);
      });
      
      return aids;
    } catch (error) {
      this.logger.error({ error, bounds }, 'Failed to fetch navigation aids');
      return [];
    }
  }
  
  /**
   * Check route for hazards and clearance
   */
  async validateRoute(
    waypoints: Array<{ latitude: number; longitude: number }>,
    draft: number // vessel draft in meters
  ): Promise<{
    safe: boolean;
    hazards: NavigationHazard[];
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const foundHazards: NavigationHazard[] = [];
    
    // Calculate bounds that encompass the entire route
    const bounds = this.calculateRouteBounds(waypoints);
    
    // Get all hazards in the area
    const hazards = await this.getNavigationHazards(bounds);
    
    // Check each route segment
    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];
      
      // Check for hazards near the route line
      hazards.forEach(hazard => {
        const distance = this.distanceToLine(
          hazard.position,
          start,
          end
        );
        
        // If hazard is within 0.1nm (185m) of route
        if (distance < 0.1) {
          foundHazards.push(hazard);
          
          if (hazard.type === 'rock' || hazard.type === 'wreck') {
            warnings.push(
              `${hazard.type} near route segment ${i + 1}: ${hazard.name || 'unnamed'}`
            );
          }
          
          if (hazard.type === 'shoal' && hazard.depth && hazard.depth < draft + 2) {
            warnings.push(
              `Insufficient depth at ${hazard.name || 'shoal'}: ${hazard.depth}m (vessel draft: ${draft}m)`
            );
          }
        }
      });
    }
    
    // Check for restricted areas
    const restrictedAreas = hazards.filter(h => h.type === 'restricted_area');
    restrictedAreas.forEach(area => {
      warnings.push(`Route passes through restricted area: ${area.name || 'unnamed'}`);
    });
    
    return {
      safe: warnings.length === 0,
      hazards: foundHazards,
      warnings
    };
  }
  
  /**
   * Get depth at specific points (limited capability with OpenSeaMap)
   */
  async getDepthProfile(
    waypoints: Array<{ latitude: number; longitude: number }>
  ): Promise<Array<{ point: any; estimatedDepth: number | null }>> {
    // Note: OpenSeaMap doesn't provide direct depth API
    // This would need integration with other bathymetric data sources
    // For now, returning null depths
    
    return waypoints.map(point => ({
      point,
      estimatedDepth: null
    }));
  }
  
  /**
   * Get chart tile URL for specific location and zoom
   */
  getChartTileUrl(
    latitude: number,
    longitude: number,
    zoom: number,
    layer: 'base' | 'seamark' | 'depth' = 'seamark'
  ): string {
    const { x, y } = this.latLonToTile(latitude, longitude, zoom);
    
    switch (layer) {
      case 'base':
        return `${this.OSM_BASE_URL}/${zoom}/${x}/${y}.png`;
      case 'seamark':
        return `${this.SEAMARK_URL}/${zoom}/${x}/${y}.png`;
      case 'depth':
        return `${this.DEPTH_URL}/${zoom}/${x}/${y}.png`;
    }
  }
  
  /**
   * Map OpenSeaMap seamark types to our types
   */
  private mapSeamarkType(seamarkType: string): NavigationHazard['type'] | null {
    switch (seamarkType) {
      case 'rock':
        return 'rock';
      case 'wreck':
        return 'wreck';
      case 'obstruction':
        return 'obstruction';
      case 'shoal':
        return 'shoal';
      case 'restricted_area':
        return 'restricted_area';
      default:
        return null;
    }
  }
  
  /**
   * Parse depth from seamark tags
   */
  private parseDepth(waterLevel: string): number | undefined {
    if (!waterLevel) return undefined;
    
    // Common values: 'covers', 'awash', 'always_dry'
    // For numeric depths, would need additional tags
    switch (waterLevel) {
      case 'covers':
        return 0; // At water level
      case 'awash':
        return -0.5; // Just below surface
      case 'always_dry':
        return -999; // Above water
      default:
        return undefined;
    }
  }
  
  /**
   * Calculate bounds that encompass all waypoints
   */
  private calculateRouteBounds(
    waypoints: Array<{ latitude: number; longitude: number }>
  ): ChartBounds {
    const lats = waypoints.map(w => w.latitude);
    const lons = waypoints.map(w => w.longitude);
    
    // Add 0.1 degree buffer
    return {
      north: Math.max(...lats) + 0.1,
      south: Math.min(...lats) - 0.1,
      east: Math.max(...lons) + 0.1,
      west: Math.min(...lons) - 0.1
    };
  }
  
  /**
   * Calculate distance from point to line segment
   */
  private distanceToLine(
    point: { latitude: number; longitude: number },
    lineStart: { latitude: number; longitude: number },
    lineEnd: { latitude: number; longitude: number }
  ): number {
    // Simplified distance calculation
    // In production, use proper spherical geometry
    const A = point.latitude - lineStart.latitude;
    const B = point.longitude - lineStart.longitude;
    const C = lineEnd.latitude - lineStart.latitude;
    const D = lineEnd.longitude - lineStart.longitude;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.latitude;
      yy = lineStart.longitude;
    } else if (param > 1) {
      xx = lineEnd.latitude;
      yy = lineEnd.longitude;
    } else {
      xx = lineStart.latitude + param * C;
      yy = lineStart.longitude + param * D;
    }
    
    const dx = point.latitude - xx;
    const dy = point.longitude - yy;
    
    // Convert to nautical miles (rough approximation)
    return Math.sqrt(dx * dx + dy * dy) * 60;
  }
  
  /**
   * Convert lat/lon to tile coordinates
   */
  private latLonToTile(
    lat: number,
    lon: number,
    zoom: number
  ): { x: number; y: number } {
    const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 
      1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    
    return { x, y };
  }
} 