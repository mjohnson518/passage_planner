/**
 * Tidal hot-path staleness integration test.
 *
 * SAFETY CRITICAL: CLAUDE.md mandates rejecting tidal data >1 day old. This
 * file pins the contract end-to-end: if NOAATidalService returns a stale
 * TidalData (as can happen via the 7-day circuit-breaker fallback cache),
 * TidalAgent.getTides MUST surface an isError response rather than silently
 * returning predictions that cannot safely drive depth or window decisions.
 *
 * Mirrors the weather-agent pattern at agents/weather/src/__tests__/index.test.ts.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// ── Mocks must come before production imports ─────────────────────────────

const mockTidalService = {
  findNearestStations:
    jest.fn<(lat: number, lon: number, radius?: number) => Promise<any[]>>(),
  getTidalPredictions:
    jest.fn<(stationId: string, start: Date, end: Date) => Promise<any>>(),
  calculateTidalWindows: jest.fn<(...args: any[]) => Promise<any>>(),
};

jest.mock("@passage-planner/shared", () => {
  const actual = jest.requireActual("@passage-planner/shared") as any;
  return {
    ...actual,
    CacheManager: jest.fn().mockImplementation(() => ({
      get: jest.fn(async () => null),
      set: jest.fn(async () => {}),
      setWithTTL: jest.fn(async () => {}),
      getWithMetadata: jest.fn(async () => null),
    })),
    NOAATidalService: jest.fn().mockImplementation(() => mockTidalService),
  };
});

import { TidalAgent } from "../index";

// ── Shared test fixtures ──────────────────────────────────────────────────

const freshPredictions = {
  station: {
    id: "8443970",
    name: "Boston",
    distance: 2,
    lat: 42.36,
    lon: -71.06,
  },
  predictions: [{ time: new Date(), height: 5, type: "h" }],
  extremes: [
    { time: new Date(), height: 5, type: "high" },
    { time: new Date(Date.now() + 6 * 3600_000), height: 1, type: "low" },
  ],
  currentHeight: 5,
  datum: "MLLW",
  units: "english" as const,
  fetchedAt: new Date(),
  // formatTidalSummary reads these — not on the TidalData interface, but the
  // implementation treats the shape as `any` and expects them present.
  startDate: new Date(),
  endDate: new Date(Date.now() + 24 * 3600_000),
};

describe("TidalAgent.getTides — hot-path freshness enforcement", () => {
  let agent: TidalAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new TidalAgent();
  });

  it("returns predictions when fetchedAt is current", async () => {
    mockTidalService.getTidalPredictions.mockResolvedValueOnce({
      ...freshPredictions,
      fetchedAt: new Date(),
    });

    const result = await agent.callTool("get_tides", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });

    expect(result.isError).toBeFalsy();
    expect(result.content.find((c: any) => c.type === "data")).toBeDefined();
  });

  it("surfaces an isError response when NOAATidalService returns stale fetchedAt (25h)", async () => {
    mockTidalService.getTidalPredictions.mockResolvedValueOnce({
      ...freshPredictions,
      fetchedAt: new Date(Date.now() - 25 * 3600_000), // 1h past MAX_TIDAL_AGE_MS
    });

    const result = await agent.callTool("get_tides", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });

    expect(result.isError).toBe(true);
    const text = result.content.find((c: any) => c.type === "text")?.text;
    expect(text).toMatch(/stale|refresh|hours old/i);
  });

  it("surfaces an isError response for fallback-cache predictions 7 days old", async () => {
    // Simulates the NOAATidalService circuit-breaker fallback path surfacing a
    // prediction set from the 7-day fallback cache with its original fetchedAt
    // preserved — a plausible real-world failure mode during NOAA outages.
    mockTidalService.getTidalPredictions.mockResolvedValueOnce({
      ...freshPredictions,
      fetchedAt: new Date(Date.now() - 7 * 24 * 3600_000),
    });

    const result = await agent.callTool("get_tides", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });

    expect(result.isError).toBe(true);
  });

  it("accepts boundary-case predictions fetched 23h ago (within MAX_TIDAL_AGE_MS)", async () => {
    mockTidalService.getTidalPredictions.mockResolvedValueOnce({
      ...freshPredictions,
      fetchedAt: new Date(Date.now() - 23 * 3600_000),
    });

    const result = await agent.callTool("get_tides", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });

    expect(result.isError).toBeFalsy();
  });
});
