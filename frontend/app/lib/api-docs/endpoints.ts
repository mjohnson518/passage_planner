// ============================================================================
// API docs — single source of truth (F2)
//
// Each entry describes a publicly-callable endpoint. The /api-docs page
// renders the entire docs site from this list. To document a new endpoint:
//
//   1. Add an entry here.
//   2. Run the dev server. The page picks it up — no markdown to maintain.
//
// Curl examples use $HELMWISE_API_KEY as the credential placeholder so
// users can copy-and-run after exporting their key once. Real OpenAPI
// generation from Zod schemas is a follow-up; this is the smaller, honest
// first cut.
// ============================================================================

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
export type ApiScope = "read" | "write";

export interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  scopes: ApiScope[];
  curlExample: string;
  responseShape?: string;
}

const API_BASE = "$HELMWISE_API"; // placeholder users replace with their host

export const API_ENDPOINTS: ApiEndpoint[] = [
  // -- Passages -------------------------------------------------------------
  {
    id: "list-passages",
    method: "GET",
    path: "/api/passages",
    summary: "List saved passages",
    description:
      "Returns the most recent saved passages for the authenticated user (up to 100).",
    scopes: ["read"],
    curlExample: `curl ${API_BASE}/api/passages \\
  -H "X-API-Key: $HELMWISE_API_KEY"`,
    responseShape: `{
  "passages": [
    {
      "id": "uuid",
      "name": "Cowes → Cherbourg",
      "savedAt": "2026-05-26T14:00:00Z",
      "plan": { ... }
    }
  ]
}`,
  },
  {
    id: "get-passage",
    method: "GET",
    path: "/api/passages/recent?limit=5",
    summary: "Recent passages",
    description:
      "Lightweight list endpoint that returns only the N most recent passages. Useful for dashboards.",
    scopes: ["read"],
    curlExample: `curl "${API_BASE}/api/passages/recent?limit=5" \\
  -H "X-API-Key: $HELMWISE_API_KEY"`,
    responseShape: `{ "passages": [ { "id": "...", "name": "...", ... } ] }`,
  },
  {
    id: "save-passage",
    method: "POST",
    path: "/api/passages",
    summary: "Save a passage plan",
    scopes: ["write"],
    curlExample: `curl -X POST ${API_BASE}/api/passages \\
  -H "X-API-Key: $HELMWISE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Cowes to Cherbourg",
    "plan": { ... }
  }'`,
    responseShape: `{
  "success": true,
  "passage": { "id": "uuid", "name": "...", "savedAt": "..." }
}`,
  },
  {
    id: "delete-passage",
    method: "DELETE",
    path: "/api/passages/:id",
    summary: "Delete a passage",
    description:
      "Also revokes any active share link for the passage so its public URL stops resolving immediately.",
    scopes: ["write"],
    curlExample: `curl -X DELETE ${API_BASE}/api/passages/PASSAGE_ID \\
  -H "X-API-Key: $HELMWISE_API_KEY"`,
    responseShape: `{ "success": true }`,
  },

  // -- Planning -------------------------------------------------------------
  {
    id: "plan-passage",
    method: "POST",
    path: "/api/plan",
    summary: "Generate a passage plan",
    description:
      "Runs weather, tidal, route, safety, port, and NDBC-buoy agents in parallel and returns an assembled plan with optional risk score and multi-model comparison.",
    scopes: ["write"],
    curlExample: `curl -X POST ${API_BASE}/api/plan \\
  -H "X-API-Key: $HELMWISE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "departure": { "latitude": 50.7587, "longitude": -1.2982, "name": "Cowes", "time": "2026-06-01T06:00:00Z" },
    "destination": { "latitude": 49.6500, "longitude": -1.6200, "name": "Cherbourg" },
    "vessel": { "cruiseSpeed": 6, "draft": 5.5 },
    "multiModel": true
  }'`,
    responseShape: `{
  "success": true,
  "plan": {
    "route": { ... },
    "weather": { ... },
    "riskScore": { "status": "GO", "score": 82, ... },
    "modelComparison": { ... }
  }
}`,
  },

  // -- Share links ----------------------------------------------------------
  {
    id: "public-share-lookup",
    method: "GET",
    path: "/api/share/:token",
    summary: "Public share-link lookup",
    description:
      "PUBLIC endpoint — no auth required. Returns a redacted view of a shared passage. Vessel identifiers (MMSI/EPIRB/InReach), owner email, and crew details are stripped before the response leaves the server.",
    scopes: [],
    curlExample: `curl ${API_BASE}/api/share/SHARE_TOKEN`,
    responseShape: `{
  "vessel": { "name": "Antares", "type": "Sloop", "length_ft": 35 },
  "passage": { "from": "Cowes", "to": "Cherbourg", "eta": "..." },
  "route": { "waypoints": [...] }
}`,
  },

  // -- Logbook --------------------------------------------------------------
  {
    id: "list-logbook",
    method: "GET",
    path: "/api/passages/:id/logbook",
    summary: "List logbook entries for a passage",
    scopes: ["read"],
    curlExample: `curl ${API_BASE}/api/passages/PASSAGE_ID/logbook \\
  -H "X-API-Key: $HELMWISE_API_KEY"`,
    responseShape: `{ "entries": [ { "entry_type": "departure", "occurred_at": "...", ... } ] }`,
  },
  {
    id: "add-logbook-entry",
    method: "POST",
    path: "/api/passages/:id/logbook",
    summary: "Add a logbook entry",
    description:
      "Append-only. Entries cannot be edited after 5 minutes (delete window) — corrections must be added as new entries (maritime tradition).",
    scopes: ["write"],
    curlExample: `curl -X POST ${API_BASE}/api/passages/PASSAGE_ID/logbook \\
  -H "X-API-Key: $HELMWISE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "entry_type": "position",
    "occurred_at": "2026-06-01T12:00:00Z",
    "position_lat": 50.5,
    "position_lon": -1.4,
    "notes": "On the rhumb line, 4kt under spinnaker."
  }'`,
    responseShape: `{ "entry": { "id": "uuid", ... } }`,
  },

  // -- Vessels --------------------------------------------------------------
  {
    id: "list-vessels",
    method: "GET",
    path: "/api/vessels",
    summary: "List vessels",
    description:
      "Returns the user's vessels with current engine/watermaker hour readings.",
    scopes: ["read"],
    curlExample: `curl ${API_BASE}/api/vessels \\
  -H "X-API-Key: $HELMWISE_API_KEY"`,
    responseShape: `{
  "vessels": [
    { "id": "uuid", "name": "Antares", "current_engine_hours": 1234.5, ... }
  ]
}`,
  },
  {
    id: "update-vessel-hours",
    method: "PUT",
    path: "/api/vessels/:id/hours",
    summary: "Update engine / watermaker hours",
    description:
      "Captain updates these manually after each trip. Drives hour-based maintenance interval evaluation.",
    scopes: ["write"],
    curlExample: `curl -X PUT ${API_BASE}/api/vessels/VESSEL_ID/hours \\
  -H "X-API-Key: $HELMWISE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "current_engine_hours": 1240.0 }'`,
    responseShape: `{ "vessel": { "id": "...", "current_engine_hours": 1240, ... } }`,
  },
];
