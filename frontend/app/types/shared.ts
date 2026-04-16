// Local type shims — the workspace build currently blocks importing
// @passage-planner/shared directly from the frontend. When that's fixed,
// prefer importing from the shared package and delete these aliases.

export type Passage = any;
export type PassagePlan = any;
export type PassagePlanRequest = any;
export type Fleet = any;
export type FleetVessel = any;
export type FleetAnalytics = any;
export type CrewMember = any;

// Export-surface types: the minimum shape the GPX/KML/CSV/PDF helpers need.
// Fields are optional where the helpers already handle absent data.

export interface PassageCoordinates {
  lat: number;
  lng: number;
}

export interface PassageWaypoint {
  name: string;
  coordinates?: PassageCoordinates;
  latitude?: number;
  longitude?: number;
  type?: string;
  notes?: string;
  arrivalTime?: Date | string;
}

export interface PassageEndpoint {
  name: string;
  coordinates?: PassageCoordinates;
  latitude?: number;
  longitude?: number;
  facilities?: string[];
  vhfChannel?: string | number;
  notes?: string;
}

export interface PassageRouteSegment {
  from: PassageCoordinates;
  to: PassageCoordinates;
  bearing: number;
  distance: number;
  estimatedSpeed?: number;
  estimatedTime?: number;
}

export interface PassageWeatherSegment {
  startTime: Date | string;
  endTime: Date | string;
  location: PassageCoordinates;
  wind: { direction: number; speed: number; gusts?: number };
  waves: { height: number; period: number };
  visibility?: number;
  temperature?: number;
}

export interface PassageTideEntry {
  location: string;
  type: 'high' | 'low';
  time: Date | string;
  height: number;
  current?: { speed: number; direction: number };
}

export interface PassageSafety {
  vhfChannels?: Array<string | number>;
  navigationWarnings?: string[];
  emergencyContacts?: Array<{ name: string; vhfChannel?: string | number; phoneNumber?: string }>;
}

export interface PassagePreferences {
  maxWindSpeed?: number;
  maxWaveHeight?: number;
  avoidNight?: boolean;
}

export interface PassageExport {
  name: string;
  departure?: PassageEndpoint;
  destination?: PassageEndpoint;
  waypoints?: PassageWaypoint[];
  route?: PassageRouteSegment[];
  distance?: number;
  estimatedDuration?: number;
  departureTime?: Date | string;
  estimatedArrivalTime?: Date | string;
  weather?: PassageWeatherSegment[];
  tides?: PassageTideEntry[];
  safety?: PassageSafety;
  preferences?: PassagePreferences;
  [extra: string]: unknown;
}
