/**
 * Tests for RateLimiter.sensitiveOpsLimit — the gate in front of
 * irreversible per-user actions (GDPR export, account deletion, API key
 * rotation). Unlike the tiered `limit()`, this middleware MUST:
 *   - fail CLOSED in production when Redis is unavailable (503, not next())
 *   - reject unauthenticated requests (401)
 *   - allow up to `maxRequests` within the window, then 429
 *   - namespace counters per (action, userId) so one user's export quota
 *     doesn't drain another's deletion quota
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import pino from "pino";
import type { Response, NextFunction } from "express";
import { RateLimiter } from "../rateLimiter";

const silent = pino({ level: "silent" });

type Counter = { value: number; expirySec?: number };

function fakeRedis(
  store: Map<string, Counter>,
  options: { throwOnIncr?: boolean } = {},
) {
  return {
    async incr(key: string) {
      if (options.throwOnIncr) throw new Error("redis unavailable");
      const current = store.get(key) ?? { value: 0 };
      current.value += 1;
      store.set(key, current);
      return current.value;
    },
    async expire(key: string, seconds: number) {
      const current = store.get(key);
      if (current) current.expirySec = seconds;
    },
    async ttl(key: string) {
      return store.get(key)?.expirySec ?? -1;
    },
  } as any;
}

function mockRes() {
  const headers: Record<string, string> = {};
  const res: Partial<Response> & {
    statusCode?: number;
    body?: unknown;
    headers: Record<string, string>;
  } = {
    headers,
    setHeader(name: string, value: string | number | readonly string[]) {
      headers[name] = String(value);
      return res as Response;
    },
    status(code: number) {
      (res as any).statusCode = code;
      return res as Response;
    },
    json(body: unknown) {
      (res as any).body = body;
      return res as Response;
    },
  };
  return res as Response & {
    statusCode?: number;
    body?: any;
    headers: Record<string, string>;
  };
}

describe("RateLimiter.sensitiveOpsLimit — irreversible-op gate", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("rejects unauthenticated requests with 401", async () => {
    const limiter = new RateLimiter(fakeRedis(new Map()), silent);
    const mw = limiter.sensitiveOpsLimit("data-export", 3, 60 * 60 * 1000);
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;
    await mw({} as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("fails CLOSED in production when Redis is unavailable", async () => {
    process.env.NODE_ENV = "production";
    const limiter = new RateLimiter(null, silent);
    const mw = limiter.sensitiveOpsLimit("data-export", 3, 60 * 60 * 1000);
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;
    await mw({ user: { id: "u1", email: "a@b.com" } } as any, res, next);
    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("fails open in non-production when Redis is unavailable (dev convenience)", async () => {
    process.env.NODE_ENV = "test";
    const limiter = new RateLimiter(null, silent);
    const mw = limiter.sensitiveOpsLimit("data-export", 3, 60 * 60 * 1000);
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;
    await mw({ user: { id: "u1", email: "a@b.com" } } as any, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it("allows up to maxRequests, then 429 on the next attempt", async () => {
    const limiter = new RateLimiter(fakeRedis(new Map()), silent);
    const mw = limiter.sensitiveOpsLimit(
      "account-delete",
      3,
      24 * 60 * 60 * 1000,
    );
    const req = { user: { id: "u1", email: "a@b.com" } } as any;

    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      const next = jest.fn() as unknown as NextFunction;
      await mw(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBeUndefined();
    }

    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;
    await mw(req, res, next);
    expect(res.statusCode).toBe(429);
    expect((res.body as any).error).toMatch(/account-delete/);
    expect(next).not.toHaveBeenCalled();
  });

  it("sets X-RateLimit headers on successful requests", async () => {
    const limiter = new RateLimiter(fakeRedis(new Map()), silent);
    const mw = limiter.sensitiveOpsLimit("data-export", 3, 60 * 60 * 1000);
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;
    await mw({ user: { id: "u1", email: "a@b.com" } } as any, res, next);
    expect(res.headers["X-RateLimit-Limit"]).toBe("3");
    expect(res.headers["X-RateLimit-Remaining"]).toBe("2");
  });

  it("namespaces counters per (action, user) — one user or action does not drain another", async () => {
    const limiter = new RateLimiter(fakeRedis(new Map()), silent);
    const exportMw = limiter.sensitiveOpsLimit(
      "data-export",
      2,
      60 * 60 * 1000,
    );
    const deleteMw = limiter.sensitiveOpsLimit(
      "account-delete",
      2,
      60 * 60 * 1000,
    );

    // u1 exhausts data-export (2 allowed)
    for (let i = 0; i < 2; i++) {
      await exportMw(
        { user: { id: "u1", email: "a@b.com" } } as any,
        mockRes(),
        jest.fn() as unknown as NextFunction,
      );
    }

    // u1 account-delete should still be allowed (different action)
    const delRes = mockRes();
    const delNext = jest.fn() as unknown as NextFunction;
    await deleteMw(
      { user: { id: "u1", email: "a@b.com" } } as any,
      delRes,
      delNext,
    );
    expect(delNext).toHaveBeenCalled();
    expect(delRes.statusCode).toBeUndefined();

    // u2 data-export should still be allowed (different user)
    const u2Res = mockRes();
    const u2Next = jest.fn() as unknown as NextFunction;
    await exportMw(
      { user: { id: "u2", email: "b@c.com" } } as any,
      u2Res,
      u2Next,
    );
    expect(u2Next).toHaveBeenCalled();
    expect(u2Res.statusCode).toBeUndefined();

    // u1 data-export third attempt — blocked
    const blockedRes = mockRes();
    const blockedNext = jest.fn() as unknown as NextFunction;
    await exportMw(
      { user: { id: "u1", email: "a@b.com" } } as any,
      blockedRes,
      blockedNext,
    );
    expect(blockedRes.statusCode).toBe(429);
    expect(blockedNext).not.toHaveBeenCalled();
  });

  it("fails CLOSED in production when Redis throws mid-request", async () => {
    process.env.NODE_ENV = "production";
    const limiter = new RateLimiter(
      fakeRedis(new Map(), { throwOnIncr: true }),
      silent,
    );
    const mw = limiter.sensitiveOpsLimit("data-export", 3, 60 * 60 * 1000);
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;
    await mw({ user: { id: "u1", email: "a@b.com" } } as any, res, next);
    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });
});
