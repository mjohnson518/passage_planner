/**
 * SafetyAuditLogger Supplemental Coverage Tests — Phase 4.4
 *
 * Targets uncovered branches in audit-logger.ts identified during the Phase 4
 * safety-agent coverage push:
 *
 *   - Buffer overflow truncation (line 300)
 *   - persistLogToDatabase early-return when no pool (line 324)
 *   - queryLogsByRequestId no-pool fallback (line 397)
 *   - queryLogsByRequestId DB-success row mapping (lines 409-418)
 *   - queryCriticalLogs full body (lines 435-463) — no-pool, DB success, DB failure
 *   - queryOverrides no-pool fallback (line 477)
 *   - queryOverrides userId-filter branch (lines 491-492)
 *   - queryOverrides DB-success row mapping (line 499)
 *
 * Existing audit-logger-persistence.test.ts covers the in-memory buffer and
 * DB-failure fallback surface. This file exercises the success branches plus
 * the narrower edge-cases that persistence.test.ts does not reach.
 *
 * Compliance note: these are regulatory paths (maritime incident investigation
 * queries). Coverage of success AND failure is required to demonstrate that
 * the DB query layer itself is trustworthy for audit output, not just resilient
 * to DB outages.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import pino from "pino";
import type { Pool } from "pg";
import {
  SafetyAuditLogger,
  initializeAuditLoggerDatabase,
} from "../audit-logger";
import type {
  SafetyAuditLog,
  SafetyOverride,
  Waypoint,
} from "../../../../../shared/src/types/safety";

const silentLogger = pino({ level: "silent" });

type DbRow = {
  id: string;
  timestamp: string;
  user_id: string | null;
  request_id: string;
  action: string;
  details: unknown;
  result: string;
  metadata: unknown;
};

function makeRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: "db-row-1",
    timestamp: "2026-04-01T12:00:00.000Z",
    user_id: "user-x",
    request_id: "req-db",
    action: "override_applied",
    details: { foo: "bar" },
    result: "critical",
    metadata: null,
    ...overrides,
  };
}

describe("SafetyAuditLogger — supplemental coverage", () => {
  let auditLogger: SafetyAuditLogger;

  beforeEach(() => {
    auditLogger = new SafetyAuditLogger(silentLogger);
  });

  afterEach(() => {
    // Reset module-level dbPool so tests in other files don't inherit our state.
    initializeAuditLoggerDatabase(null as unknown as Pool);
  });

  describe("in-memory buffer overflow", () => {
    it("truncates the buffer to maxBufferSize when it grows past the limit", () => {
      // maxBufferSize = 1000. Write 1005 logs; only the most recent 1000 must remain.
      const waypoint: Waypoint = { latitude: 42, longitude: -71 };
      for (let i = 0; i < 1005; i++) {
        auditLogger.logHazardDetected(
          `req-${i}`,
          "user-buf",
          "shallow_water",
          waypoint,
          "moderate",
          `hazard ${i}`,
        );
      }

      // exportLogs returns a copy of the internal buffer.
      const all = auditLogger.exportLogs();
      expect(all).toHaveLength(1000);
      // Oldest survivors are req-5..req-1004 (the first 5 got sliced off).
      expect(all[0].requestId).toBe("req-5");
      expect(all[all.length - 1].requestId).toBe("req-1004");
    });
  });

  describe("persistLogToDatabase early-return", () => {
    it("no-ops when dbPool is null (defensive guard)", async () => {
      // dbPool is null in this test (reset by afterEach).
      // Reach the private method via bracket access — addLog's gate normally
      // prevents this path, but the defensive check at the top of
      // persistLogToDatabase must still be covered.
      const fakeLog: SafetyAuditLog = {
        id: "direct-call",
        timestamp: new Date().toISOString(),
        userId: "u",
        requestId: "req-direct",
        action: "route_analyzed",
        details: {},
        result: "success",
      };

      await expect(
        (
          auditLogger as unknown as {
            persistLogToDatabase: (l: SafetyAuditLog) => Promise<void>;
          }
        ).persistLogToDatabase(fakeLog),
      ).resolves.toBeUndefined();
    });
  });

  describe("queryLogsByRequestId", () => {
    it("falls back to in-memory buffer when dbPool is null", async () => {
      // dbPool reset to null by afterEach of the previous test.
      auditLogger.logRouteAnalysis(
        "req-mem",
        "user-mem",
        [{ latitude: 42, longitude: -71 }],
        0,
        0,
        "A",
        ["NOAA"],
        "high",
      );

      const logs = await auditLogger.queryLogsByRequestId("req-mem");
      expect(logs).toHaveLength(1);
      expect(logs[0].requestId).toBe("req-mem");
    });

    it("returns mapped rows from the database on success", async () => {
      const dbRow = makeRow({
        id: "log-1",
        request_id: "req-db-lookup",
        action: "route_analyzed",
        result: "success",
        details: JSON.stringify({ foo: "bar" }),
        metadata: JSON.stringify({ src: "unit-test" }),
      });
      const queryMock = jest
        .fn<() => Promise<{ rows: DbRow[] }>>()
        .mockResolvedValue({ rows: [dbRow] });
      const fakePool = { query: queryMock } as unknown as Pool;
      initializeAuditLoggerDatabase(fakePool);

      const logs = await auditLogger.queryLogsByRequestId("req-db-lookup");
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: "log-1",
        requestId: "req-db-lookup",
        action: "route_analyzed",
        result: "success",
        userId: "user-x",
      });
      // JSON-string details + metadata must be parsed back to objects.
      expect(logs[0].details).toEqual({ foo: "bar" });
      expect(logs[0].metadata).toEqual({ src: "unit-test" });
    });

    it("handles rows whose details/metadata are already objects (non-string passthrough)", async () => {
      const dbRow = makeRow({
        id: "log-2",
        request_id: "req-obj-lookup",
        details: { already: "object" },
        metadata: { also: "object" },
      });
      const queryMock = jest
        .fn<() => Promise<{ rows: DbRow[] }>>()
        .mockResolvedValue({ rows: [dbRow] });
      initializeAuditLoggerDatabase({ query: queryMock } as unknown as Pool);

      const logs = await auditLogger.queryLogsByRequestId("req-obj-lookup");
      expect(logs[0].details).toEqual({ already: "object" });
      expect(logs[0].metadata).toEqual({ also: "object" });
    });

    it("treats null metadata as undefined in the mapped result", async () => {
      const dbRow = makeRow({
        id: "log-3",
        request_id: "req-null-meta",
        metadata: null,
      });
      const queryMock = jest
        .fn<() => Promise<{ rows: DbRow[] }>>()
        .mockResolvedValue({ rows: [dbRow] });
      initializeAuditLoggerDatabase({ query: queryMock } as unknown as Pool);

      const logs = await auditLogger.queryLogsByRequestId("req-null-meta");
      expect(logs[0].metadata).toBeUndefined();
    });
  });

  describe("queryCriticalLogs", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-12-31T23:59:59Z");

    it("falls back to in-memory critical logs when dbPool is null", async () => {
      // With no pool, queryCriticalLogs delegates to getCriticalLogs (in-memory).
      const override: SafetyOverride = {
        userId: "user-over",
        warningId: "w-1",
        warningType: "depth",
        justification: "local knowledge",
      } as SafetyOverride;
      auditLogger.logOverride("req-crit-mem", override);

      const logs = await auditLogger.queryCriticalLogs(start, end, 10);
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.every((l) => l.result === "critical")).toBe(true);
    });

    it("returns mapped critical rows from the database on success", async () => {
      const dbRow = makeRow({
        id: "crit-1",
        request_id: "req-crit-db",
        action: "override_applied",
        result: "critical",
        details: JSON.stringify({ overrideInfo: { userId: "u" } }),
        metadata: null,
      });
      const queryMock = jest
        .fn<() => Promise<{ rows: DbRow[] }>>()
        .mockResolvedValue({ rows: [dbRow] });
      initializeAuditLoggerDatabase({ query: queryMock } as unknown as Pool);

      const logs = await auditLogger.queryCriticalLogs(start, end, 25);
      expect(queryMock).toHaveBeenCalledTimes(1);
      const [sql, params] = queryMock.mock.calls[0] as unknown as [
        string,
        unknown[],
      ];
      expect(String(sql)).toMatch(/FROM safety_audit_logs/);
      expect(String(sql)).toMatch(/result = 'critical'/);
      expect(params[0]).toBe(start.toISOString());
      expect(params[1]).toBe(end.toISOString());
      expect(params[2]).toBe(25);

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: "crit-1",
        requestId: "req-crit-db",
        result: "critical",
      });
      expect(logs[0].details).toEqual({ overrideInfo: { userId: "u" } });
    });

    it("uses the default limit of 100 when none is supplied", async () => {
      const queryMock = jest
        .fn<() => Promise<{ rows: DbRow[] }>>()
        .mockResolvedValue({ rows: [] });
      initializeAuditLoggerDatabase({ query: queryMock } as unknown as Pool);

      await auditLogger.queryCriticalLogs(start, end);
      const [, params] = queryMock.mock.calls[0] as unknown as [
        string,
        unknown[],
      ];
      expect(params[2]).toBe(100);
    });

    it("falls back to in-memory critical logs when DB query rejects", async () => {
      const queryMock = jest
        .fn<() => Promise<{ rows: DbRow[] }>>()
        .mockRejectedValue(new Error("connection refused"));
      initializeAuditLoggerDatabase({ query: queryMock } as unknown as Pool);

      // Seed an in-memory critical log first so the fallback has something to return.
      auditLogger.logOverride("req-crit-fb", {
        userId: "user-fb",
        warningId: "w-fb",
        warningType: "weather",
        justification: "storm subsiding",
      } as SafetyOverride);

      const logs = await auditLogger.queryCriticalLogs(start, end, 5);
      // At least one call is the queryCriticalLogs attempt itself;
      // the logOverride side-effect also dispatches a persistLogToDatabase call.
      expect(queryMock).toHaveBeenCalled();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.every((l) => l.result === "critical")).toBe(true);
    });
  });

  describe("queryOverrides", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-12-31T23:59:59Z");

    it("falls back to in-memory overrides when dbPool is null", async () => {
      auditLogger.logOverride("req-ov-mem", {
        userId: "user-ov",
        warningId: "w-ov",
        warningType: "depth",
        justification: "experienced crew",
      } as SafetyOverride);

      const results = await auditLogger.queryOverrides(start, end);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((r) => r.action === "override_applied")).toBe(true);
    });

    it("issues a 2-param query when no userId filter is supplied", async () => {
      const dbRow = makeRow({
        id: "ov-1",
        action: "override_applied",
        result: "critical",
      });
      const queryMock = jest
        .fn<() => Promise<{ rows: DbRow[] }>>()
        .mockResolvedValue({ rows: [dbRow] });
      initializeAuditLoggerDatabase({ query: queryMock } as unknown as Pool);

      const results = await auditLogger.queryOverrides(start, end);
      expect(queryMock).toHaveBeenCalledTimes(1);
      const [sql, params] = queryMock.mock.calls[0] as unknown as [
        string,
        unknown[],
      ];
      expect(params).toHaveLength(2);
      expect(String(sql)).not.toMatch(/AND user_id/);
      expect(String(sql)).toMatch(/action = 'override_applied'/);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: "ov-1",
        action: "override_applied",
      });
    });

    it("adds the userId filter and a third bind param when userId is supplied", async () => {
      const dbRow = makeRow({
        id: "ov-2",
        action: "override_applied",
        result: "critical",
        user_id: "target-user",
      });
      const queryMock = jest
        .fn<() => Promise<{ rows: DbRow[] }>>()
        .mockResolvedValue({ rows: [dbRow] });
      initializeAuditLoggerDatabase({ query: queryMock } as unknown as Pool);

      const results = await auditLogger.queryOverrides(
        start,
        end,
        "target-user",
      );

      const [sql, params] = queryMock.mock.calls[0] as unknown as [
        string,
        unknown[],
      ];
      expect(String(sql)).toMatch(/AND user_id = \$3/);
      expect(params).toHaveLength(3);
      expect(params[2]).toBe("target-user");
      expect(results[0].userId).toBe("target-user");
    });

    it("parses string-encoded details and metadata on override rows", async () => {
      const dbRow = makeRow({
        id: "ov-3",
        action: "override_applied",
        result: "critical",
        details: JSON.stringify({ overrideInfo: { id: "x" } }),
        metadata: JSON.stringify({ source: "db" }),
      });
      const queryMock = jest
        .fn<() => Promise<{ rows: DbRow[] }>>()
        .mockResolvedValue({ rows: [dbRow] });
      initializeAuditLoggerDatabase({ query: queryMock } as unknown as Pool);

      const results = await auditLogger.queryOverrides(start, end);
      expect(results[0].details).toEqual({ overrideInfo: { id: "x" } });
      expect(results[0].metadata).toEqual({ source: "db" });
    });

    it("falls back to in-memory overrides when DB query rejects", async () => {
      const queryMock = jest
        .fn<() => Promise<{ rows: DbRow[] }>>()
        .mockRejectedValue(new Error("db down"));
      initializeAuditLoggerDatabase({ query: queryMock } as unknown as Pool);

      auditLogger.logOverride("req-ov-fb", {
        userId: "user-fb",
        warningId: "w-fb",
        warningType: "depth",
        justification: "fallback path",
      } as SafetyOverride);

      const results = await auditLogger.queryOverrides(start, end);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].action).toBe("override_applied");
    });
  });
});
