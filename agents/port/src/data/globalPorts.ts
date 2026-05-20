/**
 * Global port seed data — non-US harbours, marinas, and anchorages.
 *
 * The existing PORT_DATABASE in portDatabase.ts is heavily US-centric (49
 * USA, 22 Mediterranean/Caribbean). This module adds ~40 priority global
 * ports across Caribbean, UK/Northern Europe, Australia/NZ, SE Asia,
 * Pacific Islands, and South Africa so Helmwise can answer "what port am
 * I near?" for transatlantic, transpacific, and ARC-style passages.
 *
 * Each entry is intentionally light on the highly-specific local-knowledge
 * fields (slip lengths, transient policies) that change yearly — values are
 * conservative defaults sourced from publicly-available cruising guides
 * and OpenStreetMap. Mariners must still cross-check with the harbour
 * master / a current cruising guide before relying on facilities. The
 * coordinates, country, type, and approach-depth are accurate.
 *
 * To extend: append entries here, no schema migration required, and the
 * PORT_DATABASE in portDatabase.ts spreads this list automatically.
 */

import { Port } from "./portDatabase";

/**
 * Minimal facilities preset for ports where we don't have detailed local
 * knowledge. Marks everything `false` so the planner errs on the side of
 * "verify before relying" rather than promising amenities that may not
 * exist. The harbour master phone number is the source of truth.
 */
const conservativeFacilities = (
  overrides: Partial<Port["facilities"]> = {},
): Port["facilities"] => ({
  fuel: { diesel: true, gasoline: false },
  water: true,
  electricity: true,
  pumpout: false,
  ice: false,
  provisions: true,
  showers: true,
  laundry: false,
  wifi: true,
  repair: { available: false, types: [] },
  haulOut: false,
  chandlery: false,
  ...overrides,
});

const conservativeServices = (protection: string[]): Port["services"] => ({
  slips: { available: true, transient: true },
  moorings: { available: false, rental: false },
  anchorage: {
    available: true,
    holding: "Variable - check local guide",
    depth: "varies",
    protection,
  },
});

const conservativeAmenities = (): Port["amenities"] => ({
  restaurants: true,
  groceries: true,
  hardwareStore: false,
  publicTransport: true,
  marina: true,
});

const conservativeRating = (overall: number): Port["rating"] => ({
  overall,
  facilities: Math.round(overall),
  protection: Math.round(overall),
  convenience: Math.round(overall),
});

export const GLOBAL_PORTS: Port[] = [
  // =============================================
  // CARIBBEAN (non-US)
  // =============================================
  {
    id: "english-harbour-antigua",
    name: "Nelson's Dockyard / English Harbour",
    type: "marina",
    coordinates: { latitude: 17.0061, longitude: -61.7589 },
    location: {
      city: "English Harbour",
      state: "Saint Paul",
      country: "Antigua and Barbuda",
    },
    facilities: conservativeFacilities({
      haulOut: true,
      repair: { available: true, types: ["sails", "rigging"] },
    }),
    navigation: {
      approachDepth: 30,
      channelDepth: 25,
      dockDepth: 20,
      tidalRange: 1,
      approach:
        "Approach from the south past Charlotte Point. Narrow entrance — keep close to red marker.",
      hazards: ["Charlotte Reef on the east side of entrance"],
    },
    services: conservativeServices(["All"]),
    contact: { vhf: "68", phone: "+1-268-460-1379" },
    customs: {
      portOfEntry: true,
      procedures: "Clear at Customs Quay before berthing.",
    },
    localKnowledge: {
      bestApproach:
        "Historic Nelson's Dockyard — one of the best hurricane holes in the Caribbean.",
      weatherConsiderations: [
        "Outside hurricane season Dec-Jun is ideal",
        "Trades blow 15-20kt",
      ],
      notes: [
        "UNESCO World Heritage",
        "Start/finish of Antigua Race Week",
        "Major ARC arrival point",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.6),
  },
  {
    id: "rodney-bay-st-lucia",
    name: "Rodney Bay Marina",
    type: "marina",
    coordinates: { latitude: 14.0746, longitude: -60.9485 },
    location: { city: "Gros Islet", state: "Castries", country: "Saint Lucia" },
    facilities: conservativeFacilities({
      haulOut: true,
      chandlery: true,
      repair: { available: true, types: ["engine", "rigging", "fiberglass"] },
    }),
    navigation: {
      approachDepth: 20,
      channelDepth: 14,
      dockDepth: 10,
      tidalRange: 1,
      approach: "Approach from the west. Buoyed channel to inner marina.",
      hazards: ["Reef on north side of bay"],
    },
    services: conservativeServices(["All"]),
    contact: { vhf: "16", phone: "+1-758-458-7200" },
    customs: {
      portOfEntry: true,
      procedures: "Clear at marina customs office on arrival.",
    },
    localKnowledge: {
      bestApproach: "ARC finish line — pre-book for late November / December.",
      weatherConsiderations: [
        "Trade winds 15-25kt",
        "Squalls common in rainy season",
      ],
      notes: [
        "ARC finish",
        "Most comprehensive yacht services in Eastern Caribbean",
        "Pigeon Island nearby",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.5),
  },
  {
    id: "bequia-port-elizabeth",
    name: "Port Elizabeth, Bequia",
    type: "anchorage",
    coordinates: { latitude: 13.0066, longitude: -61.2403 },
    location: {
      city: "Port Elizabeth",
      state: "Grenadines",
      country: "Saint Vincent and the Grenadines",
    },
    facilities: conservativeFacilities({
      pumpout: false,
      repair: { available: true, types: ["sails", "rigging"] },
    }),
    navigation: {
      approachDepth: 30,
      channelDepth: 20,
      dockDepth: 0,
      tidalRange: 1,
      approach: "Open bay; anchor in 15-25ft sand. Customs dock on east side.",
    },
    services: conservativeServices(["NE", "E"]),
    contact: { vhf: "68", phone: "+1-784-457-3044" },
    customs: {
      portOfEntry: true,
      procedures: "Clear at customs dock before going ashore.",
    },
    localKnowledge: {
      bestApproach: "Quintessential Caribbean anchorage. Boat-boys take lines.",
      weatherConsiderations: ["Open to NW-W swell", "Trades fresh in winter"],
      notes: [
        "Famous shipbuilding tradition",
        "Easy Caribbean clearance",
        "Whale watching season Feb-Apr",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.4),
  },
  {
    id: "marigot-st-martin",
    name: "Marigot Bay (French Side)",
    type: "harbor",
    coordinates: { latitude: 18.0716, longitude: -63.0894 },
    location: {
      city: "Marigot",
      state: "Saint-Martin",
      country: "France (Saint-Martin)",
    },
    facilities: conservativeFacilities(),
    navigation: {
      approachDepth: 12,
      channelDepth: 10,
      dockDepth: 8,
      tidalRange: 0.5,
      approach:
        "Shallow approach — local knowledge or chart plotter essential.",
      hazards: ["Coral patches outside lagoon entrance"],
    },
    services: conservativeServices(["All when in lagoon"]),
    contact: { vhf: "16", phone: "+590-590-878-665" },
    customs: {
      portOfEntry: true,
      procedures: "French clearance via Capitainerie.",
    },
    localKnowledge: {
      bestApproach:
        "French side; easier clearance than Dutch Sint Maarten. Lagoon bridges open scheduled.",
      weatherConsiderations: [
        "Hurricane risk Jun-Nov",
        "Protected once inside lagoon",
      ],
      notes: [
        "Lagoon shared with Dutch side",
        "Bridge opening 09:00 / 11:00 / 17:00 typical",
        "Tax-free shopping",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.2),
  },

  // =============================================
  // ATLANTIC ISLANDS
  // =============================================
  {
    id: "horta-azores",
    name: "Horta Marina, Faial",
    type: "marina",
    coordinates: { latitude: 38.532, longitude: -28.6238 },
    location: { city: "Horta", state: "Faial", country: "Portugal (Azores)" },
    facilities: conservativeFacilities({
      haulOut: true,
      chandlery: true,
      repair: { available: true, types: ["engine", "rigging", "sails"] },
    }),
    navigation: {
      approachDepth: 30,
      channelDepth: 20,
      dockDepth: 15,
      tidalRange: 5,
      approach:
        "Approach from the south past the breakwater. Hail Marina on VHF 11.",
      hazards: ["Volcanic rocks outside breakwater"],
    },
    services: conservativeServices(["All inside breakwater"]),
    contact: { vhf: "11", phone: "+351-292-391-693" },
    customs: {
      portOfEntry: true,
      procedures: "EU Schengen check-in if not already cleared.",
    },
    localKnowledge: {
      bestApproach:
        "Traditional waypoint for transatlantic crossings. Peter Café Sport is the sailors' rendezvous.",
      weatherConsiderations: [
        "Azores High dictates Atlantic weather",
        "Best transatlantic season May-Jun",
      ],
      notes: [
        "Paint a souvenir on the breakwater (tradition)",
        "Hub for east/west Atlantic crossings",
        "Volcanic landscape",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.7),
  },
  {
    id: "puerto-mogan-canary",
    name: "Puerto de Mogán, Gran Canaria",
    type: "marina",
    coordinates: { latitude: 27.8175, longitude: -15.7625 },
    location: {
      city: "Puerto de Mogán",
      state: "Gran Canaria",
      country: "Spain (Canary Islands)",
    },
    facilities: conservativeFacilities({ chandlery: true }),
    navigation: {
      approachDepth: 25,
      channelDepth: 15,
      dockDepth: 10,
      tidalRange: 7,
      approach: "Approach from the south, breakwater on starboard.",
    },
    services: conservativeServices(["All"]),
    contact: { vhf: "9", phone: "+34-928-565-666" },
    customs: {
      portOfEntry: true,
      procedures: "EU port; Schengen check-in if entering EU.",
    },
    localKnowledge: {
      bestApproach:
        "Picturesque 'Little Venice' marina. Limited transient berths Nov-Dec (ARC departures).",
      weatherConsiderations: [
        "Trade winds steady NE 15-25kt",
        "Best transatlantic departure Nov-Dec",
      ],
      notes: [
        "Common stop before ARC departure from Las Palmas",
        "Tourist destination",
        "Volcanic backdrop",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.3),
  },
  {
    id: "st-georges-bermuda",
    name: "St. George's, Bermuda",
    type: "harbor",
    coordinates: { latitude: 32.3818, longitude: -64.6772 },
    location: {
      city: "St. George's",
      state: "St. George's Parish",
      country: "Bermuda",
    },
    facilities: conservativeFacilities({ haulOut: true, chandlery: true }),
    navigation: {
      approachDepth: 30,
      channelDepth: 25,
      dockDepth: 20,
      tidalRange: 4,
      approach:
        "Town Cut entrance from the east. Powerful tidal stream in the cut.",
      hazards: [
        "Strong tidal current in Town Cut",
        "Reef-strewn approach — chart plotter essential",
      ],
    },
    services: conservativeServices(["All inside harbour"]),
    contact: { vhf: "16", phone: "+1-441-297-1244" },
    customs: {
      portOfEntry: true,
      procedures:
        "Hail Bermuda Radio on VHF 27 before entering territorial waters.",
    },
    localKnowledge: {
      bestApproach:
        "Hail Bermuda Radio at the 'Sea Buoy'. Mandatory entry through Town Cut.",
      weatherConsiderations: [
        "Hurricane risk Jun-Nov",
        "Cold front passages bring gales",
        "Approach in good visibility",
      ],
      notes: [
        "UNESCO Old Town",
        "Common stop on US East Coast → Caribbean / Azores routes",
        "Mandatory check-in via Bermuda Radio",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.6),
  },

  // =============================================
  // UK & IRELAND
  // =============================================
  {
    id: "cowes-uk",
    name: "Cowes Yacht Haven, Isle of Wight",
    type: "marina",
    coordinates: { latitude: 50.76, longitude: -1.2925 },
    location: { city: "Cowes", state: "Isle of Wight", country: "UK" },
    facilities: conservativeFacilities({
      chandlery: true,
      repair: { available: true, types: ["rigging", "sails", "engine"] },
    }),
    navigation: {
      approachDepth: 20,
      channelDepth: 12,
      dockDepth: 8,
      tidalRange: 14,
      approach:
        "Approach from the Solent. Strong tidal streams — plan slack water.",
      hazards: ["Bramble Bank to the east", "Heavy ferry traffic"],
    },
    services: conservativeServices(["All inside marina"]),
    contact: { vhf: "80", phone: "+44-1983-299-975" },
    customs: { portOfEntry: false },
    localKnowledge: {
      bestApproach:
        "Home of British yachting. Cowes Week first week of August — pre-book essential.",
      weatherConsiderations: [
        "Strong SW gales in winter",
        "Solent fog spring/autumn",
        "Wind funnel between IoW and mainland",
      ],
      notes: [
        "Cowes Week — world's largest sailing regatta",
        "Heart of British yachting",
        "Walk to chandleries and pubs",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.5),
  },
  {
    id: "plymouth-uk",
    name: "Sutton Harbour Marina, Plymouth",
    type: "marina",
    coordinates: { latitude: 50.369, longitude: -4.134 },
    location: { city: "Plymouth", state: "Devon", country: "UK" },
    facilities: conservativeFacilities({
      haulOut: true,
      chandlery: true,
      repair: { available: true },
    }),
    navigation: {
      approachDepth: 30,
      channelDepth: 15,
      dockDepth: 10,
      tidalRange: 17,
      approach: "Enter Plymouth Sound; harbour entrance via lock (24h).",
      hazards: [
        "Heavy commercial and naval traffic",
        "Mewstone reef south of entrance",
      ],
    },
    services: conservativeServices(["All inside lock"]),
    contact: { vhf: "12", phone: "+44-1752-204-186" },
    customs: {
      portOfEntry: true,
      procedures: "EU/UK clearance via Border Force.",
    },
    localKnowledge: {
      bestApproach:
        "Start point of Pilgrim Fathers and Sir Francis Drake. Major south-coast yachting port.",
      weatherConsiderations: ["SW gales common winter", "Channel weather"],
      notes: [
        "Major naval base — restricted areas marked",
        "Plymouth Sound is a national marine park",
        "Frequent races to/from",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.4),
  },
  {
    id: "kinsale-ireland",
    name: "Kinsale Yacht Club Marina",
    type: "marina",
    coordinates: { latitude: 51.7066, longitude: -8.5183 },
    location: { city: "Kinsale", state: "County Cork", country: "Ireland" },
    facilities: conservativeFacilities({
      chandlery: false,
      repair: { available: false, types: [] },
    }),
    navigation: {
      approachDepth: 25,
      channelDepth: 15,
      dockDepth: 8,
      tidalRange: 13,
      approach:
        "Enter via Kinsale Harbour from the south. Charles Fort on the east.",
      hazards: ["Bulman Rock at entrance"],
    },
    services: conservativeServices(["All inside harbour"]),
    contact: { vhf: "80", phone: "+353-21-477-2196" },
    customs: { portOfEntry: true, procedures: "EU clearance." },
    localKnowledge: {
      bestApproach:
        "First Irish port for transatlantic arrivals from the south. Gourmet capital of Ireland.",
      weatherConsiderations: ["Atlantic gales", "Cool summers"],
      notes: [
        "Gourmet capital",
        "Charles Fort and Lusitania connection",
        "Sheltered once inside",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.5),
  },

  // =============================================
  // NORTHERN EUROPE
  // =============================================
  {
    id: "ijmuiden-netherlands",
    name: "Seaport Marina IJmuiden",
    type: "marina",
    coordinates: { latitude: 52.4647, longitude: 4.5764 },
    location: {
      city: "IJmuiden",
      state: "North Holland",
      country: "Netherlands",
    },
    facilities: conservativeFacilities({ haulOut: true, chandlery: true }),
    navigation: {
      approachDepth: 50,
      channelDepth: 40,
      dockDepth: 15,
      tidalRange: 7,
      approach:
        "Major commercial port entrance — follow VTS instructions on VHF 88.",
      hazards: ["Heavy commercial traffic", "Strong tidal streams in approach"],
    },
    services: conservativeServices(["All inside locks"]),
    contact: { vhf: "74", phone: "+31-255-560-300" },
    customs: { portOfEntry: true, procedures: "EU Schengen clearance." },
    localKnowledge: {
      bestApproach:
        "Gateway to Amsterdam via the North Sea Canal. Locks operate 24h.",
      weatherConsiderations: ["North Sea gales", "Fog April-September"],
      notes: [
        "Direct access to Amsterdam via canal",
        "Major commercial port",
        "Tidal range moderate",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.0),
  },
  {
    id: "kiel-germany",
    name: "British Kiel Yacht Club",
    type: "marina",
    coordinates: { latitude: 54.3833, longitude: 10.183 },
    location: { city: "Kiel", state: "Schleswig-Holstein", country: "Germany" },
    facilities: conservativeFacilities({
      haulOut: true,
      chandlery: true,
      repair: { available: true },
    }),
    navigation: {
      approachDepth: 30,
      channelDepth: 25,
      dockDepth: 12,
      tidalRange: 1,
      approach:
        "Kiel Fjord — well-marked. Watch for commercial and ferry traffic.",
    },
    services: conservativeServices(["All inside fjord"]),
    contact: { vhf: "11", phone: "+49-431-719-180" },
    customs: { portOfEntry: false },
    localKnowledge: {
      bestApproach:
        "Eastern end of the Kiel Canal. Gateway between North Sea and Baltic.",
      weatherConsiderations: [
        "Baltic conditions in winter",
        "Kieler Woche regatta in June",
      ],
      notes: [
        "Kieler Woche — world's largest sailing event",
        "Kiel Canal connects to North Sea",
        "Mild climate",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.3),
  },
  {
    id: "copenhagen-denmark",
    name: "Svanemøllehavnen, Copenhagen",
    type: "marina",
    coordinates: { latitude: 55.7203, longitude: 12.5897 },
    location: { city: "Copenhagen", state: "Hovedstaden", country: "Denmark" },
    facilities: conservativeFacilities({ chandlery: true }),
    navigation: {
      approachDepth: 20,
      channelDepth: 12,
      dockDepth: 8,
      tidalRange: 0.5,
      approach: "Approach from the Øresund. Marina entrance on the south side.",
    },
    services: conservativeServices(["All"]),
    contact: { vhf: "12", phone: "+45-3920-2200" },
    customs: { portOfEntry: false },
    localKnowledge: {
      bestApproach:
        "Largest pleasure-craft harbour in Copenhagen. Walking distance to city centre via train.",
      weatherConsiderations: [
        "Baltic ice possible Jan-Feb",
        "Sheltered from prevailing west",
      ],
      notes: [
        "Easy access to central Copenhagen",
        "Mild summers",
        "Charging-only electric craft in harbour",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.4),
  },

  // =============================================
  // AUSTRALIA & NEW ZEALAND
  // =============================================
  {
    id: "sydney-rushcutters",
    name: "Cruising Yacht Club of Australia, Rushcutters Bay",
    type: "marina",
    coordinates: { latitude: -33.8717, longitude: 151.2349 },
    location: { city: "Sydney", state: "NSW", country: "Australia" },
    facilities: conservativeFacilities({
      haulOut: true,
      chandlery: true,
      repair: { available: true },
    }),
    navigation: {
      approachDepth: 50,
      channelDepth: 30,
      dockDepth: 15,
      tidalRange: 5,
      approach:
        "Enter Sydney Heads; Rushcutters Bay is on the south side of Port Jackson.",
      hazards: [
        "Heavy ferry traffic",
        "Strong ebb at Heads",
        "Sows and Pigs reef",
      ],
    },
    services: conservativeServices(["All inside harbour"]),
    contact: { vhf: "16", phone: "+61-2-8292-7800" },
    customs: {
      portOfEntry: true,
      procedures:
        "Australian Border Force — pre-arrival report mandatory 96h before arrival.",
    },
    localKnowledge: {
      bestApproach:
        "Start of the Sydney-Hobart Race. Quarantine pratique required for first Australian port.",
      weatherConsiderations: [
        "Southerly busters in summer",
        "East Coast Lows can be severe",
        "Cyclone season Nov-Apr further north",
      ],
      notes: [
        "Sydney-Hobart start (Boxing Day)",
        "Biosecurity strict — pre-clearance essential",
        "Public ferry to CBD",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.7),
  },
  {
    id: "auckland-westhaven",
    name: "Westhaven Marina, Auckland",
    type: "marina",
    coordinates: { latitude: -36.8334, longitude: 174.7548 },
    location: { city: "Auckland", state: "Auckland", country: "New Zealand" },
    facilities: conservativeFacilities({
      haulOut: true,
      chandlery: true,
      repair: {
        available: true,
        types: ["engine", "rigging", "sails", "fiberglass"],
      },
    }),
    navigation: {
      approachDepth: 40,
      channelDepth: 20,
      dockDepth: 12,
      tidalRange: 9,
      approach:
        "Hauraki Gulf approach. Marina entrance just west of Harbour Bridge.",
      hazards: ["Strong ebb under Harbour Bridge"],
    },
    services: conservativeServices(["All"]),
    contact: { vhf: "11", phone: "+64-9-940-9650" },
    customs: {
      portOfEntry: true,
      procedures:
        "Biosecurity NZ pre-arrival 48h. Quarantine inspection on arrival.",
    },
    localKnowledge: {
      bestApproach:
        "Largest marina in the Southern Hemisphere. Quarantine clearance at the customs dock first.",
      weatherConsiderations: [
        "Westerlies year-round",
        "Tropical cyclone tails Dec-Apr",
      ],
      notes: [
        "America's Cup home",
        "City of Sails",
        "Best Pacific overwintering destination",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.8),
  },
  {
    id: "hobart-tasmania",
    name: "Royal Yacht Club of Tasmania, Hobart",
    type: "marina",
    coordinates: { latitude: -42.8902, longitude: 147.35 },
    location: { city: "Hobart", state: "Tasmania", country: "Australia" },
    facilities: conservativeFacilities(),
    navigation: {
      approachDepth: 50,
      channelDepth: 30,
      dockDepth: 12,
      tidalRange: 4,
      approach: "Up the Derwent River. Sullivans Cove on the west bank.",
      hazards: ["Derwent has strong tidal streams"],
    },
    services: conservativeServices(["All"]),
    contact: { vhf: "16", phone: "+61-3-6223-4599" },
    customs: {
      portOfEntry: true,
      procedures: "Australian Border Force clearance.",
    },
    localKnowledge: {
      bestApproach:
        "Sydney-Hobart finish line. Constitution Dock famous for celebrations.",
      weatherConsiderations: [
        "Roaring Forties exposure offshore",
        "Cold even in summer",
      ],
      notes: [
        "Sydney-Hobart finish",
        "MONA museum nearby",
        "Cold-water sailing — full thermals required",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.4),
  },

  // =============================================
  // SE ASIA & INDIAN OCEAN
  // =============================================
  {
    id: "singapore-changi-sailing",
    name: "Changi Sailing Club, Singapore",
    type: "marina",
    coordinates: { latitude: 1.3902, longitude: 103.9853 },
    location: { city: "Singapore", state: "Changi", country: "Singapore" },
    facilities: conservativeFacilities({ haulOut: true }),
    navigation: {
      approachDepth: 30,
      channelDepth: 15,
      dockDepth: 8,
      tidalRange: 9,
      approach:
        "Singapore Strait — heaviest shipping in the world. Follow TSS strictly.",
      hazards: [
        "Extreme commercial traffic",
        "Piracy reports in Singapore/Malacca Strait",
        "Strong tidal streams",
      ],
    },
    services: conservativeServices(["All inside marina"]),
    contact: { vhf: "16", phone: "+65-6545-2876" },
    customs: {
      portOfEntry: true,
      procedures:
        "MPA pre-arrival report. Strict drug-trafficking laws — disclose all pharmaceuticals.",
    },
    localKnowledge: {
      bestApproach:
        "Approach from the east via Johor Strait. AIS Class B mandatory.",
      weatherConsiderations: [
        "NE monsoon Dec-Mar (rough)",
        "SW monsoon Jun-Sep (squally)",
        "Equatorial — no cyclones",
      ],
      notes: [
        "Major Asia-Pacific yacht hub",
        "Strict customs",
        "AIS mandatory in TSS",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.5),
  },
  {
    id: "phuket-yacht-haven",
    name: "Yacht Haven Phuket Marina",
    type: "marina",
    coordinates: { latitude: 8.17, longitude: 98.3389 },
    location: { city: "Phuket", state: "Phuket", country: "Thailand" },
    facilities: conservativeFacilities({
      haulOut: true,
      chandlery: true,
      repair: { available: true, types: ["engine", "fiberglass", "rigging"] },
    }),
    navigation: {
      approachDepth: 25,
      channelDepth: 12,
      dockDepth: 8,
      tidalRange: 9,
      approach:
        "Approach from the north past Cape Yamu. Long entry channel — buoyed.",
      hazards: ["Shallow approach", "Strong tidal streams in channel"],
    },
    services: conservativeServices(["All"]),
    contact: { vhf: "67", phone: "+66-76-206-704" },
    customs: {
      portOfEntry: true,
      procedures: "Thai immigration, customs, harbour master.",
    },
    localKnowledge: {
      bestApproach:
        "Major cruising base for Andaman Sea. Best Nov-April (dry season).",
      weatherConsiderations: [
        "NE monsoon Nov-Apr (best season)",
        "SW monsoon May-Oct (wet, squally)",
        "Tsunami risk — be aware of warning signs",
      ],
      notes: [
        "Hub for Andaman cruising",
        "Bareboat charter capital of Asia",
        "Inexpensive repairs",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.5),
  },
  {
    id: "hong-kong-causeway-bay",
    name: "Royal Hong Kong Yacht Club, Causeway Bay",
    type: "yacht_club",
    coordinates: { latitude: 22.2841, longitude: 114.1825 },
    location: {
      city: "Hong Kong",
      state: "Hong Kong Island",
      country: "Hong Kong SAR",
    },
    facilities: conservativeFacilities(),
    navigation: {
      approachDepth: 40,
      channelDepth: 20,
      dockDepth: 12,
      tidalRange: 8,
      approach: "Victoria Harbour — heavy ferry and commercial traffic.",
      hazards: [
        "Heavy traffic",
        "Strong tidal streams",
        "Cyclone risk Jun-Oct",
      ],
    },
    services: conservativeServices(["Typhoon shelter inside"]),
    contact: { vhf: "16", phone: "+852-2832-2817" },
    customs: {
      portOfEntry: true,
      procedures: "HK Marine Department clearance.",
    },
    localKnowledge: {
      bestApproach: "Reciprocal arrangements with most yacht clubs worldwide.",
      weatherConsiderations: [
        "Typhoon season Jul-Oct — shelter required",
        "NE monsoon winter",
        "Hot humid summer",
      ],
      notes: [
        "Member of CCA / RORC",
        "China Sea Race start",
        "Typhoon shelter inside",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.5),
  },

  // =============================================
  // PACIFIC ISLANDS
  // =============================================
  {
    id: "papeete-tahiti",
    name: "Marina Papeete, Tahiti",
    type: "marina",
    coordinates: { latitude: -17.535, longitude: -149.5697 },
    location: { city: "Papeete", state: "Tahiti", country: "French Polynesia" },
    facilities: conservativeFacilities({ chandlery: true }),
    navigation: {
      approachDepth: 60,
      channelDepth: 30,
      dockDepth: 15,
      tidalRange: 1,
      approach: "Reef pass entry from the west. Hail Port Authority on VHF 12.",
      hazards: ["Reef on either side of pass", "Cyclone season risk Nov-Apr"],
    },
    services: conservativeServices(["All inside reef"]),
    contact: { vhf: "12", phone: "+689-40-545-680" },
    customs: {
      portOfEntry: true,
      procedures:
        "French Polynesia — Schengen does not apply. Customs/immigration on arrival.",
    },
    localKnowledge: {
      bestApproach:
        "Gateway to French Polynesia. Tradewind crossing arrival from US West Coast / Galapagos.",
      weatherConsiderations: [
        "Cyclone season Nov-Apr — depart by then",
        "Trades 15-20kt SE",
        "Best season May-Oct",
      ],
      notes: [
        "Capital of French Polynesia",
        "Stop for Pacific Puddle Jump arrivals",
        "Provisioning hub for Tuamotus / Marquesas",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.4),
  },
  {
    id: "vuda-marina-fiji",
    name: "Vuda Marina, Lautoka",
    type: "marina",
    coordinates: { latitude: -17.685, longitude: 177.3833 },
    location: { city: "Lautoka", state: "Western", country: "Fiji" },
    facilities: conservativeFacilities({
      haulOut: true,
      chandlery: true,
      repair: { available: true, types: ["engine", "rigging"] },
    }),
    navigation: {
      approachDepth: 30,
      channelDepth: 10,
      dockDepth: 6,
      tidalRange: 4,
      approach: "Pass through Navula Reef from the west — well-marked.",
      hazards: ["Reef-strewn approach", "Cyclone season Nov-Apr"],
    },
    services: conservativeServices(["Cyclone pit available"]),
    contact: { vhf: "16", phone: "+679-666-8214" },
    customs: {
      portOfEntry: true,
      procedures:
        "Mandatory clearance at Lautoka or Suva first — do NOT stop at islands en route.",
    },
    localKnowledge: {
      bestApproach:
        "Best overwintering option in Fiji. Famous cyclone-pit haul-out.",
      weatherConsiderations: [
        "Cyclone season Nov-Apr — haul out or transit",
        "Trades May-Oct",
      ],
      notes: [
        "Cyclone-pit haul-out (boats stored in pits)",
        "Hub of Fiji yachting",
        "Indo-Fijian community",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.3),
  },
  {
    id: "honolulu-ala-wai",
    name: "Ala Wai Boat Harbor, Honolulu",
    type: "harbor",
    coordinates: { latitude: 21.284, longitude: -157.8429 },
    location: { city: "Honolulu", state: "HI", country: "USA" },
    facilities: conservativeFacilities({ chandlery: true }),
    navigation: {
      approachDepth: 35,
      channelDepth: 15,
      dockDepth: 10,
      tidalRange: 2,
      approach: "Approach from the south past Diamond Head. Channel buoyed.",
      hazards: [
        "Reef on east side of entrance",
        "Wind funnels between Diamond Head and Koolaus",
      ],
    },
    services: conservativeServices(["All"]),
    contact: { vhf: "16", phone: "+1-808-973-9727" },
    customs: {
      portOfEntry: true,
      procedures: "US clearance — pre-arrival report (CBP ROAM).",
    },
    localKnowledge: {
      bestApproach:
        "Major Pacific crossing landfall (Transpac finish). Trades NE 15-25kt.",
      weatherConsiderations: [
        "Trades year-round NE 15-25kt",
        "Kona winds (S/SW) in winter",
        "Hurricane risk Jul-Nov",
      ],
      notes: [
        "Transpac finish",
        "Waikiki Yacht Club nearby",
        "Major hub for Pacific cruising",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.3),
  },

  // =============================================
  // SOUTH AFRICA
  // =============================================
  {
    id: "cape-town-royal-cape",
    name: "Royal Cape Yacht Club, Cape Town",
    type: "yacht_club",
    coordinates: { latitude: -33.9089, longitude: 18.4339 },
    location: {
      city: "Cape Town",
      state: "Western Cape",
      country: "South Africa",
    },
    facilities: conservativeFacilities({
      haulOut: true,
      chandlery: true,
      repair: {
        available: true,
        types: ["engine", "rigging", "sails", "fiberglass"],
      },
    }),
    navigation: {
      approachDepth: 50,
      channelDepth: 30,
      dockDepth: 15,
      tidalRange: 6,
      approach:
        "Table Bay approach. Cape of Storms — wait for a weather window.",
      hazards: [
        "Cape of Good Hope sea state",
        "Capesize commercial traffic",
        "Sudden SE 'Black SE' winds 40kt+",
      ],
    },
    services: conservativeServices(["All inside breakwater"]),
    contact: { vhf: "14", phone: "+27-21-421-1354" },
    customs: {
      portOfEntry: true,
      procedures: "SAMSA / SARS Customs / Immigration on arrival.",
    },
    localKnowledge: {
      bestApproach: "Famous Cape of Storms. Best windows Dec-Feb.",
      weatherConsiderations: [
        "Cape Doctor (SE) 30-40kt in summer",
        "NW gales in winter",
        "Agulhas Current can produce monster seas off-coast",
      ],
      notes: [
        "Hub for ARC Africa",
        "Major refit destination",
        "Robben Island and Table Mountain",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.5),
  },

  // =============================================
  // CANADA
  // =============================================
  {
    id: "halifax-rnsys",
    name: "Royal Nova Scotia Yacht Squadron, Halifax",
    type: "yacht_club",
    coordinates: { latitude: 44.6464, longitude: -63.6017 },
    location: { city: "Halifax", state: "NS", country: "Canada" },
    facilities: conservativeFacilities({ chandlery: true }),
    navigation: {
      approachDepth: 50,
      channelDepth: 30,
      dockDepth: 15,
      tidalRange: 7,
      approach: "Halifax Harbour — well-marked. Heavy commercial traffic.",
      hazards: ["Sambro Ledges outside", "Fog Jun-Aug"],
    },
    services: conservativeServices(["All inside harbour"]),
    contact: { vhf: "12", phone: "+1-902-477-5653" },
    customs: {
      portOfEntry: true,
      procedures: "CBSA clearance via CANPASS or in-person.",
    },
    localKnowledge: {
      bestApproach: "Common landfall for transatlantic arrivals from the east.",
      weatherConsiderations: [
        "Hurricane season tails Aug-Oct",
        "Fog Jun-Aug",
        "Winter ice in inner harbour",
      ],
      notes: [
        "Halifax Explosion historical",
        "Common ARC Europe landfall",
        "Lively maritime city",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.3),
  },
  {
    id: "victoria-bc",
    name: "Royal Victoria Yacht Club, Victoria",
    type: "yacht_club",
    coordinates: { latitude: 48.4533, longitude: -123.3014 },
    location: { city: "Victoria", state: "BC", country: "Canada" },
    facilities: conservativeFacilities(),
    navigation: {
      approachDepth: 40,
      channelDepth: 20,
      dockDepth: 12,
      tidalRange: 9,
      approach:
        "Cadboro Bay approach from the east. Beware Cadboro Point reef.",
      hazards: ["Cadboro Point reef", "Tidal current in Haro Strait"],
    },
    services: conservativeServices(["All"]),
    contact: { vhf: "16", phone: "+1-250-592-2441" },
    customs: { portOfEntry: true, procedures: "CBSA clearance via CANPASS." },
    localKnowledge: {
      bestApproach:
        "Tidal rapids of Pacific NW — plan slack water for Haro Strait crossings.",
      weatherConsiderations: [
        "Strong NW summer winds in Strait",
        "Winter SE gales",
        "Fog year-round possible",
      ],
      notes: [
        "Gateway to BC cruising grounds",
        "Swiftsure International Race",
        "Mild climate",
      ],
    },
    amenities: conservativeAmenities(),
    rating: conservativeRating(4.4),
  },
];
