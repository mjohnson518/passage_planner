/**
 * Coverage region helpers — frontend mirror of shared/src/constants/coverage-regions.ts.
 *
 * Local copy because the workspace build blocks importing @passage-planner/shared
 * directly from the frontend. Keep in sync with the shared module — both files
 * define the same bounding boxes so the planner's pre-submit gate matches the
 * orchestrator's post-plan COVERAGE_LIMITED status.
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

export function isInCoverage(lat: number, lon: number): boolean {
  for (const region of COVERAGE_REGIONS) {
    if (
      lat >= region.latRange[0] &&
      lat <= region.latRange[1] &&
      lon >= region.lonRange[0] &&
      lon <= region.lonRange[1]
    ) {
      return true;
    }
  }
  return false;
}

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
