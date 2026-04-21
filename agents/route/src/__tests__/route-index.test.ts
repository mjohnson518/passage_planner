/**
 * RouteAgent (index.ts) Tests — Phase 4 Coverage Push
 *
 * `index.ts` exports the BaseAgent-backed RouteAgent used by SimpleOrchestrator
 * (the main production orchestrator). Before this file it was 0% covered.
 *
 * These tests exercise the public `callTool()` API which dispatches to every
 * private tool handler, and cover the cache-hit / cache-miss branches, all
 * three route-type branches, and the error paths.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// CacheManager from shared runs in pass-through mode when REDIS_URL is unset.
// Tests only depend on that behavior — no extra mocking required.
delete process.env.REDIS_URL;

import { RouteAgent } from "../index";

type ToolResult = {
  content: Array<{ type: string; text?: string; data?: unknown }>;
  isError?: boolean;
};

const findText = (result: ToolResult): string =>
  (result.content.find((c) => c.type === "text")?.text as string) || "";

const findData = <T = unknown>(result: ToolResult): T | undefined =>
  result.content.find((c) => c.type === "data")?.data as T | undefined;

describe("RouteAgent (index.ts)", () => {
  let agent: RouteAgent;

  beforeEach(() => {
    agent = new RouteAgent();
  });

  describe("construction & tooling surface", () => {
    it("constructs with no arguments", () => {
      expect(agent).toBeInstanceOf(RouteAgent);
    });

    it("rejects unknown tool names via callTool", async () => {
      await expect(agent.callTool("not_a_tool", {})).rejects.toThrow(
        /Unknown tool/,
      );
    });

    it("reports health with routing-engine metadata", async () => {
      const result = (await agent.callTool("health", {})) as ToolResult;
      const text = findText(result);
      expect(text).toContain("routingEngine");
      const parsed = JSON.parse(text);
      expect(parsed.status).toMatch(/healthy|degraded/);
      expect(parsed.routingEngine.algorithmsAvailable).toEqual(
        expect.arrayContaining(["great_circle", "rhumb_line", "optimal"]),
      );
    });
  });

  describe("calculate_route", () => {
    const boston = { startLat: 42.3601, startLon: -71.0589 };
    const portland = { endLat: 43.6591, endLon: -70.2568 };

    it("returns a route for the default optimal routeType", async () => {
      const result = (await agent.callTool("calculate_route", {
        ...boston,
        ...portland,
        speed: 6,
      })) as ToolResult;

      expect(result.isError).not.toBe(true);
      const text = findText(result);
      expect(text).toMatch(/Route Calculated/);
      expect(text).toMatch(/Total Distance/);
      const data = findData<{ waypoints: unknown[]; totalDistance: number }>(
        result,
      );
      expect(data).toBeDefined();
      expect(data!.totalDistance).toBeGreaterThan(0);
      expect(Array.isArray(data!.waypoints)).toBe(true);
    });

    it("honors routeType=great_circle", async () => {
      const result = (await agent.callTool("calculate_route", {
        ...boston,
        ...portland,
        speed: 5,
        routeType: "great_circle",
      })) as ToolResult;
      const text = findText(result);
      expect(text).toMatch(/GREAT CIRCLE/);
    });

    it("honors routeType=rhumb_line", async () => {
      const result = (await agent.callTool("calculate_route", {
        ...boston,
        ...portland,
        speed: 5,
        routeType: "rhumb_line",
      })) as ToolResult;
      const text = findText(result);
      expect(text).toMatch(/RHUMB LINE/);
    });

    it("falls back to optimal when routeType is unrecognised", async () => {
      const result = (await agent.callTool("calculate_route", {
        ...boston,
        ...portland,
        speed: 5,
        routeType: "made-up-route-type",
      })) as ToolResult;
      expect(result.isError).not.toBe(true);
      expect(findText(result)).toMatch(/Route Calculated/);
    });

    it("returns an isError response on invalid latitude", async () => {
      const result = (await agent.callTool("calculate_route", {
        startLat: 999,
        startLon: -71,
        endLat: 43,
        endLon: -70,
      })) as ToolResult;
      expect(result.isError).toBe(true);
      expect(findText(result)).toMatch(/Unable to calculate route/);
      expect(findText(result)).toMatch(/latitude/i);
    });

    it("returns an isError response on invalid longitude", async () => {
      const result = (await agent.callTool("calculate_route", {
        startLat: 42,
        startLon: 999,
        endLat: 43,
        endLon: -70,
      })) as ToolResult;
      expect(result.isError).toBe(true);
      expect(findText(result)).toMatch(/longitude/i);
    });

    it("caches routes and serves the cache-hit branch on repeat calls", async () => {
      // CacheManager without REDIS_URL is pass-through — simulate the hit
      // branch by spying on the internal cache instance.
      const cached = {
        type: "great_circle",
        totalDistance: 123.4,
        estimatedDuration: 24.68,
        waypoints: [
          { lat: 42, lon: -71, distance: 0, bearing: 0, name: "Start" },
          { lat: 43, lon: -70, distance: 123.4, bearing: 45, name: "End" },
        ],
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cacheInstance = (agent as any).cache;
      const getSpy = jest
        .spyOn(cacheInstance, "get")
        .mockResolvedValue(cached as never);

      const result = (await agent.callTool("calculate_route", {
        ...boston,
        ...portland,
      })) as ToolResult;

      expect(getSpy).toHaveBeenCalledTimes(1);
      const data = findData<typeof cached>(result);
      expect(data).toEqual(cached);
      expect(findText(result)).toMatch(/Route Calculated/);
    });
  });

  describe("calculate_distance", () => {
    it("returns both great-circle and rhumb-line distances", async () => {
      const result = (await agent.callTool("calculate_distance", {
        startLat: 42.3601,
        startLon: -71.0589,
        endLat: 51.5074,
        endLon: -0.1278, // Boston → London (shows meaningful gap)
      })) as ToolResult;

      expect(result.isError).not.toBe(true);
      expect(findText(result)).toMatch(/Great Circle/);
      expect(findText(result)).toMatch(/Rhumb Line/);
      const data = findData<{
        greatCircle: number;
        rhumbLine: number;
        units: string;
      }>(result);
      expect(data).toBeDefined();
      expect(data!.units).toBe("nautical_miles");
      expect(data!.greatCircle).toBeGreaterThan(0);
      expect(data!.rhumbLine).toBeGreaterThan(0);
    });

    it("returns an isError response on invalid coordinates", async () => {
      const result = (await agent.callTool("calculate_distance", {
        startLat: -999,
        startLon: 0,
        endLat: 0,
        endLon: 0,
      })) as ToolResult;
      expect(result.isError).toBe(true);
      expect(findText(result)).toMatch(/Unable to calculate distance/);
    });
  });

  describe("optimize_waypoints", () => {
    it("chains segments across multiple waypoints and returns an optimized route", async () => {
      const result = (await agent.callTool("optimize_waypoints", {
        waypoints: [
          { lat: 42.36, lon: -71.06 }, // Boston
          { lat: 41.31, lon: -72.92 }, // New Haven
          { lat: 40.71, lon: -74.01 }, // New York
        ],
        speed: 6,
      })) as ToolResult;

      expect(result.isError).not.toBe(true);
      const data = findData<{
        waypoints: unknown[];
        totalDistance: number;
        estimatedDuration: number;
      }>(result);
      expect(data).toBeDefined();
      expect(data!.totalDistance).toBeGreaterThan(0);
      expect(data!.estimatedDuration).toBeCloseTo(data!.totalDistance / 6, 1);
      // first waypoint is preserved; last is appended exactly
      expect(data!.waypoints.length).toBeGreaterThanOrEqual(3);
    });

    it("uses the default speed when none is provided", async () => {
      const result = (await agent.callTool("optimize_waypoints", {
        waypoints: [
          { lat: 42.36, lon: -71.06 },
          { lat: 41.31, lon: -72.92 },
        ],
      })) as ToolResult;

      const data = findData<{
        totalDistance: number;
        estimatedDuration: number;
      }>(result);
      expect(data).toBeDefined();
      // default speed is 5 kt
      expect(data!.estimatedDuration).toBeCloseTo(data!.totalDistance / 5, 1);
    });

    it("returns isError when fewer than 2 waypoints are supplied", async () => {
      const result = (await agent.callTool("optimize_waypoints", {
        waypoints: [{ lat: 42, lon: -71 }],
      })) as ToolResult;
      expect(result.isError).toBe(true);
      expect(findText(result)).toMatch(/at least 2 waypoints/i);
    });

    it("returns isError on malformed waypoints (invalid coordinates)", async () => {
      const result = (await agent.callTool("optimize_waypoints", {
        waypoints: [
          { lat: 999, lon: -71 },
          { lat: 42, lon: -71 },
        ],
      })) as ToolResult;
      expect(result.isError).toBe(true);
      expect(findText(result)).toMatch(/Unable to optimize waypoints/);
    });
  });

  describe("formatRouteResponse", () => {
    it("formats waypoint bearing/distance/ETA blocks", async () => {
      const result = (await agent.callTool("calculate_route", {
        startLat: 42.3601,
        startLon: -71.0589,
        endLat: 41.3559,
        endLon: -72.0895,
        speed: 5,
      })) as ToolResult;

      const text = findText(result);
      // Each waypoint line includes coordinate, distance (nm), bearing (°T), and ETA field
      expect(text).toMatch(/nm/);
      expect(text).toMatch(/°T/);
      expect(text).toMatch(/ETA:/);
    });
  });
});
