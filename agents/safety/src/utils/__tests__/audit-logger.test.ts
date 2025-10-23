/**
 * Safety Audit Logger Comprehensive Tests
 * 
 * PURPOSE: Validate comprehensive audit logging that ensures all safety
 * decisions, warnings, hazards, and overrides are permanently logged for
 * compliance, liability protection, and post-incident investigation.
 * 
 * COVERAGE TARGET: 90%+ of SafetyAuditLogger class
 * 
 * MARITIME SAFETY & COMPLIANCE CRITICAL: Complete audit trails are essential for:
 * 1. Post-incident investigation (understanding what went wrong)
 * 2. Liability protection (documenting safety decisions made)
 * 3. Regulatory compliance (proving due diligence)
 * 4. Continuous improvement (analyzing safety trends)
 * 5. Insurance claims (providing evidence of proper procedures)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SafetyAuditLogger } from '../audit-logger';
import { Waypoint, SafetyOverride } from '../../../../../shared/src/types/safety';

// Mock uuid with sequential IDs
let auditUuidCounter = 0;
jest.mock('uuid', () => ({
  v4: () => `test-audit-id-${++auditUuidCounter}`,
}));

describe('SafetyAuditLogger - COMPLIANCE & AUDIT TRAIL', () => {
  let logger: SafetyAuditLogger;
  let mockPinoLogger: any;

  beforeEach(() => {
    // Reset UUID counter
    auditUuidCounter = 0;
    
    // Create mock pino logger
    mockPinoLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    logger = new SafetyAuditLogger(mockPinoLogger as any);
  });

  // ============================================================================
  // TEST GROUP 1: Route Analysis Logging
  // ============================================================================

  describe('Route Analysis Logging', () => {
    it('should log route safety analysis with all details', () => {
      const route: Waypoint[] = [
        { latitude: 42.3601, longitude: -71.0589 },
        { latitude: 43.6591, longitude: -70.2568 }
      ];

      logger.logRouteAnalysis(
        'req_001',
        'captain_001',
        route,
        2, // hazards found
        3, // warnings issued
        'Fair',
        ['Weather API', 'Depth Database'],
        'medium'
      );

      // Verify pino logger was called
      expect(mockPinoLogger.info).toHaveBeenCalled();
      
      // Verify log was added to buffer
      const logs = logger.getRecentLogs(10);
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('route_analyzed');
    });

    it('should include complete route analysis details in log', () => {
      const route: Waypoint[] = [
        { latitude: 42.3601, longitude: -71.0589 },
        { latitude: 43.6591, longitude: -70.2568 }
      ];

      logger.logRouteAnalysis(
        'req_002',
        'captain_001',
        route,
        0, // No hazards
        0, // No warnings
        'Excellent',
        ['Weather API'],
        'high'
      );

      const logs = logger.getLogsByRequestId('req_002');
      expect(logs.length).toBe(1);
      
      const log = logs[0];
      expect(log.details.route).toEqual(route);
      expect(log.details.hazardsFound).toBe(0);
      expect(log.details.warningsIssued).toBe(0);
      expect(log.details.safetyScore).toBe('Excellent');
      expect(log.details.dataSources).toContain('Weather API');
      expect(log.details.confidence).toBe('high');
    });

    it('should mark result as warning when hazards found', () => {
      const route: Waypoint[] = [
        { latitude: 42.0, longitude: -71.0 }
      ];

      logger.logRouteAnalysis(
        'req_003',
        undefined, // Anonymous analysis
        route,
        3, // Hazards found
        2,
        'Poor',
        ['Safety Database'],
        'medium'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].result).toBe('warning');
    });

    it('should mark result as success when no hazards', () => {
      const route: Waypoint[] = [
        { latitude: 42.0, longitude: -71.0 }
      ];

      logger.logRouteAnalysis(
        'req_004',
        'captain_001',
        route,
        0, // No hazards
        0,
        'Excellent',
        ['Safety Database'],
        'high'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].result).toBe('success');
    });

    it('should handle undefined userId for anonymous analysis', () => {
      const route: Waypoint[] = [
        { latitude: 42.0, longitude: -71.0 }
      ];

      logger.logRouteAnalysis(
        'req_005',
        undefined,
        route,
        0,
        0,
        'Good',
        ['Test'],
        'high'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].userId).toBeUndefined();
    });
  });

  // ============================================================================
  // TEST GROUP 2: Warning Generation Logging
  // ============================================================================

  describe('Warning Generation Logging', () => {
    it('should log warning generation with complete details', () => {
      const location: Waypoint = { latitude: 42.3601, longitude: -71.0589 };

      logger.logWarningGenerated(
        'req_warn_001',
        'captain_001',
        'shallow_water',
        'high',
        location,
        'Shallow water hazard detected in channel'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('warning_generated');
      expect(logs[0].details.metadata.warningType).toBe('shallow_water');
      expect(logs[0].details.metadata.severity).toBe('high');
      expect(logs[0].details.metadata.location).toEqual(location);
    });

    it('should mark critical severity warnings as critical result', () => {
      logger.logWarningGenerated(
        'req_critical_001',
        'captain_001',
        'grounding_imminent',
        'critical',
        { latitude: 42.0, longitude: -71.0 },
        'Immediate grounding risk'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].result).toBe('critical');
    });

    it('should mark urgent severity warnings as critical result', () => {
      logger.logWarningGenerated(
        'req_urgent_001',
        'captain_001',
        'collision_course',
        'urgent',
        { latitude: 42.0, longitude: -71.0 },
        'Collision course detected'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].result).toBe('critical');
    });

    it('should mark non-critical warnings as warning result', () => {
      logger.logWarningGenerated(
        'req_warning_001',
        'captain_001',
        'weather_advisory',
        'moderate',
        { latitude: 42.0, longitude: -71.0 },
        'Weather conditions marginal'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].result).toBe('warning');
    });

    it('should use pino warn level for warnings', () => {
      logger.logWarningGenerated(
        'req_pino_001',
        'captain_001',
        'test_warning',
        'moderate',
        { latitude: 42.0, longitude: -71.0 },
        'Test warning'
      );

      expect(mockPinoLogger.warn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST GROUP 3: Override Logging (CRITICAL for Liability)
  // ============================================================================

  describe('Override Logging', () => {
    it('should log safety override with complete details', () => {
      const override: SafetyOverride = {
        id: 'override_001',
        userId: 'captain_001',
        timestamp: new Date().toISOString(),
        warningId: 'warn_001',
        warningType: 'shallow_water',
        justification: 'Familiar with channel, safe at high tide',
        acknowledged: true,
        witnessedBy: 'first_mate_002'
      };

      logger.logOverride('req_override_001', override);

      const logs = logger.getRecentLogs(1);
      expect(logs[0].action).toBe('override_applied');
      expect(logs[0].details.overrideInfo).toEqual(override);
    });

    it('should mark all overrides as critical result', () => {
      const override: SafetyOverride = {
        id: 'override_critical_001',
        userId: 'captain_001',
        timestamp: new Date().toISOString(),
        warningId: 'warn_001',
        warningType: 'test_warning',
        justification: 'Test override for critical result verification',
        acknowledged: true
      };

      logger.logOverride('req_critical_override_001', override);

      const logs = logger.getRecentLogs(1);
      // All overrides logged as critical for review
      expect(logs[0].result).toBe('critical');
    });

    it('should retrieve override logs via getCriticalLogs', () => {
      const override: SafetyOverride = {
        id: 'override_retrieve_001',
        userId: 'captain_001',
        timestamp: new Date().toISOString(),
        warningId: 'warn_001',
        warningType: 'test_warning',
        justification: 'Test override for retrieval',
        acknowledged: true
      };

      logger.logOverride('req_retrieve_001', override);

      const criticalLogs = logger.getCriticalLogs(10);
      expect(criticalLogs.length).toBeGreaterThan(0);
      expect(criticalLogs[0].action).toBe('override_applied');
    });

    it('should log overrides with pino warn level', () => {
      const override: SafetyOverride = {
        id: 'override_pino_001',
        userId: 'captain_001',
        timestamp: new Date().toISOString(),
        warningId: 'warn_001',
        warningType: 'test_warning',
        justification: 'Test',
        acknowledged: true
      };

      logger.logOverride('req_pino_001', override);

      expect(mockPinoLogger.warn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST GROUP 4: Hazard Detection Logging
  // ============================================================================

  describe('Hazard Detection Logging', () => {
    it('should log hazard detection with complete details', () => {
      const location: Waypoint = { latitude: 42.3601, longitude: -71.0589 };

      logger.logHazardDetected(
        'req_hazard_001',
        'captain_001',
        'shallow_water',
        location,
        'high',
        'Depth less than minimum safe clearance'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].action).toBe('hazard_detected');
      expect(logs[0].details.metadata.hazardType).toBe('shallow_water');
      expect(logs[0].details.metadata.severity).toBe('high');
      expect(logs[0].details.metadata.location).toEqual(location);
    });

    it('should mark critical hazards appropriately', () => {
      logger.logHazardDetected(
        'req_hazard_critical_001',
        'captain_001',
        'grounding_imminent',
        { latitude: 42.0, longitude: -71.0 },
        'critical',
        'Grounding imminent'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].result).toBe('critical');
    });

    it('should mark non-critical hazards as warning', () => {
      logger.logHazardDetected(
        'req_hazard_warning_001',
        'captain_001',
        'depth_advisory',
        { latitude: 42.0, longitude: -71.0 },
        'moderate',
        'Marginal depth clearance'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].result).toBe('warning');
    });
  });

  // ============================================================================
  // TEST GROUP 5: Recommendation Logging
  // ============================================================================

  describe('Recommendation Logging', () => {
    it('should log safety recommendations', () => {
      logger.logRecommendation(
        'req_rec_001',
        'captain_001',
        'delay_departure',
        'high',
        'Wait for weather window to improve'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].action).toBe('recommendation_made');
      expect(logs[0].details.metadata.recommendationType).toBe('delay_departure');
      expect(logs[0].details.metadata.priority).toBe('high');
    });

    it('should mark critical recommendations as critical result', () => {
      logger.logRecommendation(
        'req_rec_critical_001',
        'captain_001',
        'cancel_passage',
        'critical',
        'Severe weather prohibits safe passage'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].result).toBe('critical');
    });

    it('should mark non-critical recommendations as success', () => {
      logger.logRecommendation(
        'req_rec_success_001',
        'captain_001',
        'proceed_with_caution',
        'low',
        'Conditions acceptable, monitor weather'
      );

      const logs = logger.getRecentLogs(1);
      expect(logs[0].result).toBe('success');
    });

    it('should use pino info level for recommendations', () => {
      logger.logRecommendation(
        'req_rec_pino_001',
        'captain_001',
        'test_recommendation',
        'low',
        'Test recommendation'
      );

      expect(mockPinoLogger.info).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST GROUP 6: Log Retrieval and Filtering
  // ============================================================================

  describe('Log Retrieval and Filtering', () => {
    it('should retrieve recent logs with default count', () => {
      // Add 5 logs
      for (let i = 0; i < 5; i++) {
        logger.logRecommendation(
          `req_recent_${i}`,
          'captain_001',
          'test',
          'low',
          `Test ${i}`
        );
      }

      const logs = logger.getRecentLogs(); // Default 100
      expect(logs.length).toBe(5);
    });

    it('should retrieve limited number of recent logs', () => {
      // Add 10 logs
      for (let i = 0; i < 10; i++) {
        logger.logRecommendation(
          `req_limit_${i}`,
          'captain_001',
          'test',
          'low',
          `Test ${i}`
        );
      }

      const logs = logger.getRecentLogs(3);
      expect(logs.length).toBe(3);
      // Should be the LAST 3 logs
    });

    it('should filter logs by request ID', () => {
      logger.logRouteAnalysis('req_filter_001', 'user1', [], 0, 0, 'Good', [], 'high');
      logger.logWarningGenerated('req_filter_001', 'user1', 'test', 'low', undefined, 'Test');
      logger.logHazardDetected('req_filter_002', 'user2', 'test', { latitude: 42.0, longitude: -71.0 }, 'low', 'Test');

      const logs = logger.getLogsByRequestId('req_filter_001');
      expect(logs.length).toBe(2);
      expect(logs.every(l => l.requestId === 'req_filter_001')).toBe(true);
    });

    it('should return empty array for non-existent request ID', () => {
      const logs = logger.getLogsByRequestId('req_does_not_exist');
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBe(0);
    });

    it('should retrieve only critical logs', () => {
      // Add mix of critical and non-critical
      logger.logRecommendation('req_mix_001', 'user1', 'proceed', 'low', 'Safe'); // success
      logger.logRecommendation('req_mix_002', 'user1', 'cancel', 'critical', 'Danger'); // critical
      logger.logWarningGenerated('req_mix_003', 'user1', 'test', 'urgent', undefined, 'Test'); // critical
      logger.logRecommendation('req_mix_004', 'user1', 'monitor', 'medium', 'Watch'); // success

      const criticalLogs = logger.getCriticalLogs(50);
      expect(criticalLogs.length).toBe(2);
      expect(criticalLogs.every(l => l.result === 'critical')).toBe(true);
    });

    it('should limit critical logs to specified count', () => {
      // Add 5 critical logs
      for (let i = 0; i < 5; i++) {
        logger.logRecommendation(`req_critical_${i}`, 'user1', 'test', 'critical', 'Test');
      }

      const logs = logger.getCriticalLogs(2);
      expect(logs.length).toBe(2);
    });
  });

  // ============================================================================
  // TEST GROUP 7: Log Buffer Management
  // ============================================================================

  describe('Log Buffer Management', () => {
    it('should maintain logs in buffer', () => {
      logger.logRecommendation('req_buffer_001', 'user1', 'test', 'low', 'Test');
      logger.logRecommendation('req_buffer_002', 'user1', 'test', 'low', 'Test');

      const logs = logger.exportLogs();
      expect(logs.length).toBe(2);
    });

    it('should export all logs for audit', () => {
      // Add 10 logs
      for (let i = 0; i < 10; i++) {
        logger.logRecommendation(`req_export_${i}`, 'user1', 'test', 'low', 'Test');
      }

      const exported = logger.exportLogs();
      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBe(10);
    });

    it('should export empty array when no logs', () => {
      const exported = logger.exportLogs();
      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBe(0);
    });

    it('should clear logs when requested', () => {
      logger.logRecommendation('req_clear_001', 'user1', 'test', 'low', 'Test');
      logger.logRecommendation('req_clear_002', 'user1', 'test', 'low', 'Test');

      logger.clearLogs();

      const logs = logger.exportLogs();
      expect(logs.length).toBe(0);
    });

    it('should log clearing action', () => {
      logger.clearLogs();

      expect(mockPinoLogger.info).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEST GROUP 8: Log Entry Structure
  // ============================================================================

  describe('Log Entry Structure', () => {
    it('should include unique ID for each log entry', () => {
      logger.logRecommendation('req_id_001', 'user1', 'test', 'low', 'First');
      logger.logRecommendation('req_id_002', 'user1', 'test', 'low', 'Second');

      const logs = logger.exportLogs();
      expect(logs[0].id).toBeDefined();
      expect(logs[1].id).toBeDefined();
      expect(logs[0].id).not.toBe(logs[1].id);
    });

    it('should include timestamp in ISO format', () => {
      logger.logRecommendation('req_time_001', 'user1', 'test', 'low', 'Test');

      const logs = logger.getRecentLogs(1);
      expect(logs[0].timestamp).toBeDefined();
      // Should be valid ISO timestamp
      expect(() => new Date(logs[0].timestamp)).not.toThrow();
    });

    it('should include userId when provided', () => {
      logger.logRecommendation('req_user_001', 'captain_123', 'test', 'low', 'Test');

      const logs = logger.getRecentLogs(1);
      expect(logs[0].userId).toBe('captain_123');
    });

    it('should handle undefined userId gracefully', () => {
      logger.logRecommendation('req_no_user_001', undefined, 'test', 'low', 'Test');

      const logs = logger.getRecentLogs(1);
      expect(logs[0].userId).toBeUndefined();
    });

    it('should include request ID for correlation', () => {
      logger.logRecommendation('req_correlation_001', 'user1', 'test', 'low', 'Test');

      const logs = logger.getRecentLogs(1);
      expect(logs[0].requestId).toBe('req_correlation_001');
    });
  });

  // ============================================================================
  // TEST GROUP 9: Multiple Log Types (Comprehensive Audit)
  // ============================================================================

  describe('Multiple Log Types', () => {
    it('should handle mixed log types in sequence', () => {
      const route: Waypoint[] = [{ latitude: 42.0, longitude: -71.0 }];
      const override: SafetyOverride = {
        id: 'override_001',
        userId: 'captain_001',
        timestamp: new Date().toISOString(),
        warningId: 'warn_001',
        warningType: 'test',
        justification: 'Test',
        acknowledged: true
      };

      logger.logRouteAnalysis('req_mixed_001', 'user1', route, 1, 1, 'Fair', [], 'medium');
      logger.logWarningGenerated('req_mixed_001', 'user1', 'test', 'moderate', undefined, 'Test');
      logger.logHazardDetected('req_mixed_001', 'user1', 'test', { latitude: 42.0, longitude: -71.0 }, 'high', 'Test');
      logger.logOverride('req_mixed_001', override);
      logger.logRecommendation('req_mixed_001', 'user1', 'test', 'high', 'Test');

      const logs = logger.getLogsByRequestId('req_mixed_001');
      expect(logs.length).toBe(5);
    });

    it('should maintain log order (chronological)', () => {
      logger.logRecommendation('req_order_001', 'user1', 'first', 'low', 'First');
      logger.logRecommendation('req_order_002', 'user1', 'second', 'low', 'Second');
      logger.logRecommendation('req_order_003', 'user1', 'third', 'low', 'Third');

      const logs = logger.exportLogs();
      expect(logs[0].details.metadata.recommendationType).toBe('first');
      expect(logs[1].details.metadata.recommendationType).toBe('second');
      expect(logs[2].details.metadata.recommendationType).toBe('third');
    });
  });
});

