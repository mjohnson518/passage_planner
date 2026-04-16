/**
 * Passage Planning Service
 * Connects to production backend API to fetch comprehensive passage planning data
 *
 * Integrates 6 data sources:
 * 1. Route calculations
 * 2. Weather data (NOAA)
 * 3. Tidal predictions (NOAA)
 * 4. Navigation warnings
 * 5. Safety analysis
 * 6. Port information
 */

import { getSupabase } from '../../app/lib/supabase-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://passage-plannerorchestrator-production.up.railway.app';
const TIMEOUT = 30000; // 30 second timeout

/**
 * Get auth token from Supabase session (if available)
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

export interface PassagePlanningRequest {
  departure: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  vessel?: {
    cruiseSpeed?: number;
    draft?: number;
    crewExperience?: 'novice' | 'intermediate' | 'advanced' | 'professional';
    crewSize?: number;
  };
}

/**
 * Plan-status codes surfaced from the orchestrator.
 * OK — no critical issues
 * SAFETY_WARNING — critical hazard detected on the route
 * SAFETY_UNVERIFIED — safety system failed to run (fail-closed, show caution)
 */
export type PlanStatus = 'OK' | 'SAFETY_WARNING' | 'SAFETY_UNVERIFIED';

export interface PassagePlanningResponse {
  success: boolean;
  /** Server-generated plan UUID */
  id?: string;
  /** When the plan was generated (ISO string) */
  timestamp?: string;
  /** Safety fail-closed status */
  status?: PlanStatus;
  /** Weather-optimized route (isochrone), when available */
  weatherRoute?: {
    waypoints?: Array<{ latitude: number; longitude: number; name?: string }>;
    totalDistance?: number;
    estimatedDuration?: string;
    adjustedDuration?: string;
    averageSpeed?: number;
    comparison?: unknown;
    safetyWarnings?: string[];
  } | null;
  route: {
    distance: number;
    distanceNm: number;
    distanceKm: number;
    bearing: number;
    estimatedDuration: string;
    estimatedDurationHours: number;
    waypoints: Array<{
      latitude: number;
      longitude: number;
      name?: string;
    }>;
    departure: string;
    destination: string;
  };
  weather: {
    departure: {
      forecast: string;
      windSpeed: number;
      windDirection: number;
      waveHeight: number;
      temperature: number;
      conditions: string;
      warnings: string[];
      source: string;
      timestamp: string;
      /** Forecast issue time — used for the >1h staleness gate */
      issuedAt?: string;
      windDescription: string;
    };
    destination: {
      forecast: string;
      windSpeed: number;
      windDirection: number;
      waveHeight: number;
      temperature: number;
      conditions: string;
      warnings: string[];
      source: string;
      timestamp: string;
      /** Forecast issue time — used for the >1h staleness gate */
      issuedAt?: string;
      windDescription: string;
    };
    summary: {
      maxWindSpeed: number;
      suitable: boolean;
      warnings: string[];
      overall: string;
    };
  };
  navigationWarnings: {
    count: number;
    critical: number;
    warnings: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      location: any;
      severity: 'critical' | 'warning' | 'info';
      effectiveDate: string;
      expiryDate?: string;
      source: string;
    }>;
    lastChecked: string;
  };
  tidal: {
    departure: {
      station: string;
      stationId?: string;
      distance?: number;
      predictions: Array<{
        time: string;
        type: 'high' | 'low';
        height: number;
        unit: string;
      }>;
      nextTide: any;
      nextTideFormatted: string;
      source: string;
      warning?: string;
    };
    destination: {
      station: string;
      stationId?: string;
      distance?: number;
      predictions: Array<{
        time: string;
        type: 'high' | 'low';
        height: number;
        unit: string;
      }>;
      nextTide: any;
      nextTideFormatted: string;
      source: string;
      warning?: string;
    };
    summary: {
      departureStation: string;
      destinationStation: string;
      tidalDataAvailable: boolean;
      warnings: string[];
    };
  };
  safety: {
    safetyScore: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    goNoGo: 'GO' | 'CAUTION' | 'NO-GO';
    overallRisk: 'low' | 'moderate' | 'high' | 'critical';
    riskFactors: string[];
    safetyWarnings: string[];
    recommendations: string[];
    hazards: any[];
    emergencyContacts: any;
    watchSchedule: any;
    timestamp: string;
    source: string;
    decision: {
      goNoGo: string;
      overallRisk: string;
      safetyScore: string;
      proceedWithPassage: boolean;
      requiresCaution: boolean;
      doNotProceed: boolean;
    };
    analysis: {
      riskFactors: string[];
      hazardsDetected: number;
      warningsActive: number;
      crewExperienceConsidered: boolean;
      vesselDraftConsidered: boolean;
    };
  };
  port: {
    departure: {
      found?: boolean;
      name?: string;
      type?: string;
      distance?: string;
      facilities?: any;
      navigation?: any;
      contact?: any;
      customs?: any;
      recommendations?: string[];
      rating?: number;
      message?: string;
    };
    destination: {
      found?: boolean;
      name?: string;
      type?: string;
      distance?: string;
      facilities?: any;
      navigation?: any;
      contact?: any;
      customs?: any;
      recommendations?: string[];
      rating?: number;
      message?: string;
    };
    emergencyHarbors: Array<{
      name: string;
      distance: string;
      vhf: string;
      protection: number;
      facilities: number;
    }>;
    summary: {
      departurePortAvailable: boolean;
      destinationPortAvailable: boolean;
      emergencyOptions: number;
      nearestEmergency: string;
    };
  };
  summary: {
    totalDistance: string;
    estimatedTime: string;
    safetyDecision: 'GO' | 'CAUTION' | 'NO-GO';
    safetyScore: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    overallRisk: 'low' | 'moderate' | 'high' | 'critical';
    suitableForPassage: boolean;
    warnings: string[];
    recommendations: string[];
    /** Average speed for the weather-optimized route (knots), when available */
    averageSpeed?: number | string;
  };
}

/**
 * Plan a passage with comprehensive data from all 6 sources
 * @param request Passage planning parameters
 * @returns Complete passage plan with route, weather, tidal, navigation, safety, and port data
 */
export async function planPassage(
  request: PassagePlanningRequest
): Promise<PassagePlanningResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/api/passage-planning/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Passage planning failed');
    }

    return data;

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    throw new Error(error.message || 'Failed to plan passage');
  }
}

/**
 * Check backend health
 */
export async function checkBackendHealth(): Promise<{
  status: string;
  timestamp: string;
  version: string;
  message: string;
}> {
  try {
    const response = await fetch(`${API_URL}/health`);
    
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    
    return response.json();
  } catch (error) {
    throw new Error('Backend is unavailable');
  }
}

/**
 * Check if backend is ready
 */
export async function checkBackendReady(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/ready`);
    const data = await response.json();
    return data.status === 'ready';
  } catch (error) {
    return false;
  }
}

