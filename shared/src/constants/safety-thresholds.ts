/**
 * Safety Thresholds — SINGLE SOURCE OF TRUTH
 *
 * SAFETY CRITICAL: These constants govern life-safety decisions for mariners.
 * Do NOT change these values without reviewing CLAUDE.md safety requirements
 * and obtaining appropriate approval.
 *
 * Priority hierarchy: Safety > Accuracy > Transparency > Reliability > Performance
 */

// Weather data staleness thresholds
export const WEATHER_WARN_AGE_MS = 30 * 60 * 1000;    // 30 minutes — warn approaching stale
export const WEATHER_REJECT_AGE_MS = 60 * 60 * 1000;  // 1 hour    — CLAUDE.md: "Reject stale data (weather >1hr)"
export const TIDAL_REJECT_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours — CLAUDE.md: "tides >1 day"

// Safety margins (non-negotiable per CLAUDE.md)
export const KEEL_CLEARANCE_FACTOR = 1.2;   // 20% clearance under keel
export const WEATHER_DELAY_FACTOR = 1.2;    // 20% weather delay buffer on all route durations
export const FUEL_WATER_RESERVE_FACTOR = 1.3; // 30% fuel/water reserve requirement

// Passage plan safety statuses
export const PLAN_STATUS = {
  OK: 'OK',
  SAFETY_UNVERIFIED: 'SAFETY_UNVERIFIED',
  SAFETY_WARNING: 'SAFETY_WARNING',
} as const;

export type PlanStatus = typeof PLAN_STATUS[keyof typeof PLAN_STATUS];
