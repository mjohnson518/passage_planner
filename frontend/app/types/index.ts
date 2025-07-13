export interface Coordinate {
  latitude: number
  longitude: number
}

export interface Port {
  id: string
  name: string
  coordinates: Coordinate
  country: string
}

export interface Waypoint {
  id: string
  name?: string
  coordinates: Coordinate
  estimatedArrival: Date
  notes?: string
}

export interface WeatherCondition {
  timeWindow: {
    start: Date
    end: Date
  }
  description: string
  windSpeed: number
  windDirection: string
  waveHeight: number
  visibility: number
  precipitation: number
}

export interface TidePrediction {
  time: Date
  height: number
  type: 'high' | 'low'
  current?: {
    speed: number
    direction: string
  }
}

export interface PassagePlan {
  id: string
  departure: Port
  destination: Port
  waypoints: Waypoint[]
  departureTime: Date
  estimatedArrivalTime: Date
  distance: {
    total: number
    unit: 'nm' | 'km'
  }
  weather: {
    conditions: WeatherCondition[]
    warnings: string[]
    lastUpdated: Date
  }
  tides: Array<{
    location: string
    predictions: TidePrediction[]
  }>
  safety: {
    emergencyContacts: Array<{
      type: string
      name?: string
      phone?: string
      vhfChannel?: number
    }>
    hazards: Array<{
      type: string
      location: Coordinate
      description: string
    }>
    requiredEquipment: string[]
  }
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    agentsUsed?: string[]
    processingTime?: number
    plan?: PassagePlan
  }
}

export interface AgentStatus {
  id: string
  name: string
  status: 'active' | 'idle' | 'error' | 'processing'
  lastActivity?: Date
  currentOperation?: string
  performance?: {
    averageResponseTime: number
    successRate: number
  }
} 