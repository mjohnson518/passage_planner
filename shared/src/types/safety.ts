/**
 * Safety Types for Helmwise Maritime System
 * 
 * These types define safety-critical structures used throughout the application.
 * All safety calculations and warnings must use these standardized types.
 */

export interface Waypoint {
  latitude: number;
  longitude: number;
  name?: string;
  timestamp?: string;
}

export interface SafetyHazard {
  id: string;
  type: 'shallow_water' | 'traffic_separation' | 'restricted_area' | 'weather' | 'obstruction' | 'other';
  location: Waypoint;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  description: string;
  avoidance?: string;
  radius?: number; // Radius of hazard in nautical miles
  metadata?: Record<string, unknown>;
}

export interface SafetyWarning {
  id: string;
  type: 'navigation' | 'weather' | 'regulatory' | 'operational';
  location?: Waypoint;
  area?: GeographicBounds;
  description: string;
  action: string;
  severity: 'urgent' | 'warning' | 'advisory' | 'info';
  issued: string;
  expires?: string;
  source: string;
}

export interface GeographicBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface RestrictedArea {
  id: string;
  name: string;
  type: 'military' | 'marine_sanctuary' | 'shipping_lane' | 'anchor_prohibited' | 'speed_restricted' | 'other';
  bounds?: GeographicBounds;
  polygon?: Waypoint[]; // For irregular shapes
  description: string;
  restrictions: string[];
  active: boolean;
  schedule?: {
    start: string; // ISO format or 'permanent'
    end?: string;
    recurring?: string; // e.g., "Daily 0800-1600"
  };
  authority: string;
  penalty?: string;
}

export interface SafetyMargin {
  type: 'depth' | 'distance' | 'weather' | 'time';
  minimum: number;
  recommended: number;
  unit: string;
  rationale: string;
}

export interface CrewExperience {
  level: 'novice' | 'intermediate' | 'advanced' | 'professional';
  hoursLogged?: number;
  certificationsHeld: string[];
  nightExperienceHours?: number;
  offshoreExperienceNm?: number;
  heavyWeatherExperience?: boolean;
}

export interface SafetyRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'preparation' | 'equipment' | 'route' | 'timing' | 'crew' | 'communication';
  description: string;
  action: string;
  rationale: string;
  experienceDependent?: boolean;
}

export interface WeatherHazardAssessment {
  location: Waypoint;
  timeRange: {
    start: string;
    end: string;
  };
  hazardsDetected: WeatherHazard[];
  marine: MarineConditions;
  confidence: 'high' | 'medium' | 'low';
  sources: string[]; // Which weather services provided data
  consensus: boolean; // Do multiple sources agree?
}

export interface WeatherHazard {
  type: 'gale' | 'storm' | 'hurricane' | 'fog' | 'thunderstorm' | 'ice' | 'visibility' | 'small_craft';
  severity: 'extreme' | 'high' | 'moderate' | 'low';
  description: string;
  timing: string;
  action?: string;
  probabilityPercent?: number;
}

export interface MarineConditions {
  windSpeed: {
    min: number;
    max: number;
    average: number;
    unit: 'knots' | 'mph' | 'mps';
  };
  waveHeight: {
    min: number;
    max: number;
    average: number;
    unit: 'feet' | 'meters';
  };
  visibility: {
    min: number;
    average: number;
    unit: 'nm' | 'km';
  };
  seaState?: {
    douglasScale: number; // 0-9
    description: string;
  };
}

export interface SafetyOverride {
  id: string;
  userId: string;
  timestamp: string;
  warningId: string;
  warningType: string;
  justification: string;
  acknowledged: boolean;
  witnessedBy?: string; // For crew confirmations
  expiresAt?: string; // Optional expiration
}

export interface SafetyAuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  requestId: string;
  action: 'route_analyzed' | 'warning_generated' | 'override_applied' | 'hazard_detected' | 'recommendation_made';
  details: {
    route?: Waypoint[];
    hazardsFound?: number;
    warningsIssued?: number;
    safetyScore?: string;
    dataSources?: string[];
    confidence?: string;
    overrideInfo?: SafetyOverride;
    metadata?: Record<string, unknown>; // Additional context data
  };
  result: 'success' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface DepthCalculation {
  location: Waypoint;
  chartedDepth: number; // From chart data
  tidalAdjustment: number; // Tidal height at time of passage
  actualDepth: number; // chartedDepth + tidalAdjustment
  vesselDraft: number;
  minimumClearance: number; // 20% of draft or fixed minimum
  clearanceAvailable: number; // actualDepth - vesselDraft
  isGroundingRisk: boolean;
  severity: 'critical' | 'high' | 'moderate' | 'safe';
  recommendation: string;
}

export interface SevereWeatherPattern {
  type: 'tropical_cyclone' | 'gale_series' | 'rapid_pressure_drop' | 'cold_front' | 'storm_system';
  name?: string; // e.g., hurricane name
  currentPosition?: Waypoint;
  forecastTrack?: Waypoint[]; // Predicted path
  affectedArea: GeographicBounds;
  intensity: string;
  movementSpeed: number; // knots
  movementDirection: number; // degrees
  predictedImpact: {
    timing: string;
    windSpeed: number;
    waveHeight: number;
    recommendedAction: 'shelter_immediately' | 'delay_departure' | 'divert_route' | 'monitor_closely';
  };
  dataSource: string;
  lastUpdated: string;
}

