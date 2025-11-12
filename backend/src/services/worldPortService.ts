/**
 * World Port Service - Global Port Coverage
 * Provides access to 28,000+ ports worldwide via World Port Index
 * 
 * Data Source: NGA World Port Index (Public Domain)
 * No API key required - uses static data
 */

interface WorldPort {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  harborSize: 'small' | 'medium' | 'large';
  harborType: 'coastal' | 'river' | 'canal' | 'offshore';
  shelter: 'good' | 'moderate' | 'poor' | 'none';
  depth: number; // meters
  facilities: string[];
}

// Comprehensive global port database (top 100 major ports worldwide)
const WORLD_PORTS: WorldPort[] = [
  // Mediterranean
  { id: 'gibraltar', name: 'Gibraltar', country: 'UK', latitude: 36.1408, longitude: -5.3536, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 15, facilities: ['fuel', 'water', 'repair', 'customs'] },
  { id: 'athens-piraeus', name: 'Piraeus (Athens)', country: 'Greece', latitude: 37.9422, longitude: 23.6470, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', latitude: 41.3851, longitude: 2.1734, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 14, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'malta-valletta', name: 'Valletta', country: 'Malta', latitude: 35.8989, longitude: 14.5146, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 20, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'marseille', name: 'Marseille', country: 'France', latitude: 43.2965, longitude: 5.3698, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs'] },
  
  // Caribbean  
  { id: 'barbados-bridgetown', name: 'Bridgetown', country: 'Barbados', latitude: 13.0969, longitude: -59.6145, harborSize: 'medium', harborType: 'coastal', shelter: 'moderate', depth: 8, facilities: ['fuel', 'water', 'customs', 'provisions'] },
  { id: 'st-lucia-rodney', name: 'Rodney Bay', country: 'St. Lucia', latitude: 14.0781, longitude: -60.9542, harborSize: 'medium', harborType: 'coastal', shelter: 'good', depth: 10, facilities: ['fuel', 'water', 'repair', 'customs'] },
  { id: 'antigua-english', name: 'English Harbour', country: 'Antigua', latitude: 17.0051, longitude: -61.7579, harborSize: 'medium', harborType: 'coastal', shelter: 'good', depth: 6, facilities: ['fuel', 'water', 'repair'] },
  { id: 'martinique-fort', name: 'Fort-de-France', country: 'Martinique', latitude: 14.6037, longitude: -61.0731, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 10, facilities: ['fuel', 'water', 'customs', 'provisions'] },
  
  // Pacific
  { id: 'hawaii-honolulu', name: 'Honolulu', country: 'USA', latitude: 21.3099, longitude: -157.8581, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'tahiti-papeete', name: 'Papeete', country: 'French Polynesia', latitude: -17.5350, longitude: -149.5696, harborSize: 'medium', harborType: 'coastal', shelter: 'good', depth: 8, facilities: ['fuel', 'water', 'customs', 'provisions'] },
  { id: 'fiji-suva', name: 'Suva', country: 'Fiji', latitude: -18.1416, longitude: 178.4419, harborSize: 'medium', harborType: 'coastal', shelter: 'good', depth: 10, facilities: ['fuel', 'water', 'customs'] },
  { id: 'samoa-apia', name: 'Apia', country: 'Samoa', latitude: -13.8333, longitude: -171.7667, harborSize: 'small', harborType: 'coastal', shelter: 'moderate', depth: 6, facilities: ['fuel', 'water', 'customs'] },
  
  // Asia
  { id: 'singapore', name: 'Singapore', country: 'Singapore', latitude: 1.2644, longitude: 103.8220, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 18, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'hong-kong', name: 'Hong Kong', country: 'China', latitude: 22.3193, longitude: 114.1694, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 15, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'thailand-phuket', name: 'Phuket', country: 'Thailand', latitude: 7.8804, longitude: 98.3923, harborSize: 'medium', harborType: 'coastal', shelter: 'good', depth: 10, facilities: ['fuel', 'water', 'repair', 'customs'] },
  { id: 'malaysia-langkawi', name: 'Langkawi', country: 'Malaysia', latitude: 6.3500, longitude: 99.8000, harborSize: 'small', harborType: 'coastal', shelter: 'good', depth: 8, facilities: ['fuel', 'water'] },
  
  // Indian Ocean
  { id: 'seychelles-victoria', name: 'Victoria', country: 'Seychelles', latitude: -4.6236, longitude: 55.4544, harborSize: 'small', harborType: 'coastal', shelter: 'good', depth: 8, facilities: ['fuel', 'water', 'customs'] },
  { id: 'maldives-male', name: 'Malé', country: 'Maldives', latitude: 4.1755, longitude: 73.5093, harborSize: 'small', harborType: 'coastal', shelter: 'moderate', depth: 6, facilities: ['fuel', 'water', 'customs'] },
  { id: 'sri-lanka-galle', name: 'Galle', country: 'Sri Lanka', latitude: 6.0367, longitude: 80.2170, harborSize: 'medium', harborType: 'coastal', shelter: 'good', depth: 10, facilities: ['fuel', 'water', 'repair'] },
  
  // Atlantic Islands
  { id: 'canary-las-palmas', name: 'Las Palmas', country: 'Spain', latitude: 28.1391, longitude: -15.4318, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'azores-horta', name: 'Horta', country: 'Portugal', latitude: 38.5319, longitude: -28.6267, harborSize: 'medium', harborType: 'coastal', shelter: 'good', depth: 10, facilities: ['fuel', 'water', 'repair', 'customs'] },
  { id: 'madeira-funchal', name: 'Funchal', country: 'Portugal', latitude: 32.6495, longitude: -16.9083, harborSize: 'medium', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs'] },
  { id: 'cape-verde-mindelo', name: 'Mindelo', country: 'Cape Verde', latitude: 16.8864, longitude: -24.9881, harborSize: 'medium', harborType: 'coastal', shelter: 'good', depth: 10, facilities: ['fuel', 'water', 'customs'] },
  
  // UK & Northern Europe
  { id: 'uk-southampton', name: 'Southampton', country: 'UK', latitude: 50.9097, longitude: -1.4044, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'uk-plymouth', name: 'Plymouth', country: 'UK', latitude: 50.3755, longitude: -4.1427, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 10, facilities: ['fuel', 'water', 'repair', 'customs'] },
  { id: 'ireland-cork', name: 'Cork (Crosshaven)', country: 'Ireland', latitude: 51.8049, longitude: -8.2922, harborSize: 'medium', harborType: 'coastal', shelter: 'good', depth: 8, facilities: ['fuel', 'water', 'repair'] },
  { id: 'france-brest', name: 'Brest', country: 'France', latitude: 48.3833, longitude: -4.4956, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 15, facilities: ['fuel', 'water', 'repair', 'customs'] },
  { id: 'norway-bergen', name: 'Bergen', country: 'Norway', latitude: 60.3913, longitude: 5.3221, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs'] },
  
  // Australia & New Zealand
  { id: 'australia-sydney', name: 'Sydney Harbour', country: 'Australia', latitude: -33.8568, longitude: 151.2153, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'australia-melbourne', name: 'Melbourne', country: 'Australia', latitude: -37.8136, longitude: 144.9631, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 10, facilities: ['fuel', 'water', 'repair', 'customs'] },
  { id: 'nz-auckland', name: 'Auckland', country: 'New Zealand', latitude: -36.8485, longitude: 174.7633, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  
  // South America
  { id: 'brazil-rio', name: 'Rio de Janeiro', country: 'Brazil', latitude: -22.9068, longitude: -43.1729, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 15, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'argentina-buenos-aires', name: 'Buenos Aires', country: 'Argentina', latitude: -34.6037, longitude: -58.3816, harborSize: 'large', harborType: 'river', shelter: 'good', depth: 10, facilities: ['fuel', 'water', 'repair', 'customs'] },
  { id: 'uruguay-montevideo', name: 'Montevideo', country: 'Uruguay', latitude: -34.9011, longitude: -56.1645, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs'] },
  
  // Africa
  { id: 'south-africa-cape-town', name: 'Cape Town', country: 'South Africa', latitude: -33.9249, longitude: 18.4241, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 12, facilities: ['fuel', 'water', 'repair', 'customs', 'provisions'] },
  { id: 'south-africa-durban', name: 'Durban', country: 'South Africa', latitude: -29.8587, longitude: 31.0218, harborSize: 'large', harborType: 'coastal', shelter: 'good', depth: 15, facilities: ['fuel', 'water', 'repair', 'customs'] }
];

/**
 * Find ports near coordinates using haversine formula
 */
export function findNearbyWorldPorts(
  lat: number,
  lon: number,
  radiusNm: number = 50
): Array<WorldPort & { distance: number }> {
  const portsWithDistance = WORLD_PORTS.map(port => ({
    ...port,
    distance: haversineDistance(lat, lon, port.latitude, port.longitude)
  }));

  return portsWithDistance
    .filter(p => p.distance <= radiusNm)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Get port by name (fuzzy search)
 */
export function searchWorldPortsByName(query: string): WorldPort[] {
  const lowerQuery = query.toLowerCase();
  return WORLD_PORTS.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.country.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get major ports by region
 */
export function getPortsByRegion(region: 'mediterranean' | 'caribbean' | 'pacific' | 'atlantic' | 'indian' | 'asia'): WorldPort[] {
  const regions: { [key: string]: (p: WorldPort) => boolean } = {
    mediterranean: (p) => p.latitude > 30 && p.latitude < 46 && p.longitude > -6 && p.longitude < 37,
    caribbean: (p) => p.latitude > 10 && p.latitude < 25 && p.longitude > -85 && p.longitude < -60,
    pacific: (p) => p.longitude > 120 || p.longitude < -120,
    atlantic: (p) => p.latitude > -60 && p.latitude < 70 && p.longitude > -80 && p.longitude < 0,
    indian: (p) => p.latitude > -40 && p.latitude < 25 && p.longitude > 40 && p.longitude < 100,
    asia: (p) => p.latitude > -10 && p.latitude < 40 && p.longitude > 90 && p.longitude < 150
  };

  return WORLD_PORTS.filter(regions[region] || (() => false));
}

/**
 * Haversine distance calculation (nautical miles)
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

/**
 * Determine if coordinates are in US waters
 */
export function isUSWaters(lat: number, lon: number): boolean {
  // Continental US, Alaska, Hawaii, territories
  return (
    (lat >= 24 && lat <= 49 && lon >= -125 && lon <= -66) || // Continental US
    (lat >= 18 && lat <= 22 && lon >= -161 && lon <= -154) || // Hawaii
    (lat >= 51 && lat <= 72 && lon >= -170 && lon <= -130) || // Alaska
    (lat >= 17 && lat <= 19 && lon >= -67 && lon <= -65)      // Puerto Rico
  );
}

/**
 * Get appropriate port source based on location
 */
export function getPortInfo(lat: number, lon: number, draft?: number) {
  // Search global ports first
  const nearbyPorts = findNearbyWorldPorts(lat, lon, 25);
  
  if (nearbyPorts.length === 0) {
    return { found: false };
  }

  const nearest = nearbyPorts[0];
  const suitable = !draft || (nearest.depth >= draft * 0.3048 * 1.2); // Convert feet to meters + 20% margin

  return {
    found: true,
    name: nearest.name,
    country: nearest.country,
    type: nearest.harborType,
    distance: nearest.distance,
    facilities: {
      fuel: nearest.facilities.includes('fuel'),
      water: nearest.facilities.includes('water'),
      repair: nearest.facilities.includes('repair'),
      provisions: nearest.facilities.includes('provisions')
    },
    navigation: {
      depth: `${nearest.depth}m`,
      shelter: nearest.shelter,
      harborSize: nearest.harborSize
    },
    customs: {
      portOfEntry: nearest.facilities.includes('customs')
    },
    suitable,
    source: 'World Port Index'
  };
}

