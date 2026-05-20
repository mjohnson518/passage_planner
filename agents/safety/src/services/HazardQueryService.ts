/**
 * HazardQueryService — server-side spatial query for global hazard feeds.
 *
 * Calls the `public.hazards_along_route` SQL function (migration 014) which
 * does the PostGIS ST_DWithin math against piracy_zones.
 *
 * SAFETY: all DB errors and timeouts are caught and returned as an empty hit
 * list with `degraded: true`. The SafetyAgent caller is expected to surface
 * a `piracy_data_unavailable` warning in that case so the mariner sees the
 * gap. Failing open silently would be a transparency violation; failing
 * loud-but-non-blocking lets the rest of the safety analysis (depth,
 * restricted areas, weather) ship while we audit-log the data gap.
 */
import { Pool } from "pg";
import { Logger } from "pino";

let dbPool: Pool | null = null;

export function initializeHazardQueryDatabase(pool: Pool): void {
  dbPool = pool;
}

function getPool(): Pool | null {
  if (dbPool) return dbPool;
  if (!process.env.DATABASE_URL) return null;
  dbPool = new Pool({ connectionString: process.env.DATABASE_URL });
  return dbPool;
}

export interface PiracyHit {
  id: string;
  source: string;
  externalRef: string;
  occurredAt: string; // ISO
  lat: number;
  lon: number;
  subregion: string | null;
  navarea: string | null;
  hostility: string | null;
  description: string;
  distanceNm: number;
}

export interface HazardQueryResult {
  hits: PiracyHit[];
  /** True iff the query did not run end-to-end (DB unavailable, timeout, etc). */
  degraded: boolean;
  /** Reason for degradation, if any. */
  degradedReason?: string;
}

export interface HazardQueryOptions {
  /** Search radius in nautical miles. Default 50. */
  bufferNm?: number;
  /** Earliest occurrence date to consider. Default: now − 24 months. */
  since?: Date;
  /** Per-query DB timeout in ms. Default 5000. */
  timeoutMs?: number;
}

const DEFAULT_BUFFER_NM = 50;
const DEFAULT_TIMEOUT_MS = 5000;

export class HazardQueryService {
  constructor(private logger: Logger) {}

  async piracyAlongRoute(
    waypoints: Array<{ latitude: number; longitude: number }>,
    opts: HazardQueryOptions = {},
  ): Promise<HazardQueryResult> {
    if (waypoints.length < 2) {
      return { hits: [], degraded: false };
    }

    const pool = getPool();
    if (!pool) {
      this.logger.warn(
        "HazardQueryService: DATABASE_URL not configured — skipping piracy query",
      );
      return {
        hits: [],
        degraded: true,
        degradedReason: "database_not_configured",
      };
    }

    const lineString = {
      type: "LineString",
      coordinates: waypoints.map((w) => [w.longitude, w.latitude]),
    };
    const bufferNm = opts.bufferNm ?? DEFAULT_BUFFER_NM;
    const since =
      opts.since ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2);
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const client = await pool.connect();
    try {
      // Per-query timeout so a slow DB cannot stall the whole plan.
      await client.query(`SET LOCAL statement_timeout = ${Number(timeoutMs)}`);

      const { rows } = await client.query(
        `SELECT id, source, external_ref, occurred_at, lat, lon,
                subregion, navarea, hostility, description, distance_nm
           FROM public.hazards_along_route($1::jsonb, $2::numeric, $3::timestamptz)`,
        [JSON.stringify(lineString), bufferNm, since.toISOString()],
      );

      return {
        hits: rows.map((r: any) => ({
          id: r.id,
          source: r.source,
          externalRef: r.external_ref,
          occurredAt:
            r.occurred_at instanceof Date
              ? r.occurred_at.toISOString()
              : String(r.occurred_at),
          lat: Number(r.lat),
          lon: Number(r.lon),
          subregion: r.subregion,
          navarea: r.navarea,
          hostility: r.hostility,
          description: r.description,
          distanceNm: Number(r.distance_nm),
        })),
        degraded: false,
      };
    } catch (error) {
      this.logger.error(
        { error, waypointCount: waypoints.length },
        "HazardQueryService: piracy query failed",
      );
      return {
        hits: [],
        degraded: true,
        degradedReason:
          error instanceof Error ? error.message : "unknown_db_error",
      };
    } finally {
      client.release();
    }
  }
}
