/**
 * Area Checker Supplemental Coverage Tests
 *
 * Targets uncovered branches identified in Phase 4 coverage push:
 * - Database refresh path (initializeAreaCheckerDatabase, refreshFromDatabase, ensureFreshData)
 * - Antimeridian-crossing bounds
 * - addRestrictedArea update-existing-by-id path
 * - queryAreasByBounds / queryAreasNearPoint / boundsOverlap
 * - getAreaCountsByType / getLastRefreshTime
 * - distanceToPolygon / distanceToLineSegment / haversineDistance (polygon areas)
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { AreaChecker, initializeAreaCheckerDatabase } from "../area-checker";
import {
  RestrictedArea,
  Waypoint,
} from "../../../../../shared/src/types/safety";

describe("AreaChecker — Supplemental Coverage", () => {
  let checker: AreaChecker;

  beforeEach(() => {
    checker = new AreaChecker();
  });

  describe("Antimeridian-crossing bounds", () => {
    it("detects a point east of 180° inside antimeridian-crossing bounds (west=170, east=-170)", () => {
      const area: RestrictedArea = {
        id: "AM-1",
        name: "Antimeridian Area",
        type: "other",
        bounds: { north: 10, south: -10, east: -170, west: 170 },
        description: "Spans the date line",
        restrictions: ["Test"],
        active: true,
        schedule: { start: "permanent" },
        authority: "Test",
      };
      checker.addRestrictedArea(area);

      const eastSide: Waypoint = { latitude: 0, longitude: 175 };
      const westSide: Waypoint = { latitude: 0, longitude: -175 };
      const outside: Waypoint = { latitude: 0, longitude: 0 };

      expect(checker.checkWaypoint(eastSide).some((a) => a.id === "AM-1")).toBe(
        true,
      );
      expect(checker.checkWaypoint(westSide).some((a) => a.id === "AM-1")).toBe(
        true,
      );
      expect(checker.checkWaypoint(outside).some((a) => a.id === "AM-1")).toBe(
        false,
      );
    });

    it("does not flag points outside latitude range even if longitude matches", () => {
      const area: RestrictedArea = {
        id: "AM-2",
        name: "Antimeridian Area 2",
        type: "other",
        bounds: { north: 10, south: -10, east: -170, west: 170 },
        description: "",
        restrictions: ["x"],
        active: true,
        schedule: { start: "permanent" },
        authority: "Test",
      };
      checker.addRestrictedArea(area);

      // longitude inside, latitude outside
      const tooNorth: Waypoint = { latitude: 30, longitude: 175 };
      expect(checker.checkWaypoint(tooNorth).some((a) => a.id === "AM-2")).toBe(
        false,
      );
    });
  });

  describe("addRestrictedArea update-existing path", () => {
    it("replaces the existing area when ID matches", () => {
      const initial: RestrictedArea = {
        id: "DUP-1",
        name: "Original",
        type: "other",
        bounds: { north: 45, south: 44, east: -69, west: -70 },
        description: "",
        restrictions: ["v1"],
        active: true,
        schedule: { start: "permanent" },
        authority: "Test",
      };
      checker.addRestrictedArea(initial);

      const replacement: RestrictedArea = {
        ...initial,
        name: "Replaced",
        restrictions: ["v2"],
      };
      checker.addRestrictedArea(replacement);

      const all = checker.getActiveAreas().filter((a) => a.id === "DUP-1");
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe("Replaced");
      expect(all[0].restrictions).toEqual(["v2"]);
    });
  });

  describe("queryAreasByBounds", () => {
    it("returns bounded areas that overlap the query box", async () => {
      const query = { north: 42.8, south: 42.0, east: -70.0, west: -70.7 };
      const results = await checker.queryAreasByBounds(query);

      // Stellwagen (bounded) overlaps this box
      expect(results.some((a) => a.name.includes("Stellwagen"))).toBe(true);
    });

    it("returns polygon-defined areas when any polygon vertex is inside the query box", async () => {
      const polygonArea: RestrictedArea = {
        id: "POLY-1",
        name: "Polygon Area",
        type: "other",
        polygon: [
          { latitude: 50.5, longitude: -60.5 },
          { latitude: 50.5, longitude: -59.5 },
          { latitude: 51.5, longitude: -59.5 },
          { latitude: 51.5, longitude: -60.5 },
        ],
        description: "",
        restrictions: ["x"],
        active: true,
        schedule: { start: "permanent" },
        authority: "Test",
      };
      checker.addRestrictedArea(polygonArea);

      const results = await checker.queryAreasByBounds({
        north: 51.0,
        south: 50.0,
        east: -60.0,
        west: -61.0,
      });
      expect(results.some((a) => a.id === "POLY-1")).toBe(true);
    });

    it("excludes inactive areas", async () => {
      const inactive: RestrictedArea = {
        id: "INACTIVE-1",
        name: "Inactive",
        type: "other",
        bounds: { north: 42.5, south: 42.1, east: -70.1, west: -70.6 },
        description: "",
        restrictions: ["x"],
        active: false,
        schedule: { start: "permanent" },
        authority: "Test",
      };
      checker.addRestrictedArea(inactive);

      const results = await checker.queryAreasByBounds({
        north: 42.8,
        south: 42.0,
        east: -70.0,
        west: -70.7,
      });
      expect(results.some((a) => a.id === "INACTIVE-1")).toBe(false);
    });

    it("excludes areas with neither bounds nor polygon", async () => {
      const incomplete: RestrictedArea = {
        id: "INCOMPLETE-1",
        name: "No Geometry",
        type: "other",
        description: "",
        restrictions: ["x"],
        active: true,
        schedule: { start: "permanent" },
        authority: "Test",
      };
      checker.addRestrictedArea(incomplete);

      const results = await checker.queryAreasByBounds({
        north: 90,
        south: -90,
        east: 180,
        west: -180,
      });
      expect(results.some((a) => a.id === "INCOMPLETE-1")).toBe(false);
    });

    it("returns empty when no areas overlap the query box", async () => {
      const results = await checker.queryAreasByBounds({
        north: -10,
        south: -20,
        east: 150,
        west: 140,
      });
      expect(results).toHaveLength(0);
    });
  });

  describe("queryAreasNearPoint", () => {
    it("returns areas within the requested radius sorted by distance", async () => {
      const nearStellwagen: Waypoint = { latitude: 42.0, longitude: -70.3 };
      const results = await checker.queryAreasNearPoint(nearStellwagen, 200);

      expect(results.length).toBeGreaterThan(0);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distanceNm).toBeGreaterThanOrEqual(
          results[i - 1].distanceNm,
        );
      }
      // Sanity: distances are finite non-negative numbers
      results.forEach((r) => {
        expect(isFinite(r.distanceNm)).toBe(true);
        expect(r.distanceNm).toBeGreaterThanOrEqual(0);
      });
    });

    it("returns no areas when radius is too small", async () => {
      const farOffshore: Waypoint = { latitude: 0, longitude: -40 };
      const results = await checker.queryAreasNearPoint(farOffshore, 5);
      expect(results).toHaveLength(0);
    });

    it("uses the default 50nm radius when no radius is supplied", async () => {
      const openOcean: Waypoint = { latitude: 20, longitude: -40 };
      const results = await checker.queryAreasNearPoint(openOcean);
      expect(results).toHaveLength(0);
    });

    it("includes a polygon area when the point is near its edge", async () => {
      const polygonArea: RestrictedArea = {
        id: "NEAR-POLY-1",
        name: "Near Poly",
        type: "other",
        polygon: [
          { latitude: 30.0, longitude: -60.0 },
          { latitude: 30.0, longitude: -59.5 },
          { latitude: 30.5, longitude: -59.5 },
          { latitude: 30.5, longitude: -60.0 },
        ],
        description: "",
        restrictions: ["x"],
        active: true,
        schedule: { start: "permanent" },
        authority: "Test",
      };
      checker.addRestrictedArea(polygonArea);

      // Point just outside the polygon
      const nearby: Waypoint = { latitude: 30.25, longitude: -60.1 };
      const results = await checker.queryAreasNearPoint(nearby, 50);

      const hit = results.find((r) => r.area.id === "NEAR-POLY-1");
      expect(hit).toBeDefined();
      expect(hit!.distanceNm).toBeGreaterThan(0);
    });

    it("returns distance 0 for polygon area when point is inside", async () => {
      const polygonArea: RestrictedArea = {
        id: "INSIDE-POLY-1",
        name: "Inside Poly",
        type: "other",
        polygon: [
          { latitude: 30.0, longitude: -60.0 },
          { latitude: 30.0, longitude: -59.0 },
          { latitude: 31.0, longitude: -59.0 },
          { latitude: 31.0, longitude: -60.0 },
        ],
        description: "",
        restrictions: ["x"],
        active: true,
        schedule: { start: "permanent" },
        authority: "Test",
      };
      checker.addRestrictedArea(polygonArea);

      const inside: Waypoint = { latitude: 30.5, longitude: -59.5 };
      const results = await checker.queryAreasNearPoint(inside, 50);

      const hit = results.find((r) => r.area.id === "INSIDE-POLY-1");
      expect(hit).toBeDefined();
      expect(hit!.distanceNm).toBe(0);
    });
  });

  describe("getAreaCountsByType", () => {
    it("counts active areas grouped by type", () => {
      const counts = checker.getAreaCountsByType();
      expect(counts.marine_sanctuary).toBeGreaterThanOrEqual(1);
      expect(counts.military).toBeGreaterThanOrEqual(1);
      expect(counts.shipping_lane).toBeGreaterThanOrEqual(1);
    });

    it("ignores inactive areas in the count", () => {
      const before = checker.getAreaCountsByType();
      const inactiveMilitary: RestrictedArea = {
        id: "INACTIVE-MIL",
        name: "Inactive Military",
        type: "military",
        bounds: { north: 10, south: 0, east: 10, west: 0 },
        description: "",
        restrictions: ["x"],
        active: false,
        schedule: { start: "permanent" },
        authority: "Test",
      };
      checker.addRestrictedArea(inactiveMilitary);
      const after = checker.getAreaCountsByType();
      expect(after.military).toBe(before.military);
    });
  });

  describe("getLastRefreshTime", () => {
    it("returns null before any database refresh", () => {
      expect(checker.getLastRefreshTime()).toBeNull();
    });
  });

  describe("Database refresh paths", () => {
    afterEach(() => {
      // Reset module-level dbPool to avoid leaking between tests.
      // Casting to the broader Pool shape is fine here — the module only checks truthiness.
      initializeAreaCheckerDatabase(null as unknown as never);
    });

    it("no-ops refreshFromDatabase when no DB pool is configured", async () => {
      // Fresh checker without dbPool — should complete without error and leave lastRefresh null
      const fresh = new AreaChecker();
      await fresh.refreshFromDatabase();
      expect(fresh.getLastRefreshTime()).toBeNull();
    });

    it("merges database areas with default areas on successful refresh", async () => {
      const dbArea = {
        id: "DB-AREA-1",
        name: "Database-Loaded Area",
        type: "restricted",
        description: "From DB",
        restrictions: ["Obey signs"],
        active: true,
        bounds_north: 40,
        bounds_south: 39,
        bounds_east: -70,
        bounds_west: -71,
        polygon: null,
        schedule_start: "permanent",
        schedule_end: null,
        schedule_recurring: null,
        authority: "DB Authority",
        penalty: "DB Penalty",
      };
      const queryMock = jest
        .fn<() => Promise<{ rows: (typeof dbArea)[] }>>()
        .mockResolvedValue({ rows: [dbArea] });
      const fakePool = { query: queryMock } as unknown as import("pg").Pool;
      initializeAreaCheckerDatabase(fakePool);

      const fresh = new AreaChecker();
      await fresh.refreshFromDatabase();

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(fresh.getLastRefreshTime()).toBeInstanceOf(Date);
      const all = fresh.getActiveAreas();
      expect(all.some((a) => a.id === "DB-AREA-1")).toBe(true);
      // Defaults preserved too
      expect(all.some((a) => a.name.includes("Stellwagen"))).toBe(true);
    });

    it("parses polygon strings and omits bounds when bounds_north is null", async () => {
      const polygonWaypoints = [
        { latitude: 30, longitude: -60 },
        { latitude: 30, longitude: -59 },
        { latitude: 31, longitude: -59 },
        { latitude: 31, longitude: -60 },
      ];
      const dbArea = {
        id: "DB-POLY-1",
        name: "DB Polygon",
        type: "other",
        description: "Polygon from DB",
        restrictions: null,
        active: true,
        bounds_north: null,
        bounds_south: null,
        bounds_east: null,
        bounds_west: null,
        polygon: JSON.stringify(polygonWaypoints),
        schedule_start: null,
        schedule_end: null,
        schedule_recurring: null,
        authority: "Test",
        penalty: null,
      };
      const fakePool = {
        query: jest
          .fn<() => Promise<{ rows: (typeof dbArea)[] }>>()
          .mockResolvedValue({ rows: [dbArea] }),
      } as unknown as import("pg").Pool;
      initializeAreaCheckerDatabase(fakePool);

      const fresh = new AreaChecker();
      await fresh.refreshFromDatabase();

      const insidePoint: Waypoint = { latitude: 30.5, longitude: -59.5 };
      const conflicts = fresh.checkWaypoint(insidePoint);
      const loaded = conflicts.find((c) => c.id === "DB-POLY-1");
      expect(loaded).toBeDefined();
      expect(loaded!.polygon).toHaveLength(4);
      expect(loaded!.bounds).toBeUndefined();
      expect(loaded!.restrictions).toEqual([]);
      expect(loaded!.schedule).toBeUndefined();
    });

    it("database areas take precedence over defaults sharing the same id", async () => {
      const overriddenStellwagen = {
        id: "stellwagen-bank",
        name: "Stellwagen (Override)",
        type: "marine_sanctuary",
        description: "Overridden by DB",
        restrictions: ["Override rule"],
        active: true,
        bounds_north: 42.75,
        bounds_south: 42.08,
        bounds_east: -70.02,
        bounds_west: -70.6,
        polygon: null,
        schedule_start: "permanent",
        schedule_end: null,
        schedule_recurring: null,
        authority: "DB Authority",
        penalty: "DB penalty",
      };
      const fakePool = {
        query: jest
          .fn<() => Promise<{ rows: (typeof overriddenStellwagen)[] }>>()
          .mockResolvedValue({ rows: [overriddenStellwagen] }),
      } as unknown as import("pg").Pool;
      initializeAreaCheckerDatabase(fakePool);

      const fresh = new AreaChecker();
      await fresh.refreshFromDatabase();

      const matches = fresh
        .getActiveAreas()
        .filter((a) => a.id === "stellwagen-bank");
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe("Stellwagen (Override)");
      expect(matches[0].authority).toBe("DB Authority");
    });

    it("keeps existing areas and logs when the DB query throws", async () => {
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const fakePool = {
        query: jest
          .fn<() => Promise<never>>()
          .mockRejectedValue(new Error("boom")),
      } as unknown as import("pg").Pool;
      initializeAreaCheckerDatabase(fakePool);

      const fresh = new AreaChecker();
      await fresh.refreshFromDatabase();

      expect(errorSpy).toHaveBeenCalled();
      // Defaults still available after a failed refresh
      expect(
        fresh.getActiveAreas().some((a) => a.name.includes("Stellwagen")),
      ).toBe(true);
      errorSpy.mockRestore();
    });

    it("initialize() delegates to refreshFromDatabase", async () => {
      const fakePool = {
        query: jest
          .fn<() => Promise<{ rows: [] }>>()
          .mockResolvedValue({ rows: [] }),
      } as unknown as import("pg").Pool;
      initializeAreaCheckerDatabase(fakePool);

      const fresh = new AreaChecker();
      await fresh.initialize();

      expect(fakePool.query as jest.Mock).toHaveBeenCalledTimes(1);
      expect(fresh.getLastRefreshTime()).toBeInstanceOf(Date);
    });

    it("ensureFreshData triggers a refresh on first query and caches within the refresh interval", async () => {
      const queryMock = jest
        .fn<() => Promise<{ rows: [] }>>()
        .mockResolvedValue({ rows: [] });
      const fakePool = { query: queryMock } as unknown as import("pg").Pool;
      initializeAreaCheckerDatabase(fakePool);

      const fresh = new AreaChecker();
      await fresh.queryAreasByBounds({
        north: 90,
        south: -90,
        east: 180,
        west: -180,
      });
      await fresh.queryAreasByBounds({
        north: 90,
        south: -90,
        east: 180,
        west: -180,
      });

      // Second call should be served from cache — no second query
      expect(queryMock).toHaveBeenCalledTimes(1);
    });
  });
});
