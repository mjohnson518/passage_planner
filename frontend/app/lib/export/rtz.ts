import type { PassageExport } from "../../types/shared";

// ============================================================================
// RTZ (Route Plan Exchange Format) — ISO/IEC 17984 / CIRM standard
//
// RTZ is the ECDIS-era standard for route exchange, supported by all modern
// chartplotters from Raymarine, B&G, Simrad, Furuno, JRC, and most ECDIS
// systems. We emit RTZ 1.0 (most permissive variant — every plotter that
// reads RTZ accepts 1.0; 1.1/1.2 add schedules and operator preferences
// that older firmware ignores).
//
// Minimal valid file:
//   <route><routeInfo .../><waypoints>... </waypoints></route>
//
// Per-waypoint elements we emit:
//   - position(lat, lon) — required
//   - leg(geometryType="Loxodrome") — required on all but the last waypoint;
//     "Loxodrome" (rhumb line) is the standard for coastal sailing
//   - defaultWaypoint(radius) — sets a sensible default arrival radius
//
// Reference: https://www.cirm.org/RTZ/
// ============================================================================

interface RtzOptions {
  /** Author shown in routeInfo. Defaults to "Helmwise". */
  author?: string;
  /** Vessel name attached to the route. Optional but useful for plotters
   *  that display multiple imported routes. */
  vesselName?: string;
  /** Default waypoint arrival radius in nautical miles. 0.5 nm is the
   *  Helmwise default — close enough to count as "made the mark," large
   *  enough to avoid spurious not-arrived warnings in current/wind. */
  defaultArrivalRadiusNm?: number;
}

export function passageToRTZ(
  passage: PassageExport,
  options: RtzOptions = {},
): string {
  const author = escapeXml(options.author ?? "Helmwise");
  const vesselName = options.vesselName
    ? ` vesselName="${escapeXml(options.vesselName)}"`
    : "";
  const radius = options.defaultArrivalRadiusNm ?? 0.5;

  const points = collectPoints(passage);
  if (points.length === 0) {
    throw new Error("Cannot export to RTZ: passage has no usable coordinates.");
  }

  const waypointsXml = points
    .map((p, idx) => {
      const isLast = idx === points.length - 1;
      // Each waypoint needs a unique id within the route. RTZ ids are
      // 1-based integers per the spec.
      const id = idx + 1;
      const lat = p.lat.toFixed(6);
      const lon = p.lon.toFixed(6);
      const name = escapeXml(p.name);
      // Leg geometry attaches to the waypoint that begins each leg, so the
      // final waypoint has no leg element.
      const leg = isLast ? "" : `      <leg geometryType="Loxodrome"/>`;
      return `    <waypoint id="${id}" name="${name}">
      <position lat="${lat}" lon="${lon}"/>
${leg}    </waypoint>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<route version="1.0" xmlns="http://www.cirm.org/RTZ/1/0">
  <routeInfo routeName="${escapeXml(passage.name ?? "Passage")}" routeAuthor="${author}"${vesselName}/>
  <waypoints>
    <defaultWaypoint radius="${radius.toFixed(2)}"/>
${waypointsXml}
  </waypoints>
</route>
`;
}

interface CollectedPoint {
  name: string;
  lat: number;
  lon: number;
}

function collectPoints(passage: PassageExport): CollectedPoint[] {
  const out: CollectedPoint[] = [];
  const dep = endpointToPoint(
    passage.departure,
    passage.departure?.name ?? "Departure",
  );
  if (dep) out.push(dep);
  for (const wp of passage.waypoints ?? []) {
    const p = waypointToPoint(wp);
    if (p) out.push(p);
  }
  const dest = endpointToPoint(
    passage.destination,
    passage.destination?.name ?? "Destination",
  );
  if (dest) out.push(dest);
  return out;
}

function endpointToPoint(
  ep: PassageExport["departure"] | undefined,
  fallbackName: string,
): CollectedPoint | null {
  if (!ep) return null;
  const coords = toLatLon(
    ep.coordinates?.lat ?? ep.latitude,
    ep.coordinates?.lng ?? ep.longitude,
  );
  if (!coords) return null;
  return { name: ep.name ?? fallbackName, ...coords };
}

function waypointToPoint(
  wp: NonNullable<PassageExport["waypoints"]>[number],
): CollectedPoint | null {
  const coords = toLatLon(
    wp.coordinates?.lat ?? wp.latitude,
    wp.coordinates?.lng ?? wp.longitude,
  );
  if (!coords) return null;
  return { name: wp.name ?? "Waypoint", ...coords };
}

function toLatLon(
  lat: unknown,
  lon: unknown,
): { lat: number; lon: number } | null {
  if (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  ) {
    return { lat, lon };
  }
  return null;
}

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
