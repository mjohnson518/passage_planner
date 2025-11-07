export interface Fleet {
  id: string
  ownerId: string
  name: string
  description?: string
  vessels: FleetVessel[]
  crew: CrewMember[]
  sharedPassages: string[] // passage IDs
  settings: FleetSettings
  createdAt: Date
  updatedAt: Date
}

export interface FleetVessel {
  id: string
  fleetId: string
  boatProfileId: string
  name: string
  status: 'active' | 'maintenance' | 'inactive'
  currentLocation?: {
    lat: number
    lng: number
    lastUpdated: Date
  }
  assignedCrew?: string[] // crew member IDs
  mmsi?: string // Maritime Mobile Service Identity
  callSign?: string
}

export interface CrewMember {
  id: string
  fleetId: string
  userId?: string // linked user account
  name: string
  email: string
  phone?: string
  role: 'captain' | 'skipper' | 'crew' | 'guest'
  permissions: CrewPermissions
  vessels: string[] // vessel IDs they have access to
  status: 'active' | 'invited' | 'inactive'
  invitedAt?: Date
  joinedAt?: Date
}

export interface CrewPermissions {
  canViewPassages: boolean
  canCreatePassages: boolean
  canEditPassages: boolean
  canManageVessels: boolean
  canInviteCrew: boolean
  canViewFleetAnalytics: boolean
}

export interface FleetSettings {
  defaultPassageSharing: boolean
  requireApprovalForPassages: boolean
  allowCrewToInvite: boolean
  vesselTrackingEnabled: boolean
  maintenanceReminders: boolean
}

export interface FleetInvitation {
  id: string
  fleetId: string
  email: string
  role: CrewMember['role']
  permissions: CrewPermissions
  vessels: string[]
  invitedBy: string
  expiresAt: Date
  acceptedAt?: Date
  token: string
}

export interface VesselMaintenance {
  id: string
  vesselId: string
  type: 'routine' | 'repair' | 'inspection' | 'haul-out'
  title: string
  description?: string
  dueDate?: Date
  completedDate?: Date
  cost?: number
  vendor?: string
  documents?: string[] // URLs to maintenance docs
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue'
}

export interface FleetAnalytics {
  fleetId: string
  totalVessels: number
  activeVessels: number
  totalCrew: number
  totalPassages: number
  totalDistance: number
  averagePassageDistance: number
  vesselUtilization: {
    vesselId: string
    name: string
    passagesCount: number
    totalDistance: number
    lastUsed?: Date
  }[]
  popularRoutes: {
    departure: string
    destination: string
    count: number
  }[]
} 