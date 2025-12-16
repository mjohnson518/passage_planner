/**
 * Safety Audit Logger
 *
 * SAFETY CRITICAL: Comprehensive audit logging for all safety decisions.
 * Enables investigation of incidents and continuous improvement of safety systems.
 *
 * Logs are persisted to PostgreSQL for:
 * - Maritime incident investigation compliance
 * - Safety pattern analysis
 * - Regulatory audit trails
 */

import { Logger } from 'pino';
import { Pool } from 'pg';
import { SafetyAuditLog, Waypoint, SafetyOverride } from '../../../../shared/src/types/safety';
import { v4 as uuidv4 } from 'uuid';

// Database pool - can be initialized for persistence
let dbPool: Pool | null = null;

/**
 * Initialize the audit logger with database persistence
 * Call this at application startup to enable database logging
 */
export function initializeAuditLoggerDatabase(pool: Pool): void {
  dbPool = pool;
}

export class SafetyAuditLogger {
  private logger: Logger;
  private logs: SafetyAuditLog[] = []; // In-memory buffer for fast access
  private readonly maxBufferSize = 1000;
  private pendingWrites: Promise<void>[] = []; // Track pending DB writes

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
   * Log data source usage for traceability
   * SAFETY CRITICAL: Tracks where safety-critical data comes from for incident investigation
   */
  logDataSource(
    requestId: string,
    dataType: string,
    source: string,
    confidence: string,
    location?: Waypoint
  ): void {
    const auditLog: SafetyAuditLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userId: undefined,
      requestId,
      action: 'data_source_used',
      details: {
        metadata: {
          dataType,
          source,
          confidence,
          location,
        },
      },
      result: confidence === 'unknown' || confidence === 'low' ? 'warning' : 'success',
    };

    this.addLog(auditLog);

    // Log at appropriate level based on confidence
    if (confidence === 'unknown' || confidence === 'low') {
      this.logger.warn({
        auditId: auditLog.id,
        action: 'data_source_used',
        requestId,
        dataType,
        source,
        confidence,
        location,
      }, `Low confidence data source used: ${source} for ${dataType}`);
    } else {
      this.logger.debug({
        auditId: auditLog.id,
        action: 'data_source_used',
        requestId,
        dataType,
        source,
        confidence,
        location,
      }, `Data source used: ${source} for ${dataType}`);
    }
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
   * Add log to buffer and persist to database
   * SAFETY CRITICAL: Audit logs must be persisted for incident investigation
   */
  private addLog(log: SafetyAuditLog): void {
    this.logs.push(log);

    // Prevent memory leaks by limiting buffer size
    if (this.logs.length > this.maxBufferSize) {
      this.logs = this.logs.slice(-this.maxBufferSize);
    }

    // Persist to database asynchronously (don't block the safety check)
    if (dbPool) {
      const writePromise = this.persistLogToDatabase(log);
      this.pendingWrites.push(writePromise);

      // Clean up completed writes
      writePromise.finally(() => {
        const index = this.pendingWrites.indexOf(writePromise);
        if (index > -1) {
          this.pendingWrites.splice(index, 1);
        }
      });
    }
  }

  /**
   * Persist a single audit log to the database
   * Non-blocking to ensure safety checks aren't delayed
   */
  private async persistLogToDatabase(log: SafetyAuditLog): Promise<void> {
    if (!dbPool) {
      return;
    }

    try {
      await dbPool.query(
        `INSERT INTO safety_audit_logs (
          id, timestamp, user_id, request_id, action, details, result, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          log.id,
          log.timestamp,
          log.userId || null,
          log.requestId,
          log.action,
          JSON.stringify(log.details),
          log.result,
          log.metadata ? JSON.stringify(log.metadata) : null,
        ]
      );
    } catch (error) {
      // Log error but don't throw - audit logging failure shouldn't break safety checks
      this.logger.error(
        { error, logId: log.id, action: log.action },
        'Failed to persist safety audit log to database'
      );
    }
  }

  /**
   * Wait for all pending database writes to complete
   * Use before shutdown to ensure all logs are persisted
   */
  async flushPendingWrites(): Promise<void> {
    await Promise.all(this.pendingWrites);
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
   * Export logs for analysis (from memory buffer)
   */
  exportLogs(): SafetyAuditLog[] {
    return [...this.logs];
  }

  /**
   * Query logs from database by request ID
   * SAFETY CRITICAL: Used for incident investigation
   */
  async queryLogsByRequestId(requestId: string): Promise<SafetyAuditLog[]> {
    if (!dbPool) {
      // Fall back to in-memory logs
      return this.getLogsByRequestId(requestId);
    }

    try {
      const result = await dbPool.query(
        `SELECT id, timestamp, user_id, request_id, action, details, result, metadata
         FROM safety_audit_logs
         WHERE request_id = $1
         ORDER BY timestamp ASC`,
        [requestId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.user_id,
        requestId: row.request_id,
        action: row.action,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
        result: row.result,
        metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
      }));
    } catch (error) {
      this.logger.error({ error, requestId }, 'Failed to query audit logs from database');
      // Fall back to in-memory logs
      return this.getLogsByRequestId(requestId);
    }
  }

  /**
   * Query critical logs from database (overrides and critical warnings)
   * Used for safety review and compliance reporting
   */
  async queryCriticalLogs(
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<SafetyAuditLog[]> {
    if (!dbPool) {
      return this.getCriticalLogs(limit);
    }

    try {
      const result = await dbPool.query(
        `SELECT id, timestamp, user_id, request_id, action, details, result, metadata
         FROM safety_audit_logs
         WHERE result = 'critical'
           AND timestamp >= $1
           AND timestamp <= $2
         ORDER BY timestamp DESC
         LIMIT $3`,
        [startDate.toISOString(), endDate.toISOString(), limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.user_id,
        requestId: row.request_id,
        action: row.action,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
        result: row.result,
        metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
      }));
    } catch (error) {
      this.logger.error({ error, startDate, endDate }, 'Failed to query critical logs from database');
      return this.getCriticalLogs(limit);
    }
  }

  /**
   * Query all safety overrides for compliance reporting
   * REGULATORY: Required for maritime safety audits
   */
  async queryOverrides(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<SafetyAuditLog[]> {
    if (!dbPool) {
      return this.logs.filter((log) => log.action === 'override_applied');
    }

    try {
      let query = `
        SELECT id, timestamp, user_id, request_id, action, details, result, metadata
        FROM safety_audit_logs
        WHERE action = 'override_applied'
          AND timestamp >= $1
          AND timestamp <= $2
      `;
      const params: (string | Date)[] = [startDate.toISOString(), endDate.toISOString()];

      if (userId) {
        query += ` AND user_id = $3`;
        params.push(userId);
      }

      query += ` ORDER BY timestamp DESC`;

      const result = await dbPool.query(query, params);

      return result.rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.user_id,
        requestId: row.request_id,
        action: row.action,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
        result: row.result,
        metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
      }));
    } catch (error) {
      this.logger.error({ error, startDate, endDate, userId }, 'Failed to query overrides from database');
      return this.logs.filter((log) => log.action === 'override_applied');
    }
  }

  /**
   * Clear logs (use with caution, typically for testing only)
   */
  clearLogs(): void {
    this.logs = [];
    this.logger.info('Safety audit logs cleared');
  }
}

