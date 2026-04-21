/**
 * Supplemental WeatherAgent (index.ts) coverage — Phase 4.3
 *
 * The main index.test.ts exercises `callTool()` but never reaches:
 *   - the MCP protocol handlers registered via `server.setRequestHandler(...)`
 *     (lines 83-84 list_tools, 195-223 call_tool)
 *   - `getAgentSpecificHealth()` (lines 73-78)
 *   - the success branches of `getBuoyWaveData` / `getRouteWindField`
 *     (lines 553-559, 606-611)
 *   - the degraded / unhealthy / catch branches of `checkHealth`
 *     (lines 467, 484-489, 500-505, 525)
 *
 * This file plugs those gaps by:
 *   1. Mocking the MCP Server so `setRequestHandler` captures each handler
 *      into a module-level Map, so we can invoke them directly.
 *   2. Using service mocks that return populated success shapes so the
 *      buoy/GRIB success branches run.
 *   3. Swapping circuit-breaker state / service behaviour per test to hit
 *      the degraded / unhealthy / outer-catch branches in checkHealth.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// ── Capture MCP handlers ────────────────────────────────────────────────────
const capturedHandlers = new Map<unknown, (req: unknown) => Promise<unknown>>();

jest.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: (
      schema: unknown,
      handler: (req: unknown) => Promise<unknown>,
    ) => {
      capturedHandlers.set(schema, handler);
    },
    onerror: null,
    connect: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  })),
}));

// ── Shared mock forecast ────────────────────────────────────────────────────
const mockForecast = {
  location: { latitude: 42.36, longitude: -71.06, name: "Boston" },
  issuedAt: new Date(),
  periods: [
    {
      startTime: new Date(),
      endTime: new Date(Date.now() + 6 * 3600_000),
      temperature: 72,
      temperatureUnit: "F",
      windSpeed: "10 mph",
      windDirection: "SW",
      shortForecast: "Partly Cloudy",
      detailedForecast: "Partly cloudy with a light southwest wind.",
      precipitationChance: 10,
      isDaytime: true,
    },
  ],
  warnings: [] as Array<{
    headline: string;
    severity: string;
    onset: Date;
    expires: Date;
  }>,
  waveHeight: [],
  windData: [{ time: new Date(), speed: 10, gusts: 15, direction: 225 }],
  visibility: [],
};

// Mutable refs so tests can override service behaviour without re-mocking.
const serviceState = {
  forecast: mockForecast,
  forecastThrows: false as boolean | Error,
  redisGetThrows: false as boolean | Error,
  circuitState: "CLOSED" as string,
  buoyRouteResult: {
    buoys: [{ stationId: "44013", distance_nm: 12.3 }],
    worstConditions: { significantWaveHeight: 2.4 },
    overallHazard: "moderate",
    coverage: "partial",
  } as unknown,
  buoyRouteThrows: false as boolean | Error,
  windFieldResult: {
    source: "GFS",
    waypoints: [{ forecasts: [{ hour: 0 }, { hour: 6 }, { hour: 12 }] }],
    worstCase: { maxWindSpeed: 28.4, maxWaveHeight: 3.1, minPressure: 1001 },
  } as unknown,
};

jest.mock("@passage-planner/shared", () => {
  const actual = jest.requireActual("@passage-planner/shared") as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    CacheManager: jest.fn().mockImplementation(() => ({
      get: jest.fn(async () => {
        if (serviceState.redisGetThrows)
          throw serviceState.redisGetThrows === true
            ? new Error("redis down")
            : serviceState.redisGetThrows;
        return null;
      }),
      set: jest.fn(async () => {}),
      setWithTTL: jest.fn(async () => {}),
      getWithMetadata: jest.fn(async () => null),
      delete: jest.fn(async () => {}),
    })),
    NOAAWeatherService: jest.fn().mockImplementation(() => ({
      getMarineForecast: jest.fn(async () => {
        if (serviceState.forecastThrows)
          throw serviceState.forecastThrows === true
            ? new Error("NOAA down")
            : serviceState.forecastThrows;
        return serviceState.forecast;
      }),
      checkSafetyConditions: jest.fn(async () => ({
        safe: true,
        warnings: [],
      })),
    })),
    NDBCBuoyService: jest.fn().mockImplementation(() => ({
      getWaveDataForRoute: jest.fn(async () => {
        if (serviceState.buoyRouteThrows)
          throw serviceState.buoyRouteThrows === true
            ? new Error("buoy down")
            : serviceState.buoyRouteThrows;
        return serviceState.buoyRouteResult;
      }),
    })),
    GribService: jest.fn().mockImplementation(() => ({
      getRouteWindField: jest.fn(async () => serviceState.windFieldResult),
    })),
    CircuitBreakerFactory: {
      create: jest.fn((_name: string, fn: (...args: unknown[]) => unknown) => ({
        fire: fn,
      })),
      getState: jest.fn(() => serviceState.circuitState),
      getMetrics: jest.fn(() => ({ failures: 1, successes: 9 })),
    },
  };
});

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WeatherAgent } from "../index";

describe("WeatherAgent (index.ts) — supplemental coverage", () => {
  let agent: WeatherAgent;

  beforeEach(() => {
    capturedHandlers.clear();
    serviceState.forecast = mockForecast;
    serviceState.forecastThrows = false;
    serviceState.redisGetThrows = false;
    serviceState.circuitState = "CLOSED";
    serviceState.buoyRouteResult = {
      buoys: [{ stationId: "44013", distance_nm: 12.3 }],
      worstConditions: { significantWaveHeight: 2.4 },
      overallHazard: "moderate",
      coverage: "partial",
    };
    serviceState.buoyRouteThrows = false;
    serviceState.windFieldResult = {
      source: "GFS",
      waypoints: [{ forecasts: [{ hour: 0 }, { hour: 6 }, { hour: 12 }] }],
      worstCase: { maxWindSpeed: 28.4, maxWaveHeight: 3.1, minPressure: 1001 },
    };
    agent = new WeatherAgent();
  });

  // ── getAgentSpecificHealth ────────────────────────────────────────────────
  describe("getAgentSpecificHealth", () => {
    it("returns the weather-service health snapshot", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const details = (agent as any).getAgentSpecificHealth();
      expect(details.weatherServiceActive).toBe(true);
      expect(details.cacheStatus).toBe("active");
      expect(details.lastForecastTime).toBeInstanceOf(Date);
    });
  });

  // ── MCP list_tools handler ────────────────────────────────────────────────
  describe("MCP list_tools handler", () => {
    it("returns the full tool catalogue", async () => {
      const handler = capturedHandlers.get(ListToolsRequestSchema);
      expect(handler).toBeDefined();
      const result = (await handler!({})) as { tools: Array<{ name: string }> };
      expect(Array.isArray(result.tools)).toBe(true);
      const names = result.tools.map((t) => t.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "get_marine_weather",
          "check_weather_safety",
          "get_weather_windows",
          "get_buoy_wave_data",
          "get_route_wind_field",
          "health",
        ]),
      );
    });
  });

  // ── MCP call_tool handler ─────────────────────────────────────────────────
  describe("MCP call_tool handler (dispatches every branch)", () => {
    const invoke = async (name: string, args: Record<string, unknown>) => {
      const handler = capturedHandlers.get(CallToolRequestSchema);
      return (await handler!({ params: { name, arguments: args } })) as {
        content: Array<{ type: string; text?: string; data?: unknown }>;
      };
    };

    it("dispatches get_marine_weather", async () => {
      const result = await invoke("get_marine_weather", {
        latitude: 42.36,
        longitude: -71.06,
      });
      expect(result.content).toBeDefined();
    });

    it("dispatches check_weather_safety", async () => {
      const result = await invoke("check_weather_safety", {
        latitude: 42.36,
        longitude: -71.06,
      });
      expect(result.content).toBeDefined();
    });

    it("dispatches get_weather_windows", async () => {
      const result = await invoke("get_weather_windows", {
        startLat: 42.36,
        startLon: -71.06,
        endLat: 41.49,
        endLon: -71.31,
        departureDate: new Date(Date.now() + 86_400_000).toISOString(),
        durationHours: 12,
      });
      expect(result.content).toBeDefined();
    });

    it("dispatches get_buoy_wave_data", async () => {
      const result = await invoke("get_buoy_wave_data", {
        waypoints: [{ latitude: 42.36, longitude: -71.06 }],
      });
      expect(result.content).toBeDefined();
    });

    it("dispatches get_route_wind_field", async () => {
      const result = await invoke("get_route_wind_field", {
        waypoints: [
          { latitude: 42.36, longitude: -71.06 },
          { latitude: 41.49, longitude: -71.31 },
        ],
      });
      expect(result.content).toBeDefined();
    });

    it("dispatches health", async () => {
      const result = await invoke("health", {});
      expect(result.content).toBeDefined();
    });

    it("rethrows for unknown tool names", async () => {
      const handler = capturedHandlers.get(CallToolRequestSchema);
      await expect(
        handler!({ params: { name: "not-a-tool", arguments: {} } }),
      ).rejects.toThrow(/Unknown tool/);
    });
  });

  // ── getBuoyWaveData success branch ────────────────────────────────────────
  describe("get_buoy_wave_data — populated result", () => {
    it("formats the buoy summary when buoys are returned", async () => {
      const result = (await agent.callTool("get_buoy_wave_data", {
        waypoints: [{ latitude: 42.36, longitude: -71.06 }],
      })) as {
        content: Array<{ type: string; text?: string; data?: unknown }>;
      };
      const text = result.content.find((c) => c.type === "text")?.text || "";
      expect(text).toMatch(/Found 1 NDBC buoy/);
      expect(text).toMatch(/Worst conditions/);
      expect(text).toMatch(/2\.4m wave height/);
      expect(text).toMatch(/Overall hazard: moderate/);
      expect(text).toMatch(/Coverage: partial/);
    });

    it("reports the no-data summary when the buoy list is empty", async () => {
      serviceState.buoyRouteResult = {
        buoys: [],
        worstConditions: null,
        overallHazard: "unknown",
        coverage: "none",
      };
      const result = (await agent.callTool("get_buoy_wave_data", {
        waypoints: [{ latitude: 42.36, longitude: -71.06 }],
      })) as { content: Array<{ type: string; text?: string }> };
      const text = result.content.find((c) => c.type === "text")?.text || "";
      expect(text).toMatch(/No NDBC buoy data/);
    });
  });

  // ── getRouteWindField success branch ──────────────────────────────────────
  describe("get_route_wind_field — populated result", () => {
    it("formats the wind-field summary when the GRIB source is available", async () => {
      const result = (await agent.callTool("get_route_wind_field", {
        waypoints: [
          { latitude: 42.36, longitude: -71.06 },
          { latitude: 41.49, longitude: -71.31 },
        ],
      })) as { content: Array<{ type: string; text?: string }> };
      const text = result.content.find((c) => c.type === "text")?.text || "";
      expect(text).toMatch(/Wind field data for 1 waypoints/);
      expect(text).toMatch(/28\.4kt wind/);
      expect(text).toMatch(/3\.1m waves/);
      expect(text).toMatch(/1001hPa/);
    });

    it("returns the unavailable message when GRIB source is unavailable", async () => {
      serviceState.windFieldResult = {
        source: "unavailable",
        waypoints: [],
        worstCase: { maxWindSpeed: 0, maxWaveHeight: 0, minPressure: 0 },
      };
      const result = (await agent.callTool("get_route_wind_field", {
        waypoints: [
          { latitude: 42.36, longitude: -71.06 },
          { latitude: 41.49, longitude: -71.31 },
        ],
      })) as { content: Array<{ type: string; text?: string }> };
      const text = result.content.find((c) => c.type === "text")?.text || "";
      expect(text).toMatch(/Gridded wind field data unavailable/);
    });
  });

  // ── checkHealth branches ──────────────────────────────────────────────────
  describe("health — degraded / unhealthy paths", () => {
    it("reports degraded when any circuit is OPEN", async () => {
      serviceState.circuitState = "OPEN";
      const result = (await agent.callTool("health", {})) as {
        content: Array<{ type: string; text?: string }>;
      };
      const parsed = JSON.parse(
        result.content.find((c) => c.type === "text")!.text!,
      );
      expect(parsed.status).toBe("degraded");
      expect(parsed.circuitStates["noaa-gridpoint"].state).toBe("OPEN");
    });

    it("flags NOAA unhealthy when the forecast probe throws", async () => {
      serviceState.forecastThrows = new Error("NOAA unreachable");
      const result = (await agent.callTool("health", {})) as {
        content: Array<{ type: string; text?: string }>;
      };
      const parsed = JSON.parse(
        result.content.find((c) => c.type === "text")!.text!,
      );
      expect(parsed.status).toBe("unhealthy");
      expect(parsed.dependencies.noaaApi.status).toBe("unhealthy");
      expect(parsed.dependencies.noaaApi.error).toMatch(/NOAA unreachable/);
    });

    it("flags Redis as unhealthy when cache.get throws", async () => {
      serviceState.redisGetThrows = new Error("redis timeout");
      const result = (await agent.callTool("health", {})) as {
        content: Array<{ type: string; text?: string }>;
      };
      const parsed = JSON.parse(
        result.content.find((c) => c.type === "text")!.text!,
      );
      expect(parsed.dependencies.redis.status).toBe("unhealthy");
      expect(parsed.dependencies.redis.error).toMatch(/redis timeout/);
      // A redis failure alone only downgrades to degraded.
      expect(["degraded", "unhealthy"]).toContain(parsed.status);
    });

    it("computes a non-zero error rate when metrics show failures + successes", async () => {
      const result = (await agent.callTool("health", {})) as {
        content: Array<{ type: string; text?: string }>;
      };
      const parsed = JSON.parse(
        result.content.find((c) => c.type === "text")!.text!,
      );
      expect(parsed.errorRate).toBeGreaterThan(0);
    });
  });

  // ── get_weather_windows empty-result branch ──────────────────────────────
  describe("get_weather_windows — empty result message", () => {
    it("reports 'No safe weather windows' when forecasts carry active severe warnings", async () => {
      // Force isWindowSafe → false by injecting a severe warning that overlaps.
      const now = new Date();
      const soon = new Date(Date.now() + 7 * 24 * 3600_000);
      serviceState.forecast = {
        ...mockForecast,
        warnings: [
          {
            headline: "Gale Warning",
            severity: "severe",
            onset: now,
            expires: soon,
          },
        ],
      };

      const result = (await agent.callTool("get_weather_windows", {
        startLat: 42.36,
        startLon: -71.06,
        endLat: 41.49,
        endLon: -71.31,
        departureDate: now.toISOString(),
        durationHours: 12,
      })) as {
        content: Array<{
          type: string;
          text?: string;
          data?: { windows: unknown[] };
        }>;
      };

      const text = result.content.find((c) => c.type === "text")?.text || "";
      expect(text).toMatch(/No safe weather windows/);
      const data = result.content.find((c) => c.type === "data")?.data as {
        windows: unknown[];
      };
      expect(data.windows).toEqual([]);
    });
  });

  // ── get_marine_weather formats warnings block ────────────────────────────
  describe("formatWeatherSummary — warnings block", () => {
    it("includes the WEATHER WARNINGS section when forecast.warnings is non-empty", async () => {
      serviceState.forecast = {
        ...mockForecast,
        warnings: [
          {
            headline: "Small Craft Advisory",
            severity: "moderate",
            onset: new Date(),
            expires: new Date(Date.now() + 24 * 3600_000),
          },
        ],
      };
      const result = (await agent.callTool("get_marine_weather", {
        latitude: 42.36,
        longitude: -71.06,
      })) as { content: Array<{ type: string; text?: string }> };
      const text = result.content.find((c) => c.type === "text")?.text || "";
      expect(text).toMatch(/WEATHER WARNINGS/);
      expect(text).toMatch(/Small Craft Advisory/);
    });
  });
});
