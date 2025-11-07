export interface BoatProfile {
  id: string
  userId: string
  name: string
  type: 'sailboat' | 'motorboat' | 'catamaran' | 'trimaran'
  manufacturer?: string
  model?: string
  year?: number
  length: number // in feet
  beam?: number // in feet
  draft: number // in feet
  displacement?: number // in pounds
  
  // Sailing specific
  sailConfiguration?: 'sloop' | 'cutter' | 'ketch' | 'yawl' | 'schooner' | 'cat'
  mastHeight?: number // in feet
  
  // Motor specific
  engineType?: 'inboard' | 'outboard' | 'inboard/outboard'
  enginePower?: number // in HP
  fuelCapacity?: number // in gallons
  fuelConsumption?: number // gallons per hour at cruise
  
  // Navigation equipment
  hasAutopilot?: boolean
  hasRadar?: boolean
  hasAIS?: boolean
  hasChartplotter?: boolean
  hasWindInstruments?: boolean
  
  // Comfort/capacity
  waterCapacity?: number // in gallons
  sleeps?: number
  
  // Performance
  hullSpeed?: number // in knots
  cruisingSpeed?: number // in knots
  maxSpeed?: number // in knots
  
  // Preferences
  defaultPreferences?: PassagePreferences
  
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PassagePreferences {
  // Weather limits
  maxWindSpeed: number // knots
  maxWaveHeight: number // meters
  minVisibility?: number // nautical miles
  
  // Sailing preferences
  avoidNight: boolean
  preferMotoring: boolean
  
  // Time preferences
  maxDailyHours?: number // hours per day
  preferredDepartureTime?: string // HH:MM format
  
  // Route preferences
  minDepth?: number // feet (draft + safety margin)
  avoidTidalGates?: boolean
  preferSheltered?: boolean
  
  // Safety
  maxDistanceFromShore?: number // nautical miles
  requireVHFCoverage?: boolean
  
  // Comfort
  comfortLevel: 'racing' | 'cruising' | 'comfort'
} 