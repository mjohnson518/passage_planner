/**
 * WeatherPatternAnalyzer Supplemental Coverage — Phase 4.5
 *
 * Targets the final uncovered branches in weather-pattern-analyzer.ts:
 *
 *   - `classifyTropicalIntensity` lower tiers (lines 230-232): Tropical Storm,
 *     Tropical Depression, Developing System. These cannot be reached through
 *     the normal `analyzePattern` pipeline because `detectTropicalCyclone`
 *     only fires when winds ≥ `hurricaneWindSpeed` (default 64 kt) — but the
 *     classifier falls below that. We reach them by constructing the analyzer
 *     with a lowered hurricaneWindSpeed threshold, so maxWind values in the
 *     39 / 34 / <34 ranges do flow through `classifyTropicalIntensity`.
 *
 *   - `calculateBounds` empty-waypoints defensive branch (line 268): every
 *     public caller filters data first so an empty array never reaches this
 *     method via the normal pipeline. The branch exists as a defensive guard
 *     against future callers and is exercised here via direct bracket access.
 *
 *   - `recommendDelay` no-window branch (line 394): no severe pattern AND
 *     no usable weather window.
 *
 *   - `calculateRequiredDelay` `storm_system` case + default (lines 422-424).
 *     The analyzer's detectors never emit `type: 'storm_system'`, but the
 *     delay-calculator tolerates it defensively. Same direct-invocation
 *     approach — we're pinning the defensive contract for future pattern
 *     types that might land in the enum before new detector branches do.
 */

import { describe, it, expect } from "@jest/globals";
import { WeatherPatternAnalyzer } from "../weather-pattern-analyzer";
import type { WeatherDataPoint } from "../weather-pattern-analyzer";
import type {
  SevereWeatherPattern,
  Waypoint,
  GeographicBounds,
} from "../../../../../shared/src/types/safety";

const loc: Waypoint = { latitude: 42, longitude: -71 };

function dp(
  time: string,
  windSpeed: number,
  overrides: Partial<WeatherDataPoint> = {},
): WeatherDataPoint {
  return { time, location: loc, windSpeed, ...overrides };
}

describe("WeatherPatternAnalyzer — supplemental coverage", () => {
  describe("classifyTropicalIntensity lower tiers (reachable via lowered hurricane threshold)", () => {
    it("returns 'Tropical Storm' when max wind is 39-63 kt", () => {
      // Lower the hurricane threshold so detectTropicalCyclone fires on 40-kt wind
      // and classifyTropicalIntensity receives maxWind=40 → hits `>= 39` branch.
      const analyzer = new WeatherPatternAnalyzer({ hurricaneWindSpeed: 30 });
      const data: WeatherDataPoint[] = [dp("2026-04-21T00:00:00Z", 40)];

      const result = analyzer.analyzePattern(data);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("tropical_cyclone");
      expect(result!.intensity).toBe("Tropical Storm");
    });

    it("returns 'Tropical Depression' when max wind is 34-38 kt", () => {
      const analyzer = new WeatherPatternAnalyzer({ hurricaneWindSpeed: 30 });
      const data: WeatherDataPoint[] = [dp("2026-04-21T00:00:00Z", 35)];

      const result = analyzer.analyzePattern(data);
      expect(result).not.toBeNull();
      expect(result!.intensity).toBe("Tropical Depression");
    });

    it("returns 'Developing System' when max wind is below 34 kt", () => {
      const analyzer = new WeatherPatternAnalyzer({ hurricaneWindSpeed: 30 });
      const data: WeatherDataPoint[] = [dp("2026-04-21T00:00:00Z", 30)];

      const result = analyzer.analyzePattern(data);
      expect(result).not.toBeNull();
      expect(result!.intensity).toBe("Developing System");
    });
  });

  describe("calculateBounds defensive empty-array branch", () => {
    it("returns zeroed bounds when called with no waypoints (private defensive path)", () => {
      const analyzer = new WeatherPatternAnalyzer();
      const bounds = (
        analyzer as unknown as {
          calculateBounds: (waypoints: Waypoint[]) => GeographicBounds;
        }
      ).calculateBounds([]);
      expect(bounds).toEqual({ north: 0, south: 0, east: 0, west: 0 });
    });
  });

  describe("recommendDelay no-window branch", () => {
    it("recommends a 24-hour delay when no severe pattern AND no usable window", () => {
      // Two data points with wind=30 kt — too few to trip any pattern detector
      // (cold front needs >2 points, gale needs ≥3, hurricane needs ≥64) but
      // above the default 25-kt max in checkWeatherWindow so no window qualifies.
      const analyzer = new WeatherPatternAnalyzer();
      const data: WeatherDataPoint[] = [
        dp("2026-04-21T00:00:00Z", 30),
        dp("2026-04-21T06:00:00Z", 30),
      ];

      const result = analyzer.recommendDelay(data, 12);
      expect(result.shouldDelay).toBe(true);
      expect(result.reason).toMatch(/No adequate weather window found/);
      expect(result.suggestedDelay).toBe(24);
    });
  });

  describe("calculateRequiredDelay defensive branches", () => {
    it("waits 36 hours for a 'storm_system' pattern (line 422)", () => {
      const analyzer = new WeatherPatternAnalyzer();
      // storm_system is never emitted by the current detectors but the delay
      // calculator tolerates it. This pins that defensive contract.
      const pattern = {
        type: "storm_system",
        affectedArea: { north: 0, south: 0, east: 0, west: 0 },
        intensity: "Test storm",
        movementSpeed: 10,
        movementDirection: 0,
        predictedImpact: {
          timing: "2026-04-21T00:00:00Z",
          windSpeed: 40,
          waveHeight: 10,
          recommendedAction: "delay_departure" as const,
        },
        dataSource: "Test",
        lastUpdated: "2026-04-21T00:00:00Z",
      } as unknown as SevereWeatherPattern;

      const delayHours = (
        analyzer as unknown as {
          calculateRequiredDelay: (p: SevereWeatherPattern) => number;
        }
      ).calculateRequiredDelay(pattern);
      expect(delayHours).toBe(36);
    });

    it("falls back to 24 hours for unrecognized pattern types (default branch)", () => {
      const analyzer = new WeatherPatternAnalyzer();
      const pattern = {
        type: "freak_event",
        affectedArea: { north: 0, south: 0, east: 0, west: 0 },
        intensity: "Unknown",
        movementSpeed: 0,
        movementDirection: 0,
        predictedImpact: {
          timing: "2026-04-21T00:00:00Z",
          windSpeed: 20,
          waveHeight: 5,
          recommendedAction: "monitor_closely" as const,
        },
        dataSource: "Test",
        lastUpdated: "2026-04-21T00:00:00Z",
      } as unknown as SevereWeatherPattern;

      const delayHours = (
        analyzer as unknown as {
          calculateRequiredDelay: (p: SevereWeatherPattern) => number;
        }
      ).calculateRequiredDelay(pattern);
      expect(delayHours).toBe(24);
    });

    it("waits 12 hours for a 'cold_front' pattern (boundary coverage)", () => {
      const analyzer = new WeatherPatternAnalyzer();
      const pattern = {
        type: "cold_front",
        affectedArea: { north: 0, south: 0, east: 0, west: 0 },
        intensity: "Cold front passage",
        movementSpeed: 25,
        movementDirection: 270,
        predictedImpact: {
          timing: "2026-04-21T00:00:00Z",
          windSpeed: 25,
          waveHeight: 8,
          recommendedAction: "monitor_closely" as const,
        },
        dataSource: "Test",
        lastUpdated: "2026-04-21T00:00:00Z",
      } as unknown as SevereWeatherPattern;

      const delayHours = (
        analyzer as unknown as {
          calculateRequiredDelay: (p: SevereWeatherPattern) => number;
        }
      ).calculateRequiredDelay(pattern);
      expect(delayHours).toBe(12);
    });
  });
});
