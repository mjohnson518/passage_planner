// Shared types + math for the anchor-watch UI components.
// NOTE: this module is presentational/display math only. The alarm decision
// logic lives in app/anchor/page.tsx and must not be duplicated here.

export interface AnchorState {
  anchorLat: number;
  anchorLon: number;
  radiusMeters: number;
  droppedAt: number;
}

export interface PositionReading {
  lat: number;
  lon: number;
  accuracyM: number;
  timestamp: number;
  distanceFromAnchorM: number;
}

export type WatchStatus = "idle" | "watching" | "alarming";

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const dλ = toRad(lon2 - lon1);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
