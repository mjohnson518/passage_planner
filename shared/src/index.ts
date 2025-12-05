// Export all types
export * from './types/core';
export { 
  Passage,
  WeatherSegment,
  TidalEvent,
  RouteSegment,
  SafetyInfo
} from './types/passage';
export * from './types/boat';
export * from './types/fleet';

// Export agents
export * from './agents/BaseAgent';

// Export services
export * from './services/APIFallbackManager';
export * from './services/AuthService';
export * from './services/CacheManager';
export * from './services/ErrorHandler';
export * from './services/MetricsService';
export * from './services/RateLimiter';
export * from './services/RequestValidator';
export * from './services/StripeService';
export * from './services/FeatureGate';
export * from './services/NOAAWeatherService';
export * from './services/NOAATidalService';
export * from './services/OpenSeaMapService';
export { 
  PortDetails, 
  PortFacilities, 
  PortContact, 
  PortNavigation, 
  PortDatabaseService,
  Port as PortInfo 
} from './services/PortDatabaseService';
export * from './services/SafetyService';

// Export middleware
export * from './middleware/InputValidation';
export * from './middleware/SecurityHeaders';

// Export new Phase 1 enhancements - avoid duplicates with SafetyService
export type { 
  RestrictedArea,
  SafetyMargin,
  CrewExperience,
  SafetyRecommendation,
  WeatherHazardAssessment,
  MarineConditions,
  SafetyOverride,
  SafetyAuditLog,
  DepthCalculation,
  SevereWeatherPattern
} from './types/safety';
// Note: Waypoint, SafetyHazard, SafetyWarning, GeographicBounds, WeatherHazard already exported
export * from './types/errors';
export * from './services/retry';
export * from './services/circuit-breaker';
export * from './services/api-client';
export * from './services/data-freshness';
export { CircuitBreakerFactory } from './services/resilience/circuit-breaker';

// Export utilities
export * from './utils/validateEnv'; 