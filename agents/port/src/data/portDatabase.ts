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

