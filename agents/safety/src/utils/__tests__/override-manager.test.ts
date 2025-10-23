/**
 * Safety Override Manager Comprehensive Tests
 * 
 * PURPOSE: Validate safety override management that ensures all user overrides
 * of safety warnings are properly validated, logged, and tracked for compliance
 * and liability purposes.
 * 
 * COVERAGE TARGET: 90%+ of SafetyOverrideManager class
 * 
 * MARITIME SAFETY & COMPLIANCE CRITICAL: Override management is essential for:
 * 1. Allowing experienced captains to make informed decisions
 * 2. Maintaining complete audit trail for post-incident investigation
 * 3. Preventing unauthorized overrides of critical safety warnings
 * 4. Ensuring liability acceptance and documentation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SafetyOverrideManager, OverrideRequest } from '../override-manager';
import pino from 'pino';

// Mock uuid with sequential IDs for multiple override tests
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: () => `test-override-id-${++uuidCounter}`,
}));

describe('SafetyOverrideManager - COMPLIANCE & AUDIT TRAIL', () => {
  let manager: SafetyOverrideManager;
  let mockLogger: any;

  beforeEach(() => {
    // Reset UUID counter for test isolation
    uuidCounter = 0;
    
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    manager = new SafetyOverrideManager(mockLogger as any);
  });

  // ============================================================================
  // TEST GROUP 1: Override Validation - Non-Overridable Warnings
  // ============================================================================

  describe('Non-Overridable Warning Types', () => {
    it('should reject grounding_imminent override', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_grounding_001',
        warningType: 'grounding_imminent',
        justification: 'I know this area well and have transited many times before'
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.isValid).toBe(false);
      expect(validation.canOverride).toBe(false);
      expect(validation.reason).toContain('cannot be overridden');
      expect(validation.reason).toContain('immediate danger');
    });

    it('should reject collision_course override', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_collision_001',
        warningType: 'collision_course',
        justification: 'I see the other vessel and will take avoiding action'
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.canOverride).toBe(false);
    });

    it('should reject vessel_limits_exceeded override', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_limits_001',
        warningType: 'vessel_limits_exceeded',
        justification: 'The vessel can handle more than the rated limits'
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.canOverride).toBe(false);
    });
  });

  // ============================================================================
  // TEST GROUP 2: Justification Validation
  // ============================================================================

  describe('Justification Requirements', () => {
    it('should reject override without justification', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'weather_advisory',
        justification: ''
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.isValid).toBe(false);
      expect(validation.canOverride).toBe(false);
      expect(validation.reason).toContain('at least 10 characters');
    });

    it('should reject justification that is too short', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'weather_advisory',
        justification: 'Too short' // Only 9 characters
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.canOverride).toBe(false);
      expect(validation.reason).toContain('at least 10 characters');
    });

    it('should accept justification with exactly 10 characters', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'weather_advisory',
        justification: '1234567890' // Exactly 10 characters
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.isValid).toBe(true);
      expect(validation.canOverride).toBe(true);
    });

    it('should accept valid detailed justification', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'weather_advisory',
        justification: 'Weather forecast shows improvement in next 2 hours, current conditions manageable for experienced crew'
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.isValid).toBe(true);
      expect(validation.canOverride).toBe(true);
    });

    it('should trim whitespace when checking justification length', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'weather_advisory',
        justification: '   short   ' // 8 chars after trim
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.canOverride).toBe(false);
    });
  });

  // ============================================================================
  // TEST GROUP 3: Witness Requirements (Critical Warnings)
  // ============================================================================

  describe('Witness Requirements', () => {
    it('should require witness for severe_weather override', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_weather_001',
        warningType: 'severe_weather',
        justification: 'Weather improving and forecast shows clearing conditions'
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.requiresWitness).toBe(true);
      expect(validation.canOverride).toBe(false);
      expect(validation.reason).toContain('requires witness');
    });

    it('should require witness for shallow_water override', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_shallow_001',
        warningType: 'shallow_water',
        justification: 'Familiar with channel, safe at high tide with current depth'
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.requiresWitness).toBe(true);
      expect(validation.canOverride).toBe(false);
    });

    it('should require witness for restricted_area override', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_restricted_001',
        warningType: 'restricted_area',
        justification: 'Permission obtained from harbor master for transit'
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.requiresWitness).toBe(true);
      expect(validation.canOverride).toBe(false);
    });

    it('should accept critical warning with witness', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_weather_001',
        warningType: 'severe_weather',
        justification: 'Experienced crew, favorable forecast trend, safe weather window',
        witnessedBy: 'first_mate_002'
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.isValid).toBe(true);
      expect(validation.canOverride).toBe(true);
      expect(validation.requiresWitness).toBe(true);
    });

    it('should not require witness for non-critical warnings', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_advisory_001',
        warningType: 'weather_advisory',
        justification: 'Minor advisory, conditions acceptable for passage'
      };

      const validation = manager.validateOverride(request);
      
      expect(validation.requiresWitness).toBe(false);
      // Should be valid without witness
      if (validation.isValid) {
        expect(validation.canOverride).toBe(true);
      }
    });
  });

  // ============================================================================
  // TEST GROUP 4: Apply Override (Create and Store)
  // ============================================================================

  describe('Apply Override', () => {
    it('should create and store valid override', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'weather_advisory',
        justification: 'Valid justification with sufficient detail for testing'
      };

      const override = manager.applyOverride(request);
      
      expect(override).toBeDefined();
      expect(override.id).toMatch(/test-override-id-\d+/); // Sequential UUID
      expect(override.userId).toBe('captain_001');
      expect(override.warningId).toBe('warn_test_001');
      expect(override.warningType).toBe('weather_advisory');
      expect(override.justification).toBe(request.justification);
      expect(override.acknowledged).toBe(true);
      expect(override.timestamp).toBeDefined();
    });

    it('should throw error for invalid override', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'grounding_imminent', // Non-overridable
        justification: 'Trying to override non-overridable warning'
      };

      expect(() => manager.applyOverride(request)).toThrow('Override request rejected');
    });

    it('should include witness in override record', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_shallow_001',
        warningType: 'shallow_water',
        justification: 'Local knowledge of channel with adequate clearance at high tide',
        witnessedBy: 'first_mate_002'
      };

      const override = manager.applyOverride(request);
      
      expect(override.witnessedBy).toBe('first_mate_002');
    });

    it('should calculate expiration time correctly', () => {
      const beforeApply = Date.now();
      
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'weather_advisory',
        justification: 'Testing expiration time calculation with detail',
        expirationHours: 24
      };

      const override = manager.applyOverride(request);
      
      expect(override.expiresAt).toBeDefined();
      const expiresAt = new Date(override.expiresAt!).getTime();
      const expectedExpiry = beforeApply + (24 * 60 * 60 * 1000);
      
      // Allow 1 second tolerance for test execution time
      expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should not set expiration if not provided', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'weather_advisory',
        justification: 'Testing no expiration scenario with valid justification'
      };

      const override = manager.applyOverride(request);
      
      expect(override.expiresAt).toBeUndefined();
    });

    it('should log override application', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'weather_advisory',
        justification: 'Testing audit logging with proper justification'
      };

      manager.applyOverride(request);
      
      // Verify warning level log was called
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST GROUP 5: Override Tracking (isWarningOverridden, getOverride)
  // ============================================================================

  describe('Override Tracking', () => {
    it('should track applied overrides', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_test_001',
        warningType: 'weather_advisory',
        justification: 'Testing override tracking with valid justification'
      };

      manager.applyOverride(request);
      
      const isOverridden = manager.isWarningOverridden('warn_test_001');
      expect(isOverridden).toBe(true);
    });

    it('should return false for non-overridden warnings', () => {
      const isOverridden = manager.isWarningOverridden('warn_not_overridden');
      expect(isOverridden).toBe(false);
    });

    it('should retrieve specific override by warning ID', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_retrieve_001',
        warningType: 'weather_advisory',
        justification: 'Testing override retrieval with valid justification'
      };

      manager.applyOverride(request);
      
      const override = manager.getOverride('warn_retrieve_001');
      expect(override).toBeDefined();
      expect(override?.warningId).toBe('warn_retrieve_001');
    });

    it('should return undefined for non-existent override', () => {
      const override = manager.getOverride('warn_does_not_exist');
      expect(override).toBeUndefined();
    });

    it('should get all overrides for specific user', () => {
      const requests: OverrideRequest[] = [
        {
          userId: 'captain_001',
          warningId: 'warn_001',
          warningType: 'weather_advisory',
          justification: 'First override with valid justification'
        },
        {
          userId: 'captain_001',
          warningId: 'warn_002',
          warningType: 'weather_advisory',
          justification: 'Second override with valid justification'
        },
        {
          userId: 'captain_002',
          warningId: 'warn_003',
          warningType: 'weather_advisory',
          justification: 'Different user override with valid justification'
        }
      ];

      requests.forEach(r => manager.applyOverride(r));
      
      const captain001Overrides = manager.getUserOverrides('captain_001');
      expect(captain001Overrides.length).toBe(2);
      expect(captain001Overrides.every(o => o.userId === 'captain_001')).toBe(true);
    });

    it('should return empty array for user with no overrides', () => {
      const overrides = manager.getUserOverrides('captain_no_overrides');
      expect(Array.isArray(overrides)).toBe(true);
      expect(overrides.length).toBe(0);
    });
  });

  // ============================================================================
  // TEST GROUP 6: Expiration Handling
  // ============================================================================

  describe('Expiration Handling', () => {
    it('should recognize non-expired override as active', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_future_001',
        warningType: 'weather_advisory',
        justification: 'Testing future expiration with valid justification',
        expirationHours: 24 // Expires in future
      };

      manager.applyOverride(request);
      
      const isOverridden = manager.isWarningOverridden('warn_future_001');
      expect(isOverridden).toBe(true);
    });

    it('should recognize override without expiration as permanently active', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_permanent_001',
        warningType: 'weather_advisory',
        justification: 'Testing permanent override with valid justification'
        // No expirationHours
      };

      manager.applyOverride(request);
      
      const isOverridden = manager.isWarningOverridden('warn_permanent_001');
      expect(isOverridden).toBe(true);
    });

    it('should cleanup expired overrides', () => {
      // Create override that expires immediately
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_expired_001',
        warningType: 'weather_advisory',
        justification: 'Testing expired override cleanup',
        expirationHours: -1 // Already expired (negative hours)
      };

      manager.applyOverride(request);
      
      // Cleanup expired overrides
      const removedCount = manager.cleanupExpiredOverrides();
      
      expect(removedCount).toBe(1);
    });

    it('should not cleanup active overrides', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_active_001',
        warningType: 'weather_advisory',
        justification: 'Testing active override not cleaned up',
        expirationHours: 24
      };

      manager.applyOverride(request);
      
      const removedCount = manager.cleanupExpiredOverrides();
      
      expect(removedCount).toBe(0);
    });

    it('should log cleanup of expired overrides', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_cleanup_log_001',
        warningType: 'weather_advisory',
        justification: 'Testing cleanup logging',
        expirationHours: -1
      };

      manager.applyOverride(request);
      manager.cleanupExpiredOverrides();
      
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST GROUP 7: Revoke Override
  // ============================================================================

  describe('Revoke Override', () => {
    it('should revoke existing override', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_revoke_001',
        warningType: 'weather_advisory',
        justification: 'Testing override revocation with valid justification'
      };

      const override = manager.applyOverride(request);
      const result = manager.revokeOverride(override.id, 'Conditions changed');
      
      expect(result).toBe(true);
      
      // Should no longer be tracked
      const isOverridden = manager.isWarningOverridden('warn_revoke_001');
      expect(isOverridden).toBe(false);
    });

    it('should return false for non-existent override', () => {
      const result = manager.revokeOverride('non_existent_id', 'Test');
      expect(result).toBe(false);
    });

    it('should log override revocation', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_log_revoke_001',
        warningType: 'weather_advisory',
        justification: 'Testing revocation logging'
      };

      const override = manager.applyOverride(request);
      manager.revokeOverride(override.id, 'Weather deteriorated');
      
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST GROUP 8: Override Statistics (Analytics)
  // ============================================================================

  describe('Override Statistics', () => {
    it('should provide accurate override statistics', () => {
      const requests: OverrideRequest[] = [
        {
          userId: 'captain_001',
          warningId: 'warn_stats_001',
          warningType: 'weather_advisory',
          justification: 'First override for statistics test'
        },
        {
          userId: 'captain_001',
          warningId: 'warn_stats_002',
          warningType: 'weather_advisory',
          justification: 'Second override for statistics test'
        },
        {
          userId: 'captain_002',
          warningId: 'warn_stats_003',
          warningType: 'depth_advisory',
          justification: 'Third override for statistics test'
        }
      ];

      requests.forEach(r => manager.applyOverride(r));
      
      const stats = manager.getOverrideStatistics();
      
      expect(stats.total).toBe(3);
      expect(stats.byType['weather_advisory']).toBe(2);
      expect(stats.byType['depth_advisory']).toBe(1);
    });

    it('should count active vs expired overrides', () => {
      const requests: OverrideRequest[] = [
        {
          userId: 'captain_001',
          warningId: 'warn_active_001',
          warningType: 'weather_advisory',
          justification: 'Active override test',
          expirationHours: 24
        },
        {
          userId: 'captain_001',
          warningId: 'warn_expired_001',
          warningType: 'weather_advisory',
          justification: 'Expired override test',
          expirationHours: -1
        }
      ];

      requests.forEach(r => manager.applyOverride(r));
      
      const stats = manager.getOverrideStatistics();
      
      expect(stats.active).toBeGreaterThan(0);
      expect(stats.expired).toBeGreaterThan(0);
    });

    it('should provide statistics for empty override set', () => {
      const stats = manager.getOverrideStatistics();
      
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.expired).toBe(0);
    });
  });

  // ============================================================================
  // TEST GROUP 9: Export Overrides (Audit Trail)
  // ============================================================================

  describe('Export Overrides', () => {
    it('should export all overrides for audit', () => {
      const requests: OverrideRequest[] = [
        {
          userId: 'captain_001',
          warningId: 'warn_export_001',
          warningType: 'weather_advisory',
          justification: 'First export test override'
        },
        {
          userId: 'captain_002',
          warningId: 'warn_export_002',
          warningType: 'depth_advisory',
          justification: 'Second export test override'
        }
      ];

      requests.forEach(r => manager.applyOverride(r));
      
      const exported = manager.exportOverrides();
      
      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBe(2);
    });

    it('should export empty array when no overrides', () => {
      const exported = manager.exportOverrides();
      
      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBe(0);
    });

    it('should include all override details in export', () => {
      const request: OverrideRequest = {
        userId: 'captain_001',
        warningId: 'warn_export_detail_001',
        warningType: 'weather_advisory',
        justification: 'Complete export detail test',
        witnessedBy: 'first_mate_002',
        expirationHours: 48
      };

      manager.applyOverride(request);
      
      const exported = manager.exportOverrides();
      const override = exported[0];
      
      expect(override.id).toBeDefined();
      expect(override.userId).toBe('captain_001');
      expect(override.warningId).toBe('warn_export_detail_001');
      expect(override.justification).toBe(request.justification);
      expect(override.witnessedBy).toBe('first_mate_002');
      expect(override.expiresAt).toBeDefined();
    });
  });
});

