/**
 * Feature flags for incomplete frontend features.
 *
 * Defaults OFF so broken UI never ships to users. Enable per-feature
 * via NEXT_PUBLIC_FEATURE_* env vars during staged rollouts.
 *
 * The source of truth for whether a feature is fully wired end-to-end
 * lives in this file; update defaults as backends land.
 */

function flag(name: string): boolean {
  const raw = process.env[`NEXT_PUBLIC_FEATURE_${name}`];
  return raw === "1" || raw === "true";
}

export const features = {
  /** Fleet create/invite/manage flow — backend endpoints stubbed as of 2026-04. */
  fleet: flag("FLEET"),
  /** Crew invitation via email — backend TODO. */
  crewInvite: flag("CREW_INVITE"),
  /** Passage GPX/KML/CSV/PDF export — @ts-nocheck on export libs; unverified. */
  exportPassage: flag("EXPORT_PASSAGE"),
  /** Single-passage delete — wired to DELETE /api/passages/:id; default off until smoke-tested. */
  passageDelete: flag("PASSAGE_DELETE"),
  /** Multi-passage bulk export (GPX) — wired to POST /api/passages/export/bulk; default off until smoke-tested. */
  bulkExport: flag("BULK_EXPORT"),
  /** NOAA weather radar/forecast overlay on the route map — tile layer unwired. */
  weatherOverlay: flag("WEATHER_OVERLAY"),
  /** Weather page CSV/PDF export — wired to nothing. */
  weatherExport: flag("WEATHER_EXPORT"),
  /** WebSocket-based agent health dashboard — placeholder only. */
  agentMonitoring: flag("AGENT_MONITORING"),
};

export type FeatureKey = keyof typeof features;
