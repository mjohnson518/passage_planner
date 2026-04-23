/**
 * Supplemental TidalAgent coverage — MCP protocol handlers.
 *
 * The existing tool-dispatch.test.ts exercises the class-level `callTool`
 * method but never reaches the MCP handlers registered via
 * `server.setRequestHandler(...)` in `setupTools()` (index.ts lines 86-150
 * for ListTools, 153-174 for CallTool). This file captures both handlers
 * through a mocked MCP Server so they can be invoked directly and their
 * response shapes asserted.
 *
 * Mirrors the pattern used in agents/weather/src/__tests__/index-extra.test.ts.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

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

const mockTidalService = {
  findNearestStations:
    jest.fn<
      (lat: number, lon: number, radius?: number) => Promise<unknown[]>
    >(),
  getTidalPredictions:
    jest.fn<(stationId: string, start: Date, end: Date) => Promise<unknown>>(),
  calculateTidalWindows: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
};

jest.mock("@passage-planner/shared", () => {
  const actual = jest.requireActual("@passage-planner/shared") as Record<
    string,
    unknown
  >;
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

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TidalAgent } from "../index";

describe("TidalAgent — MCP protocol handlers", () => {
  beforeEach(() => {
    capturedHandlers.clear();
    mockTidalService.findNearestStations.mockReset();
    mockTidalService.getTidalPredictions.mockReset();
    mockTidalService.calculateTidalWindows.mockReset();
    // Instantiating the agent registers both handlers into capturedHandlers
    // via the mocked Server.setRequestHandler.
    new TidalAgent();
  });

  describe("list_tools handler", () => {
    it("returns the full tool catalogue with schemas", async () => {
      const handler = capturedHandlers.get(ListToolsRequestSchema);
      expect(handler).toBeDefined();
      const result = (await handler!({})) as {
        tools: Array<{ name: string; inputSchema: { required?: string[] } }>;
      };
      expect(Array.isArray(result.tools)).toBe(true);
      const names = result.tools.map((t) => t.name);
      expect(names).toEqual([
        "get_tidal_stations",
        "get_tides",
        "calculate_tidal_windows",
      ]);
      const windowsTool = result.tools.find(
        (t) => t.name === "calculate_tidal_windows",
      );
      expect(windowsTool?.inputSchema.required).toEqual(
        expect.arrayContaining([
          "stationId",
          "startDate",
          "endDate",
          "requiredDepth",
        ]),
      );
    });
  });

  describe("call_tool handler", () => {
    const invoke = async (name: string, args: Record<string, unknown>) => {
      const handler = capturedHandlers.get(CallToolRequestSchema);
      expect(handler).toBeDefined();
      return (await handler!({ params: { name, arguments: args } })) as {
        content: Array<{ type: string; text?: string; data?: unknown }>;
        isError?: boolean;
      };
    };

    it("dispatches get_tidal_stations to the stations handler", async () => {
      mockTidalService.findNearestStations.mockResolvedValueOnce([
        { id: "8443970", name: "Boston", distance: 2 },
      ]);
      const result = await invoke("get_tidal_stations", {
        latitude: 42.36,
        longitude: -71.06,
        radius: 25,
      });
      expect(result.content[0].text).toMatch(/Found 1 tidal station/);
      expect(mockTidalService.findNearestStations).toHaveBeenCalledWith(
        42.36,
        -71.06,
        25,
      );
    });

    it("dispatches get_tides to the predictions handler", async () => {
      const start = new Date();
      const end = new Date(Date.now() + 12 * 3600_000);
      mockTidalService.getTidalPredictions.mockResolvedValueOnce({
        station: { id: "8443970", name: "Boston", distance: 2 },
        startDate: start,
        endDate: end,
        extremes: [
          { time: start, type: "high", height: 3.2 },
          { time: end, type: "low", height: 0.4 },
        ],
        predictions: [],
        fetchedAt: new Date(),
      });
      const result = await invoke("get_tides", {
        stationId: "8443970",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      expect(result.isError).not.toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toMatch(/Tidal Predictions for Station/);
    });

    it("dispatches calculate_tidal_windows to the windows handler", async () => {
      mockTidalService.calculateTidalWindows.mockResolvedValueOnce([]);
      const result = await invoke("calculate_tidal_windows", {
        stationId: "8443970",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 24 * 3600_000).toISOString(),
        requiredDepth: 10,
      });
      expect(result.content[0].text).toMatch(/No safe navigation windows/);
    });

    it("rethrows for unknown tool names (outer catch logs + re-throws)", async () => {
      const handler = capturedHandlers.get(CallToolRequestSchema);
      await expect(
        handler!({ params: { name: "not-a-tool", arguments: {} } }),
      ).rejects.toThrow(/Unknown tool/);
    });
  });
});
