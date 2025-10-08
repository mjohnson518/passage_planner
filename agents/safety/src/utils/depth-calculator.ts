/**
 * Depth Calculator Utility
 * 
 * SAFETY CRITICAL: Calculates water depth with safety margins to prevent grounding.
 * All calculations use conservative estimates to prioritize vessel safety.
 */

import { Waypoint, DepthCalculation } from '../../../../shared/src/types/safety';

export interface DepthCalculatorConfig {
  minimumClearancePercent: number; // Default: 20% of draft
  minimumAbsoluteClearance: number; // Minimum in feet, regardless of draft
  chartDatumAdjustment: number; // Adjustment from chart datum to MLW if needed
}

export class DepthCalculator {
  private config: DepthCalculatorConfig;

  constructor(config?: Partial<DepthCalculatorConfig>) {
    this.config = {
      minimumClearancePercent: config?.minimumClearancePercent ?? 20,
      minimumAbsoluteClearance: config?.minimumAbsoluteClearance ?? 2.0,
      chartDatumAdjustment: config?.chartDatumAdjustment ?? 0,
      ...config,
    };
  }

  /**
   * Calculate if a location presents a grounding risk
   * 
   * @param location - Geographic location
   * @param chartedDepth - Depth from chart in feet (at MLW or chart datum)
   * @param vesselDraft - Vessel draft in feet
   * @param tidalHeight - Tidal height adjustment in feet (positive above datum, negative below)
   * @returns DepthCalculation with grounding risk assessment
   */
  calculateDepthSafety(
    location: Waypoint,
    chartedDepth: number,
    vesselDraft: number,
    tidalHeight: number = 0
  ): DepthCalculation {
    // Validate inputs
    if (chartedDepth < 0) {
      throw new Error(`Invalid charted depth: ${chartedDepth}. Must be non-negative.`);
    }
    if (vesselDraft <= 0) {
      throw new Error(`Invalid vessel draft: ${vesselDraft}. Must be positive.`);
    }

    // Calculate actual depth at time of passage
    const tidalAdjustment = tidalHeight + this.config.chartDatumAdjustment;
    const actualDepth = chartedDepth + tidalAdjustment;

    // Calculate required minimum clearance (use greater of percent or absolute)
    const percentClearance = vesselDraft * (this.config.minimumClearancePercent / 100);
    const minimumClearance = Math.max(percentClearance, this.config.minimumAbsoluteClearance);

    // Calculate available clearance
    const clearanceAvailable = actualDepth - vesselDraft;

    // Determine if grounding risk exists
    const isGroundingRisk = clearanceAvailable < minimumClearance;

    // Assess severity
    let severity: 'critical' | 'high' | 'moderate' | 'safe';
    let recommendation: string;

    if (clearanceAvailable < 0) {
      severity = 'critical';
      recommendation = `CRITICAL: Vessel will ground! Charted depth (${chartedDepth.toFixed(1)}ft + ${tidalAdjustment.toFixed(1)}ft tide = ${actualDepth.toFixed(1)}ft) is less than vessel draft (${vesselDraft.toFixed(1)}ft). DO NOT PROCEED.`;
    } else if (clearanceAvailable < 1.0) {
      severity = 'critical';
      recommendation = `CRITICAL: Only ${clearanceAvailable.toFixed(1)}ft clearance under keel. Extreme grounding risk. Divert immediately or wait for higher tide.`;
    } else if (clearanceAvailable < minimumClearance) {
      severity = 'high';
      recommendation = `HIGH RISK: Clearance ${clearanceAvailable.toFixed(1)}ft is below recommended minimum ${minimumClearance.toFixed(1)}ft. Exercise extreme caution. Consider waiting for higher tide or alternative route.`;
    } else if (clearanceAvailable < minimumClearance * 1.5) {
      severity = 'moderate';
      recommendation = `CAUTION: Clearance ${clearanceAvailable.toFixed(1)}ft is adequate but monitor depth closely. Maintain precise navigation.`;
    } else {
      severity = 'safe';
      recommendation = `Safe depth: ${clearanceAvailable.toFixed(1)}ft clearance under keel.`;
    }

    return {
      location,
      chartedDepth,
      tidalAdjustment,
      actualDepth,
      vesselDraft,
      minimumClearance,
      clearanceAvailable,
      isGroundingRisk,
      severity,
      recommendation,
    };
  }

  /**
   * Calculate minimum safe depth required for vessel
   */
  calculateMinimumSafeDepth(vesselDraft: number): number {
    const percentClearance = vesselDraft * (this.config.minimumClearancePercent / 100);
    const minimumClearance = Math.max(percentClearance, this.config.minimumAbsoluteClearance);
    return vesselDraft + minimumClearance;
  }

  /**
   * Adjust safety margins based on crew experience
   * Less experienced crews get larger safety margins
   */
  adjustForCrewExperience(
    baseClearance: number,
    experienceLevel: 'novice' | 'intermediate' | 'advanced' | 'professional'
  ): number {
    const multipliers = {
      novice: 1.5, // 50% more clearance
      intermediate: 1.2, // 20% more clearance
      advanced: 1.0, // Standard clearance
      professional: 0.9, // Professionals can use slightly less
    };

    return baseClearance * multipliers[experienceLevel];
  }

  /**
   * Check if depth is adequate at low water
   * Conservative check using lowest predicted tide
   */
  checkAtLowWater(
    chartedDepth: number,
    vesselDraft: number,
    lowestTide: number
  ): boolean {
    const depthAtLowWater = chartedDepth + lowestTide;
    const minimumRequired = this.calculateMinimumSafeDepth(vesselDraft);
    return depthAtLowWater >= minimumRequired;
  }
}

