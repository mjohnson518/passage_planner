// Re-export shared types
export * from '@passage-planner/shared'

// Frontend-specific types
export interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: Date
  metadata?: {
    requestId?: string
    passagePlanId?: string
    error?: boolean
  }
}

export interface MapViewport {
  latitude: number
  longitude: number
  zoom: number
  bearing?: number
  pitch?: number
}

export interface RouteLayer {
  id: string
  name: string
  visible: boolean
  type: 'route' | 'weather' | 'tidal' | 'safety' | 'ais'
  data: any
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'system'
  units: 'metric' | 'imperial'
  mapStyle: 'satellite' | 'nautical' | 'terrain'
  language: string
  timezone: string
}

export interface NotificationSettings {
  emailAlerts: boolean
  weatherUpdates: boolean
  safetyAlerts: boolean
  marketingEmails: boolean
  pushNotifications: boolean
}

export interface DashboardStats {
  totalPassages: number
  totalDistance: number
  favoriteRoutes: string[]
  recentPorts: string[]
  upcomingPassages: PassageSummary[]
}

export interface PassageSummary {
  id: string
  name: string
  departure: string
  destination: string
  departureTime: Date
  distance: number
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
}

export interface SubscriptionUsage {
  passagesThisMonth: number
  apiCallsToday: number
  storageUsed: number
  lastReset: Date
  limits: {
    passagesPerMonth: number
    apiCallsPerDay: number
    storageGB: number
  }
}

export interface WeatherOverlay {
  type: 'wind' | 'pressure' | 'precipitation' | 'waves'
  opacity: number
  animationSpeed: number
  timeOffset: number // hours from now
}

export interface ChartTile {
  url: string
  x: number
  y: number
  z: number
  cached: boolean
  lastAccessed: Date
} 