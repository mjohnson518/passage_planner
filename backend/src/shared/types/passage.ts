export interface Passage {
  id: string
  userId: string
  boatId: string
  name: string
  departure: Port
  destination: Port
  waypoints: Waypoint[]
  departureTime: Date
  estimatedArrivalTime: Date
  distance: number // nautical miles
  estimatedDuration: number // hours
  
  // Weather data
  weather: WeatherSegment[]
  
  // Tidal data
  tides: TidalEvent[]
  
  // Route details
  route: RouteSegment[]
  
  // Safety information
  safety: SafetyInfo
  
  // Preferences used
  preferences: PassagePreferences
  
  status: 'draft' | 'planned' | 'in-progress' | 'completed'
  createdAt: Date
  updatedAt: Date
}

export interface Port {
  name: string
  coordinates: Coordinates
  country?: string
  facilities?: string[]
  vhfChannel?: number
  notes?: string
}

export interface Waypoint {
  id: string
  name: string
  coordinates: Coordinates
  arrivalTime?: Date
  notes?: string
  type?: 'waypoint' | 'anchorage' | 'marina' | 'fuel'
}

export interface Coordinates {
  lat: number
  lng: number
}

export interface RouteSegment {
  from: Coordinates
  to: Coordinates
  bearing: number // degrees true
  distance: number // nautical miles
  estimatedSpeed: number // knots
  estimatedTime: number // hours
}

export interface WeatherSegment {
  startTime: Date
  endTime: Date
  location: Coordinates
  wind: {
    direction: number // degrees
    speed: number // knots
    gusts?: number // knots
  }
  waves: {
    height: number // meters
    period: number // seconds
    direction?: number // degrees
  }
  visibility?: number // nautical miles
  precipitation?: number // mm/hr
  pressure?: number // hPa
  temperature?: number // celsius
}

export interface TidalEvent {
  location: string
  coordinates: Coordinates
  type: 'high' | 'low'
  time: Date
  height: number // meters
  current?: {
    speed: number // knots
    direction: number // degrees
  }
}

export interface SafetyInfo {
  vhfChannels: number[]
  emergencyContacts: EmergencyContact[]
  nearestSafeHarbors: SafeHarbor[]
  navigationWarnings: string[]
  customNotes?: string
}

export interface EmergencyContact {
  name: string
  vhfChannel?: number
  phoneNumber?: string
  coordinates?: Coordinates
}

export interface SafeHarbor {
  name: string
  coordinates: Coordinates
  distance: number // from route
  facilities: string[]
  vhfChannel?: number
}

export interface PassagePreferences {
  maxWindSpeed: number
  maxWaveHeight: number
  avoidNight: boolean
  preferMotoring: boolean
  minDepth?: number
  comfortLevel: 'racing' | 'cruising' | 'comfort'
}

// Export formats
export type ExportFormat = 'gpx' | 'kml' | 'csv' | 'pdf'

export interface ExportOptions {
  format: ExportFormat
  includeWeather?: boolean
  includeTides?: boolean
  includeNotes?: boolean
  includeSafety?: boolean
  waypointDetails?: 'basic' | 'detailed'
} 