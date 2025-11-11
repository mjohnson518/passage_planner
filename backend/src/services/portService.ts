/**
 * Port Service - Port and Marina Information
 * 
 * Provides port details, facilities, and customs information
 * Uses inline port database for backend integration
 * 
 * NOTE: Full Port Agent with 20+ ports exists in agents/port/
 * This is a simplified version for backend API without cross-workspace imports
 */

export interface PortInfo {
  found: boolean;
  name?: string;
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
    tidalRange: string;
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
}

// Simplified port database for key locations
const PORTS = [
  { id: 'boston', name: 'Boston Harbor', lat: 42.36, lon: -71.05, depth: 15, vhf: '14', fuel: true, repair: true, customs: true },
  { id: 'portland', name: 'Portland Harbor', lat: 43.66, lon: -70.25, depth: 15, vhf: '9', fuel: true, repair: true, customs: true },
  { id: 'newport', name: 'Newport Harbor', lat: 41.49, lon: -71.33, depth: 12, vhf: '9', fuel: true, repair: true, customs: true },
  { id: 'new-york', name: 'New York Harbor', lat: 40.71, lon: -74.01, depth: 20, vhf: '14', fuel: true, repair: true, customs: true },
  { id: 'charleston', name: 'Charleston Harbor', lat: 32.78, lon: -79.93, depth: 18, vhf: '11', fuel: true, repair: true, customs: true },
  { id: 'miami', name: 'Miami', lat: 25.73, lon: -80.23, depth: 12, vhf: '16', fuel: true, repair: true, customs: true },
  { id: 'nassau', name: 'Nassau Harbor', lat: 25.08, lon: -77.35, depth: 10, vhf: '16', fuel: true, repair: true, customs: true },
  { id: 'bermuda', name: 'St. George\'s Harbor', lat: 32.38, lon: -64.68, depth: 12, vhf: '16', fuel: true, repair: true, customs: true }
];

/**
 * Get port information for coordinates
 */
export async function getPortInfo(lat: number, lon: number, draft?: number): Promise<PortInfo> {
  try {
    // Find nearest port
    const portsWithDistance = PORTS.map(p => ({
      ...p,
      distance: haversineDistance(lat, lon, p.lat, p.lon)
    })).sort((a, b) => a.distance - b.distance);

    const nearest = portsWithDistance[0];

    if (nearest.distance > 25) {
      return { found: false };
    }

    // Check draft suitability
    const suitable = !draft || nearest.depth >= (draft * 1.2); // 20% safety margin

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
        approach: 'Via marked channel',
        hazards: ['Monitor local weather and tidal conditions']
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
        `${nearest.name} is ${nearest.distance.toFixed(1)} nm from your location`,
        `Monitor VHF channel ${nearest.vhf}`,
        suitable ? 'Port suitable for your draft' : 'CAUTION: Limited depth for your draft'
      ],
      rating: 4.5
    };

  } catch (error: any) {
    console.error('Port info fetch failed:', error.message);
    return { found: false };
  }
}

/**
 * Find emergency harbors near a location
 */
export async function findEmergencyHarbors(
  lat: number, 
  lon: number, 
  maxDistance: number = 50,
  draft?: number
): Promise<any[]> {
  try {
    const portsWithDistance = PORTS.map(p => ({
      ...p,
      distance: haversineDistance(lat, lon, p.lat, p.lon)
    }))
    .filter(p => p.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

    return portsWithDistance.map(p => ({
      name: p.name,
      distance: p.distance.toFixed(1),
      vhf: p.vhf,
      protection: 4,
      facilities: 5,
      suitableForEmergency: true
    }));

  } catch (error: any) {
    console.error('Emergency harbor search failed:', error.message);
    return [];
  }
}

/**
 * Haversine distance calculation
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.1; // Earth radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

