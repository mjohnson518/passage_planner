/**
 * Coverage Regions — Honest Scoping
 *
 * SAFETY CRITICAL: Helmwise's data sources (NOAA weather/tides, hardcoded port DB,
 * US-only restricted areas) are accurate only inside these bounding boxes. Outside
 * these regions, mariners face degraded fidelity:
 *   - Tidal: nearest NOAA station may be hundreds of nm away
 *   - Hazards: no piracy zones, ice edges, or NAVAREA warnings ingested
 *   - Routing: no land-avoidance — great-circle line may cross continents
 *   - Ports: limited entries outside US East/Gulf coast
 *
 * Bounds are deliberately conservative — a passage that exits coverage even briefly
 * is treated as out-of-coverage so the user sees the COVERAGE_LIMITED disclaimer.
 */

export interface CoverageRegion {
  name: string;
  /** Inclusive degrees: [south, north] */
  latRange: [number, number];
  /** Inclusive degrees: [west, east]. Negative = W, positive = E. */
  lonRange: [number, number];
}

export const COVERAGE_REGIONS: CoverageRegion[] = [
  {
    name: "US East Coast & Gulf of Mexico",
    latRange: [24, 47],
    lonRange: [-98, -65],
  },
  {
    name: "US West Coast",
    latRange: [32, 49],
    lonRange: [-130, -117],
  },
  {
    name: "Caribbean",
    latRange: [10, 26],
    lonRange: [-90, -60],
  },
];

/**
 * Known coverage gaps shown to user when COVERAGE_LIMITED status is returned.
 * Listed in order of safety importance.
 */
export const COVERAGE_GAPS: readonly string[] = [
  "No piracy or maritime security zone data (e.g., Gulf of Aden, Strait of Malacca)",
  "No ice-edge or iceberg hazard data (e.g., North Atlantic, polar regions)",
  "No NAVAREA navigational warnings outside US waters",
  "Tidal predictions may use distant stations — accuracy degrades with distance",
  "Routing uses great-circle math without coastline avoidance",
  "Port database is limited outside US East/Gulf coast",
] as const;

/**
 * Returns the matching coverage region for a coordinate, or null if outside coverage.
 */
export function getCoverageRegion(
  lat: number,
  lon: number,
): CoverageRegion | null {
  for (const region of COVERAGE_REGIONS) {
    if (
      lat >= region.latRange[0] &&
      lat <= region.latRange[1] &&
      lon >= region.lonRange[0] &&
      lon <= region.lonRange[1]
    ) {
      return region;
    }
  }
  return null;
}

/**
 * True iff coordinate falls within any supported coverage region.
 */
export function isInCoverage(lat: number, lon: number): boolean {
  return getCoverageRegion(lat, lon) !== null;
}

/**
 * Evaluate a list of coordinates and return the first one that falls outside coverage,
 * or null if all are inside. Caller decides what to do (warn, gate, set status).
 */
export function findOutOfCoverage(
  points: ReadonlyArray<{ lat: number; lon: number; label?: string }>,
): { lat: number; lon: number; label?: string } | null {
  for (const point of points) {
    if (!isInCoverage(point.lat, point.lon)) {
      return point;
    }
  }
  return null;
}
