import type Redis from "ioredis";
import type { Pool } from "pg";
import type { Logger } from "pino";
import {
  OpenMeteoWeatherService,
  type MarineWeatherForecast,
} from "@passage-planner/shared";
import type { SafetyAgent } from "../../../agents/safety/src/index";
import type { RiskScore } from "../../../agents/safety/src/risk-score";
import type { PushService } from "./PushService";
import { emailService } from "./EmailService";

// ============================================================================
// PassageDriftMonitor (R4) — periodic re-scoring of saved passages
//
// Every 6 hours the cron service calls scan(). For each saved passage whose
// departure is in the next 72 hours and that hasn't been alerted in the past
// 24 hours, we:
//
//   1. Fetch fresh weather at the departure point (Open-Meteo).
//   2. Re-compute the risk score using the FRESH weather but the SAVED
//      vessel/route/hazards/reserves/crew (those don't change).
//   3. If the aggregate score has dropped by >= ALERT_SCORE_DROP relative to
//      the score that was stored with the saved plan, fire an alert via push
//      (topic=weather_updates) AND email fallback.
//   4. Stamp `lastDriftAlertAt` onto the passage so we don't re-alert for
//      24 hours even if the score keeps drifting.
//
// Cost note: a full re-plan would be ~5× more expensive. v1 ships score-only
// drift detection; the push body tells the user to "re-plan to see updated
// ETA" if they want refined timing.
//
// Concurrency: when multiple orchestrator instances run this job, a Redis
// SETNX lock with a 10-minute TTL ensures only one instance scans per
// window. Cheap insurance against eventual horizontal scaling.
// ============================================================================

export const ALERT_SCORE_DROP = 10;
export const SCAN_LOOKAHEAD_HOURS = 72;
export const ALERT_DEDUP_HOURS = 24;
export const SCAN_LOCK_KEY = "r4:drift-scan-lock";
export const SCAN_LOCK_TTL_S = 600;

interface SavedPassage {
  id: string;
  userId: string;
  name?: string;
  // Use index-signature on summary so we can tolerate fields planPassage may
  // add over time (estimatedDuration, baseDuration, etc.) without dragging
  // them into a hard type.
  plan: {
    summary?: { [k: string]: unknown };
    riskScore?: RiskScore;
    request?: any;
    weather?: any;
    route?: any;
    [k: string]: any;
  };
  savedAt?: string;
  /** R4: timestamp of the most recent drift alert, ISO string. */
  lastDriftAlertAt?: string;
}

export interface DriftScanResult {
  scanned: number;
  alerted: number;
  skipped: number;
  errors: number;
  locked: boolean; // false when another instance held the lock
}

export class PassageDriftMonitor {
  private readonly redis: Redis;
  private readonly pool: Pool | null;
  private readonly openMeteo: OpenMeteoWeatherService;
  private readonly safetyAgent: SafetyAgent;
  private readonly push: PushService | null;
  private readonly logger: Logger;
  private readonly appUrl: string;

  constructor(deps: {
    redis: Redis;
    pool: Pool | null;
    openMeteo: OpenMeteoWeatherService;
    safetyAgent: SafetyAgent;
    push: PushService | null;
    logger: Logger;
  }) {
    this.redis = deps.redis;
    this.pool = deps.pool;
    this.openMeteo = deps.openMeteo;
    this.safetyAgent = deps.safetyAgent;
    this.push = deps.push;
    this.logger = deps.logger.child({ service: "drift-monitor" });
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://helmwise.co";
  }

  async scan(now: Date = new Date()): Promise<DriftScanResult> {
    const result: DriftScanResult = {
      scanned: 0,
      alerted: 0,
      skipped: 0,
      errors: 0,
      locked: true,
    };

    // Distributed lock — bail cleanly if another instance is running.
    const lockAcquired = await this.redis.set(
      SCAN_LOCK_KEY,
      String(now.getTime()),
      "EX",
      SCAN_LOCK_TTL_S,
      "NX",
    );
    if (!lockAcquired) {
      this.logger.info("Another instance holds the drift-scan lock; skipping");
      return { ...result, locked: false };
    }

    try {
      let cursor = "0";
      do {
        // Use SCAN (not KEYS) so we don't block Redis on large keyspaces.
        // Match the detail keys with a userId+passageId tail so we skip the
        // per-user sorted-set indices.
        const reply = await this.redis.scan(
          cursor,
          "MATCH",
          "passages:user:*",
          "COUNT",
          100,
        );
        cursor = reply[0];
        const keys = reply[1].filter((k) => {
          // passages:user:{userId} is the zset index; passages:user:{u}:{p}
          // is the detail blob. Detail keys have one more colon.
          return k.split(":").length === 4;
        });
        for (const key of keys) {
          try {
            const handled = await this.processOne(key, now);
            result.scanned++;
            if (handled === "alerted") result.alerted++;
            else result.skipped++;
          } catch (err) {
            result.errors++;
            this.logger.error(
              { err, key },
              "Drift scan: per-passage processing failed",
            );
          }
        }
      } while (cursor !== "0");

      this.logger.info(result, "Drift scan complete");
      return result;
    } finally {
      // Release the lock so the next 6h window isn't held up if we crash.
      await this.redis.del(SCAN_LOCK_KEY).catch(() => undefined);
    }
  }

  private async processOne(
    key: string,
    now: Date,
  ): Promise<"alerted" | "skipped"> {
    const blob = await this.redis.get(key);
    if (!blob) return "skipped";
    const passage = JSON.parse(blob) as SavedPassage;
    if (!isEligible(passage, now)) return "skipped";

    // Fetch fresh weather at the departure point. We use the same
    // OpenMeteo client the planner uses so the 1h cache TTL absorbs
    // repeated calls for clustered passages.
    const lat = passage.plan.request?.departure?.latitude;
    const lon = passage.plan.request?.departure?.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") {
      this.logger.debug(
        { key },
        "Drift scan: passage missing coords; skipping",
      );
      return "skipped";
    }
    const freshWeather = await this.openMeteo.getMarineForecast(lat, lon, 3);

    // Re-score with fresh weather overlaid onto the saved RiskInput.
    const newScore = this.recomputeScore(passage, freshWeather);
    if (!newScore || !passage.plan.riskScore) {
      return "skipped";
    }
    if (!shouldAlert(passage.plan.riskScore, newScore)) {
      return "skipped";
    }

    // Send the alert (push primary, email fallback).
    await this.dispatchAlert(passage, newScore);

    // Stamp lastDriftAlertAt back onto the blob with KEEPTTL so we don't
    // reset its 1-year retention.
    passage.lastDriftAlertAt = now.toISOString();
    await this.redis.set(key, JSON.stringify(passage), "KEEPTTL");
    return "alerted";
  }

  private recomputeScore(
    passage: SavedPassage,
    fresh: MarineWeatherForecast,
  ): RiskScore | null {
    try {
      // Build the same shape buildRiskInput uses, but with fresh weather.
      const plan = passage.plan;
      const vesselReq = plan.request?.vessel ?? {};
      const summary = plan.summary ?? {};
      const tidalDep = plan.tidal?.departure ?? {};
      const hazards = plan.safety?.routeAnalysis?.hazards ?? [];

      const maxWind = Math.max(...fresh.windData.map((w) => w.speed || 0), 0);
      const maxGust = Math.max(
        ...fresh.windData.map((w) => w.gusts || 0),
        maxWind * 1.3,
      );
      const maxWave = Math.max(
        ...fresh.waveHeight.map((w) => (w.height || 0) * 3.281), // m → ft
        0,
      );
      const minVis = Math.min(
        ...fresh.visibility.map((v) => v.distance || 99),
        99,
      );

      const piracyOnRoute = hazards.some((h: any) =>
        /piracy|anti-?shipping/i.test(h.type ?? ""),
      );
      const restrictedCount = hazards.filter((h: any) =>
        /restricted|prohibited/i.test(h.type ?? ""),
      ).length;

      return this.safetyAgent.computeRiskScore({
        vessel: {
          name: vesselReq.name,
          lengthOverallFt: vesselReq.lengthFt ?? vesselReq.length_ft,
          cruiseSpeedKt: vesselReq.cruiseSpeed,
          draftFt: vesselReq.draft ?? 5,
          maxWindKt: vesselReq.maxWindKt ?? vesselReq.max_wind_kt,
          maxWaveFt: vesselReq.maxWaveFt ?? vesselReq.max_wave_ft,
        },
        crew: {
          size: vesselReq.crewSize,
          experience: vesselReq.crewExperience ?? "intermediate",
        },
        passage: {
          distanceNm:
            toNum(summary.totalDistance) ?? toNum(plan.route?.totalDistance),
          durationHr: toNum(summary.estimatedDuration),
        },
        weather: {
          maxWindKt: maxWind > 0 ? maxWind : undefined,
          maxGustKt: maxGust > 0 ? maxGust : undefined,
          maxWaveFt: maxWave > 0 ? maxWave : undefined,
          minVisibilityNm: minVis < 99 ? minVis : undefined,
          issuedAt: fresh.issuedAt,
          available: true,
        },
        depth: {
          minClearanceFt: toNum(tidalDep.clearanceFt),
          available: !!tidalDep,
        },
        hazards: {
          activePiracyOnRoute: piracyOnRoute,
          restrictedAreasOnRoute: restrictedCount,
          iceHazardsOnRoute: 0,
          navWarningsCount: (plan.safety?.warnings ?? []).length,
          available: !!plan.safety,
        },
        reserves: {
          available: false, // Reserves not refreshed by drift scan
        },
      });
    } catch (err) {
      this.logger.warn({ err }, "Drift re-scoring threw");
      return null;
    }
  }

  private async dispatchAlert(
    passage: SavedPassage,
    newScore: RiskScore,
  ): Promise<void> {
    const oldScore = passage.plan.riskScore!.score;
    const drop = oldScore - newScore.score;
    const vesselName = passage.plan.request?.vessel?.name ?? "Vessel";
    const from = passage.plan.request?.departure?.name ?? "departure";
    const to = passage.plan.request?.destination?.name ?? "destination";

    // Push primary.
    if (this.push?.isEnabled()) {
      try {
        await this.push.sendToUser(passage.userId, "weather_updates", {
          title: `Weather changed for ${vesselName}`,
          body: `Risk score dropped from ${oldScore} to ${newScore.score} (status: ${newScore.status}). Re-plan before departing.`,
          url: `${this.appUrl}/planner`,
          tag: `drift-${passage.id}`,
        });
      } catch (err) {
        this.logger.warn(
          { err, userId: passage.userId, passageId: passage.id },
          "Push drift alert failed",
        );
      }
    }

    // Email fallback — always sent so users with no push subscription still
    // get warned. Costs are negligible at MVP scale.
    if (this.pool) {
      try {
        const profile = await this.pool.query(
          `SELECT email, full_name FROM profiles WHERE id = $1`,
          [passage.userId],
        );
        const row = profile.rows[0];
        if (row?.email) {
          await emailService.sendWeatherDriftAlert({
            to: row.email,
            recipientName: row.full_name ?? "Captain",
            vesselName,
            from,
            to_: to,
            oldScore,
            newScore: newScore.score,
            newStatus: newScore.status,
            scoreDrop: drop,
            topContributors: this.topChangedContributors(
              passage.plan.riskScore!,
              newScore,
            ),
            replanUrl: `${this.appUrl}/planner`,
          });
        }
      } catch (err) {
        this.logger.warn(
          { err, userId: passage.userId },
          "Email drift alert failed",
        );
      }
    }
  }

  private topChangedContributors(
    oldScore: RiskScore,
    newScore: RiskScore,
  ): string[] {
    // Surface the contributor lines from the categories that dropped the
    // most — these are the human-readable "what changed" hints.
    const drops = newScore.breakdown
      .map((nb) => {
        const ob = oldScore.breakdown.find((b) => b.category === nb.category);
        return {
          category: nb.category,
          drop: ob ? ob.score - nb.score : 0,
          contributor: nb.contributors[0],
        };
      })
      .filter((x) => x.drop > 0 && x.contributor)
      .sort((a, b) => b.drop - a.drop);
    return drops.slice(0, 3).map((d) => d.contributor);
  }
}

// ----------------------------------------------------------------------------
// Pure helpers — exported for unit testing without standing up a full service.
// ----------------------------------------------------------------------------

export function isEligible(
  passage: SavedPassage,
  now: Date = new Date(),
): boolean {
  const depIso =
    passage.plan?.summary?.departureTime ??
    passage.plan?.request?.departure?.time;
  if (!depIso) return false;
  const depMs = new Date(depIso).getTime();
  if (!Number.isFinite(depMs)) return false;
  const nowMs = now.getTime();
  // Already departed (or in the past) → don't alert; user is at sea.
  if (depMs <= nowMs) return false;
  // Beyond the 72h scan window → not urgent.
  if (depMs - nowMs > SCAN_LOOKAHEAD_HOURS * 60 * 60 * 1000) return false;
  // Dedupe: already alerted within the last 24h → skip.
  if (passage.lastDriftAlertAt) {
    const lastMs = new Date(passage.lastDriftAlertAt).getTime();
    if (
      Number.isFinite(lastMs) &&
      nowMs - lastMs < ALERT_DEDUP_HOURS * 60 * 60 * 1000
    ) {
      return false;
    }
  }
  // Must have a saved risk score to compare against.
  if (!passage.plan?.riskScore) return false;
  return true;
}

export function shouldAlert(
  saved: { score: number },
  fresh: { score: number },
): boolean {
  if (typeof saved.score !== "number" || typeof fresh.score !== "number") {
    return false;
  }
  return saved.score - fresh.score >= ALERT_SCORE_DROP;
}

function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const m = v.match(/-?\d+(\.\d+)?/);
    if (!m) return undefined;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
