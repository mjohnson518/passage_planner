/**
 * Safety Audit Logger
 * 
 * SAFETY CRITICAL: Comprehensive audit logging for all safety decisions.
 * Enables investigation of incidents and continuous improvement of safety systems.
 */

import { Logger } from 'pino';
import { SafetyAuditLog, Waypoint, SafetyOverride } from '../../../../shared/src/types/safety';
import { v4 as uuidv4 } from 'uuid';

export class SafetyAuditLogger {
  private logger: Logger;
  private logs: SafetyAuditLog[] = []; // In-memory buffer
  private readonly maxBufferSize = 1000;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Log a route safety analysis
   */
  logRouteAnalysis(
    requestId: string,
    userId: string | undefined,
    route: Waypoint[],
    hazardsFound: number,
    warningsIssued: number,
    safetyScore: string,
    dataSources: string[],
    confidence: string
  ): void {
    const auditLog: SafetyAuditLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userId,
      requestId,
      action: 'route_analyzed',
      details: {
        route,
        hazardsFound,
        warningsIssued,
        safetyScore,
        dataSources,
        confidence,
      },
      result: hazardsFound > 0 ? 'warning' : 'success',
    };

    this.addLog(auditLog);

    // Structured logging
    this.logger.info({
      auditId: auditLog.id,
      action: 'route_analyzed',
      userId,
      requestId,
      waypoints: route.length,
      hazardsFound,
      warningsIssued,
      safetyScore,
      confidence,
    }, 'Route safety analysis completed');
  }

  /**
   * Log a safety warning generation
   */
  logWarningGenerated(
    requestId: string,
    userId: string | undefined,
    warningType: string,
    severity: string,
    location: Waypoint | undefined,
    description: string
  ): void {
    const auditLog: SafetyAuditLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userId,
      requestId,
      action: 'warning_generated',
      details: {
        metadata: {
          warningType,
          severity,
          location,
          description,
        },
      },
      result: severity === 'critical' || severity === 'urgent' ? 'critical' : 'warning',
    };

    this.addLog(auditLog);

    this.logger.warn({
      auditId: auditLog.id,
      action: 'warning_generated',
      userId,
      requestId,
      warningType,
      severity,
      location,
    }, `Safety warning generated: ${description}`);
  }

  /**
   * Log a safety override (when user acknowledges and overrides a warning)
   */
  logOverride(
    requestId: string,
    override: SafetyOverride
  ): void {
    const auditLog: SafetyAuditLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userId: override.userId,
      requestId,
      action: 'override_applied',
      details: {
        overrideInfo: override,
      },
      result: 'critical', // Always log overrides as critical for review
    };

    this.addLog(auditLog);

    this.logger.warn({
      auditId: auditLog.id,
      action: 'override_applied',
      userId: override.userId,
      requestId,
      warningId: override.warningId,
      warningType: override.warningType,
      justification: override.justification,
    }, 'SAFETY OVERRIDE APPLIED - User acknowledged and overrode safety warning');
  }

  /**
   * Log a hazard detection
   */
  logHazardDetected(
    requestId: string,
    userId: string | undefined,
    hazardType: string,
    location: Waypoint,
    severity: string,
    description: string
  ): void {
    const auditLog: SafetyAuditLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userId,
      requestId,
      action: 'hazard_detected',
      details: {
        metadata: {
          hazardType,
          location,
          severity,
          description,
        },
      },
      result: severity === 'critical' ? 'critical' : 'warning',
    };

    this.addLog(auditLog);

    this.logger.warn({
      auditId: auditLog.id,
      action: 'hazard_detected',
      userId,
      requestId,
      hazardType,
      severity,
      location,
    }, `Hazard detected: ${description}`);
  }

  /**
   * Log a safety recommendation
   */
  logRecommendation(
    requestId: string,
    userId: string | undefined,
    recommendationType: string,
    priority: string,
    description: string
  ): void {
    const auditLog: SafetyAuditLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userId,
      requestId,
      action: 'recommendation_made',
      details: {
        metadata: {
          recommendationType,
          priority,
          description,
        },
      },
      result: priority === 'critical' ? 'critical' : 'success',
    };

    this.addLog(auditLog);

    this.logger.info({
      auditId: auditLog.id,
      action: 'recommendation_made',
      userId,
      requestId,
      recommendationType,
      priority,
    }, `Safety recommendation: ${description}`);
  }

  /**
   * Add log to buffer
   */
  private addLog(log: SafetyAuditLog): void {
    this.logs.push(log);

    // Prevent memory leaks by limiting buffer size
    if (this.logs.length > this.maxBufferSize) {
      this.logs = this.logs.slice(-this.maxBufferSize);
    }

    // In production, would also persist to database
  }

  /**
   * Get recent logs (for debugging/analysis)
   */
  getRecentLogs(count: number = 100): SafetyAuditLog[] {
    return this.logs.slice(-count);
  }

  /**
   * Get logs for a specific request
   */
  getLogsByRequestId(requestId: string): SafetyAuditLog[] {
    return this.logs.filter(log => log.requestId === requestId);
  }

  /**
   * Get critical logs (overrides and critical warnings)
   */
  getCriticalLogs(count: number = 50): SafetyAuditLog[] {
    return this.logs
      .filter(log => log.result === 'critical')
      .slice(-count);
  }

  /**
   * Export logs for analysis (would write to file or database in production)
   */
  exportLogs(): SafetyAuditLog[] {
    return [...this.logs];
  }

  /**
   * Clear logs (use with caution, typically for testing only)
   */
  clearLogs(): void {
    this.logs = [];
    this.logger.info('Safety audit logs cleared');
  }
}

