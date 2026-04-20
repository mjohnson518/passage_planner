/**
 * TidalAgent tool-dispatch + helper-path coverage.
 *
 * Targets uncovered branches in agents/tidal/src/index.ts surfaced by the
 * 2026-04-20 coverage run (statements 59%, branches 54%). Exercises:
 *   - callTool dispatch for all tools + aliases + unknown
 *   - getTidalStations happy/error/empty
 *   - getTides: missing coordinates + nearest-station empty
 *   - calculateTidalWindows happy/error/no-windows
 *   - validateTidalFreshness: missing predictions, missing extremes,
 *     start/end coverage gaps, inter-extreme gap >6h, distant station
 *   - formatTidalSummary permutations
 *
 * Keeps the existing hot-path-staleness.test.ts pattern (mock @passage-planner/
 * shared before importing TidalAgent) so we don't hit a real NOAA endpoint.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

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

const okPredictions = () => ({
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
  startDate: new Date(),
  endDate: new Date(Date.now() + 24 * 3600_000),
});

describe("TidalAgent — callTool dispatch", () => {
  let agent: TidalAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new TidalAgent();
  });

  it("routes get_tidal_stations to the stations handler", async () => {
    mockTidalService.findNearestStations.mockResolvedValueOnce([
      { id: "8443970", name: "Boston", distance: 2 },
    ]);
    const result = await agent.callTool("get_tidal_stations", {
      latitude: 42.36,
      longitude: -71.06,
    });
    expect(
      result.content.find((c: any) => c.type === "data")?.data,
    ).toHaveLength(1);
  });

  it("routes get_tides and the get_tide_predictions alias", async () => {
    mockTidalService.getTidalPredictions.mockResolvedValue(okPredictions());
    const a = await agent.callTool("get_tides", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600_000).toISOString(),
    });
    const b = await agent.callTool("get_tide_predictions", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(a.isError).toBeFalsy();
    expect(b.isError).toBeFalsy();
  });

  it("routes calculate_tidal_windows and the find_navigation_windows alias", async () => {
    mockTidalService.calculateTidalWindows.mockResolvedValue([
      { start: new Date(), end: new Date(Date.now() + 3600_000), minHeight: 6 },
    ]);
    const a = await agent.callTool("calculate_tidal_windows", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600_000).toISOString(),
      requiredDepth: 8,
    });
    const b = await agent.callTool("find_navigation_windows", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600_000).toISOString(),
      requiredDepth: 8,
    });
    expect(a.content.find((c: any) => c.type === "data")).toBeDefined();
    expect(b.content.find((c: any) => c.type === "data")).toBeDefined();
  });

  it("throws Unknown tool on an unrecognized name", async () => {
    await expect(agent.callTool("not_a_tool", {})).rejects.toThrow(
      /Unknown tool/,
    );
  });
});

describe("TidalAgent — agent-specific health", () => {
  it("reports tidalServiceActive + a recent lastPredictionTime", () => {
    const agent: any = new TidalAgent();
    const health = agent.getAgentSpecificHealth();
    expect(health.tidalServiceActive).toBe(true);
    expect(health.cacheStatus).toBe("active");
    expect(health.lastPredictionTime).toBeInstanceOf(Date);
  });
});

describe("TidalAgent — getTidalStations", () => {
  let agent: TidalAgent;
  beforeEach(() => {
    jest.clearAllMocks();
    agent = new TidalAgent();
  });

  it("surfaces isError when NOAATidalService.findNearestStations throws", async () => {
    mockTidalService.findNearestStations.mockRejectedValueOnce(
      new Error("NOAA down"),
    );
    const result = await agent.callTool("get_tidal_stations", {
      latitude: 42.36,
      longitude: -71.06,
    });
    expect(result.isError).toBe(true);
  });

  it("returns an empty set with a radius summary when no stations match", async () => {
    mockTidalService.findNearestStations.mockResolvedValueOnce([]);
    const result = await agent.callTool("get_tidal_stations", {
      latitude: 0,
      longitude: 0,
      radius: 10,
    });
    const text = result.content.find((c: any) => c.type === "text")?.text;
    expect(text).toMatch(/Found 0 tidal stations within 10nm/);
  });
});

describe("TidalAgent.getTides — coordinate-fallback branches", () => {
  let agent: TidalAgent;
  beforeEach(() => {
    jest.clearAllMocks();
    agent = new TidalAgent();
  });

  it("returns isError when neither stationId nor coordinates are supplied", async () => {
    const result = await agent.callTool("get_tides", {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/stationId or latitude\/longitude/);
  });

  it("returns isError when nearest-station lookup finds nothing", async () => {
    mockTidalService.findNearestStations.mockResolvedValueOnce([]);
    const result = await agent.callTool("get_tides", {
      stationId: "nearest",
      latitude: 10,
      longitude: 10,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/No tidal stations found/);
  });

  it('uses the nearest station when stationId is "nearest"', async () => {
    mockTidalService.findNearestStations.mockResolvedValueOnce([
      { id: "8443970", name: "Boston", distance: 2 },
    ]);
    mockTidalService.getTidalPredictions.mockResolvedValueOnce(okPredictions());
    const result = await agent.callTool("get_tides", {
      stationId: "nearest",
      latitude: 42.36,
      longitude: -71.06,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(result.isError).toBeFalsy();
    expect(mockTidalService.getTidalPredictions).toHaveBeenCalledWith(
      "8443970",
      expect.any(Date),
      expect.any(Date),
    );
  });

  it("surfaces isError when NOAATidalService rejects", async () => {
    mockTidalService.getTidalPredictions.mockRejectedValueOnce(
      new Error("NOAA 503"),
    );
    const result = await agent.callTool("get_tides", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(
      /Unable to retrieve tidal predictions/,
    );
  });
});

describe("TidalAgent.calculateTidalWindows", () => {
  let agent: TidalAgent;
  beforeEach(() => {
    jest.clearAllMocks();
    agent = new TidalAgent();
  });

  it("converts requiredDepth from feet to metres and forwards to the service", async () => {
    mockTidalService.calculateTidalWindows.mockResolvedValue([
      { start: new Date(), end: new Date(Date.now() + 3600_000), minHeight: 3 },
    ]);
    await agent.callTool("calculate_tidal_windows", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 6 * 3600_000).toISOString(),
      requiredDepth: 10, // feet
    });
    const call = mockTidalService.calculateTidalWindows.mock.calls[0];
    const opts = call[3] as { minTideHeight: number };
    expect(opts.minTideHeight).toBeCloseTo(10 * 0.3048, 4);
  });

  it('returns a "no windows" summary when the service returns an empty set', async () => {
    mockTidalService.calculateTidalWindows.mockResolvedValue([]);
    const result = await agent.callTool("calculate_tidal_windows", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600_000).toISOString(),
      requiredDepth: 8,
    });
    const text = result.content.find((c: any) => c.type === "text")?.text;
    expect(text).toMatch(/No safe navigation windows/);
  });

  it("surfaces isError when the service throws", async () => {
    mockTidalService.calculateTidalWindows.mockRejectedValue(new Error("boom"));
    const result = await agent.callTool("calculate_tidal_windows", {
      stationId: "8443970",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600_000).toISOString(),
      requiredDepth: 8,
    });
    expect(result.isError).toBe(true);
  });
});

describe("TidalAgent.getTides — freshness-warning surface (validateTidalFreshness)", () => {
  let agent: TidalAgent;
  beforeEach(() => {
    jest.clearAllMocks();
    agent = new TidalAgent();
  });

  const runGetTides = async () =>
    agent.callTool("get_tides", {
      stationId: "8443970",
      startDate: new Date("2026-04-20T00:00:00Z").toISOString(),
      endDate: new Date("2026-04-20T06:00:00Z").toISOString(),
    });

  const extractWarnings = (result: any): string[] =>
    result.content.find((c: any) => c.type === "data")?.data
      ?.freshnessWarnings ?? [];

  it("warns when extremes are empty", async () => {
    mockTidalService.getTidalPredictions.mockResolvedValueOnce({
      ...okPredictions(),
      extremes: [],
    });
    const warnings = extractWarnings(await runGetTides());
    expect(warnings.some((w) => /No tidal extremes/.test(w))).toBe(true);
  });

  it("warns when predictions start after the requested window", async () => {
    const requestedStart = new Date("2026-04-20T00:00:00Z");
    mockTidalService.getTidalPredictions.mockResolvedValueOnce({
      ...okPredictions(),
      extremes: [
        {
          time: new Date(requestedStart.getTime() + 4 * 3600_000),
          height: 5,
          type: "high",
        },
        {
          time: new Date(requestedStart.getTime() + 10 * 3600_000),
          height: 1,
          type: "low",
        },
      ],
    });
    const warnings = extractWarnings(await runGetTides());
    expect(warnings.some((w) => /early portion not covered/.test(w))).toBe(
      true,
    );
  });

  it("warns when predictions end before the requested window", async () => {
    const requestedStart = new Date("2026-04-20T00:00:00Z");
    mockTidalService.getTidalPredictions.mockResolvedValueOnce({
      ...okPredictions(),
      extremes: [
        {
          time: new Date(requestedStart.getTime() - 3600_000),
          height: 5,
          type: "high",
        },
        { time: new Date(requestedStart.getTime()), height: 1, type: "low" },
      ],
    });
    const warnings = extractWarnings(await runGetTides());
    expect(warnings.some((w) => /later portion not covered/.test(w))).toBe(
      true,
    );
  });

  it("warns when there is a >6h gap between consecutive extremes", async () => {
    const base = new Date("2026-04-20T00:00:00Z");
    mockTidalService.getTidalPredictions.mockResolvedValueOnce({
      ...okPredictions(),
      extremes: [
        { time: base, height: 5, type: "high" },
        {
          time: new Date(base.getTime() + 8 * 3600_000),
          height: 1,
          type: "low",
        },
      ],
    });
    const warnings = extractWarnings(await runGetTides());
    expect(warnings.some((w) => /Gap of \d+ hours/.test(w))).toBe(true);
  });

  it("warns when the nearest station is >40nm away", async () => {
    mockTidalService.getTidalPredictions.mockResolvedValueOnce({
      ...okPredictions(),
      station: {
        id: "8443970",
        name: "Boston",
        distance: 60,
        lat: 42.36,
        lon: -71.06,
      },
    });
    const warnings = extractWarnings(await runGetTides());
    expect(warnings.some((w) => /60nm away/.test(w))).toBe(true);
  });
});
