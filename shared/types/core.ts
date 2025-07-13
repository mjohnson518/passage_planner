// shared/types/core.ts
// Core type definitions for the entire system

import { z } from 'zod';

// ===== Base Types =====

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface Port {
  id: string;
  name: string;
  coordinates: Coordinate;
  country: string;
  facilities: PortFacility[];
  contacts: ContactInfo[];
}

export interface PortFacility {
  type: 'fuel' | 'water' | 'provisions' | 'repairs' | 'customs';
  available: boolean;
  details?: string;
}

export interface ContactInfo {
  type: 'harbormaster' | 'marina' | 'emergency' | 'customs';
  name?: string;
  phone?: string;
  email?: string;
  vhfChannel?: number;
}

// ===== Agent Communication Protocol =====

export interface AgentCapabilitySummary {
  agentId: string;
  name: string;
  description: string;
  version: string;
  status: AgentStatus;
  tools: ToolDefinition[];
  resources: ResourceDefinition[];
  prompts: PromptDefinition[];
  lastUpdated: Date;
  healthEndpoint: string;
  performance: {
    averageResponseTime: number;
    successRate: number;
    lastError?: string;
  };
}

export type AgentStatus = 'active' | 'idle' | 'error' | 'maintenance' | 'starting';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  outputSchema: z.ZodSchema<any>;
  examples?: ToolExample[];
  rateLimit?: {
    requests: number;
    window: number; // seconds
  };
}

export interface ToolExample {
  input: any;
  output: any;
  description?: string;
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  updateFrequency?: string; // cron expression
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
  template: string;
}

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'coordinate' | 'datetime';
  default?: any;
  validation?: z.ZodSchema<any>;
}

// ===== Request/Response Protocol =====

export interface AgentRequest {
  id: string;
  timestamp: Date;
  source: string; // orchestrator or agent ID
  target: string; // agent ID
  type: 'tool' | 'resource' | 'prompt';
  name: string;
  arguments: Record<string, any>;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  context?: RequestContext;
}

export interface RequestContext {
  sessionId: string;
  userId?: string;
  correlationId: string;
  parentRequestId?: string;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  id: string;
  requestId: string;
  timestamp: Date;
  source: string;
  status: 'success' | 'error' | 'partial';
  data?: any;
  error?: AgentError;
  performance: {
    duration: number;
    apiCalls?: number;
  };
}

export interface AgentError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

// ===== Orchestrator Types =====

export interface OrchestrationPlan {
  id: string;
  userPrompt: string;
  requiredAgents: string[];
  steps: OrchestrationStep[];
  estimatedDuration: number;
  fallbackStrategies: FallbackStrategy[];
}

export interface OrchestrationStep {
  id: string;
  agentId: string;
  operation: string;
  dependencies: string[]; // step IDs
  arguments: Record<string, any>;
  timeout: number;
  retries: number;
}

export interface FallbackStrategy {
  condition: 'agent_unavailable' | 'timeout' | 'error';
  agentId: string;
  alternativeAgent?: string;
  degradedResponse?: any;
}

// ===== Domain-Specific Types =====

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
  weather: WeatherSummary;
  tides: TidalSummary[];
  safety: SafetyBriefing;
  alternativeRoutes?: Route[];
}

export interface Waypoint {
  id: string;
  name?: string;
  coordinates: Coordinate;
  estimatedArrival: Date;
  notes?: string;
}

export interface Route {
  id: string;
  name: string;
  waypoints: Waypoint[];
  distance: number;
  estimatedDuration: number;
  advantages: string[];
  disadvantages: string[];
}

export interface WeatherSummary {
  conditions: WeatherCondition[];
  warnings: string[];
  lastUpdated: Date;
}

export interface WeatherCondition {
  timeWindow: TimeWindow;
  description: string;
  windSpeed: number;
  windDirection: string;
  waveHeight: number;
  visibility: number;
  precipitation: number;
}

export interface TidalSummary {
  location: string;
  predictions: TidePrediction[];
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

export interface SafetyBriefing {
  emergencyContacts: ContactInfo[];
  hazards: NavigationalHazard[];
  requiredEquipment: string[];
  weatherWindows: TimeWindow[];
}

export interface NavigationalHazard {
  type: 'shoal' | 'rock' | 'wreck' | 'restricted_area' | 'traffic';
  location: Coordinate;
  description: string;
  avoidanceRadius: number; // meters
}

// ===== Monitoring Types =====

export interface SystemMetrics {
  timestamp: Date;
  orchestrator: {
    activeRequests: number;
    queueDepth: number;
    processingTime: number;
  };
  agents: Record<string, AgentMetrics>;
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
}

export interface AgentMetrics {
  status: AgentStatus;
  requestsProcessed: number;
  averageResponseTime: number;
  errorRate: number;
  lastError?: string;
  resourceUsage: {
    cpu: number;
    memory: number;
  };
}

// ===== Validation Schemas =====

export const CoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const AgentRequestSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.date(),
  source: z.string(),
  target: z.string(),
  type: z.enum(['tool', 'resource', 'prompt']),
  name: z.string(),
  arguments: z.record(z.any()),
  timeout: z.number().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
});

export const PassagePlanRequestSchema = z.object({
  departure: z.string(),
  destination: z.string(),
  departureTime: z.date(),
  boatType: z.enum(['sailboat', 'powerboat', 'catamaran']).optional(),
  preferences: z.object({
    avoidNightSailing: z.boolean().optional(),
    maxWindSpeed: z.number().optional(),
    maxWaveHeight: z.number().optional(),
  }).optional(),
}); 