/**
 * Port and Marina Database - US East Coast
 * Comprehensive facility information for passage planning
 * 
 * Data includes: marinas, anchorages, harbors with services, navigation info, and local knowledge
 */

export interface Port {
  id: string;
  name: string;
  type: 'marina' | 'harbor' | 'anchorage' | 'yacht_club';
  coordinates: {
    latitude: number;
    longitude: number;
  };
  location: {
    city: string;
    state: string;
    country: string;
  };
  facilities: {
    fuel?: {
      diesel: boolean;
      gasoline: boolean;
      hours?: string;
    };
    water: boolean;
    electricity: boolean;
    pumpout: boolean;
    ice: boolean;
    provisions: boolean;
    showers: boolean;
    laundry: boolean;
    wifi: boolean;
    repair: {
      available: boolean;
      types?: string[];
    };
    haulOut: boolean;
    chandlery: boolean;
  };
  navigation: {
    approachDepth: number; // feet at MLW
    channelDepth: number;
    dockDepth: number;
    tidalRange: number; // feet
    currentStrength?: string;
    approach: string;
    hazards?: string[];
    bestTideState?: string;
  };
  services: {
    slips: {
      available: boolean;
      transient: boolean;
      maxLength?: number; // feet
      reservation?: string;
    };
    moorings: {
      available: boolean;
      rental: boolean;
    };
    anchorage: {
      available: boolean;
      holding: string;
      depth: string;
      protection: string[];
    };
  };
  contact: {
    vhf: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  customs: {
    portOfEntry: boolean;
    cbpRequired?: boolean;
    hours?: string;
    procedures?: string;
  };
  localKnowledge: {
    bestApproach: string;
    weatherConsiderations: string[];
    tidalConsiderations?: string;
    notes: string[];
  };
  amenities: {
    restaurants: boolean;
    groceries: boolean;
    hardwareStore: boolean;
    publicTransport: boolean;
    marina: boolean;
  };
  rating: {
    overall: number; // 1-5
    facilities: number;
    protection: number;
    convenience: number;
  };
}

/**
 * US East Coast Port Database
 * 20+ major ports and marinas from Maine to Florida
 */
export const PORT_DATABASE: Port[] = [
  {
    id: 'boston-constitution-marina',
    name: 'Constitution Marina',
    type: 'marina',
    coordinates: { latitude: 42.3736, longitude: -71.0520 },
    location: { city: 'Boston', state: 'MA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0800-1700 daily' },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: false,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: false,
      chandlery: false
    },
    navigation: {
      approachDepth: 15,
      channelDepth: 20,
      dockDepth: 12,
      tidalRange: 9.5,
      approach: 'From President Roads via Boston Inner Harbor',
      hazards: ['Strong tidal current in harbor', 'Heavy commercial traffic'],
      bestTideState: 'Enter/exit 2 hours either side of high tide for maximum depth'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150, reservation: 'Recommended in summer' },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: {
      vhf: '9',
      phone: '+1-617-241-9640',
      email: 'info@constitutionmarina.com',
      website: 'constitutionmarina.com'
    },
    customs: {
      portOfEntry: true,
      cbpRequired: true,
      hours: '0800-1600 weekdays',
      procedures: 'Call CBP at +1-800-973-2867 before arrival'
    },
    localKnowledge: {
      bestApproach: 'Monitor Boston VTS on VHF 14. Follow Traffic Separation Scheme',
      weatherConsiderations: ['Fog common in spring/summer', 'Strong winds funnel through harbor in winter'],
      tidalConsiderations: 'Strong ebb current runs 3-4 knots in main channel',
      notes: [
        'Reserved transient slips fill quickly in summer - call ahead',
        'Water taxi available to downtown Boston',
        'Excellent provisioning nearby at Haymarket'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: true,
      publicTransport: true,
      marina: true
    },
    rating: { overall: 4.5, facilities: 5, protection: 3, convenience: 5 }
  },
  
  {
    id: 'portland-dimillo-marina',
    name: "DiMillo's Marina",
    type: 'marina',
    coordinates: { latitude: 43.6565, longitude: -70.2473 },
    location: { city: 'Portland', state: 'ME', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0700-1900 summer, 0800-1700 winter' },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: true,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics', 'canvas'] },
      haulOut: true,
      chandlery: true
    },
    navigation: {
      approachDepth: 18,
      channelDepth: 25,
      dockDepth: 15,
      tidalRange: 9.0,
      approach: 'Main Ship Channel past Spring Point Ledge Light',
      hazards: ['Strong tidal current at harbor entrance', 'Fog common'],
      bestTideState: 'Time arrival for slack water or favorable current'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 200, reservation: 'Required summer weekends' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '15-25 ft', protection: ['N', 'E', 'S'] }
    },
    contact: {
      vhf: '9, 68',
      phone: '+1-207-773-7632',
      email: 'dockmaster@dimillos.com',
      website: 'dimillosmarina.com'
    },
    customs: {
      portOfEntry: true,
      cbpRequired: true,
      hours: 'By appointment',
      procedures: 'Call CBP 24 hours in advance: +1-207-780-3352'
    },
    localKnowledge: {
      bestApproach: 'Monitor Portland Harbor on VHF 13. Follow buoyed channel carefully',
      weatherConsiderations: ['Fog very common May-September', 'Strong SW winds in winter'],
      tidalConsiderations: 'Current runs 2-3 knots at harbor entrance - plan arrival/departure at slack',
      notes: [
        'Excellent restaurant on premises',
        'Walking distance to Old Port district',
        'Full-service yard available',
        'Strong current when entering - use caution'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: true,
      publicTransport: true,
      marina: true
    },
    rating: { overall: 4.8, facilities: 5, protection: 4, convenience: 5 }
  },

  {
    id: 'newport-goat-island',
    name: 'Goat Island Marina',
    type: 'marina',
    coordinates: { latitude: 41.4936, longitude: -71.3271 },
    location: { city: 'Newport', state: 'RI', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0800-1800 daily' },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: false,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: false,
      chandlery: true
    },
    navigation: {
      approachDepth: 12,
      channelDepth: 15,
      dockDepth: 10,
      tidalRange: 3.5,
      approach: 'Newport Harbor via East Passage or West Passage',
      hazards: ['Heavy summer traffic', 'Racing fleets'],
      bestTideState: 'Accessible all tides for draft <8ft'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 180, reservation: 'Strongly recommended' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud/sand', depth: '12-20 ft', protection: ['N', 'NE', 'E', 'SE'] }
    },
    contact: {
      vhf: '9, 71',
      phone: '+1-401-849-5655',
      email: 'dockmaster@goatislandmarina.com',
      website: 'goatislandmarina.com'
    },
    customs: {
      portOfEntry: true,
      cbpRequired: true,
      hours: 'By appointment',
      procedures: 'Contact Newport CBP at +1-401-841-6900'
    },
    localKnowledge: {
      bestApproach: 'East Passage is deeper and preferred. Avoid race courses on summer weekends',
      weatherConsiderations: ['SW winds dominate summer', 'Thunderstorms July-August'],
      tidalConsiderations: 'Moderate tidal current in passages - plan for slack or favorable',
      notes: [
        'World-class sailing destination',
        'Excellent chandleries nearby',
        'Walking distance to downtown Newport',
        'Very busy in summer - reserve ahead'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: true,
      publicTransport: true,
      marina: true
    },
    rating: { overall: 4.7, facilities: 5, protection: 4, convenience: 5 }
  },

  {
    id: 'annapolis-harbor',
    name: 'Annapolis City Dock',
    type: 'marina',
    coordinates: { latitude: 38.9784, longitude: -76.4822 },
    location: { city: 'Annapolis', state: 'MD', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0700-1900 summer' },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: false,
      showers: true,
      laundry: false,
      wifi: true,
      repair: { available: true, types: ['engine', 'rigging'] },
      haulOut: false,
      chandlery: true
    },
    navigation: {
      approachDepth: 8,
      channelDepth: 10,
      dockDepth: 8,
      tidalRange: 1.5,
      approach: 'Severn River from Chesapeake Bay',
      hazards: ['Shoaling at river entrance', 'Heavy weekend traffic'],
      bestTideState: 'Monitor depths at river entrance - favor high tide if draft >6ft'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100, reservation: 'Required weekends' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-15 ft', protection: ['N', 'E', 'W'] }
    },
    contact: {
      vhf: '16, 71',
      phone: '+1-410-268-0660',
      email: 'harbormaster@annapolis.gov',
      website: 'annapolis.gov/harbor'
    },
    customs: {
      portOfEntry: false,
      cbpRequired: false
    },
    localKnowledge: {
      bestApproach: 'Follow buoyed channel carefully - shoals to both sides',
      weatherConsiderations: ['Afternoon thunderstorms common summer', 'Strong NW winds in winter'],
      tidalConsiderations: 'Minimal tidal influence - current rarely exceeds 0.5 knots',
      notes: [
        'Sailing capital of USA - busy all season',
        'Excellent chandleries and marine services',
        'Historic downtown walking distance',
        'Academy sailing events frequent - monitor traffic'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: true,
      publicTransport: true,
      marina: true
    },
    rating: { overall: 4.6, facilities: 4, protection: 4, convenience: 5 }
  },

  {
    id: 'charleston-harbor',
    name: 'Charleston Maritime Center',
    type: 'marina',
    coordinates: { latitude: 32.7765, longitude: -79.9209 },
    location: { city: 'Charleston', state: 'SC', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0800-1700 daily' },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: true,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics', 'fiberglass'] },
      haulOut: true,
      chandlery: true
    },
    navigation: {
      approachDepth: 20,
      channelDepth: 25,
      dockDepth: 15,
      tidalRange: 5.5,
      approach: 'Charleston Harbor via main ship channel',
      hazards: ['Strong tidal current', 'Commercial shipping traffic'],
      bestTideState: 'Accessible all tides - favor flood for entering harbor'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 200, reservation: 'Recommended' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Excellent - mud', depth: '12-18 ft', protection: ['NE', 'E', 'SE', 'S'] }
    },
    contact: {
      vhf: '16, then 11',
      phone: '+1-843-723-5098',
      email: 'dockmaster@charlestonmaritime.com',
      website: 'charlestonmaritime.com'
    },
    customs: {
      portOfEntry: true,
      cbpRequired: true,
      hours: '0800-1600 weekdays',
      procedures: 'Major port of entry - call CBP at +1-843-727-4312'
    },
    localKnowledge: {
      bestApproach: 'Monitor Charleston Traffic on VHF 11/13. Stay clear of shipping channel when possible',
      weatherConsiderations: ['Afternoon thunderstorms April-September', 'Hurricane season June-November'],
      tidalConsiderations: 'Current runs 2-3 knots in main channel - plan arrival for slack or favorable',
      notes: [
        'Historic city with excellent provisioning',
        'Full-service boatyard available',
        'Hurricane hole option',
        'Popular ICW stop'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: true,
      publicTransport: true,
      marina: true
    },
    rating: { overall: 4.7, facilities: 5, protection: 4, convenience: 5 }
  },

  {
    id: 'rockland-harbor',
    name: 'Rockland Harbor',
    type: 'harbor',
    coordinates: { latitude: 44.1053, longitude: -69.1078 },
    location: { city: 'Rockland', state: 'ME', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0700-1800' },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: true,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics', 'woodwork'] },
      haulOut: true,
      chandlery: true
    },
    navigation: {
      approachDepth: 15,
      channelDepth: 20,
      dockDepth: 12,
      tidalRange: 10.5,
      approach: 'From south via Muscle Ridge Channel or from east via Two Bush Channel',
      hazards: ['Numerous ledges and rocks', 'Strong tidal currents', 'Fog common'],
      bestTideState: 'Large tidal range - monitor depth for your draft'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 120 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '15-30 ft', protection: ['NE', 'E', 'SE', 'S', 'SW', 'W'] }
    },
    contact: {
      vhf: '9',
      phone: '+1-207-594-2011',
      website: 'rocklandharbor.com'
    },
    customs: {
      portOfEntry: false,
      cbpRequired: false
    },
    localKnowledge: {
      bestApproach: 'Muscle Ridge Channel is well-marked. Use chart carefully - many ledges',
      weatherConsiderations: ['Fog very common June-August', 'Strong NE winds in fall/spring'],
      tidalConsiderations: '10+ foot tidal range - verify depth at low water',
      notes: [
        'Excellent cruising center for Midcoast Maine',
        'Famous Lobster Festival in August',
        'Multiple marinas and anchorages',
        'Well-protected natural harbor'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: true,
      publicTransport: false,
      marina: true
    },
    rating: { overall: 4.8, facilities: 5, protection: 5, convenience: 4 }
  },

  {
    id: 'block-island-harbor',
    name: 'Block Island Great Salt Pond',
    type: 'harbor',
    coordinates: { latitude: 41.1731, longitude: -71.5617 },
    location: { city: 'Block Island', state: 'RI', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0800-1800 summer' },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: true,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['engine', 'basic rigging'] },
      haulOut: false,
      chandlery: false
    },
    navigation: {
      approachDepth: 7,
      channelDepth: 8,
      dockDepth: 6,
      tidalRange: 2.5,
      currentStrength: 'Moderate 1-2 knots in entrance channel',
      approach: 'Through breakwater entrance - narrow channel',
      hazards: ['Shallow entrance channel', 'Strong current', 'Heavy traffic in summer'],
      bestTideState: 'Draft >6ft should enter within 2 hours of high tide'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 60, reservation: 'Essential in summer' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Fair - sand/mud', depth: '8-12 ft', protection: ['All directions'] }
    },
    contact: {
      vhf: '9',
      phone: '+1-401-466-5511'
    },
    customs: {
      portOfEntry: false,
      cbpRequired: false
    },
    localKnowledge: {
      bestApproach: 'Line up range markers carefully. Channel is narrow - no room for error',
      weatherConsiderations: ['Exposed to ocean swells', 'Afternoon SW breeze strong in summer'],
      tidalConsiderations: 'Current sets across entrance - approach on flood preferred',
      notes: [
        'Very popular summer destination - book early',
        'Excellent protection once inside',
        'Shallow entrance requires careful timing',
        'Dinghy to town from moorings/anchorage'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: false,
      publicTransport: false,
      marina: true
    },
    rating: { overall: 4.5, facilities: 4, protection: 5, convenience: 3 }
  },

  {
    id: 'nantucket-harbor',
    name: 'Nantucket Harbor',
    type: 'harbor',
    coordinates: { latitude: 41.2835, longitude: -70.0995 },
    location: { city: 'Nantucket', state: 'MA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0800-1700' },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: true,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: true,
      chandlery: true
    },
    navigation: {
      approachDepth: 8,
      channelDepth: 10,
      dockDepth: 8,
      tidalRange: 3.0,
      approach: 'Via Nantucket Sound - shifting channel requires local knowledge',
      hazards: ['Shifting sand bars', 'Channel moves - use current charts', 'Strong tidal current'],
      bestTideState: 'Draft >6ft should enter at half-tide rising or high water'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150, reservation: 'Essential summer' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - sand', depth: '8-15 ft', protection: ['N', 'W'] }
    },
    contact: {
      vhf: '9, 71',
      phone: '+1-508-228-7260'
    },
    customs: {
      portOfEntry: true,
      cbpRequired: true,
      procedures: 'Call CBP before arrival if coming from foreign port'
    },
    localKnowledge: {
      bestApproach: 'Harbor entrance shifts - get local knowledge or hire pilot. Monitor depths carefully',
      weatherConsiderations: ['Fog very common', 'Exposed to ocean weather from S/SE'],
      tidalConsiderations: 'Strong cross-current in entrance - approach on flood preferred',
      notes: [
        'Beautiful historic town',
        'Channel depth changes - verify before entry',
        'Excellent provisioning and services',
        'Popular but exposed anchorage'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: true,
      publicTransport: false,
      marina: true
    },
    rating: { overall: 4.3, facilities: 4, protection: 3, convenience: 4 }
  },

  {
    id: 'mystic-seaport',
    name: 'Mystic Seaport Marina',
    type: 'marina',
    coordinates: { latitude: 41.3612, longitude: -71.9661 },
    location: { city: 'Mystic', state: 'CT', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: true,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['all types - full service yard'] },
      haulOut: true,
      chandlery: true
    },
    navigation: {
      approachDepth: 10,
      channelDepth: 12,
      dockDepth: 10,
      tidalRange: 2.8,
      approach: 'Mystic River from Fishers Island Sound',
      hazards: ['Highway drawbridge (clearance 15ft closed)', 'Railroad bridge (opens on request)'],
      bestTideState: 'Accessible all tides for most vessels'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 200 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-15 ft', protection: ['All directions'] }
    },
    contact: {
      vhf: '9, 71',
      phone: '+1-860-572-5955'
    },
    customs: {
      portOfEntry: false,
      cbpRequired: false
    },
    localKnowledge: {
      bestApproach: 'Call drawbridge on VHF 13 for opening. Museum worth visiting',
      weatherConsiderations: ['Well protected from weather', 'Strong currents under bridges'],
      notes: [
        'Historic Mystic Seaport Museum',
        'Excellent full-service facilities',
        'Drawbridge opens on request',
        'Charming historic village'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: true,
      publicTransport: false,
      marina: true
    },
    rating: { overall: 4.9, facilities: 5, protection: 5, convenience: 4 }
  },

  {
    id: 'new-york-liberty-landing',
    name: 'Liberty Landing Marina',
    type: 'marina',
    coordinates: { latitude: 40.7128, longitude: -74.0343 },
    location: { city: 'Jersey City', state: 'NJ', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: false,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['engine', 'rigging'] },
      haulOut: false,
      chandlery: false
    },
    navigation: {
      approachDepth: 20,
      channelDepth: 30,
      dockDepth: 15,
      tidalRange: 4.5,
      approach: 'Hudson River from New York Harbor',
      hazards: ['Heavy commercial traffic', 'Strong tidal current', 'Ferry traffic'],
      bestTideState: 'Accessible all tides - favor slack for easier docking'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150 },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: {
      vhf: '71',
      phone: '+1-201-985-8000',
      website: 'libertylanding.com'
    },
    customs: {
      portOfEntry: true,
      cbpRequired: true,
      hours: '24/7',
      procedures: 'Major international port - customs available'
    },
    localKnowledge: {
      bestApproach: 'Monitor New York VTS on VHF 14. Watch for ferry traffic',
      weatherConsiderations: ['Strong winds funnel through harbor', 'Ice in winter'],
      tidalConsiderations: 'Current runs 2-3 knots - plan arrival for slack',
      notes: [
        'Spectacular Manhattan skyline views',
        'Ferry to NYC available',
        'Security-conscious - check in at office',
        'Excellent base for NYC visit'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: false,
      publicTransport: true,
      marina: true
    },
    rating: { overall: 4.4, facilities: 4, protection: 3, convenience: 5 }
  },

  {
    id: 'cape-may-harbor',
    name: 'Cape May Harbor',
    type: 'harbor',
    coordinates: { latitude: 38.9351, longitude: -74.9060 },
    location: { city: 'Cape May', state: 'NJ', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: true,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: true,
      chandlery: true
    },
    navigation: {
      approachDepth: 8,
      channelDepth: 10,
      dockDepth: 8,
      tidalRange: 4.5,
      approach: 'Cape May Canal or around Cape May Point',
      hazards: ['Shallow inlet - monitor depths', 'Strong current at inlet'],
      bestTideState: 'Favor high tide for entry if draft >5ft'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - sand/mud', depth: '8-12 ft', protection: ['NE', 'E', 'SE'] }
    },
    contact: {
      vhf: '16, 9',
      phone: '+1-609-884-5508'
    },
    customs: {
      portOfEntry: false,
      cbpRequired: false
    },
    localKnowledge: {
      bestApproach: 'Cape May Canal avoids ocean passage around cape in rough weather',
      weatherConsiderations: ['Can be rough at inlet in strong winds', 'Fog in spring'],
      tidalConsiderations: 'Strong current at inlet - enter on flood for easier passage',
      notes: [
        'Popular ICW stopover',
        'Historic Victorian town',
        'Good protection from most weather',
        'Several marinas available'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: true,
      publicTransport: false,
      marina: true
    },
    rating: { overall: 4.3, facilities: 4, protection: 4, convenience: 4 }
  },

  {
    id: 'norfolk-waterside',
    name: 'Waterside Marina',
    type: 'marina',
    coordinates: { latitude: 36.8468, longitude: -76.2918 },
    location: { city: 'Norfolk', state: 'VA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true,
      electricity: true,
      pumpout: true,
      ice: true,
      provisions: false,
      showers: true,
      laundry: true,
      wifi: true,
      repair: { available: true, types: ['engine', 'basic repairs'] },
      haulOut: false,
      chandlery: false
    },
    navigation: {
      approachDepth: 25,
      channelDepth: 35,
      dockDepth: 20,
      tidalRange: 2.5,
      approach: 'Elizabeth River from Hampton Roads',
      hazards: ['Heavy military vessel traffic', 'Commercial shipping'],
      bestTideState: 'Deep water - accessible all tides'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 200 },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: {
      vhf: '16',
      phone: '+1-757-333-3003'
    },
    customs: {
      portOfEntry: true,
      cbpRequired: true,
      hours: '24/7',
      procedures: 'Major naval base - customs available'
    },
    localKnowledge: {
      bestApproach: 'Stay clear of military vessels - they have right of way. Monitor security zones',
      weatherConsiderations: ['Protected location', 'Can be hot/humid in summer'],
      tidalConsiderations: 'Minimal tidal influence',
      notes: [
        'Downtown location',
        'Major naval base nearby',
        'Good ICW stopover',
        'Easy access to provisions'
      ]
    },
    amenities: {
      restaurants: true,
      groceries: true,
      hardwareStore: true,
      publicTransport: true,
      marina: true
    },
    rating: { overall: 4.2, facilities: 4, protection: 4, convenience: 5 }
  },

  // Additional US East Coast Ports (9-20)
  {
    id: 'cuttyhunk-harbor',
    name: 'Cuttyhunk Harbor',
    type: 'anchorage',
    coordinates: { latitude: 41.4144, longitude: -70.9183 },
    location: { city: 'Cuttyhunk', state: 'MA', country: 'USA' },
    facilities: {
      water: false, electricity: false, pumpout: false, ice: false, provisions: false,
      showers: false, laundry: false, wifi: false,
      repair: { available: false }, haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 8, tidalRange: 3.0,
      approach: 'Via Canapitsit Channel or Quicks Hole',
      hazards: ['Strong tidal current', 'Rocks and shoals'],
      bestTideState: 'Enter on rising tide for maximum depth'
    },
    services: {
      slips: { available: false, transient: false },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Excellent - sand/mud', depth: '8-15 ft', protection: ['N', 'E', 'W'] }
    },
    contact: { vhf: '9' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Classic cruising destination. Use local charts - many rocks',
      weatherConsiderations: ['Exposed to S/SW winds', 'Excellent holding in normal weather'],
      notes: ['Beautiful anchorage', 'Limited services', 'Peaceful overnight stop']
    },
    amenities: { restaurants: false, groceries: false, hardwareStore: false, publicTransport: false, marina: false },
    rating: { overall: 4.5, facilities: 1, protection: 4, convenience: 2 }
  },

  {
    id: 'camden-harbor',
    name: 'Camden Harbor',
    type: 'harbor',
    coordinates: { latitude: 44.2098, longitude: -69.0645 },
    location: { city: 'Camden', state: 'ME', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 10, tidalRange: 9.5,
      approach: 'Penobscot Bay via marked channel',
      hazards: ['Rocks and ledges', 'Strong tidal current'],
      bestTideState: 'Monitor depth at low water - large tidal range'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 120 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '15-25 ft', protection: ['N', 'E', 'W'] }
    },
    contact: { vhf: '9', phone: '+1-207-236-7969' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Picturesque harbor entrance. Follow markers carefully',
      weatherConsiderations: ['Well protected', 'Fog common'],
      notes: ['Beautiful Maine harbor', 'Excellent town', 'Windjammer fleet based here']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.8, facilities: 5, protection: 5, convenience: 5 }
  },

  {
    id: 'boothbay-harbor',
    name: 'Boothbay Harbor',
    type: 'harbor',
    coordinates: { latitude: 43.8518, longitude: -69.6284 },
    location: { city: 'Boothbay Harbor', state: 'ME', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['full service'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 12, tidalRange: 10.0,
      approach: 'From Linekin Bay or Townsend Gut',
      hazards: ['Ledges and rocks', 'Strong tidal current'],
      bestTideState: 'Large tidal range - verify depth for your draft'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '15-30 ft', protection: ['All directions'] }
    },
    contact: { vhf: '9', phone: '+1-207-633-2321' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Well-marked approaches. Busy harbor in summer',
      weatherConsiderations: ['Excellent protection', 'Fog common'],
      notes: ['Major cruising center', 'Multiple marinas', 'Charming village']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.7, facilities: 5, protection: 5, convenience: 5 }
  },

  {
    id: 'marblehead-harbor',
    name: 'Marblehead Harbor',
    type: 'harbor',
    coordinates: { latitude: 42.5001, longitude: -70.8578 },
    location: { city: 'Marblehead', state: 'MA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: false, wifi: true,
      repair: { available: true, types: ['engine', 'rigging'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 8, channelDepth: 10, dockDepth: 8, tidalRange: 9.0,
      approach: 'From Massachusetts Bay via marked channel',
      hazards: ['Rocks and shoals', 'Racing activity', 'Mooring field crowded'],
      bestTideState: 'Favor high tide if draft >6ft'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 60, reservation: 'Required summer' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-15 ft', protection: ['N', 'E', 'W'] }
    },
    contact: { vhf: '9', phone: '+1-781-631-2386' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Historic sailing town. Avoid race courses on summer weekends',
      weatherConsiderations: ['Well protected', 'Can be rolly in NE winds'],
      notes: ['Prestigious yacht clubs', 'Historic town', 'Limited transient space']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.6, facilities: 4, protection: 4, convenience: 4 }
  },

  {
    id: 'salem-harbor',
    name: 'Salem Harbor',
    type: 'harbor',
    coordinates: { latitude: 42.5195, longitude: -70.8885 },
    location: { city: 'Salem', state: 'MA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 10, tidalRange: 9.0,
      approach: 'From Beverly/Salem Harbor via marked channel',
      hazards: ['Power plant cooling water discharge', 'Commercial traffic'],
      bestTideState: 'Accessible all tides for draft <8ft'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '12-18 ft', protection: ['N', 'E', 'S', 'W'] }
    },
    contact: { vhf: '9', phone: '+1-978-745-9430' },
    customs: { portOfEntry: true, cbpRequired: true, procedures: 'Contact CBP for clearance' },
    localKnowledge: {
      bestApproach: 'Historic maritime city. Well-marked approaches',
      weatherConsiderations: ['Good protection', 'Strong NE winds can make harbor uncomfortable'],
      notes: ['Historic waterfront', 'Easy access to Boston', 'Maritime museum']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.3, facilities: 4, protection: 4, convenience: 5 }
  },

  {
    id: 'edgartown-harbor',
    name: 'Edgartown Harbor',
    type: 'harbor',
    coordinates: { latitude: 41.3891, longitude: -70.5033 },
    location: { city: 'Edgartown', state: 'MA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging'] },
      haulOut: false, chandlery: true
    },
    navigation: {
      approachDepth: 8, channelDepth: 10, dockDepth: 7, tidalRange: 2.5,
      approach: 'From Nantucket Sound - well marked',
      hazards: ['Shallow entrance bar', 'Strong tidal current'],
      bestTideState: 'Draft >6ft should enter within 2 hours of high tide'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 80, reservation: 'Essential summer' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - sand/mud', depth: '8-12 ft', protection: ['N', 'W'] }
    },
    contact: { vhf: '9, 68', phone: '+1-508-627-4746' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Monitor depths crossing entrance bar. Very popular destination',
      weatherConsiderations: ['Can be uncomfortable in S/SW winds', 'Fog common'],
      notes: ['Upscale Martha\'s Vineyard town', 'Very busy summer', 'Beautiful harbor']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.6, facilities: 4, protection: 3, convenience: 4 }
  },

  {
    id: 'hyannis-harbor',
    name: 'Hyannis Harbor',
    type: 'harbor',
    coordinates: { latitude: 41.6362, longitude: -70.2811 },
    location: { city: 'Hyannis', state: 'MA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 8, channelDepth: 10, dockDepth: 8, tidalRange: 2.0,
      approach: 'From Nantucket Sound - marked channel',
      hazards: ['Ferry traffic', 'Shoaling', 'Busy harbor'],
      bestTideState: 'Monitor depths in outer harbor'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 120 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Fair - sand', depth: '8-12 ft', protection: ['N', 'W'] }
    },
    contact: { vhf: '9', phone: '+1-508-790-6273' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Watch for ferries to Nantucket and Martha\'s Vineyard',
      weatherConsiderations: ['Open to S winds', 'Good provisioning'],
      notes: ['Major Cape Cod hub', 'Ferries run frequently', 'Good facilities']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.2, facilities: 4, protection: 3, convenience: 5 }
  },

  {
    id: 'provincetown-harbor',
    name: 'Provincetown Harbor',
    type: 'harbor',
    coordinates: { latitude: 42.0534, longitude: -70.1864 },
    location: { city: 'Provincetown', state: 'MA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['basic repairs'] },
      haulOut: false, chandlery: true
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 12, tidalRange: 8.5,
      approach: 'From Cape Cod Bay - deep water approach',
      hazards: ['Exposed to N winds', 'Can be rough in winter'],
      bestTideState: 'Deep water - accessible all tides'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - sand', depth: '15-25 ft', protection: ['S', 'E', 'W'] }
    },
    contact: { vhf: '12', phone: '+1-508-487-7030' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Long Point at tip of Cape Cod. Sheltered from most weather',
      weatherConsiderations: ['Exposed to strong N winds', 'Excellent in summer'],
      notes: ['Vibrant tourist town', 'Good anchorage', 'Ferry to Boston']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.4, facilities: 4, protection: 4, convenience: 4 }
  },

  {
    id: 'beaufort-nc',
    name: 'Beaufort Town Docks',
    type: 'marina',
    coordinates: { latitude: 34.7204, longitude: -76.6638 },
    location: { city: 'Beaufort', state: 'NC', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 8, tidalRange: 3.5,
      approach: 'Via Beaufort Inlet from Atlantic or ICW',
      hazards: ['Shifting inlet channel', 'Strong current at inlet'],
      bestTideState: 'Monitor depths at inlet - bar shifts'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 120 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '8-15 ft', protection: ['N', 'E', 'W'] }
    },
    contact: { vhf: '16', phone: '+1-252-728-2503' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Historic waterfront. Monitor inlet depths - channel can shift after storms',
      weatherConsiderations: ['Good protection', 'Hurricane season June-November'],
      notes: ['Historic NC seaport', 'Excellent facilities', 'ICW milestone']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.7, facilities: 5, protection: 4, convenience: 4 }
  },

  {
    id: 'wilmington-nc',
    name: 'Wilmington City Docks',
    type: 'marina',
    coordinates: { latitude: 34.2257, longitude: -77.9447 },
    location: { city: 'Wilmington', state: 'NC', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics', 'fiberglass'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 10, tidalRange: 4.0,
      approach: 'Cape Fear River from Atlantic',
      hazards: ['Commercial shipping', 'Strong river current'],
      bestTideState: 'Accessible all tides'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150 },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '15-20 ft', protection: ['All directions'] }
    },
    contact: { vhf: '16', phone: '+1-910-341-7800' },
    customs: { portOfEntry: true, cbpRequired: true, procedures: 'Contact CBP for clearance' },
    localKnowledge: {
      bestApproach: 'Follow Cape Fear River channel. Historic riverfront',
      weatherConsiderations: ['Protected location', 'Hurricane preparations important'],
      notes: ['Historic downtown', 'Excellent facilities', 'Full-service yards nearby']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.5, facilities: 5, protection: 4, convenience: 5 }
  },

  {
    id: 'georgetown-sc',
    name: 'Georgetown Landing Marina',
    type: 'marina',
    coordinates: { latitude: 33.3771, longitude: -79.2945 },
    location: { city: 'Georgetown', state: 'SC', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'basic repairs'] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 8, tidalRange: 5.0,
      approach: 'Winyah Bay from Atlantic or via ICW',
      hazards: ['Shallow bay entrance', 'Strong tidal current'],
      bestTideState: 'Favor flood tide for entering bay'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100 },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-15 ft', protection: ['N', 'E', 'W'] }
    },
    contact: { vhf: '16', phone: '+1-843-546-1776' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Monitor depths crossing Winyah Bay bar. Historic riverport',
      weatherConsiderations: ['Protected once inside', 'Inlet can be rough'],
      notes: ['Historic southern town', 'Good ICW stop', 'Friendly community']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.3, facilities: 4, protection: 4, convenience: 3 }
  },

  {
    id: 'fernandina-beach',
    name: 'Fernandina Harbor Marina',
    type: 'marina',
    coordinates: { latitude: 30.6724, longitude: -81.4648 },
    location: { city: 'Fernandina Beach', state: 'FL', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 10, tidalRange: 6.5,
      approach: 'Amelia River from Atlantic',
      hazards: ['Strong tidal current', 'Commercial shipping'],
      bestTideState: 'Time arrival for slack or favorable current'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150 },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-15 ft', protection: ['N', 'E', 'W'] }
    },
    contact: { vhf: '16', phone: '+1-904-491-0014' },
    customs: { portOfEntry: true, cbpRequired: true, procedures: 'First US port from Bahamas - CBP clearance required' },
    localKnowledge: {
      bestApproach: 'Popular first stop returning from Bahamas. Historic downtown',
      weatherConsiderations: ['Protected from ocean', 'Warm climate year-round'],
      notes: ['Historic district', 'Popular Bahamas return point', 'Good facilities']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.6, facilities: 5, protection: 4, convenience: 4 }
  },

  {
    id: 'st-augustine',
    name: 'St. Augustine Municipal Marina',
    type: 'marina',
    coordinates: { latitude: 29.8977, longitude: -81.3145 },
    location: { city: 'St. Augustine', state: 'FL', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics', 'fiberglass'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 8, channelDepth: 10, dockDepth: 8, tidalRange: 5.0,
      approach: 'St. Augustine Inlet from Atlantic or via ICW',
      hazards: ['Inlet can be rough in strong winds', 'Shifting sand bar'],
      bestTideState: 'Avoid inlet in strong onshore winds or ebb tide'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 200 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '8-15 ft', protection: ['N', 'E', 'W'] }
    },
    contact: { vhf: '16', phone: '+1-904-825-1026' },
    customs: { portOfEntry: true, cbpRequired: true, procedures: 'Contact CBP for clearance from foreign ports' },
    localKnowledge: {
      bestApproach: 'Oldest city in USA. Inlet requires local knowledge or calm conditions',
      weatherConsiderations: ['Inlet dangerous in strong E/SE winds', 'Protected inside'],
      notes: ['Historic attractions', 'Popular ICW stop', 'Excellent downtown marina']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.7, facilities: 5, protection: 4, convenience: 5 }
  },

  {
    id: 'southport-nc',
    name: 'Southport Marina',
    type: 'marina',
    coordinates: { latitude: 33.9204, longitude: -78.0206 },
    location: { city: 'Southport', state: 'NC', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 8, tidalRange: 4.5,
      approach: 'Cape Fear River from Atlantic',
      hazards: ['Commercial shipping to Wilmington', 'Strong tidal current'],
      bestTideState: 'Plan for slack or favorable current'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 120 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-15 ft', protection: ['N', 'E', 'S', 'W'] }
    },
    contact: { vhf: '16', phone: '+1-910-457-6501' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Charming NC coastal town. Watch for shipping traffic to Wilmington',
      weatherConsiderations: ['Good protection', 'Hurricane planning important'],
      notes: ['Quaint waterfront town', 'ICW mile 300', 'Good facilities']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.5, facilities: 4, protection: 5, convenience: 4 }
  },

  {
    id: 'miami-dinner-key',
    name: 'Dinner Key Marina',
    type: 'marina',
    coordinates: { latitude: 25.7320, longitude: -80.2321 },
    location: { city: 'Miami', state: 'FL', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '24/7' }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['all types - full service'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 10, tidalRange: 2.0,
      approach: 'Biscayne Bay from Atlantic',
      hazards: ['Heavy recreational traffic', 'Water depth varies'],
      bestTideState: 'Monitor local depths - some areas shallow'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 250, reservation: 'Recommended' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Fair - sand/grass', depth: '8-12 ft', protection: ['N', 'E'] }
    },
    contact: { vhf: '16, 68', phone: '+1-305-579-6955' },
    customs: { portOfEntry: true, cbpRequired: true, hours: '24/7', procedures: 'Major international port - full CBP services' },
    localKnowledge: {
      bestApproach: 'Major metro marina. Heavy weekend traffic - arrive early for slip',
      weatherConsiderations: ['Protected from ocean', 'Hurricane season June-November'],
      notes: ['Large municipal marina', 'Full services', 'Easy city access', 'Popular megayacht stop']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.3, facilities: 5, protection: 3, convenience: 5 }
  },

  {
    id: 'key-west-harbor',
    name: 'Key West Bight Marina',
    type: 'marina',
    coordinates: { latitude: 24.5585, longitude: -81.8065 },
    location: { city: 'Key West', state: 'FL', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 8, channelDepth: 10, dockDepth: 7, tidalRange: 1.5,
      approach: 'Via marked channels from Atlantic or Gulf',
      hazards: ['Shallow waters', 'Coral reefs', 'Heavy traffic'],
      bestTideState: 'Monitor depths - some areas barely adequate at low tide'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150, reservation: 'Essential' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Poor - hard bottom', depth: '6-10 ft', protection: ['N', 'E'] }
    },
    contact: { vhf: '16', phone: '+1-305-809-3983' },
    customs: { portOfEntry: true, cbpRequired: true, hours: 'By appointment', procedures: 'Required for vessels arriving from foreign ports' },
    localKnowledge: {
      bestApproach: 'Use charts carefully - coral and shallow water. Monitor depths',
      weatherConsiderations: ['Tropical climate', 'Hurricane season active', 'Strong winter cold fronts'],
      notes: ['Southernmost US port', 'Vibrant tourist town', 'Gateway to Caribbean', 'Premium pricing']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.4, facilities: 5, protection: 3, convenience: 5 }
  },

  {
    id: 'fort-lauderdale',
    name: 'Las Olas Marina',
    type: 'marina',
    coordinates: { latitude: 26.1186, longitude: -80.1226 },
    location: { city: 'Fort Lauderdale', state: 'FL', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '24/7' }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['all types - full service center'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 12, tidalRange: 2.5,
      approach: 'New River from Port Everglades inlet',
      hazards: ['Numerous bridges (low clearance)', 'Heavy traffic'],
      bestTideState: 'Monitor bridge clearances - some very low'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 300, reservation: 'Recommended' },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: { vhf: '16', phone: '+1-954-524-2424' },
    customs: { portOfEntry: true, cbpRequired: true, hours: '24/7', procedures: 'Major international yachting center' },
    localKnowledge: {
      bestApproach: 'Yachting capital of the world. Count bridge clearances before entering',
      weatherConsiderations: ['Protected river location', 'Hurricane preparations critical'],
      notes: ['Major refit center', 'Extensive marine services', 'International destination', 'Multiple marinas']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.9, facilities: 5, protection: 4, convenience: 5 }
  },

  {
    id: 'atlantic-city',
    name: 'Golden Nugget Atlantic City Marina',
    type: 'marina',
    coordinates: { latitude: 39.3797, longitude: -74.4310 },
    location: { city: 'Atlantic City', state: 'NJ', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: false, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'basic repairs'] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 8, tidalRange: 4.0,
      approach: 'Absecon Inlet from Atlantic',
      hazards: ['Inlet can be rough', 'Shoaling'],
      bestTideState: 'Favor high tide for crossing inlet bar'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 130 },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: { vhf: '16', phone: '+1-609-441-2116' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Casino marina. Monitor inlet conditions - can be dangerous in onshore winds',
      weatherConsiderations: ['Inlet rough in strong E/SE winds', 'Protected inside'],
      notes: ['Casino access', 'Good ICW access', 'Entertainment available']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: true, marina: true },
    rating: { overall: 4.0, facilities: 4, protection: 3, convenience: 4 }
  },

  {
    id: 'buzzards-bay-padanaram',
    name: 'Padanaram Harbor',
    type: 'harbor',
    coordinates: { latitude: 41.5725, longitude: -70.9439 },
    location: { city: 'South Dartmouth', state: 'MA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: false, wifi: true,
      repair: { available: true, types: ['engine', 'rigging'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 8, channelDepth: 10, dockDepth: 7, tidalRange: 4.0,
      approach: 'From Buzzards Bay via narrow entrance',
      hazards: ['Narrow entrance channel', 'Strong current'],
      bestTideState: 'Favor flood tide for entering harbor'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 80 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Excellent - mud', depth: '10-15 ft', protection: ['All directions'] }
    },
    contact: { vhf: '9', phone: '+1-508-999-3321' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Beautiful small harbor. Line up range markers for narrow entrance',
      weatherConsiderations: ['Excellent protection once inside', 'Hurricane hole'],
      notes: ['Picturesque village', 'Excellent protection', 'Limited transient space']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: false, marina: true },
    rating: { overall: 4.7, facilities: 4, protection: 5, convenience: 3 }
  },

  {
    id: 'essex-ct',
    name: 'Essex Island Marina',
    type: 'marina',
    coordinates: { latitude: 41.3518, longitude: -72.3926 },
    location: { city: 'Essex', state: 'CT', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'woodwork'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 10, tidalRange: 3.0,
      approach: 'Connecticut River from Long Island Sound',
      hazards: ['Railroad bridge', 'River traffic'],
      bestTideState: 'Accessible all tides'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-18 ft', protection: ['All directions'] }
    },
    contact: { vhf: '9', phone: '+1-860-767-1267' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Classic Connecticut River town. Well protected from weather',
      weatherConsiderations: ['River provides excellent protection', 'Minimal tidal influence'],
      notes: ['Historic village', 'Traditional boat building', 'Charming downtown']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.8, facilities: 5, protection: 5, convenience: 4 }
  },

  {
    id: 'greenport-ny',
    name: 'Greenport Yacht & Shipbuilding',
    type: 'marina',
    coordinates: { latitude: 41.1037, longitude: -72.3573 },
    location: { city: 'Greenport', state: 'NY', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['all types - shipyard'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 10, tidalRange: 2.5,
      approach: 'Peconic Bay from Gardiners Bay',
      hazards: ['Shoaling in some areas', 'Ferry traffic'],
      bestTideState: 'Generally deep - accessible all tides'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 200 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '8-15 ft', protection: ['N', 'E', 'S', 'W'] }
    },
    contact: { vhf: '71', phone: '+1-631-477-2277' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'North Fork Long Island. Working shipyard with full services',
      weatherConsiderations: ['Protected bay location', 'Good in most weather'],
      notes: ['Full-service yard', 'Winery tours nearby', 'Historic maritime village']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.6, facilities: 5, protection: 4, convenience: 4 }
  },

  {
    id: 'watch-hill-ri',
    name: 'Watch Hill Cove',
    type: 'anchorage',
    coordinates: { latitude: 41.3048, longitude: -71.8576 },
    location: { city: 'Watch Hill', state: 'RI', country: 'USA' },
    facilities: {
      water: false, electricity: false, pumpout: false, ice: true, provisions: true,
      showers: true, laundry: false, wifi: false,
      repair: { available: false }, haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 6, channelDepth: 8, dockDepth: 6, tidalRange: 2.5,
      approach: 'From Block Island Sound - shallow entrance',
      hazards: ['Very shallow - draft limit 5ft', 'Rocks'],
      bestTideState: 'Enter at high tide only if draft >4ft'
    },
    services: {
      slips: { available: false, transient: false },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - sand/mud', depth: '6-10 ft', protection: ['N', 'E', 'S'] }
    },
    contact: { vhf: '68' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Exclusive summer community. Shallow - shoal draft boats only',
      weatherConsiderations: ['Exposed to W/SW winds', 'Beautiful summer spot'],
      notes: ['Upscale community', 'Limited facilities', 'Dinghy landing', 'Very shallow']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: false, marina: false },
    rating: { overall: 4.0, facilities: 2, protection: 3, convenience: 2 }
  },

  {
    id: 'stonington-ct',
    name: 'Dodson Boatyard',
    type: 'marina',
    coordinates: { latitude: 41.3315, longitude: -71.9070 },
    location: { city: 'Stonington', state: 'CT', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true }, water: true, electricity: true, pumpout: true,
      ice: true, provisions: true, showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['all types - full service yard'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 10, tidalRange: 2.5,
      approach: 'From Fishers Island Sound',
      hazards: ['Rocks and ledges', 'Strong current'],
      bestTideState: 'Accessible all tides with careful navigation'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-15 ft', protection: ['N', 'E', 'W'] }
    },
    contact: { vhf: '9', phone: '+1-860-535-1507' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Quaint fishing village. Full-service yard',
      weatherConsiderations: ['Well protected', 'Good year-round'],
      notes: ['Traditional boatyard', 'Historic village', 'Working waterfront']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.7, facilities: 5, protection: 5, convenience: 4 }
  },

  // =============================================
  // GULF COAST PORTS
  // =============================================

  {
    id: 'pensacola-palafox-pier',
    name: 'Palafox Pier & Yacht Harbor',
    type: 'marina',
    coordinates: { latitude: 30.4045, longitude: -87.2131 },
    location: { city: 'Pensacola', state: 'FL', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0700-1800 daily' },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'fiberglass', 'electronics'] },
      haulOut: false, chandlery: true
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 10, tidalRange: 1.5,
      approach: 'Enter Pensacola Pass, follow marked channel to downtown waterfront',
      hazards: ['Strong currents at pass entrance', 'Shallow areas outside channel'],
      bestTideState: 'Accessible all tides'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 130, reservation: 'Recommended in winter' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - sand', depth: '8-12 ft', protection: ['N', 'E'] }
    },
    contact: { vhf: '16', phone: '+1-850-432-9620' },
    customs: { portOfEntry: true, cbpRequired: true, hours: '0800-1600 weekdays' },
    localKnowledge: {
      bestApproach: 'Pensacola Pass has strong currents - time entry for slack water',
      weatherConsiderations: ['Hurricane season Jun-Nov', 'Summer afternoon thunderstorms common'],
      notes: ['Popular ICW stop', 'Historic downtown walkable', 'Blue Angels NAS nearby']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.3, facilities: 4, protection: 4, convenience: 5 }
  },

  {
    id: 'mobile-dog-river-marina',
    name: 'Dog River Marina',
    type: 'marina',
    coordinates: { latitude: 30.6267, longitude: -88.1018 },
    location: { city: 'Mobile', state: 'AL', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: false,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'fiberglass'] },
      haulOut: true, chandlery: false
    },
    navigation: {
      approachDepth: 8, channelDepth: 12, dockDepth: 8, tidalRange: 1.5,
      approach: 'From Mobile Bay via Dog River entrance',
      hazards: ['Shallow bar at river entrance'],
      bestTideState: 'Enter at half tide or higher'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 80 },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '6-10 ft', protection: ['All'] }
    },
    contact: { vhf: '16', phone: '+1-251-471-5443' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Well protected in Dog River. Good hurricane hole.',
      weatherConsiderations: ['Hurricane season Jun-Nov', 'Excellent storm protection'],
      notes: ['Popular hurricane hole', 'Quiet anchorage', 'ICW access']
    },
    amenities: { restaurants: true, groceries: false, hardwareStore: false, publicTransport: false, marina: true },
    rating: { overall: 3.8, facilities: 3, protection: 5, convenience: 2 }
  },

  {
    id: 'gulfport-harbor',
    name: 'Gulfport Small Craft Harbor',
    type: 'harbor',
    coordinates: { latitude: 30.3616, longitude: -89.0928 },
    location: { city: 'Gulfport', state: 'MS', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: false,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine'] },
      haulOut: true, chandlery: false
    },
    navigation: {
      approachDepth: 8, channelDepth: 10, dockDepth: 8, tidalRange: 1.5,
      approach: 'From Mississippi Sound, follow marked channel',
      hazards: ['Shallow approach in Sound', 'Barrier islands reduce wave action'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 65 },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Fair - sand/mud', depth: '6-8 ft', protection: ['S'] }
    },
    contact: { vhf: '16', phone: '+1-228-868-5713' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Protected by barrier islands. Good stop on Gulf ICW.',
      weatherConsiderations: ['Hurricane season Jun-Nov', 'Barrier islands provide some protection'],
      notes: ['Casino area nearby', 'Good provisioning in town']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 3.5, facilities: 3, protection: 3, convenience: 4 }
  },

  {
    id: 'new-orleans-municipal-yacht-harbor',
    name: 'Municipal Yacht Harbor',
    type: 'marina',
    coordinates: { latitude: 30.0244, longitude: -90.0709 },
    location: { city: 'New Orleans', state: 'LA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging'] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 10, tidalRange: 0.5,
      approach: 'Via Lake Pontchartrain through Inner Harbor Navigation Canal',
      hazards: ['Strong Mississippi River current', 'Commercial traffic in IHNC'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100, reservation: 'Recommended during festivals' },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: { vhf: '16', phone: '+1-504-283-4515' },
    customs: { portOfEntry: true, cbpRequired: true, hours: '24/7' },
    localKnowledge: {
      bestApproach: 'Lake Pontchartrain approach avoids Mississippi River current. Call ahead for lock schedules.',
      weatherConsiderations: ['Hurricane season Jun-Nov', 'Summer heat extreme', 'Afternoon storms common'],
      notes: ['French Quarter walkable', 'Mardi Gras reservations essential', 'Rich maritime history']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.0, facilities: 4, protection: 4, convenience: 5 }
  },

  {
    id: 'galveston-yacht-basin',
    name: 'Galveston Yacht Basin',
    type: 'marina',
    coordinates: { latitude: 29.3089, longitude: -94.7847 },
    location: { city: 'Galveston', state: 'TX', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: false,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'fiberglass'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 8, tidalRange: 2.0,
      approach: 'Enter via Galveston Channel, follow markers to yacht basin',
      hazards: ['Strong currents in ship channel', 'Commercial traffic'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100 },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: { vhf: '16', phone: '+1-409-765-3421' },
    customs: { portOfEntry: true, cbpRequired: true },
    localKnowledge: {
      bestApproach: 'Monitor VHF 13 for ship traffic. Stay well clear of commercial vessels.',
      weatherConsiderations: ['Hurricane season Jun-Nov', 'Fog in winter', 'Strong southerly sea breeze'],
      notes: ['Gateway to Texas coast', 'Good provisioning', 'Historic Strand district']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 3.8, facilities: 4, protection: 3, convenience: 4 }
  },

  // =============================================
  // PACIFIC COAST PORTS
  // =============================================

  {
    id: 'san-diego-shelter-island',
    name: 'Shelter Island Marina',
    type: 'marina',
    coordinates: { latitude: 32.7114, longitude: -117.2268 },
    location: { city: 'San Diego', state: 'CA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0700-1700 daily' },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics', 'fiberglass', 'sails'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 25, channelDepth: 40, dockDepth: 15, tidalRange: 5.5,
      approach: 'Enter San Diego Bay past Point Loma lighthouse',
      hazards: ['Navy vessel traffic', 'Strong kelp beds outside bay'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 200, reservation: 'Recommended' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '12-20 ft', protection: ['All'] }
    },
    contact: { vhf: '12', phone: '+1-619-222-1181' },
    customs: { portOfEntry: true, cbpRequired: true, hours: '24/7', procedures: 'CBP office at Shelter Island' },
    localKnowledge: {
      bestApproach: 'Fair-weather port, well protected inside bay. First US port for Mexico returnees.',
      weatherConsiderations: ['Mild year-round', 'Fog common mornings May-Sep', 'Santa Ana winds Oct-Dec'],
      notes: ['Major cruising hub', 'Excellent yacht services', 'Baja Ha-Ha staging area']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.8, facilities: 5, protection: 5, convenience: 5 }
  },

  {
    id: 'channel-islands-harbor',
    name: 'Channel Islands Harbor',
    type: 'harbor',
    coordinates: { latitude: 34.1567, longitude: -119.2225 },
    location: { city: 'Oxnard', state: 'CA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'fiberglass'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 12, tidalRange: 5.0,
      approach: 'Well-marked entrance, breakwater protected',
      hazards: ['Surge during large SW swells', 'Kelp beds outside entrance'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100 },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: { vhf: '16', phone: '+1-805-382-3001' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Gateway to Channel Islands National Park. Well-maintained harbor.',
      weatherConsiderations: ['NW winds predominant', 'Santa Ana winds Oct-Feb', 'Fog common'],
      notes: ['Staging point for Channel Islands', 'Good marine services', 'Nice waterfront restaurants']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: true, marina: true },
    rating: { overall: 4.2, facilities: 4, protection: 4, convenience: 4 }
  },

  {
    id: 'san-francisco-pier-39',
    name: 'Pier 39 Marina',
    type: 'marina',
    coordinates: { latitude: 37.8087, longitude: -122.4098 },
    location: { city: 'San Francisco', state: 'CA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: false, types: [] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 30, channelDepth: 40, dockDepth: 15, tidalRange: 6.0,
      approach: 'Enter Golden Gate, turn east to Pier 39 north of Bay Bridge',
      hazards: ['Extremely strong currents (3-5 knots) at Golden Gate', 'Fog', 'Heavy commercial traffic'],
      bestTideState: 'Time Golden Gate entry for slack water or favorable current'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100, reservation: 'Required - call ahead' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '15-30 ft', protection: ['W', 'N'] }
    },
    contact: { vhf: '16', phone: '+1-415-705-5556' },
    customs: { portOfEntry: true, cbpRequired: true, hours: '24/7' },
    localKnowledge: {
      bestApproach: 'Time Golden Gate passage for slack water. Max ebb current 5+ knots. Monitor VHF 14 for VTS.',
      weatherConsiderations: ['Fog very common May-Sep', 'Strong afternoon westerlies 20-30kt', 'Cold water year-round'],
      notes: ['Iconic location', 'Sea lions on docks', 'Alcatraz views', 'Tourist area']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: true, marina: true },
    rating: { overall: 4.0, facilities: 3, protection: 3, convenience: 5 }
  },

  {
    id: 'monterey-harbor',
    name: 'Monterey Harbor',
    type: 'harbor',
    coordinates: { latitude: 36.6049, longitude: -121.8919 },
    location: { city: 'Monterey', state: 'CA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'fiberglass'] },
      haulOut: true, chandlery: false
    },
    navigation: {
      approachDepth: 15, channelDepth: 18, dockDepth: 10, tidalRange: 5.0,
      approach: 'Well-marked breakwater entrance from Monterey Bay',
      hazards: ['Kelp beds', 'Marine sanctuary restrictions'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 80 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - sand/mud', depth: '15-25 ft', protection: ['W', 'N', 'E'] }
    },
    contact: { vhf: '16', phone: '+1-831-646-3950' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Protected from NW swell by breakwater. Monterey Bay National Marine Sanctuary rules apply.',
      weatherConsiderations: ['Fog common', 'NW winds afternoon', 'Can be exposed to southerly storms'],
      notes: ['Cannery Row nearby', 'Monterey Bay Aquarium', 'Beautiful coastline']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: true, marina: true },
    rating: { overall: 4.2, facilities: 4, protection: 4, convenience: 4 }
  },

  {
    id: 'seattle-shilshole-bay',
    name: 'Shilshole Bay Marina',
    type: 'marina',
    coordinates: { latitude: 47.6808, longitude: -122.4048 },
    location: { city: 'Seattle', state: 'WA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0800-1700' },
      water: true, electricity: true, pumpout: true, ice: true, provisions: false,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics', 'fiberglass'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 20, channelDepth: 25, dockDepth: 15, tidalRange: 11.0,
      approach: 'From Puget Sound, well-marked entrance breakwater',
      hazards: ['Large tidal range', 'Current in Puget Sound'],
      bestTideState: 'Accessible all tides'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150, reservation: 'Recommended summer' },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: { vhf: '16', phone: '+1-206-728-3006' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Largest marina in Pacific NW. Monitor VHF 5A for Puget Sound VTS.',
      weatherConsiderations: ['Rain common Oct-May', 'Mild temperatures', 'Wind funnels through Sound'],
      notes: ['1400+ slips', 'Excellent marine services', 'Gateway to San Juan Islands']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.5, facilities: 5, protection: 4, convenience: 4 }
  },

  {
    id: 'friday-harbor',
    name: 'Friday Harbor Marina',
    type: 'marina',
    coordinates: { latitude: 48.5340, longitude: -123.0168 },
    location: { city: 'Friday Harbor', state: 'WA', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine'] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 20, channelDepth: 30, dockDepth: 15, tidalRange: 8.0,
      approach: 'Enter from San Juan Channel, well-marked harbor',
      hazards: ['Strong tidal currents in channel (3-4 knots)', 'Whale watching vessels'],
      bestTideState: 'Time channel transit for slack or favorable current'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 120 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '15-30 ft', protection: ['W', 'S'] }
    },
    contact: { vhf: '66A', phone: '+1-360-378-2688' },
    customs: { portOfEntry: true, cbpRequired: true, procedures: 'Clear customs on arrival from Canada' },
    localKnowledge: {
      bestApproach: 'Beautiful approach through San Juan Islands. Time for slack current in channels.',
      weatherConsiderations: ['Rain shadow - drier than Seattle', 'Current is biggest factor', 'Fog occasional'],
      notes: ['Orca whale watching', 'Charming town', 'Customs clearance for Canada crossings']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: false, marina: true },
    rating: { overall: 4.5, facilities: 4, protection: 4, convenience: 4 }
  },

  // =============================================
  // GREAT LAKES PORTS
  // =============================================

  {
    id: 'mackinac-island-marina',
    name: 'Mackinac Island State Dock',
    type: 'harbor',
    coordinates: { latitude: 45.8480, longitude: -84.6189 },
    location: { city: 'Mackinac Island', state: 'MI', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: false, wifi: true,
      repair: { available: false, types: [] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 12, tidalRange: 0.0,
      approach: 'From Straits of Mackinac, approach from south or east',
      hazards: ['Strong currents in Straits', 'Ferry traffic', 'No motorized vehicles on island'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 80 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-20 ft', protection: ['W'] }
    },
    contact: { vhf: '16', phone: '+1-906-847-3561' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Iconic Great Lakes destination. No cars on island - bicycle or horse transport.',
      weatherConsiderations: ['Season May-Oct only', 'Strong storms can develop quickly', 'Ice Nov-Apr'],
      notes: ['No motor vehicles', 'Historic Grand Hotel', 'Chicago-Mac race finish']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: false, marina: true },
    rating: { overall: 4.3, facilities: 3, protection: 3, convenience: 4 }
  },

  {
    id: 'chicago-dusable-harbor',
    name: 'DuSable Harbor',
    type: 'harbor',
    coordinates: { latitude: 41.8692, longitude: -87.6122 },
    location: { city: 'Chicago', state: 'IL', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: false,
      showers: true, laundry: true, wifi: true,
      repair: { available: false, types: [] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 12, tidalRange: 0.0,
      approach: 'From Lake Michigan, enter breakwater-protected harbor near Navy Pier',
      hazards: ['Large vessel traffic at harbor entrance', 'Strong NE storms create large waves'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 70, reservation: 'Required in summer' },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: { vhf: '16', phone: '+1-312-742-5369' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Stunning Chicago skyline approach. Call ahead - fills quickly in summer.',
      weatherConsiderations: ['Season Apr-Nov', 'Sudden storms on Lake Michigan', 'Ice Dec-Mar'],
      notes: ['Downtown Chicago location', 'Museums and Magnificent Mile nearby', 'Race to Mackinac staging']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: true, marina: true },
    rating: { overall: 4.0, facilities: 3, protection: 4, convenience: 5 }
  },

  {
    id: 'put-in-bay-marina',
    name: 'Put-in-Bay Marina',
    type: 'marina',
    coordinates: { latitude: 41.6522, longitude: -82.8224 },
    location: { city: 'Put-in-Bay', state: 'OH', country: 'USA' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine'] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 10, channelDepth: 12, dockDepth: 8, tidalRange: 0.0,
      approach: 'From Lake Erie, enter harbor from the south',
      hazards: ['Shallow areas around islands', 'Heavy recreational traffic in summer'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 60 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - sand/mud', depth: '8-12 ft', protection: ['N', 'E', 'W'] }
    },
    contact: { vhf: '16', phone: '+1-419-285-3821' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Popular Lake Erie cruising destination. South Bass Island.',
      weatherConsiderations: ['Season May-Oct', 'Lake Erie storms build quickly', 'Shallow lake = steep waves'],
      notes: ["Perry's Victory monument", 'Party island atmosphere', 'Good holding in harbor']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: false, marina: true },
    rating: { overall: 4.0, facilities: 3, protection: 4, convenience: 4 }
  },

  // =============================================
  // CARIBBEAN / BAHAMAS PORTS
  // =============================================

  {
    id: 'marsh-harbour-abacos',
    name: 'Marsh Harbour Marina',
    type: 'marina',
    coordinates: { latitude: 26.5414, longitude: -77.0593 },
    location: { city: 'Marsh Harbour', state: 'Abaco', country: 'Bahamas' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: false, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'fiberglass'] },
      haulOut: true, chandlery: false
    },
    navigation: {
      approachDepth: 8, channelDepth: 10, dockDepth: 7, tidalRange: 3.0,
      approach: 'Via Sea of Abaco from north or south, follow markers to harbour',
      hazards: ['Coral heads', 'Shallow banks outside channel', 'Strong tidal flow in cuts'],
      bestTideState: 'Mid to high tide for approach'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - sand', depth: '6-10 ft', protection: ['W', 'S'] }
    },
    contact: { vhf: '16', phone: '+1-242-367-2700' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'Clear in at government dock with immigration and customs' },
    localKnowledge: {
      bestApproach: 'Hub of the Abacos. Well-stocked for cruisers. Use updated charts - Hurricane Dorian changed depths.',
      weatherConsiderations: ['Hurricane season Jun-Nov', 'Trade winds 10-20kt typical', 'Cold fronts Dec-Mar'],
      notes: ['Cruiser hub', 'Good provisioning', 'Recovering from Hurricane Dorian (2019)']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.0, facilities: 4, protection: 3, convenience: 4 }
  },

  {
    id: 'nassau-harbor',
    name: 'Nassau Harbour Club & Marina',
    type: 'marina',
    coordinates: { latitude: 25.0800, longitude: -77.3400 },
    location: { city: 'Nassau', state: 'New Providence', country: 'Bahamas' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'electronics'] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 10, tidalRange: 3.0,
      approach: 'Enter Nassau Harbour from the west past the lighthouse',
      hazards: ['Cruise ship traffic', 'Strong current in harbour entrance', 'Coral on either side'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150, reservation: 'Recommended in season' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Fair - sand', depth: '10-15 ft', protection: ['N'] }
    },
    contact: { vhf: '16', phone: '+1-242-393-0771' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'Clear at main customs dock. Yellow Q flag required until cleared.' },
    localKnowledge: {
      bestApproach: 'Time entrance to avoid cruise ship departures (usually 5-7pm). Fly Q flag until cleared.',
      weatherConsiderations: ['Hurricane season Jun-Nov', 'Trade winds predominant', 'Christmas Winds Dec-Jan'],
      notes: ['Major Bahamas port of entry', 'Good reprovisioning', 'Bridge to Paradise Island']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.2, facilities: 4, protection: 3, convenience: 5 }
  },

  {
    id: 'georgetown-exuma',
    name: 'Georgetown Anchorage',
    type: 'anchorage',
    coordinates: { latitude: 23.5160, longitude: -75.7780 },
    location: { city: 'Georgetown', state: 'Great Exuma', country: 'Bahamas' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: false, pumpout: false, ice: true, provisions: true,
      showers: true, laundry: true, wifi: false,
      repair: { available: false, types: [] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 8, channelDepth: 10, dockDepth: 6, tidalRange: 3.0,
      approach: 'From Exuma Sound through various cuts or via bank route',
      hazards: ['Coral heads in Elizabeth Harbour', 'Strong current in channels'],
      bestTideState: 'Mid to high tide for cuts'
    },
    services: {
      slips: { available: false, transient: false },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Excellent - sand', depth: '8-15 ft', protection: ['N', 'E', 'S', 'W'] }
    },
    contact: { vhf: '16' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'Clear at government dock in town' },
    localKnowledge: {
      bestApproach: 'Elizabeth Harbour offers excellent all-weather protection. Cruiser community Feb-Apr.',
      weatherConsiderations: ['Hurricane season Jun-Nov', 'Trade winds 15-25kt winter', 'Regatta in Apr'],
      notes: ['Famous cruiser gathering spot', 'Georgetown Regatta April', 'Limited but adequate provisioning']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: false, marina: false },
    rating: { overall: 4.3, facilities: 2, protection: 5, convenience: 3 }
  },

  // =============================================
  // UK & CHANNEL PORTS
  // =============================================

  {
    id: 'plymouth-queen-anne',
    name: "Queen Anne's Battery Marina",
    type: 'marina',
    coordinates: { latitude: 50.3656, longitude: -4.1310 },
    location: { city: 'Plymouth', state: 'Devon', country: 'UK' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0800-1800' },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics', 'sails'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 18, channelDepth: 25, dockDepth: 10, tidalRange: 15.0,
      approach: 'Enter Plymouth Sound past the Breakwater, head east to Cattewater',
      hazards: ['Large tidal range', 'Naval vessels in Sound', 'Drake Channel traffic'],
      bestTideState: 'Accessible all tides but check draft at low springs'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 120, reservation: 'Recommended Jul-Aug' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-25 ft', protection: ['N', 'W'] }
    },
    contact: { vhf: '80', phone: '+44-1752-671142', website: 'queeneannesbattery.co.uk' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'Report to Border Force on arrival from outside UK' },
    localKnowledge: {
      bestApproach: 'Plymouth Breakwater provides excellent protection. Major departure point for Atlantic crossings.',
      weatherConsiderations: ['SW gales common in winter', 'Fog in summer', 'Large tidal range (4.7m springs)'],
      tidalConsiderations: 'Tidal streams run strongly at breakwater entrance',
      notes: ['RNLI base', 'Mayflower Steps nearby', 'Excellent provisioning', 'ARC rally starting point']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.5, facilities: 5, protection: 4, convenience: 5 }
  },

  {
    id: 'cowes-yacht-haven',
    name: 'Cowes Yacht Haven',
    type: 'marina',
    coordinates: { latitude: 50.7631, longitude: -1.2988 },
    location: { city: 'Cowes', state: 'Isle of Wight', country: 'UK' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'sails', 'electronics'] },
      haulOut: false, chandlery: true
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 8, tidalRange: 12.0,
      approach: 'Enter the Solent from east or west, approach Cowes from the north',
      hazards: ['Very strong tidal streams in the Solent', 'Heavy racing traffic', 'Red Funnel ferry traffic'],
      bestTideState: 'Tidal gate at Hurst Narrows - time passage accordingly'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 80, reservation: 'Essential during Cowes Week (Aug)' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - mud', depth: '8-15 ft', protection: ['S', 'W'] }
    },
    contact: { vhf: '80', phone: '+44-1983-299975' },
    customs: { portOfEntry: false, cbpRequired: false },
    localKnowledge: {
      bestApproach: 'Sailing capital of the world. Cowes Week first week of August. Book months ahead.',
      weatherConsiderations: ['Solent funnels wind', 'Tidal streams critical for planning', 'Sheltered from SW'],
      tidalConsiderations: 'Tidal diamonds essential for Solent navigation',
      notes: ['Home of the Royal Yacht Squadron', 'Cowes Week regatta', 'Excellent yacht services']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.7, facilities: 5, protection: 4, convenience: 4 }
  },

  {
    id: 'falmouth-visitors-yacht-haven',
    name: 'Falmouth Visitors Yacht Haven',
    type: 'marina',
    coordinates: { latitude: 50.1537, longitude: -5.0601 },
    location: { city: 'Falmouth', state: 'Cornwall', country: 'UK' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'fiberglass', 'sails'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 20, channelDepth: 30, dockDepth: 10, tidalRange: 16.0,
      approach: 'Enter Carrick Roads past Pendennis and St Mawes castles',
      hazards: ['Black Rock at harbour entrance', 'Large tidal range', 'Manacles reef to the south'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100 },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Excellent - mud', depth: '10-30 ft', protection: ['All'] }
    },
    contact: { vhf: '12', phone: '+44-1326-310991' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'First UK port for many transatlantic arrivals' },
    localKnowledge: {
      bestApproach: 'Third deepest natural harbour in the world. Traditional first/last port for Atlantic crossings.',
      weatherConsiderations: ['Well protected harbour', 'SW gales can be severe outside', 'Fog occasional'],
      tidalConsiderations: 'Very large tidal range - check berth depth at low springs',
      notes: ['Traditional Atlantic landfall/departure', 'National Maritime Museum', 'Excellent boatyards']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.6, facilities: 5, protection: 5, convenience: 4 }
  },

  // =============================================
  // ATLANTIC EUROPE
  // =============================================

  {
    id: 'brest-marina-moulin-blanc',
    name: 'Marina du Moulin Blanc',
    type: 'marina',
    coordinates: { latitude: 48.3905, longitude: -4.4340 },
    location: { city: 'Brest', state: 'Brittany', country: 'France' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '0800-2000 summer' },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'fiberglass', 'sails'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 10, tidalRange: 22.0,
      approach: 'Enter Goulet de Brest (narrow strait), then north to marina',
      hazards: ['Extremely strong tidal streams in Goulet (5+ knots)', 'Naval base - restricted zones', 'Large tidal range (7m springs)'],
      bestTideState: 'Time Goulet passage for slack water - life-safety critical'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100, reservation: 'Recommended summer' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-20 ft', protection: ['All'] }
    },
    contact: { vhf: '9', phone: '+33-2-98-02-20-02' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone - no customs for EU vessels. Non-EU report to Capitainerie.' },
    localKnowledge: {
      bestApproach: 'Goulet tidal streams are DANGEROUS at peak flow. Plan passage for slack water.',
      weatherConsiderations: ['Atlantic gales frequent Oct-Mar', 'Brittany fog', 'Excellent inside rade'],
      tidalConsiderations: 'One of the largest tidal ranges in Europe (7m+). Goulet currents 5+ knots.',
      notes: ['Oceanopolis aquarium', 'Major French naval port', 'Gateway to Brittany cruising']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.3, facilities: 5, protection: 5, convenience: 4 }
  },

  {
    id: 'la-rochelle-minimes',
    name: 'Port des Minimes',
    type: 'marina',
    coordinates: { latitude: 46.1447, longitude: -1.1672 },
    location: { city: 'La Rochelle', state: 'Charente-Maritime', country: 'France' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'fiberglass', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 8, tidalRange: 18.0,
      approach: 'Follow buoyed channel past Ile de Re bridge',
      hazards: ['Very large tidal range', 'Shallow approaches at low tide', 'Mussel farms nearby'],
      bestTideState: 'Approach at half tide rising or above'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100, reservation: 'Essential in summer' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '6-12 ft', protection: ['E'] }
    },
    contact: { vhf: '9', phone: '+33-5-46-44-41-20' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone' },
    localKnowledge: {
      bestApproach: 'Largest marina on the Atlantic coast (4,500 berths). Excellent stop for Biscay crossing.',
      weatherConsiderations: ['Bay of Biscay weather systems', 'Protected from SW', 'Summer sea breeze reliable'],
      tidalConsiderations: 'Large tidal range means significant depth changes - check berth depths',
      notes: ['4,500 berths - largest Atlantic marina', 'Beautiful medieval old town', 'Grand Pavois boat show (Sep)']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.5, facilities: 5, protection: 4, convenience: 5 }
  },

  {
    id: 'cascais-marina',
    name: 'Cascais Marina',
    type: 'marina',
    coordinates: { latitude: 38.6917, longitude: -9.4191 },
    location: { city: 'Cascais', state: 'Lisbon District', country: 'Portugal' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'fiberglass', 'sails'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 15, channelDepth: 18, dockDepth: 10, tidalRange: 10.0,
      approach: 'From the west, round Cabo da Roca and head east to Cascais bay',
      hazards: ['Cabo da Roca - strong winds/seas', 'Swell can wrap into bay', 'River Tagus current near Lisbon'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 120, reservation: 'Recommended' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Fair - sand', depth: '12-20 ft', protection: ['N', 'E'] }
    },
    contact: { vhf: '16', phone: '+351-21-482-4800' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone. Non-EU vessels clear at marina office.' },
    localKnowledge: {
      bestApproach: 'Popular staging point for ARC and transatlantic passages. Close to Lisbon.',
      weatherConsiderations: ['Portuguese trade winds (Nortada) strong Jul-Sep', 'Cabo da Roca exposed to NW swell', 'Mild winters'],
      notes: ['30 min train to Lisbon', 'ARC staging marina', 'Beautiful coastal town', 'Excellent value']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.6, facilities: 5, protection: 4, convenience: 5 }
  },

  {
    id: 'gibraltar-marina-bay',
    name: 'Marina Bay Gibraltar',
    type: 'marina',
    coordinates: { latitude: 36.1408, longitude: -5.3536 },
    location: { city: 'Gibraltar', state: 'Gibraltar', country: 'Gibraltar' },
    facilities: {
      fuel: { diesel: true, gasoline: true, hours: '24/7' },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics', 'sails'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 20, channelDepth: 30, dockDepth: 12, tidalRange: 3.0,
      approach: 'Enter from the west past the runway, or from the east via the Bay',
      hazards: ['Strait of Gibraltar current (2-3 knots east)', 'Heavy shipping traffic', 'Low-flying aircraft near runway'],
      bestTideState: 'Time Strait passage for favorable current'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 200, reservation: 'Recommended' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - sand/mud', depth: '15-30 ft', protection: ['W'] }
    },
    contact: { vhf: '71', phone: '+350-200-73300' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'British Overseas Territory. Clear customs on arrival. Duty-free fuel available.' },
    localKnowledge: {
      bestApproach: 'Gateway between Atlantic and Mediterranean. Duty-free fuel (cheapest in region). Time Strait crossing for current.',
      weatherConsiderations: ['Levanter (E wind) brings cloud/rain', 'Poniente (W wind) is clear', 'Strait funnels wind dramatically'],
      tidalConsiderations: 'Strait current typically 1-3 knots eastward. Counter-current close inshore.',
      notes: ['Duty-free fuel and provisions', 'Strait of Gibraltar crossing point', 'Tax-free shopping', 'Excellent yacht services']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.5, facilities: 5, protection: 4, convenience: 5 }
  },

  // =============================================
  // WESTERN MEDITERRANEAN
  // =============================================

  {
    id: 'barcelona-port-olimpic',
    name: 'Port Olímpic',
    type: 'marina',
    coordinates: { latitude: 41.3853, longitude: 2.2014 },
    location: { city: 'Barcelona', state: 'Catalonia', country: 'Spain' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'electronics'] },
      haulOut: false, chandlery: true
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 10, tidalRange: 1.0,
      approach: 'From the south or east, well-marked breakwater entrance',
      hazards: ['Heavy commercial port traffic to the south', 'Cruise ships', 'Strong onshore breeze afternoons'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100, reservation: 'Required in summer' },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: { vhf: '9', phone: '+34-93-225-9220' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone' },
    localKnowledge: {
      bestApproach: 'Purpose-built for 1992 Olympics. Central Barcelona location with metro access.',
      weatherConsiderations: ['Tramuntana (N wind) can be very strong', 'Sea breeze afternoon', 'Mild winters'],
      notes: ['Walking distance to Las Ramblas', 'Excellent restaurants', 'Gateway to Balearics']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: true, marina: true },
    rating: { overall: 4.2, facilities: 4, protection: 4, convenience: 5 }
  },

  {
    id: 'palma-real-club-nautico',
    name: 'Real Club Náutico de Palma',
    type: 'yacht_club',
    coordinates: { latitude: 39.5630, longitude: 2.6349 },
    location: { city: 'Palma de Mallorca', state: 'Balearic Islands', country: 'Spain' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'fiberglass', 'sails', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 20, channelDepth: 25, dockDepth: 12, tidalRange: 0.5,
      approach: 'Enter Palma Bay from the south, well-marked harbour entrance',
      hazards: ['Superyacht traffic', 'Ferry wash', 'Shallows near cathedral'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 200, reservation: 'Essential May-Sep' },
      moorings: { available: true, rental: true },
      anchorage: { available: true, holding: 'Good - sand', depth: '15-30 ft', protection: ['N', 'W'] }
    },
    contact: { vhf: '9', phone: '+34-971-726-848' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone' },
    localKnowledge: {
      bestApproach: 'Mediterranean sailing capital. World-class yacht services and infrastructure.',
      weatherConsiderations: ['Summer sea breeze (embat) reliable 12-20kt', 'Tramuntana (N) can be severe in winter', 'Beautiful sailing conditions Apr-Oct'],
      notes: ['Superyacht hub', 'STP shipyard world-class', 'Kings Cup regatta', 'Beautiful old town']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.8, facilities: 5, protection: 4, convenience: 5 }
  },

  {
    id: 'marseille-vieux-port',
    name: 'Vieux Port de Marseille',
    type: 'harbor',
    coordinates: { latitude: 43.2950, longitude: 5.3698 },
    location: { city: 'Marseille', state: 'Provence', country: 'France' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'fiberglass'] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 10, tidalRange: 0.5,
      approach: 'Enter between Fort Saint-Jean and Fort Saint-Nicolas',
      hazards: ['Mistral wind can blow 40+ knots', 'Ferry traffic', 'Shallow areas in old port'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 60, reservation: 'Essential summer' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-20 ft', protection: ['N'] }
    },
    contact: { vhf: '12', phone: '+33-4-91-59-02-40' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone' },
    localKnowledge: {
      bestApproach: 'Iconic harbour entrance. Mistral can strike with little warning - have engine ready.',
      weatherConsiderations: ['Mistral (NW) severe and sudden - up to 60kt', 'Calm in summer', 'Sea state builds rapidly with Mistral'],
      notes: ['Historic old port', 'Calanques National Park nearby', 'Excellent seafood', 'Gateway to Corsica']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.0, facilities: 3, protection: 3, convenience: 5 }
  },

  {
    id: 'genoa-porto-antico',
    name: 'Marina Porto Antico',
    type: 'marina',
    coordinates: { latitude: 44.4097, longitude: 8.9266 },
    location: { city: 'Genoa', state: 'Liguria', country: 'Italy' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'fiberglass', 'electronics'] },
      haulOut: false, chandlery: true
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 10, tidalRange: 0.5,
      approach: 'Enter the commercial port area, marina is in the historic inner harbour',
      hazards: ['Large vessel traffic', 'Ferry and cruise ship maneuvers', 'Swell from SE'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100 },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: { vhf: '9', phone: '+39-010-246-8681' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone' },
    localKnowledge: {
      bestApproach: 'Heart of Genoa. Aquarium and historic centre adjacent. Good base for Italian Riviera.',
      weatherConsiderations: ['Libeccio (SW) can be strong', 'Winter gales occasional', 'Well protected inside harbour'],
      notes: ['Genoa Boat Show (Sep)', 'UNESCO World Heritage old town', 'Gateway to Italian Riviera & Cinque Terre']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.2, facilities: 4, protection: 4, convenience: 5 }
  },

  // =============================================
  // CENTRAL & EASTERN MEDITERRANEAN
  // =============================================

  {
    id: 'valletta-grand-harbour',
    name: 'Grand Harbour Marina',
    type: 'marina',
    coordinates: { latitude: 35.8911, longitude: 14.5140 },
    location: { city: 'Valletta', state: 'Grand Harbour', country: 'Malta' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'fiberglass', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 25, channelDepth: 35, dockDepth: 15, tidalRange: 0.5,
      approach: 'Enter Grand Harbour past the breakwater - dramatic entrance below fortifications',
      hazards: ['Strong Gregale (NE) wind can make entrance rough', 'Commercial traffic'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 200, reservation: 'Recommended Oct-Jun' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '20-40 ft', protection: ['W', 'S'] }
    },
    contact: { vhf: '12', phone: '+356-2180-0700' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone. English widely spoken.' },
    localKnowledge: {
      bestApproach: 'One of the most spectacular harbour entrances in the world. Below the Knights of Malta fortifications.',
      weatherConsiderations: ['Gregale (NE) can blow hard', 'Sirocco (SE) brings heat and sand', 'Mild year-round'],
      notes: ['UNESCO World Heritage Site', 'Excellent mid-Med stop', 'Rolex Middle Sea Race (Oct)', 'English-speaking']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.7, facilities: 5, protection: 5, convenience: 5 }
  },

  {
    id: 'split-aci-marina',
    name: 'ACI Marina Split',
    type: 'marina',
    coordinates: { latitude: 43.5024, longitude: 16.4394 },
    location: { city: 'Split', state: 'Dalmatia', country: 'Croatia' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'fiberglass'] },
      haulOut: true, chandlery: false
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 10, tidalRange: 1.0,
      approach: 'Enter Split harbour from the west, marina on the south side',
      hazards: ['Bura (NE) katabatic wind can be sudden and violent', 'Ferry traffic', 'Tourist boats in summer'],
      bestTideState: 'Minimal tidal range - accessible all tides'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 80, reservation: 'Essential Jul-Aug' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '15-30 ft', protection: ['N'] }
    },
    contact: { vhf: '17', phone: '+385-21-398-548' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone (Croatia joined 2023)' },
    localKnowledge: {
      bestApproach: 'Main charter base for Dalmatian islands. Diocletian Palace UNESCO site in town.',
      weatherConsiderations: ['Bura (NE) violent katabatic - can strike suddenly at 50+ knots', 'Jugo (SE) brings rain', 'Maestral (NW) sea breeze reliable summer'],
      tidalConsiderations: 'Minimal tidal range but seiches can cause 50cm changes',
      notes: ['Charter capital of Adriatic', '1000+ islands to explore', 'UNESCO Diocletian Palace', 'Excellent cuisine']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.5, facilities: 4, protection: 3, convenience: 5 }
  },

  {
    id: 'dubrovnik-aci-marina',
    name: 'ACI Marina Dubrovnik',
    type: 'marina',
    coordinates: { latitude: 42.6584, longitude: 18.0601 },
    location: { city: 'Dubrovnik', state: 'Dalmatia', country: 'Croatia' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine'] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 10, tidalRange: 1.0,
      approach: 'Marina is in Komolac at the head of Rijeka Dubrovacka inlet',
      hazards: ['Bura wind in inlet', 'Cruise ship traffic at Gruz port'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 70, reservation: 'Essential in season' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '15-25 ft', protection: ['All'] }
    },
    contact: { vhf: '17', phone: '+385-20-455-020' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone. Montenegro border nearby - check if crossing.' },
    localKnowledge: {
      bestApproach: 'Sheltered inlet provides good protection. Bus to Old Town. Book well ahead.',
      weatherConsiderations: ['Bura can be strong', 'Well protected in inlet', 'Hot summers'],
      notes: ['UNESCO Old Town', 'Game of Thrones filming location', 'Near Montenegro border', 'Very popular - book ahead']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: true, marina: true },
    rating: { overall: 4.3, facilities: 4, protection: 4, convenience: 4 }
  },

  {
    id: 'athens-alimos-marina',
    name: 'Alimos Marina (Kalamaki)',
    type: 'marina',
    coordinates: { latitude: 37.9135, longitude: 23.7053 },
    location: { city: 'Athens', state: 'Attica', country: 'Greece' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'fiberglass', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 8, tidalRange: 0.5,
      approach: 'Enter from Saronic Gulf, well-marked breakwater',
      hazards: ['Meltemi wind (N) can be very strong Jul-Aug', 'Shallow patches near entrance'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100, reservation: 'Recommended' },
      moorings: { available: false, rental: false },
      anchorage: { available: false, holding: 'N/A', depth: 'N/A', protection: [] }
    },
    contact: { vhf: '16', phone: '+30-210-988-6666' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone. DEKPA (transit log) required for non-EU flagged vessels.' },
    localKnowledge: {
      bestApproach: 'Largest marina in Greece. Gateway to Saronic Gulf and Cyclades islands.',
      weatherConsiderations: ['Meltemi (N) dominates Jul-Aug, 25-40kt', 'Calm in Saronic Gulf compared to Cyclades', 'Hot dry summers'],
      notes: ['Metro to central Athens', 'Major charter base', 'Gateway to Greek islands', 'Affordable by Med standards']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.0, facilities: 4, protection: 4, convenience: 5 }
  },

  {
    id: 'lefkada-marina',
    name: 'Lefkas Marina',
    type: 'marina',
    coordinates: { latitude: 38.8326, longitude: 20.7070 },
    location: { city: 'Lefkada', state: 'Ionian Islands', country: 'Greece' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'fiberglass'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 8, channelDepth: 10, dockDepth: 6, tidalRange: 0.5,
      approach: 'Through the Lefkada Canal from the north - swing bridge opens on the hour',
      hazards: ['Canal is narrow and shallow (2m depth)', 'Swing bridge schedule', 'Sand bar at canal entrance'],
      bestTideState: 'Check for any seiche effects'
    },
    services: {
      slips: { available: true, transient: true, maxLength: 80 },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '10-20 ft', protection: ['E', 'W'] }
    },
    contact: { vhf: '16', phone: '+30-26450-24494' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone. Port police for check-in.' },
    localKnowledge: {
      bestApproach: 'Canal bridge opens at set times - check schedule. Major charter base for Ionian islands.',
      weatherConsiderations: ['Ionian is calmer than Aegean - no Meltemi', 'Afternoon thermal breeze', 'Green and lush (more rain than Aegean)'],
      notes: ['Major Ionian charter base', 'Protected from Meltemi', 'Beautiful beaches', 'Bridge schedule critical']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: false, marina: true },
    rating: { overall: 4.3, facilities: 4, protection: 4, convenience: 4 }
  },

  {
    id: 'rhodes-mandraki',
    name: 'Mandraki Harbour',
    type: 'harbor',
    coordinates: { latitude: 36.4489, longitude: 28.2262 },
    location: { city: 'Rhodes', state: 'Dodecanese', country: 'Greece' },
    facilities: {
      fuel: { diesel: true, gasoline: false },
      water: true, electricity: true, pumpout: false, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine'] },
      haulOut: false, chandlery: false
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 8, tidalRange: 0.5,
      approach: 'Enter from the north past the iconic deer statues on columns',
      hazards: ['Meltemi creates rough seas in approach', 'Surge in harbour with NW winds', 'Shallow near walls'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 60 },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Fair - sand', depth: '15-25 ft', protection: ['W'] }
    },
    contact: { vhf: '16', phone: '+30-22410-22220' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'EU Schengen zone. Useful stop before/after Turkey.' },
    localKnowledge: {
      bestApproach: 'Historic harbour where the Colossus once stood. Med-moor stern-to on the quay.',
      weatherConsiderations: ['Meltemi can blow 30+ knots Jul-Aug', 'Sheltered from south', 'Hot dry summers'],
      notes: ['UNESCO Medieval Old Town', 'Close to Turkish coast', 'Last Greek stop before Turkey', 'Historic Knights quarter']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: false, publicTransport: true, marina: false },
    rating: { overall: 3.8, facilities: 3, protection: 3, convenience: 5 }
  },

  // =============================================
  // TURKEY
  // =============================================

  {
    id: 'marmaris-yacht-marina',
    name: 'Marmaris Yacht Marina',
    type: 'marina',
    coordinates: { latitude: 36.8503, longitude: 28.2675 },
    location: { city: 'Marmaris', state: 'Mugla', country: 'Turkey' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'rigging', 'fiberglass', 'sails', 'electronics'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 15, channelDepth: 20, dockDepth: 10, tidalRange: 0.5,
      approach: 'Enter the large natural bay from the southwest, marina at the head',
      hazards: ['Gulet and day-tripper traffic in summer', 'Shallow area near town quay'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 150, reservation: 'Recommended May-Oct' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - mud', depth: '15-30 ft', protection: ['All'] }
    },
    contact: { vhf: '16', phone: '+90-252-412-2708' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'Turkish transit log required. Check in with Harbour Master, customs, and immigration.' },
    localKnowledge: {
      bestApproach: 'One of the best protected natural harbours in the Med. Popular wintering spot.',
      weatherConsiderations: ['Excellent protection from all directions', 'Hot summers', 'Mild winters - popular overwinter spot'],
      notes: ['Major charter base', 'Excellent value for repairs', 'Beautiful Turkish coast', 'Popular overwinter destination']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.6, facilities: 5, protection: 5, convenience: 5 }
  },

  {
    id: 'bodrum-milta-marina',
    name: 'Milta Bodrum Marina',
    type: 'marina',
    coordinates: { latitude: 37.0318, longitude: 27.4239 },
    location: { city: 'Bodrum', state: 'Mugla', country: 'Turkey' },
    facilities: {
      fuel: { diesel: true, gasoline: true },
      water: true, electricity: true, pumpout: true, ice: true, provisions: true,
      showers: true, laundry: true, wifi: true,
      repair: { available: true, types: ['engine', 'fiberglass', 'sails'] },
      haulOut: true, chandlery: true
    },
    navigation: {
      approachDepth: 12, channelDepth: 15, dockDepth: 8, tidalRange: 0.5,
      approach: 'Enter Bodrum Bay from the west, marina below the Castle of St. Peter',
      hazards: ['Meltemi creates steep seas in approach', 'Tourist boat traffic', 'Shallow near castle'],
    },
    services: {
      slips: { available: true, transient: true, maxLength: 100, reservation: 'Essential Jul-Aug' },
      moorings: { available: false, rental: false },
      anchorage: { available: true, holding: 'Good - sand/mud', depth: '15-25 ft', protection: ['N', 'E'] }
    },
    contact: { vhf: '16', phone: '+90-252-316-1860' },
    customs: { portOfEntry: true, cbpRequired: false, procedures: 'Turkish transit log required.' },
    localKnowledge: {
      bestApproach: 'Beautiful approach below the Crusader castle. Home of blue voyage (gulet) tradition.',
      weatherConsiderations: ['Meltemi can blow hard Jul-Aug', 'Protected from S and W', 'Excellent spring/autumn sailing'],
      notes: ['Castle of St. Peter (museum)', 'Bodrum Cup regatta', 'Home of gulet tradition', 'Vibrant nightlife']
    },
    amenities: { restaurants: true, groceries: true, hardwareStore: true, publicTransport: true, marina: true },
    rating: { overall: 4.4, facilities: 4, protection: 3, convenience: 5 }
  }
];

/**
 * Get port by ID
 */
export function getPortById(id: string): Port | undefined {
  return PORT_DATABASE.find(p => p.id === id);
}

/**
 * Search ports by name
 */
export function searchPortsByName(query: string): Port[] {
  const lowerQuery = query.toLowerCase();
  return PORT_DATABASE.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.location.city.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Find nearest ports to coordinates
 */
export function findNearestPorts(
  lat: number,
  lon: number,
  radiusNm: number = 50,
  maxResults: number = 10
): Array<Port & { distance: number }> {
  const portsWithDistance = PORT_DATABASE.map(port => ({
    ...port,
    distance: haversineDistance(
      { latitude: lat, longitude: lon },
      port.coordinates
    )
  }));

  return portsWithDistance
    .filter(p => p.distance <= radiusNm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults);
}

/**
 * Find ports suitable for vessel draft
 */
export function findPortsForDraft(
  lat: number,
  lon: number,
  draftFeet: number,
  radiusNm: number = 50
): Array<Port & { distance: number; suitable: boolean; clearanceMargin: number }> {
  const nearbyPorts = findNearestPorts(lat, lon, radiusNm);
  
  return nearbyPorts.map(port => {
    // Apply 20% safety margin
    const requiredDepth = draftFeet * 1.2;
    const suitable = port.navigation.dockDepth >= requiredDepth;
    const clearanceMargin = port.navigation.dockDepth - draftFeet;
    
    return {
      ...port,
      suitable,
      clearanceMargin
    };
  }).filter(p => p.suitable);
}

/**
 * Haversine distance calculation
 */
function haversineDistance(
  p1: { latitude: number; longitude: number },
  p2: { latitude: number; longitude: number }
): number {
  const R = 3440.1; // Earth radius in nautical miles
  const lat1 = p1.latitude * Math.PI / 180;
  const lat2 = p2.latitude * Math.PI / 180;
  const deltaLat = (p2.latitude - p1.latitude) * Math.PI / 180;
  const deltaLon = (p2.longitude - p1.longitude) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10; // Round to 0.1 nm
}

