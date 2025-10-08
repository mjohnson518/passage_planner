/**
 * Safety Override Manager
 * 
 * SAFETY CRITICAL: Manages user overrides of safety warnings.
 * All overrides are logged for audit trail and potential incident investigation.
 */

import { SafetyOverride } from '../../../../shared/src/types/safety';
import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface OverrideRequest {
  userId: string;
  warningId: string;
  warningType: string;
  justification: string;
  witnessedBy?: string;
  expirationHours?: number;
}

export interface OverrideValidation {
  isValid: boolean;
  canOverride: boolean;
  reason: string;
  requiresWitness: boolean;
  requiresAdditionalApproval: boolean;
}

export class SafetyOverrideManager {
  private overrides: Map<string, SafetyOverride> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Validate if a safety warning can be overridden
   * Some critical warnings should not be overridable
   */
  validateOverride(request: OverrideRequest): OverrideValidation {
    // Certain warning types should never be overridden
    const nonOverridableTypes = [
      'grounding_imminent',
      'collision_course',
      'vessel_limits_exceeded',
    ];

    if (nonOverridableTypes.includes(request.warningType)) {
      return {
        isValid: false,
        canOverride: false,
        reason: `Warning type '${request.warningType}' cannot be overridden due to immediate danger to vessel and crew.`,
        requiresWitness: false,
        requiresAdditionalApproval: false,
      };
    }

    // Check if justification is provided and adequate
    if (!request.justification || request.justification.trim().length < 10) {
      return {
        isValid: false,
        canOverride: false,
        reason: 'Justification must be at least 10 characters and explain the override decision.',
        requiresWitness: false,
        requiresAdditionalApproval: false,
      };
    }

    // Critical warnings require witness confirmation
    const criticalTypes = [
      'severe_weather',
      'shallow_water',
      'restricted_area',
    ];

    const requiresWitness = criticalTypes.includes(request.warningType);
    
    if (requiresWitness && !request.witnessedBy) {
      return {
        isValid: false,
        canOverride: false,
        reason: `Warning type '${request.warningType}' requires witness confirmation from another crew member.`,
        requiresWitness: true,
        requiresAdditionalApproval: false,
      };
    }

    // Override is valid
    return {
      isValid: true,
      canOverride: true,
      reason: 'Override request meets all requirements.',
      requiresWitness,
      requiresAdditionalApproval: false,
    };
  }

  /**
   * Apply a safety override
   */
  applyOverride(request: OverrideRequest): SafetyOverride {
    // Validate the override first
    const validation = this.validateOverride(request);

    if (!validation.isValid || !validation.canOverride) {
      throw new Error(`Override request rejected: ${validation.reason}`);
    }

    // Create override record
    const override: SafetyOverride = {
      id: uuidv4(),
      userId: request.userId,
      timestamp: new Date().toISOString(),
      warningId: request.warningId,
      warningType: request.warningType,
      justification: request.justification,
      acknowledged: true,
      witnessedBy: request.witnessedBy,
      expiresAt: request.expirationHours 
        ? new Date(Date.now() + request.expirationHours * 60 * 60 * 1000).toISOString()
        : undefined,
    };

    // Store override
    this.overrides.set(override.id, override);

    // Log the override (CRITICAL logging)
    this.logger.warn({
      overrideId: override.id,
      userId: override.userId,
      warningId: override.warningId,
      warningType: override.warningType,
      justification: override.justification,
      witnessedBy: override.witnessedBy,
      timestamp: override.timestamp,
    }, '⚠️ SAFETY OVERRIDE APPLIED - User has acknowledged and overridden safety warning');

    return override;
  }

  /**
   * Check if a warning has been overridden
   */
  isWarningOverridden(warningId: string): boolean {
    for (const override of this.overrides.values()) {
      if (override.warningId === warningId && override.acknowledged) {
        // Check if override has expired
        if (override.expiresAt) {
          if (new Date(override.expiresAt) > new Date()) {
            return true;
          }
        } else {
          return true; // No expiration
        }
      }
    }
    return false;
  }

  /**
   * Get override for a specific warning
   */
  getOverride(warningId: string): SafetyOverride | undefined {
    for (const override of this.overrides.values()) {
      if (override.warningId === warningId) {
        return override;
      }
    }
    return undefined;
  }

  /**
   * Get all overrides for a user
   */
  getUserOverrides(userId: string): SafetyOverride[] {
    return Array.from(this.overrides.values())
      .filter(o => o.userId === userId);
  }

  /**
   * Revoke an override
   */
  revokeOverride(overrideId: string, reason: string): boolean {
    const override = this.overrides.get(overrideId);
    
    if (!override) {
      return false;
    }

    this.overrides.delete(overrideId);

    this.logger.info({
      overrideId,
      warningId: override.warningId,
      reason,
    }, 'Safety override revoked');

    return true;
  }

  /**
   * Get statistics on overrides (for safety analysis)
   */
  getOverrideStatistics(): {
    total: number;
    byType: Record<string, number>;
    expired: number;
    active: number;
  } {
    const stats = {
      total: this.overrides.size,
      byType: {} as Record<string, number>,
      expired: 0,
      active: 0,
    };

    const now = new Date();

    for (const override of this.overrides.values()) {
      // Count by type
      stats.byType[override.warningType] = (stats.byType[override.warningType] || 0) + 1;

      // Count expired vs active
      if (override.expiresAt && new Date(override.expiresAt) < now) {
        stats.expired++;
      } else {
        stats.active++;
      }
    }

    return stats;
  }

  /**
   * Export overrides for analysis (would write to database in production)
   */
  exportOverrides(): SafetyOverride[] {
    return Array.from(this.overrides.values());
  }

  /**
   * Clear expired overrides (periodic cleanup)
   */
  cleanupExpiredOverrides(): number {
    const now = new Date();
    let removed = 0;

    for (const [id, override] of this.overrides.entries()) {
      if (override.expiresAt && new Date(override.expiresAt) < now) {
        this.overrides.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.info({ removed }, 'Cleaned up expired safety overrides');
    }

    return removed;
  }
}

