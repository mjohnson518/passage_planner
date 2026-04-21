/**
 * SafetyAgent (index.ts) Supplemental Coverage — Phase 4.4
 *
 * Targets narrowly-uncovered branches in safety/index.ts after the main
 * Phase 4.1 coverage push:
 *
 *   - `callTool` public wrapper (line 1348)
 *   - `handleToolCall('health')` dispatch + `getHealthStatus` body (265, 292-333)
 *   - `getNavigationWarnings` catch path (lines 742-744)
 *   - `mapNWSSeverityToSafetyLevel` every switch branch (lines 750-761)
 *
 * The tests replace the agent's service instances via bracket access so we
 * can drive deterministic outputs without mocking the shared HTTP clients.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";

jest.mock("uuid", () => ({
  v4: () => "test-uuid-index-extra",
}));

jest.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock("@modelcontextprotocol/sdk/types", () => ({
  ListToolsRequestSchema: { method: "tools/list" },
  CallToolRequestSchema: { method: "tools/call" },
}));

import { SafetyAgent } from "../index";

type TidalStubStations = Array<{ id: string; name: string; distance?: number }>;

type ServiceStubs = {
  navWarnings?: {
    getWarningsForArea?: (bounds: unknown) => Promise<unknown>;
  };
  tidal?: {
    findNearestStations?: (
      lat: number,
      lon: number,
      radiusNm: number,
    ) => Promise<TidalStubStations>;
    getTidalPredictions?: (
      stationId: string,
      start: Date,
      end: Date,
    ) => Promise<unknown>;
  };
};

function patchAgent(agent: SafetyAgent, stubs: ServiceStubs): void {
  if (stubs.navWarnings) {
    (
      agent as unknown as { navigationWarningsService: unknown }
    ).navigationWarningsService = stubs.navWarnings;
  }
  if (stubs.tidal) {
    (agent as unknown as { tidalService: unknown }).tidalService = stubs.tidal;
  }
}

describe("SafetyAgent (index.ts) — supplemental coverage", () => {
  let agent: SafetyAgent;

  beforeEach(async () => {
    process.env.LOG_LEVEL = "silent";
    process.env.NODE_ENV = "test";
    agent = new SafetyAgent();
    await agent.initialize();
  });

  afterEach(async () => {
    await agent.shutdown();
  });

  describe("callTool public wrapper", () => {
    it("forwards to handleToolCall and returns the result", async () => {
      const spy = jest
        .spyOn(agent, "handleToolCall")
        .mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
      const result = await agent.callTool("get_emergency_contacts", {
        latitude: 42,
        longitude: -71,
      });
      expect(spy).toHaveBeenCalledWith("get_emergency_contacts", {
        latitude: 42,
        longitude: -71,
      });
      expect(result.content[0].text).toBe("ok");
      spy.mockRestore();
    });

    it("rejects when the wrapped tool is unknown", async () => {
      await expect(agent.callTool("nope", {})).rejects.toThrow(/Unknown tool/);
    });
  });

  describe("health tool / getHealthStatus", () => {
    it("reports healthy when every service is up AND NOAA key is configured", async () => {
      process.env.NOAA_API_KEY = "test-noaa-key";
      // Rebuild the agent so the new env var is picked up in the constructor.
      await agent.shutdown();
      agent = new SafetyAgent();
      patchAgent(agent, {
        tidal: {
          findNearestStations: jest
            .fn<
              (
                lat: number,
                lon: number,
                radiusNm: number,
              ) => Promise<TidalStubStations>
            >()
            .mockResolvedValue([{ id: "S1", name: "Boston" }]),
        },
      });

      const result = await agent.handleToolCall("health", {});
      expect(result.status).toBe("healthy");
      expect(result.services.tidalService.status).toBe("healthy");
      expect(result.services.bathymetryService.status).toBe("healthy");
      expect(result.services.navigationWarningsService.status).toBe("healthy");
      expect(result.services.noaaApi.status).toBe("healthy");
      expect(typeof result.timestamp).toBe("string");
    });

    it("degrades when the tidal service returns no stations", async () => {
      patchAgent(agent, {
        tidal: {
          findNearestStations: jest
            .fn<
              (
                lat: number,
                lon: number,
                radiusNm: number,
              ) => Promise<TidalStubStations>
            >()
            .mockResolvedValue([]),
        },
      });
      delete process.env.NOAA_API_KEY;
      // Rebuild so the no-key path is exercised in the constructor-derived field.
      await agent.shutdown();
      agent = new SafetyAgent();
      patchAgent(agent, {
        tidal: {
          findNearestStations: jest
            .fn<
              (
                lat: number,
                lon: number,
                radiusNm: number,
              ) => Promise<TidalStubStations>
            >()
            .mockResolvedValue([]),
        },
      });

      const result = await agent.handleToolCall("health", {});
      expect(result.status).toBe("degraded");
      expect(result.services.tidalService.status).toBe("degraded");
      expect(result.services.noaaApi.status).toBe("degraded");
    });

    it("marks tidal unhealthy + overall degraded when findNearestStations throws", async () => {
      patchAgent(agent, {
        tidal: {
          findNearestStations: jest
            .fn<
              (
                lat: number,
                lon: number,
                radiusNm: number,
              ) => Promise<TidalStubStations>
            >()
            .mockRejectedValue(new Error("tidal service offline")),
        },
      });

      const result = await agent.handleToolCall("health", {});
      expect(result.services.tidalService.status).toBe("unhealthy");
      expect(result.services.tidalService.message).toMatch(
        /tidal service offline/,
      );
      expect(result.status).toBe("degraded");
    });
  });

  describe("getNavigationWarnings — error path + severity mapping", () => {
    const validBounds = {
      north: 43,
      south: 42,
      east: -70,
      west: -71,
    };

    it("rethrows when the underlying service fails", async () => {
      patchAgent(agent, {
        navWarnings: {
          getWarningsForArea: jest
            .fn<(bounds: unknown) => Promise<unknown>>()
            .mockRejectedValue(new Error("NOAA unavailable")),
        },
      });

      await expect(
        agent.handleToolCall("get_navigation_warnings", {
          bounds: validBounds,
        }),
      ).rejects.toThrow(/NOAA unavailable/);
    });

    it("maps every NWS severity level through mapNWSSeverityToSafetyLevel", async () => {
      // Build warnings covering every branch of the severity switch.
      // Each row triggers a different case; we verify the mapped severity in the response.
      const severityCases: Array<{
        input: string;
        expected: "urgent" | "warning" | "advisory" | "info";
      }> = [
        { input: "extreme", expected: "urgent" },
        { input: "severe", expected: "urgent" },
        { input: "moderate", expected: "warning" },
        { input: "minor", expected: "advisory" },
        { input: "unknown-level", expected: "info" }, // default branch
      ];

      const now = new Date();
      const warnings = severityCases.map((c, idx) => ({
        id: `w-${idx}`,
        type: "marine_warning",
        title: `Warning ${idx}`,
        description: `Description ${idx}`,
        area: "Test Area",
        location: { latitude: 42.5, longitude: -70.5 },
        bounds: validBounds,
        severity: c.input,
        urgency: "expected",
        issued: now,
        expires: now,
        effective: now,
        source: "NWS Test",
        instruction: "Heed the warning",
        event: "Test Event",
      }));

      patchAgent(agent, {
        navWarnings: {
          getWarningsForArea: jest
            .fn<(bounds: unknown) => Promise<unknown>>()
            .mockResolvedValue({
              warnings,
              totalCount: warnings.length,
              fetchedAt: now,
              source: "NOAA NWS (mocked)",
            }),
        },
      });

      const result = await agent.handleToolCall("get_navigation_warnings", {
        bounds: validBounds,
      });
      const response = JSON.parse(result.content[0].text);

      expect(response.warnings).toHaveLength(severityCases.length);
      for (let i = 0; i < severityCases.length; i++) {
        expect(response.warnings[i].severity).toBe(severityCases[i].expected);
      }
    });
  });
});
