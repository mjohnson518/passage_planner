/**
 * SafetyAuditLogger persistence-failure tests.
 *
 * SAFETY CRITICAL: The audit log is the compliance trail for every safety
 * decision. If the Postgres persistence path fails (DB outage, network blip),
 * the safety check itself MUST still complete — a mariner cannot be blocked
 * from a go/no-go decision by a logging-infra failure. Symmetrically, the
 * in-memory buffer MUST still retain the log so nothing is silently lost.
 *
 * These tests pin both invariants.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import pino from 'pino';
import { Pool } from 'pg';

jest.mock('uuid', () => ({
  v4: () => `test-uuid-${Math.random().toString(36).slice(2)}`,
}));

import {
  SafetyAuditLogger,
  initializeAuditLoggerDatabase,
} from '../utils/audit-logger';

const silentLogger = pino({ level: 'silent' });

function makeFailingPool(): Pool {
  return {
    query: jest.fn<Pool['query']>().mockRejectedValue(new Error('connection refused')),
  } as unknown as Pool;
}

function makeNoopPool(): Pool {
  return {
    query: jest.fn<Pool['query']>().mockResolvedValue({ rows: [] } as any),
  } as unknown as Pool;
}

describe('SafetyAuditLogger — DB persistence failure must not lose audit trail', () => {
  let auditLogger: SafetyAuditLogger;

  beforeEach(() => {
    auditLogger = new SafetyAuditLogger(silentLogger);
  });

  it('logs to in-memory buffer when no DB pool is configured', () => {
    // Reset module-level pool by re-initializing with undefined isn't supported,
    // so just construct fresh and rely on dbPool being null at module start.
    auditLogger.logRouteAnalysis(
      'req-1',
      'user-1',
      [{ latitude: 42.36, longitude: -71.06 }] as any,
      0,
      0,
      'A',
      ['NOAA'],
      'high'
    );
    expect(auditLogger.getLogsByRequestId('req-1')).toHaveLength(1);
  });

  it('keeps the log in the in-memory buffer even when DB persistence throws', async () => {
    initializeAuditLoggerDatabase(makeFailingPool());

    auditLogger.logHazardDetected(
      'req-2',
      'user-2',
      'shallow_water',
      { latitude: 42.0, longitude: -71.0 } as any,
      'critical',
      'Depth below keel clearance threshold'
    );

    // Buffer write is synchronous; DB write is async and will reject.
    expect(auditLogger.getLogsByRequestId('req-2')).toHaveLength(1);

    // Pending write should settle without throwing to the caller.
    await expect(auditLogger.flushPendingWrites()).resolves.toBeUndefined();

    // Log is still there after the failed persistence.
    expect(auditLogger.getLogsByRequestId('req-2')).toHaveLength(1);
  });

  it('does not propagate DB errors to the safety-check caller', () => {
    initializeAuditLoggerDatabase(makeFailingPool());

    // These calls must not throw — a DB outage is not a safety-decision blocker.
    expect(() => {
      auditLogger.logWarningGenerated(
        'req-3',
        'user-3',
        'weather',
        'critical',
        { latitude: 42, longitude: -71 } as any,
        'Gale warning active'
      );
      auditLogger.logOverride('req-3', {
        userId: 'user-3',
        warningId: 'w-1',
        warningType: 'weather',
        justification: 'Experienced crew, short passage',
      } as any);
      auditLogger.logRecommendation('req-3', 'user-3', 'shelter', 'critical', 'Seek shelter');
    }).not.toThrow();
  });

  it('queryLogsByRequestId falls back to memory when DB query fails', async () => {
    initializeAuditLoggerDatabase(makeFailingPool());
    auditLogger.logRouteAnalysis(
      'req-4',
      'user-4',
      [{ latitude: 42.36, longitude: -71.06 }] as any,
      1,
      1,
      'B',
      ['NOAA'],
      'medium'
    );

    const logs = await auditLogger.queryLogsByRequestId('req-4');
    expect(logs).toHaveLength(1);
    expect(logs[0].requestId).toBe('req-4');
  });

  it('queryOverrides falls back to memory when DB query fails', async () => {
    initializeAuditLoggerDatabase(makeFailingPool());
    auditLogger.logOverride('req-5', {
      userId: 'user-5',
      warningId: 'w-5',
      warningType: 'depth',
      justification: 'Local knowledge',
    } as any);

    const overrides = await auditLogger.queryOverrides(
      new Date(Date.now() - 60_000),
      new Date(Date.now() + 60_000)
    );
    expect(overrides.length).toBeGreaterThanOrEqual(1);
  });

  it('persists via DB when the pool is healthy', async () => {
    const pool = makeNoopPool();
    initializeAuditLoggerDatabase(pool);

    auditLogger.logHazardDetected(
      'req-6',
      'user-6',
      'restricted_area',
      { latitude: 42, longitude: -71 } as any,
      'critical',
      'Entering naval exclusion zone'
    );

    await auditLogger.flushPendingWrites();
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql] = (pool.query as jest.Mock).mock.calls[0];
    expect(String(sql)).toMatch(/INSERT INTO safety_audit_logs/);
  });
});
