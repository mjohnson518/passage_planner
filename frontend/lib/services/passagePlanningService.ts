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

import { getSupabase } from "../../app/lib/supabase-client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://passage-plannerorchestrator-production.up.railway.app";
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
    crewExperience?: "novice" | "intermediate" | "advanced" | "professional";
    crewSize?: number;
  };
  /** Premium-only (R1) — request the multi-model GFS/ECMWF/ICON comparison.
   *  Free users still get a plan; the server soft-downgrades and surfaces
   *  `modelComparisonGated: true` in the response instead. */
  multiModel?: boolean;
}

/**
 * Plan-status codes surfaced from the orchestrator.
 * OK — no critical issues
 * SAFETY_WARNING — critical hazard detected on the route
 * SAFETY_UNVERIFIED — safety system failed to run (fail-closed, show caution)
 * COVERAGE_LIMITED — route exits Helmwise's validated coverage region; data fidelity is degraded
 */
export type PlanStatus =
  | "OK"
  | "SAFETY_WARNING"
  | "SAFETY_UNVERIFIED"
  | "COVERAGE_LIMITED";

export interface CoverageDisclaimer {
  outOfCoveragePoint: { lat: number; lon: number; label?: string };
  departureRegion: string | null;
  destinationRegion: string | null;
  gaps: string[];
  message: string;
}

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
      severity: "critical" | "warning" | "info";
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
        type: "high" | "low";
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
        type: "high" | "low";
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
    safetyScore: "Excellent" | "Good" | "Fair" | "Poor";
    goNoGo: "GO" | "CAUTION" | "NO-GO";
    overallRisk: "low" | "moderate" | "high" | "critical";
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
  /** Honest scoping payload — present when route exits validated coverage */
  coverageDisclaimer?: CoverageDisclaimer | null;
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
    safetyDecision: "GO" | "CAUTION" | "NO-GO";
    safetyScore: "Excellent" | "Good" | "Fair" | "Poor";
    overallRisk: "low" | "moderate" | "high" | "critical";
    suitableForPassage: boolean;
    warnings: string[];
    recommendations: string[];
    /** Average speed for the weather-optimized route (knots), when available */
    averageSpeed?: number | string;
  };
  /** R2 — composite GO/CAUTION/NO-GO risk score. Always present for
   *  authenticated requests; falls back to undefined only if scoring threw. */
  riskScore?: {
    score: number;
    status: "GO" | "CAUTION" | "NO-GO";
    breakdown: Array<{
      category: "weather" | "depth" | "hazards" | "reserves" | "crew";
      weight: number;
      score: number;
      status: "good" | "marginal" | "poor" | "unknown";
      contributors: string[];
    }>;
    hardFails: string[];
    disclaimers: string[];
    dataMissing: string[];
    generatedAt: string;
    weatherDataAgeMin: number | null;
    multiModelApplied: boolean;
  };
  /** R1 multi-model comparison — present when the caller requested it and
   *  the user's tier permits it. `null` + `modelComparisonGated: true` means
   *  the request was made but the user is on Free. */
  modelComparison?: {
    location: { latitude: number; longitude: number };
    issuedAt: string;
    models: string[];
    evaluatedAt: string;
    windSpeed: ModelVariableAgreement | null;
    windGust: ModelVariableAgreement | null;
    waveHeight: ModelVariableAgreement | null;
    temperature: ModelVariableAgreement | null;
    recommendation: string;
  } | null;
  modelComparisonGated?: boolean;
}

export interface ModelVariableAgreement {
  variable:
    | "wind_speed_kt"
    | "wind_gust_kt"
    | "wave_height_m"
    | "temperature_f";
  consensus: number;
  worstCase: number;
  spread: number;
  status: "agree" | "mild" | "divergent";
  perModel: Record<string, number>;
}

/**
 * Plan a passage with comprehensive data from all 6 sources
 * @param request Passage planning parameters
 * @returns Complete passage plan with route, weather, tidal, navigation, safety, and port data
 */
export async function planPassage(
  request: PassagePlanningRequest,
): Promise<PassagePlanningResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/api/passage-planning/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Passage planning failed");
    }

    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("Request timeout - please try again");
    }
    throw new Error(error.message || "Failed to plan passage");
  }
}

// ----------------------------------------------------------------------------
// R3 — Multi-departure-time comparison (Premium)
// ----------------------------------------------------------------------------

export interface CandidateResultOk {
  departureTime: string;
  status: "ok";
  plan: PassagePlanningResponse;
}

export interface CandidateResultError {
  departureTime: string;
  status: "error";
  error: string;
}

export type CandidateResult = CandidateResultOk | CandidateResultError;

export interface CompareResponse {
  success: boolean;
  candidates: CandidateResult[];
  bestIndex: number | null;
  summary: string[];
  upgradeRequired?: boolean;
}

export async function comparePassages(
  request: PassagePlanningRequest,
  candidateDepartures: string[],
): Promise<CompareResponse> {
  // Server-side comparison can be long-running — give it 3× the single-plan
  // budget since it fires N plans in parallel and waits for the slowest.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT * 3);

  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/api/plan/compare`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ ...request, candidateDepartures }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (response.status === 403 && body?.upgradeRequired) {
        return {
          success: false,
          candidates: [],
          bestIndex: null,
          summary: [body.error ?? "Premium subscription required."],
          upgradeRequired: true,
        };
      }
      throw new Error(body?.error ?? `Compare failed (${response.status})`);
    }
    return (await response.json()) as CompareResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Comparison timed out — try fewer candidates.");
    }
    throw new Error(error.message || "Failed to compare departure times");
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
      throw new Error("Health check failed");
    }

    return response.json();
  } catch (error) {
    throw new Error("Backend is unavailable");
  }
}

/**
 * Check if backend is ready
 */
export async function checkBackendReady(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/ready`);
    const data = await response.json();
    return data.status === "ready";
  } catch (error) {
    return false;
  }
}
