/**
 * RouteAgent.ts detour-path coverage tests (Phase 4)
 *
 * The existing route-unit.test.ts mocks turf.booleanCrosses/booleanWithin to
 * always return false, which bypasses the detour logic entirely. This file
 * uses a scripted mock so the initial direct-route check reports a crossing
 * (forcing detour) and the detour verification calls report clearance — so the
 * full calculateDetour method is exercised, including calculateDestination.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";

// Redis mock (matches existing pattern)
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async () => null),
    setex: jest.fn(async () => "OK"),
    hset: jest.fn(async () => 1),
    hgetall: jest.fn(async () => ({})),
    quit: jest.fn(async () => "OK"),
  }));
});

// Scripted turf mock — `crossSequence` and `withinSequence` are per-call return
// values that tests override via mockImplementationOnce. Default is `false`.
const crossMock = jest.fn<(a: unknown, b: unknown) => boolean>(() => false);
const withinMock = jest.fn<(a: unknown, b: unknown) => boolean>(() => false);

jest.mock("@turf/turf", () => ({
  point: (coords: number[]) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
  }),
  lineString: (coords: number[][]) => ({
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
  }),
  circle: (center: number[], radius: number) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[center[0], center[1]]]] },
    properties: { radius },
  }),
  polygon: (coords: number[][][]) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: coords },
  }),
  booleanCrosses: (a: unknown, b: unknown) => crossMock(a, b),
  booleanWithin: (a: unknown, b: unknown) => withinMock(a, b),
  distance: (
    p1: { geometry: { coordinates: [number, number] } },
    p2: { geometry: { coordinates: [number, number] } },
  ) => {
    const [lon1, lat1] = p1.geometry.coordinates;
    const [lon2, lat2] = p2.geometry.coordinates;
    const R = 3440.1;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
  },
  rhumbDistance: (
    p1: { geometry: { coordinates: [number, number] } },
    p2: { geometry: { coordinates: [number, number] } },
  ) => {
    const [lon1, lat1] = p1.geometry.coordinates;
    const [lon2, lat2] = p2.geometry.coordinates;
    const R = 3440.1;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
  },
  bearing: () => 90,
  rhumbBearing: () => 90,
  destination: (
    origin: { geometry: { coordinates: [number, number] } },
    _distance: number,
    bearing: number,
  ) => {
    const [lon, lat] = origin.geometry.coordinates;
    // trivial offset so the returned waypoint is measurably different
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          lon + 0.1 * Math.sin((bearing * Math.PI) / 180),
          lat + 0.1 * Math.cos((bearing * Math.PI) / 180),
        ],
      },
    };
  },
  greatCircle: (
    p1: { geometry: { coordinates: [number, number] } },
    p2: { geometry: { coordinates: [number, number] } },
  ) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [p1.geometry.coordinates, p2.geometry.coordinates],
    },
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RouteAgent } = require("../RouteAgent");

describe("RouteAgent.ts — detour coverage", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let agent: any;

  beforeAll(async () => {
    agent = new RouteAgent("redis://localhost:6379");
    await agent.initialize();
  });

  afterAll(async () => {
    await agent.shutdown();
  });

  beforeEach(() => {
    crossMock.mockReset().mockReturnValue(false);
    withinMock.mockReset().mockReturnValue(false);
  });

  it("invokes calculateDetour when the direct segment crosses a circular avoid area", async () => {
    // First call: direct route crosses the circle → triggers detour branch.
    // Subsequent calls (detour segment checks): all return false → clearance verified on first try.
    crossMock.mockReturnValueOnce(true).mockReturnValue(false);

    const result = await agent.handleToolCall("calculate_route", {
      departure: { latitude: 42.0, longitude: -71.0 },
      destination: { latitude: 42.0, longitude: -70.0 },
      vessel_speed: 5,
      avoid_areas: [
        {
          type: "circle",
          coordinates: [-70.5, 42.0],
          radius: 5,
        },
      ],
    });

    // Detour returns two segments (midpoint offset) instead of one direct segment
    expect(result.segments.length).toBeGreaterThanOrEqual(2);
    expect(result.totalDistance).toBeGreaterThan(0);
  });

  it("invokes calculateDetour when the direct segment is within a polygon avoid area", async () => {
    // booleanWithin triggers detour path for polygon case
    withinMock.mockReturnValueOnce(true).mockReturnValue(false);

    const result = await agent.handleToolCall("calculate_route", {
      departure: { latitude: 42.0, longitude: -71.0 },
      destination: { latitude: 42.0, longitude: -70.0 },
      vessel_speed: 5,
      avoid_areas: [
        {
          type: "polygon",
          coordinates: [
            [-70.8, 41.9],
            [-70.2, 41.9],
            [-70.2, 42.1],
            [-70.8, 42.1],
            [-70.8, 41.9],
          ],
        },
      ],
    });

    expect(result.segments.length).toBeGreaterThanOrEqual(2);
  });

  it("throws when no verified clear detour exists (all offsets still cross the avoid area)", async () => {
    // Direct route crosses AND every detour attempt also crosses → exhaust all offsets
    crossMock.mockReturnValue(true);

    await expect(
      agent.handleToolCall("calculate_route", {
        departure: { latitude: 42.0, longitude: -71.0 },
        destination: { latitude: 42.0, longitude: -70.0 },
        vessel_speed: 5,
        avoid_areas: [
          {
            type: "circle",
            coordinates: [-70.5, 42.0],
            radius: 5,
          },
        ],
      }),
    ).rejects.toThrow(/Unable to calculate a verified clear detour/);
  });

  it("skips avoid areas with unrecognised types during detour verification", async () => {
    // Force detour via booleanCrosses=true on the direct check; detour checks won't see
    // 'mystery' as a circle or polygon so they `continue` in the verification loop.
    crossMock
      .mockReturnValueOnce(true) // direct route fails
      .mockReturnValue(false); // detour segments pass (because 'mystery' is skipped)

    const result = await agent.handleToolCall("calculate_route", {
      departure: { latitude: 42.0, longitude: -71.0 },
      destination: { latitude: 42.0, longitude: -70.0 },
      vessel_speed: 5,
      avoid_areas: [
        {
          type: "circle",
          coordinates: [-70.5, 42.0],
          radius: 5,
        },
        {
          // triggers the `continue` branch at RouteAgent.ts:402 inside calculateDetour
          type: "mystery",
          coordinates: [0, 0],
        },
      ],
    });

    expect(result.segments.length).toBeGreaterThanOrEqual(2);
  });

  it("optimizes waypoints via optimization=distance when waypoints are present", async () => {
    // No avoid areas — crossMock stays false everywhere — so this exercises the
    // waypoint-order optimization path at RouteAgent.ts:206 that the default-mock
    // tests skip because they never provide waypoints with optimization=distance.
    const result = await agent.handleToolCall("calculate_route", {
      departure: { latitude: 42.3601, longitude: -71.0589, name: "Boston" },
      destination: { latitude: 40.7128, longitude: -74.006, name: "NY" },
      waypoints: [
        { latitude: 41.3559, longitude: -72.0895, name: "New London" },
        { latitude: 41.1, longitude: -73.0, name: "Stamford" },
      ],
      vessel_speed: 6,
      optimization: "distance", // triggers optimizeWaypoints branch
    });

    expect(result.optimized).toBe(true);
    // optimizer preserves departure + destination + all waypoints
    expect(result.waypoints.length).toBe(4);
    expect(result.waypoints[0].name).toBe("Boston");
    expect(result.waypoints[result.waypoints.length - 1].name).toBe("NY");
  });
});
