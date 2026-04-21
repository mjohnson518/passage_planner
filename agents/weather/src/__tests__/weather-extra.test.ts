/**
 * Supplemental WeatherAgent.ts (legacy) coverage — Phase 4.3
 *
 * The main weather.test.ts + integration.test.ts hit the top-level tool paths
 * but skip several branches:
 *   - UKMO-configured constructor branch (line 76)
 *   - calculateConfidence 'low' / 'unknown' branches (lines 136-137)
 *   - getMarineForecast cached-data return (lines 294-315)
 *   - getGribData early-morning cycleHour branch (lines 462-463)
 *   - estimateWaveHeight phenomenal/high-seas thresholds (lines 500-501)
 *   - findWeatherWindow mid-window push + too-short label (lines 627-635)
 *   - analyzeSeaState reduce/max/min helpers (lines 710-713)
 *   - assessSeaConditions 'Severe' (line 765)
 *   - assessSeaSafety caution/warning/dangerous tiers (lines 776, 788)
 *   - parseStormCategory fall-through & tropical-storm branches (line 811)
 *
 * These tests call the private methods via the public API and via reflection
 * (TypeScript allows `(agent as any).methodName(...)`), which is acceptable
 * here because the target is coverage of production safety logic, not
 * contractual behaviour.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "@jest/globals";

// Redis + axios mocks — same shape as weather.test.ts
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async () => null),
    setex: jest.fn(async () => "OK"),
    hset: jest.fn(async () => 1),
    hgetall: jest.fn(async () => ({ status: "healthy" })),
    ping: jest.fn(async () => "PONG"),
    quit: jest.fn(async () => "OK"),
  }));
});

jest.mock("axios");

// eslint-disable-next-line @typescript-eslint/no-var-requires
import axios from "axios";
import { WeatherAgent } from "../WeatherAgent";

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("WeatherAgent.ts — supplemental coverage", () => {
  let agent: WeatherAgent;
  const originalUKMO = process.env.UKMO_API_KEY;

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.UKMO_API_KEY;
    agent = new WeatherAgent("redis://localhost:6379", "noaa", "ow");
    await agent.initialize();
  });

  afterEach(async () => {
    await agent.shutdown();
    if (originalUKMO !== undefined) process.env.UKMO_API_KEY = originalUKMO;
    else delete process.env.UKMO_API_KEY;
  });

  // ── UKMO-configured constructor (line 76) ─────────────────────────────────
  describe("constructor — UKMO-configured branch", () => {
    it("logs the UKMO-enabled message when UKMO_API_KEY is set", () => {
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (msg: string) => logs.push(msg);
      try {
        process.env.UKMO_API_KEY = "ukmo-test-key";
        // Construct a fresh agent with the env var set
        new WeatherAgent("redis://localhost:6379", "n", "o");
      } finally {
        console.log = originalLog;
      }
      expect(logs.some((m) => /UK Met Office API key configured/.test(m))).toBe(
        true,
      );
    });
  });

  // ── calculateConfidence (lines 136-137) ───────────────────────────────────
  describe("calculateConfidence — low / unknown", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calc = (horizon: number, ageMin: number) =>
      (agent as any).calculateConfidence(horizon, ageMin);

    it("returns 'high' for short horizons", () => {
      expect(calc(6, 0)).toBe("high");
    });

    it("returns 'medium' for 24-72h horizons", () => {
      expect(calc(48, 0)).toBe("medium");
    });

    it("returns 'low' for horizons up to 168h (7 days)", () => {
      expect(calc(120, 0)).toBe("low");
    });

    it("returns 'unknown' for horizons beyond 7 days", () => {
      expect(calc(200, 0)).toBe("unknown");
    });

    it("applies a staleness penalty when data age > 30 minutes", () => {
      // 20h horizon + 24h penalty for >30min age = 44h → medium
      expect(calc(20, 45)).toBe("medium");
    });

    it("applies a half-penalty when data age is 15-30 minutes", () => {
      // 22h + 0.5*24 = 34h → medium (boundary check)
      expect(calc(22, 20)).toBe("medium");
    });
  });

  // ── getMarineForecast cached-data branch (lines 294-315) ─────────────────
  describe("getMarineForecast — cached path", () => {
    it("returns cached forecast with freshness metadata when redis hits", async () => {
      const nowMs = Date.now();
      const cachedPayload = {
        data: [
          {
            time: new Date(nowMs),
            windSpeed: 12,
            windDirection: 180,
            windGust: 15,
            waveHeight: 1.5,
            wavePeriod: 6,
            waveDirection: 180,
            precipitation: 0,
            visibility: 10,
            temperature: 20,
            pressure: 1013,
            cloudCover: 50,
            confidence: "high",
          },
        ],
        fetchedAt: nowMs - 5 * 60_000, // 5 min old
        source: "NOAA/OpenWeather",
        expiresAt: nowMs + 25 * 60_000,
      };

      // Patch getCachedData on this instance so the first call returns the cache.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spy = jest
        .spyOn(agent as any, "getCachedData")
        .mockResolvedValueOnce(cachedPayload as never);

      const result = await agent.handleToolCall("get_marine_forecast", {
        latitude: 42.36,
        longitude: -71.06,
        hours: 72,
      });

      expect(spy).toHaveBeenCalled();
      expect(result).toHaveProperty("metadata");
      expect(result.metadata.source).toBe("NOAA/OpenWeather");
      expect(result.metadata.dataAgeMinutes).toBeGreaterThanOrEqual(4);
      expect(result.metadata.freshnessStatus).toHaveProperty("isStale");
      expect(Array.isArray(result.forecasts)).toBe(true);
      expect(result.forecasts[0]).toHaveProperty("confidence");
      expect(result.forecasts[0]).toHaveProperty("forecastHorizonHours");
    });

    it("flags isStale=true when cached data is older than 30 minutes", async () => {
      const nowMs = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(agent as any, "getCachedData").mockResolvedValueOnce({
        data: [
          {
            time: new Date(nowMs),
            windSpeed: 10,
            windDirection: 180,
            windGust: 12,
            waveHeight: 1,
            wavePeriod: 5,
            waveDirection: 180,
            precipitation: 0,
            visibility: 10,
            temperature: 18,
            pressure: 1010,
            cloudCover: 30,
            confidence: "high",
          },
        ],
        fetchedAt: nowMs - 90 * 60_000, // 90 min old
        source: "NOAA/OpenWeather",
        expiresAt: nowMs,
      } as never);

      const result = await agent.handleToolCall("get_marine_forecast", {
        latitude: 42.36,
        longitude: -71.06,
      });

      expect(result.metadata.freshnessStatus.isStale).toBe(true);
      expect(result.metadata.freshnessStatus.warning).toMatch(
        /STALE DATA WARNING/,
      );
    });
  });

  // ── getGribData early-morning cycleHour (lines 462-463) ───────────────────
  describe("getGribData — early-morning cycle fall-through", () => {
    it("uses previous day's 18Z cycle when UTC hour is 0-3", async () => {
      const originalDate = Date;
      const fakeNow = new originalDate("2026-04-21T02:00:00Z");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spy = jest
        .spyOn(global, "Date")
        .mockImplementation((...args: any[]) => {
          if (args.length === 0) return fakeNow;
          // @ts-expect-error spread through constructor
          return new originalDate(...args);
        });
      // Preserve Date.now
      // eslint-disable-next-line @typescript-eslint/unbound-method
      (Date as unknown as { now: () => number }).now = () => fakeNow.getTime();

      const result = await agent.handleToolCall("get_grib_data", {
        bounds: { north: 45, south: 40, east: -70, west: -75 },
        resolution: "1.0",
        parameters: ["wind"],
      });

      // "1.0" resolution branch → 1p00 token. Early morning → previous date + 18Z.
      expect(result.url).toMatch(/1p00/);
      expect(result.cycle).toMatch(/2026042018$/); // prev UTC date + 18
      spy.mockRestore();
    });

    it("uses the 0.25-degree resolution token for resolution='0.25'", async () => {
      const result = await agent.handleToolCall("get_grib_data", {
        bounds: { north: 45, south: 40, east: -70, west: -75 },
        resolution: "0.25",
        parameters: ["wind"],
      });
      expect(result.url).toMatch(/0p25/);
    });
  });

  // ── estimateWaveHeight high seas (lines 500-501) ─────────────────────────
  describe("estimateWaveHeight — phenomenal seas", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const est = async (windMps: number) =>
      (agent as any).estimateWaveHeight(windMps, 42, -71);

    it("returns 9.0m for ~55 knot winds", async () => {
      // 28.5 m/s ≈ 55 knots → <56 → 9.0
      expect(await est(28.5)).toBe(9.0);
    });

    it("returns 11.5m for ~60 knot winds", async () => {
      // 30.9 m/s ≈ 60 knots → <64 → 11.5
      expect(await est(30.9)).toBe(11.5);
    });

    it("returns 14.0m for hurricane-force 80+ knot winds", async () => {
      // 45 m/s ≈ 87 knots → else → 14.0
      expect(await est(45)).toBe(14.0);
    });

    it("returns 0.0m for <1 knot winds", async () => {
      expect(await est(0.3)).toBe(0);
    });
  });

  // ── findWeatherWindow window-chaining branches (lines 627-635) ───────────
  describe("findWeatherWindow — mixed conditions", () => {
    it("records a too-short interrupted window and then a suitable one", async () => {
      // Mock cached forecast path so we control the forecast series exactly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(agent as any, "getMarineForecast").mockResolvedValueOnce({
        forecasts: [
          // 3h good window (too short for 12h duration) — will be labelled "Too short"
          {
            time: new Date(0 * 3600_000),
            windSpeed: 10,
            waveHeight: 2,
            wavePeriod: 5,
            waveDirection: 0,
            precipitation: 0,
            visibility: 10,
            temperature: 20,
            pressure: 1013,
            cloudCover: 0,
            confidence: "high",
          },
          {
            time: new Date(1 * 3600_000),
            windSpeed: 10,
            waveHeight: 2,
            wavePeriod: 5,
            waveDirection: 0,
            precipitation: 0,
            visibility: 10,
            temperature: 20,
            pressure: 1013,
            cloudCover: 0,
            confidence: "high",
          },
          {
            time: new Date(2 * 3600_000),
            windSpeed: 10,
            waveHeight: 2,
            wavePeriod: 5,
            waveDirection: 0,
            precipitation: 0,
            visibility: 10,
            temperature: 20,
            pressure: 1013,
            cloudCover: 0,
            confidence: "high",
          },
          // storm gap
          {
            time: new Date(3 * 3600_000),
            windSpeed: 40,
            waveHeight: 12,
            wavePeriod: 5,
            waveDirection: 0,
            precipitation: 0,
            visibility: 10,
            temperature: 20,
            pressure: 1013,
            cloudCover: 0,
            confidence: "high",
          },
          // 12h acceptable window (meets duration requirement)
          ...Array.from({ length: 12 }, (_, i) => ({
            time: new Date((4 + i) * 3600_000),
            windSpeed: 12,
            waveHeight: 3,
            wavePeriod: 5,
            waveDirection: 0,
            precipitation: 0,
            visibility: 10,
            temperature: 20,
            pressure: 1013,
            cloudCover: 0,
            confidence: "high" as const,
          })),
        ],
        metadata: {
          fetchedAt: new Date().toISOString(),
          dataAgeMinutes: 0,
          freshnessStatus: { isStale: false, ageMinutes: 0, maxAgeMinutes: 30 },
          source: "test",
        },
      } as never);

      const result = await agent.handleToolCall("find_weather_window", {
        latitude: 42.36,
        longitude: -71.06,
        duration_hours: 12,
        max_wind_knots: 20,
        max_wave_feet: 6,
        days_ahead: 1,
      });

      expect(result).toHaveProperty("windowsFound");
      expect(result.windowsFound).toBeGreaterThanOrEqual(1);
      expect(result.recommendation).toMatch(/Best departure/);
    });

    it("records the final open window when the forecast series ends mid-window", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(agent as any, "getMarineForecast").mockResolvedValueOnce({
        forecasts: Array.from({ length: 6 }, (_, i) => ({
          time: new Date(i * 3600_000),
          windSpeed: 10,
          waveHeight: 2,
          wavePeriod: 5,
          waveDirection: 0,
          precipitation: 0,
          visibility: 10,
          temperature: 20,
          pressure: 1013,
          cloudCover: 0,
          confidence: "high" as const,
        })),
        metadata: {
          fetchedAt: new Date().toISOString(),
          dataAgeMinutes: 0,
          freshnessStatus: { isStale: false, ageMinutes: 0, maxAgeMinutes: 30 },
          source: "test",
        },
      } as never);

      const result = await agent.handleToolCall("find_weather_window", {
        latitude: 42.36,
        longitude: -71.06,
        duration_hours: 24,
      });
      // 6h of acceptable conditions, but 24h required → too short trailing window
      expect(result.windowsFound).toBe(0);
      expect(result.recommendation).toMatch(/No suitable weather windows/);
    });
  });

  // ── analyzeSeaState summary (lines 710-713) ──────────────────────────────
  describe("analyzeSeaState — summary block", () => {
    it("computes safestPeriod and roughestPeriod across multiple periods", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(agent as any, "getMarineForecast").mockResolvedValueOnce({
        forecasts: [
          {
            time: new Date(0),
            windSpeed: 5,
            waveHeight: 1,
            wavePeriod: 5,
            waveDirection: 0,
            precipitation: 0,
            visibility: 10,
            temperature: 20,
            pressure: 1013,
            cloudCover: 0,
            confidence: "high",
          },
          {
            time: new Date(3600_000),
            windSpeed: 25,
            waveHeight: 10,
            wavePeriod: 6,
            waveDirection: 90,
            precipitation: 0,
            visibility: 5,
            temperature: 18,
            pressure: 1000,
            cloudCover: 80,
            confidence: "high",
          },
          {
            time: new Date(7200_000),
            windSpeed: 15,
            waveHeight: 4,
            wavePeriod: 5,
            waveDirection: 180,
            precipitation: 0,
            visibility: 10,
            temperature: 19,
            pressure: 1010,
            cloudCover: 50,
            confidence: "high",
          },
        ],
        metadata: {
          fetchedAt: new Date().toISOString(),
          dataAgeMinutes: 0,
          freshnessStatus: { isStale: false, ageMinutes: 0, maxAgeMinutes: 30 },
          source: "test",
        },
      } as never);

      const result = await agent.handleToolCall("analyze_sea_state", {
        latitude: 42.36,
        longitude: -71.06,
        hours: 3,
      });

      expect(result.summary.maxWaveHeight).toBe(10);
      expect(result.summary.safestPeriod.waveHeight.feet).toBe(1);
      expect(result.summary.roughestPeriod.waveHeight.feet).toBe(10);
      expect(result.summary.maxDouglasScale).toBeGreaterThanOrEqual(3);
    });
  });

  // ── assessSeaConditions (line 765) ────────────────────────────────────────
  describe("assessSeaConditions — full ladder", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assess = (wind: number, waves: number) =>
      (agent as any).assessSeaConditions(wind, waves);

    it("reports 'Excellent' for calm conditions", () => {
      expect(assess(5, 1)).toMatch(/Excellent/);
    });
    it("reports 'Good' for light-wind comfortable seas", () => {
      expect(assess(12, 3)).toMatch(/Good/);
    });
    it("reports 'Fair' for moderate conditions", () => {
      expect(assess(18, 5)).toMatch(/Fair/);
    });
    it("reports 'Challenging' when near small-craft-advisory thresholds", () => {
      expect(assess(22, 7)).toMatch(/Challenging/);
    });
    it("reports 'Rough' for 25-35 knots + 8-12 ft seas", () => {
      expect(assess(30, 11)).toMatch(/Rough/);
    });
    it("reports 'Severe' for gale+ conditions (>=35kt or >=12ft)", () => {
      expect(assess(40, 15)).toMatch(/Severe/);
    });
  });

  // ── assessSeaSafety (lines 776, 788) ──────────────────────────────────────
  describe("assessSeaSafety — full ladder", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safety = (wind: number, waves: number) =>
      (agent as any).assessSeaSafety(wind, waves);

    it("returns 'safe' for benign conditions", () => {
      expect(safety(10, 2).level).toBe("safe");
    });
    it("returns 'caution' for small-craft-advisory territory", () => {
      expect(safety(22, 7).level).toBe("caution");
    });
    it("returns 'warning' for 25-35 knot winds / 8-12 ft seas", () => {
      expect(safety(28, 9).level).toBe("warning");
    });
    it("returns 'dangerous' for gale or >=12ft seas", () => {
      const res = safety(40, 14);
      expect(res.level).toBe("dangerous");
      expect(res.message).toMatch(/DANGEROUS/);
    });
  });

  // ── waveHeightToDouglasScale high-seas (lines 731-734) ───────────────────
  describe("waveHeightToDouglasScale — high seas", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scale = (feet: number) =>
      (agent as any).waveHeightToDouglasScale(feet);

    it("returns 7 (High) for 20-29 ft waves", () => {
      expect(scale(23)).toBe(7); // 23 ft ≈ 7 m
    });
    it("returns 8 (Very high) for ~30-45 ft waves", () => {
      expect(scale(35)).toBe(8); // 35 ft ≈ 10.7 m
    });
    it("returns 9 (Phenomenal) for >=46 ft waves", () => {
      expect(scale(60)).toBe(9); // 60 ft ≈ 18.3 m
    });
    it("returns 0 (Calm glassy) for 0 ft", () => {
      expect(scale(0)).toBe(0);
    });
  });

  // ── parseStormCategory (line 811) ─────────────────────────────────────────
  describe("parseStormCategory", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parse = (s: string) => (agent as any).parseStormCategory(s);

    it("parses 'Category 5' as 5", () => {
      expect(parse("Category 5 Hurricane")).toBe(5);
    });
    it("parses 'Cat 3' as 3", () => {
      expect(parse("Cat 3 hurricane")).toBe(3);
    });
    it("treats generic 'Hurricane' as 1", () => {
      expect(parse("Hurricane")).toBe(1);
    });
    it("treats 'Tropical Storm' as 0", () => {
      expect(parse("Tropical Storm")).toBe(0);
    });
    it("returns -1 for unrecognised classifications", () => {
      expect(parse("post-tropical depression fragment")).toBe(-1);
    });
  });

  // ── getWeatherWarnings catch path (lines 448-449) ─────────────────────────
  describe("getWeatherWarnings — upstream failure", () => {
    it("reports degraded and re-throws when NOAA alerts endpoint fails", async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 503 },
        message: "Service Unavailable",
      });

      await expect(
        agent.handleToolCall("get_weather_warnings", {
          latitude: 42.36,
          longitude: -71.06,
        }),
      ).rejects.toBeDefined();
    });
  });
});
