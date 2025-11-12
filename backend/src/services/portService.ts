/**
 * Port Service - Global Port Coverage
 * Integrates US ports (detailed) + World Port Index (global coverage)
 */

import { findNearbyWorldPorts, isUSWaters, getPortInfo as getWorldPortInfo } from './worldPortService';

export interface PortInfo {
  found: boolean;
  name?: string;
  country?: string;
  type?: string;
  distance?: number;
  location?: any;
  facilities?: {
    fuel: boolean;
    water: boolean;
    repair: boolean;
    provisions: boolean;
  };
  navigation?: {
    depth: string;
    tidalRange?: string;
    shelter?: string;
    approach?: string;
    hazards?: string[];
  };
  contact?: {
    vhf: string;
    phone?: string;
  };
  customs?: {
    portOfEntry: boolean;
    procedures?: string;
  };
  recommendations?: string[];
  rating?: number;
  source?: string;
}

// US ports with detailed VHF and local knowledge
const US_PORTS = [
  { id: 'boston', name: 'Boston Harbor', lat: 42.36, lon: -71.05, depth: 15, vhf: '14', fuel: true, repair: true, customs: true },
  { id: 'portland', name: 'Portland Harbor', lat: 43.66, lon: -70.25, depth: 15, vhf: '9', fuel: true, repair: true, customs: true },
  { id: 'newport', name: 'Newport Harbor', lat: 41.49, lon: -71.33, depth: 12, vhf: '9', fuel: true, repair: true, customs: true },
  { id: 'new-york', name: 'New York Harbor', lat: 40.71, lon: -74.01, depth: 20, vhf: '14', fuel: true, repair: true, customs: true },
  { id: 'charleston', name: 'Charleston Harbor', lat: 32.78, lon: -79.93, depth: 18, vhf: '11', fuel: true, repair: true, customs: true },
  { id: 'miami', name: 'Miami', lat: 25.73, lon: -80.23, depth: 12, vhf: '16', fuel: true, repair: true, customs: true },
];

/**
 * Get port information - GLOBAL COVERAGE
 * Uses US ports for US waters, World Port Index elsewhere
 */
export async function getPortInfo(lat: number, lon: number, draft?: number): Promise<PortInfo> {
  try {
    // For US waters, use detailed US port data
    if (isUSWaters(lat, lon)) {
      const portsWithDistance = US_PORTS.map(p => ({
        ...p,
        distance: haversineDistance(lat, lon, p.lat, p.lon)
      })).sort((a, b) => a.distance - b.distance);

      const nearest = portsWithDistance[0];

      if (nearest && nearest.distance <= 25) {
        const suitable = !draft || nearest.depth >= (draft * 1.2);

        return {
          found: true,
          name: nearest.name,
          type: 'marina',
          distance: nearest.distance,
          location: { name: nearest.name },
          facilities: {
            fuel: nearest.fuel,
            water: true,
            repair: nearest.repair,
            provisions: true
          },
          navigation: {
            depth: `${nearest.depth}ft`,
            tidalRange: '8ft',
            approach: 'Via marked channel'
          },
          contact: {
            vhf: nearest.vhf,
            phone: 'Contact harbor master'
          },
          customs: {
            portOfEntry: nearest.customs,
            procedures: nearest.customs ? 'Contact CBP before arrival' : undefined
          },
          recommendations: [
            `${nearest.name} is ${nearest.distance.toFixed(1)} nm away`,
            `Monitor VHF channel ${nearest.vhf}`,
            suitable ? 'Port suitable for your draft' : 'CAUTION: Verify depth for your draft'
          ],
          rating: 4.5,
          source: 'US Port Database'
        };
      }
    }

    // For non-US waters or if no US port nearby, use World Port Index
    console.log(`Using World Port Index for ${lat}, ${lon}`);
    const worldPortInfo = getWorldPortInfo(lat, lon, draft);
    
    if (worldPortInfo.found) {
      return {
        ...worldPortInfo,
        recommendations: [
          `${worldPortInfo.name} is ${worldPortInfo.distance?.toFixed(1)} nm away`,
          'Verify current port information before arrival',
          worldPortInfo.suitable ? 'Port appears suitable for your draft' : 'CAUTION: Verify depth for your draft'
        ]
      } as PortInfo;
    }

    return { found: false };

  } catch (error: any) {
    console.error('Port info fetch failed:', error.message);
    return { found: false };
  }
}

/**
 * Find emergency harbors - GLOBAL COVERAGE
 */
export async function findEmergencyHarbors(
  lat: number,
  lon: number,
  maxDistance: number = 50,
  draft?: number
): Promise<any[]> {
  try {
    // Use World Port Index for global coverage
    const worldPorts = findNearbyWorldPorts(lat, lon, maxDistance);

    if (worldPorts.length > 0) {
      return worldPorts.slice(0, 3).map(p => ({
        name: p.name,
        country: p.country,
        distance: p.distance.toFixed(1),
        vhf: 'Channel 16',
        protection: p.shelter === 'good' ? 5 : p.shelter === 'moderate' ? 3 : 2,
        facilities: p.facilities.length,
        suitableForEmergency: true,
        source: 'World Port Index'
      }));
    }

    // Fallback to US ports
    const usPortsWithDistance = US_PORTS.map(p => ({
      ...p,
      distance: haversineDistance(lat, lon, p.lat, p.lon)
    }))
    .filter(p => p.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

    return usPortsWithDistance.map(p => ({
      name: p.name,
      distance: p.distance.toFixed(1),
      vhf: p.vhf,
      protection: 4,
      facilities: 5,
      suitableForEmergency: true,
      source: 'US Port Database'
    }));

  } catch (error: any) {
    console.error('Emergency harbor search failed:', error.message);
    return [];
  }
}

/**
 * Haversine distance calculation (nautical miles)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.1;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
