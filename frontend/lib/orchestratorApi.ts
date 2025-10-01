const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface PassagePlanRequest {
  departure: {
    port: string;
    latitude: number;
    longitude: number;
    time: string; // ISO 8601 format
  };
  destination: {
    port: string;
    latitude: number;
    longitude: number;
  };
  vessel?: {
    type: string;
    cruiseSpeed: number;
    maxSpeed: number;
  };
  preferences?: {
    avoidNight?: boolean;
    maxWindSpeed?: number;
    maxWaveHeight?: number;
    preferredStops?: string[];
  };
  userId?: string;
}

export interface PassagePlan {
  id: string;
  request: PassagePlanRequest;
  route: {
    waypoints: Array<{
      latitude: number;
      longitude: number;
      name?: string;
      arrivalTime?: Date;
    }>;
    segments: Array<{
      from: any;
      to: any;
      distance: number;
      bearing: number;
      estimatedTime: number;
    }>;
    totalDistance: number;
    estimatedDuration: number;
    optimized: boolean;
  };
  weather: any[];
  tides: any;
  summary: {
    totalDistance: number;
    estimatedDuration: number;
    departureTime: string;
    estimatedArrival: string;
    warnings: string[];
    recommendations: string[];
  };
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  agents: {
    [key: string]: {
      status: string;
      lastHeartbeat: string | null;
    };
  };
}

/**
 * Check orchestrator and agent health
 */
export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_URL}/health`);
  
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  
  return response.json();
}

/**
 * Check if orchestrator is ready
 */
export async function checkReady(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/ready`);
    const data = await response.json();
    return data.ready === true;
  } catch (error) {
    return false;
  }
}

/**
 * Plan a sailing passage
 * Returns the planning ID - listen to WebSocket for updates and results
 */
export async function planPassage(params: PassagePlanRequest): Promise<{ planningId: string; plan: PassagePlan }> {
  const response = await fetch(`${API_URL}/api/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Planning failed');
  }
  
  const data = await response.json();
  return {
    planningId: data.plan.id,
    plan: data.plan
  };
}

