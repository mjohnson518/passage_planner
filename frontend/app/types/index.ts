export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Port {
  id: string;
  name: string;
  coordinates: Coordinate;
  country: string;
}

export interface Waypoint {
  id: string;
  name?: string;
  coordinates: Coordinate;
  estimatedArrival: Date;
  notes?: string;
}

export interface WeatherCondition {
  timeWindow: {
    start: Date;
    end: Date;
  };
  description: string;
  windSpeed: number;
  windDirection: string;
  waveHeight: number;
  visibility: number;
  precipitation: number;
}

export interface TidePrediction {
  time: Date;
  height: number;
  type: 'high' | 'low';
  current?: {
    speed: number;
    direction: string;
  };
}

export interface TidalSummary {
  location: string;
  predictions: TidePrediction[];
}

export interface ContactInfo {
  type: 'coast-guard' | 'harbormaster' | 'marina' | 'emergency' | 'customs';
  name?: string;
  phone?: string;
  email?: string;
  vhfChannel?: number;
}

export interface NavigationalHazard {
  type: 'shoal' | 'rock' | 'wreck' | 'restricted_area' | 'traffic';
  location: Coordinate;
  description: string;
  avoidanceRadius: number;
}

export interface PassagePlan {
  id: string;
  departure: Port;
  destination: Port;
  waypoints: Waypoint[];
  departureTime: Date;
  estimatedArrivalTime: Date;
  distance: {
    total: number;
    unit: 'nm' | 'km';
  };
  weather: {
    conditions: WeatherCondition[];
    warnings: string[];
    lastUpdated: Date;
  };
  tides: TidalSummary[];
  safety: {
    emergencyContacts: ContactInfo[];
    hazards: NavigationalHazard[];
    requiredEquipment: string[];
    weatherWindows: Array<{
      start: Date;
      end: Date;
    }>;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  data?: any;
  metadata?: {
    agentsUsed?: string[];
  };
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error' | 'processing';
  lastSeen?: Date;
  currentOperation?: string;
} 