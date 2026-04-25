/**
 * NGA ASAM (Anti-Shipping Activity Messages) ingestion.
 *
 * SAFETY-RELATED: ASAM is the U.S. National Geospatial-Intelligence Agency's
 * authoritative feed of anti-shipping incidents (piracy, armed robbery, hostile
 * approach). It is the standard data source mariners are pointed to by USCG /
 * UKMTO / Royal Australian Navy and frequently republishes IMB ICC reports.
 *
 * Source: https://msi.nga.mil/api/publications/asam (public, no key required).
 *
 * The fetch is defensive: malformed records are skipped with a warning, never
 * thrown. A failure of this job must not crash the orchestrator — its job is
 * to refresh data; on failure we keep using the previously-ingested rows. The
 * cron caller already wraps this in try/catch.
 */
import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { Logger } from "pino";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const ASAM_ENDPOINT = "https://msi.nga.mil/api/publications/asam";
const ASAM_SOURCE = "NGA_ASAM";

interface AsamRawRecord {
  reference?: string;
  date?: string;
  latitude?: number | string;
  longitude?: number | string;
  subreg?: string;
  navArea?: string;
  hostility?: string;
  victim?: string;
  aggressor?: string;
  description?: string;
}

interface AsamApiResponse {
  asam?: AsamRawRecord[];
}

export interface AsamIngestResult {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: number;
}

export class AsamIngestService {
  private http: AxiosInstance;
  private supabase: SupabaseClient;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: "asam-ingest" });

    this.http = axios.create({
      timeout: 30_000,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Helmwise Passage Planner (safety-data ingest, contact@helmwise.co)",
      },
    });
    axiosRetry(this.http, {
      retries: 3,
      retryDelay: (n) => n * 1000,
      retryCondition: (err) =>
        axiosRetry.isNetworkOrIdempotentRequestError(err) ||
        (err.response?.status ?? 0) >= 500,
      onRetry: (n, err) =>
        this.logger.warn(
          { retry: n, status: err.response?.status },
          "ASAM fetch retry",
        ),
    });

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error(
        "AsamIngestService requires SUPABASE_URL + SUPABASE_SERVICE_KEY",
      );
    }
    this.supabase = createClient(url, key);
  }

  async run(): Promise<AsamIngestResult> {
    const result: AsamIngestResult = {
      fetched: 0,
      inserted: 0,
      skipped: 0,
      errors: 0,
    };

    const records = await this.fetch();
    result.fetched = records.length;
    if (records.length === 0) {
      this.logger.warn("ASAM feed returned zero records — leaving table as-is");
      return result;
    }

    const rows = records
      .map((r) => this.toRow(r))
      .filter((r): r is NonNullable<typeof r> => {
        if (r === null) result.skipped++;
        return r !== null;
      });

    // Batch upsert to keep payload sizes reasonable.
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error } = await this.supabase
        .from("piracy_zones")
        .upsert(slice, { onConflict: "source,external_ref" });
      if (error) {
        this.logger.error(
          { error, batchStart: i, batchSize: slice.length },
          "ASAM upsert batch failed",
        );
        result.errors += slice.length;
      } else {
        result.inserted += slice.length;
      }
    }

    this.logger.info(result, "ASAM ingest complete");
    return result;
  }

  private async fetch(): Promise<AsamRawRecord[]> {
    // NGA's API returns either `{ asam: [...] }` or a bare array depending on
    // query params. Treat both shapes as valid; reject anything else.
    const res = await this.http.get<AsamApiResponse | AsamRawRecord[]>(
      ASAM_ENDPOINT,
      {
        params: { output: "json" },
      },
    );
    if (Array.isArray(res.data)) return res.data;
    if (res.data && Array.isArray(res.data.asam)) return res.data.asam;
    this.logger.error(
      { keys: res.data && Object.keys(res.data) },
      "ASAM response shape unrecognized",
    );
    return [];
  }

  private toRow(r: AsamRawRecord): Record<string, unknown> | null {
    const lat = numeric(r.latitude);
    const lon = numeric(r.longitude);
    const ref = r.reference?.toString().trim();
    const occurred = r.date ? new Date(r.date) : null;

    if (!ref || lat === null || lon === null || !occurred) {
      this.logger.debug({ raw: r }, "Skipping ASAM record (missing fields)");
      return null;
    }
    if (Number.isNaN(occurred.getTime())) {
      this.logger.debug({ raw: r }, "Skipping ASAM record (bad date)");
      return null;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      this.logger.debug(
        { raw: r, lat, lon },
        "Skipping ASAM record (bad coords)",
      );
      return null;
    }

    return {
      source: ASAM_SOURCE,
      external_ref: ref,
      occurred_at: occurred.toISOString(),
      lat,
      lon,
      subregion: r.subreg ?? null,
      navarea: r.navArea ?? null,
      hostility: r.hostility ?? null,
      victim: r.victim ?? null,
      aggressor: r.aggressor ?? null,
      description: (r.description ?? r.hostility ?? "ASAM report").toString(),
      // PostGIS accepts WKT via the geography type column.
      geom: `SRID=4326;POINT(${lon} ${lat})`,
      raw: r,
    };
  }
}

function numeric(v: number | string | undefined | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
