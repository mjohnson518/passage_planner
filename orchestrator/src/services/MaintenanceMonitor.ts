import type { Pool } from "pg";
import type { Logger } from "pino";
import type { PushService } from "./PushService";
import { emailService } from "./EmailService";

// ============================================================================
// MaintenanceMonitor (V2) — daily scan for overdue vessel-maintenance items
//
// Twin overdue triggers:
//   - Time-based: now - last_serviced_at >= interval_days
//   - Hours-based: vessel.current_<meter>_hours - last_serviced_at_hours
//                  >= interval_hours
//
// Items with BOTH intervals fire when EITHER trips (whichever comes first).
// Items that have never been serviced (last_serviced_at IS NULL) are
// considered overdue immediately — they need a baseline service before
// tracking can begin.
//
// Dedup: when an alert fires we stamp last_alerted_at; the next 7 days are
// suppressed. Maintenance is important but not urgent enough to nag daily.
//
// The scan is intentionally serial-per-user (one email per user per scan,
// listing all their overdue items) to avoid spam. Push notification fires
// once per user if any item is overdue.
// ============================================================================

export const MAINTENANCE_ALERT_DEDUP_DAYS = 7;
export const MAINTENANCE_DUE_SOON_FRACTION = 0.2;

export type OverdueStatus = "ok" | "due_soon" | "overdue";

export interface VesselRow {
  id: string;
  user_id: string;
  name: string;
  current_engine_hours: number;
  current_watermaker_hours: number;
}

export interface MaintenanceItemRow {
  id: string;
  user_id: string;
  vessel_id: string;
  item: string;
  category: string | null;
  interval_hours: number | null;
  interval_days: number | null;
  hours_meter_source: "engine" | "watermaker" | null;
  last_serviced_at: string | null;
  last_serviced_at_hours: number | null;
  last_alerted_at: string | null;
}

export interface OverdueEvaluation {
  status: OverdueStatus;
  daysUntilDue: number | null;
  hoursUntilDue: number | null;
  reason: string;
}

export interface MaintenanceScanResult {
  scanned: number;
  alertedUsers: number;
  errors: number;
}

export class MaintenanceMonitor {
  private readonly pool: Pool;
  private readonly push: PushService | null;
  private readonly logger: Logger;
  private readonly appUrl: string;

  constructor(deps: { pool: Pool; push: PushService | null; logger: Logger }) {
    this.pool = deps.pool;
    this.push = deps.push;
    this.logger = deps.logger.child({ service: "maintenance-monitor" });
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://helmwise.co";
  }

  async scan(now: Date = new Date()): Promise<MaintenanceScanResult> {
    const result: MaintenanceScanResult = {
      scanned: 0,
      alertedUsers: 0,
      errors: 0,
    };

    // Pull every maintenance item joined to its vessel. For an MVP this is
    // fine; at scale, partition by user or filter by last_alerted_at.
    const dedupCutoff = new Date(
      now.getTime() - MAINTENANCE_ALERT_DEDUP_DAYS * 24 * 60 * 60 * 1000,
    );

    let rows: Array<
      MaintenanceItemRow & {
        vessel_name: string;
        current_engine_hours: number;
        current_watermaker_hours: number;
      }
    >;
    try {
      const queryResult = await this.pool.query(
        `SELECT m.id, m.user_id, m.vessel_id, m.item, m.category,
                m.interval_hours, m.interval_days, m.hours_meter_source,
                m.last_serviced_at, m.last_serviced_at_hours, m.last_alerted_at,
                v.name AS vessel_name,
                v.current_engine_hours, v.current_watermaker_hours
           FROM vessel_maintenance m
           JOIN user_vessels v ON v.id = m.vessel_id
          WHERE m.last_alerted_at IS NULL OR m.last_alerted_at < $1`,
        [dedupCutoff],
      );
      rows = queryResult.rows;
    } catch (err) {
      this.logger.error({ err }, "Maintenance scan: query failed");
      result.errors = 1;
      return result;
    }

    result.scanned = rows.length;
    if (rows.length === 0) return result;

    // Group by user → batch one alert per user containing all overdue items.
    const byUser = new Map<
      string,
      Array<{
        item: MaintenanceItemRow & { vessel_name: string };
        evaluation: OverdueEvaluation;
      }>
    >();

    for (const row of rows) {
      const vessel: VesselRow = {
        id: row.vessel_id,
        user_id: row.user_id,
        name: row.vessel_name,
        current_engine_hours: row.current_engine_hours,
        current_watermaker_hours: row.current_watermaker_hours,
      };
      const evaluation = evaluateOverdue(row, vessel, now);
      if (evaluation.status !== "overdue") continue;
      const bucket = byUser.get(row.user_id) ?? [];
      bucket.push({ item: row, evaluation });
      byUser.set(row.user_id, bucket);
    }

    if (byUser.size === 0) return result;

    for (const [userId, items] of byUser) {
      try {
        await this.dispatchUserAlert(userId, items, now);
        result.alertedUsers++;
      } catch (err) {
        result.errors++;
        this.logger.error(
          { err, userId, itemCount: items.length },
          "Maintenance alert dispatch failed",
        );
      }
    }

    return result;
  }

  private async dispatchUserAlert(
    userId: string,
    items: Array<{
      item: MaintenanceItemRow & { vessel_name: string };
      evaluation: OverdueEvaluation;
    }>,
    now: Date,
  ): Promise<void> {
    // Push notification — once per user, summarising count.
    if (this.push?.isEnabled()) {
      const count = items.length;
      const firstVessel = items[0].item.vessel_name;
      const body =
        count === 1
          ? `${items[0].item.item} on ${firstVessel} is overdue.`
          : `${count} maintenance items overdue across your vessels.`;
      await this.push
        .sendToUser(userId, "maintenance", {
          title: "Maintenance overdue",
          body,
          url: `${this.appUrl}/account/vessels`,
          tag: `maintenance-${userId}`,
        })
        .catch((err: unknown) =>
          this.logger.warn({ err, userId }, "Maintenance push fanout failed"),
        );
    }

    // Email — pull user email; fallback for users without push subs.
    try {
      const profile = await this.pool.query(
        `SELECT email, full_name FROM profiles WHERE id = $1`,
        [userId],
      );
      const row = profile.rows[0];
      if (row?.email) {
        await emailService.sendMaintenanceDueAlert({
          to: row.email,
          recipientName: row.full_name ?? "Captain",
          items: items.map(({ item, evaluation }) => ({
            vesselName: item.vessel_name,
            itemName: item.item,
            reason: evaluation.reason,
          })),
          manageUrl: `${this.appUrl}/account/vessels`,
        });
      }
    } catch (err) {
      this.logger.warn(
        { err, userId },
        "Maintenance email dispatch failed (push may have succeeded)",
      );
    }

    // Stamp last_alerted_at on each item so the 7-day dedup window holds.
    const ids = items.map((i) => i.item.id);
    await this.pool.query(
      `UPDATE vessel_maintenance SET last_alerted_at = $1 WHERE id = ANY($2::uuid[])`,
      [now.toISOString(), ids],
    );
  }
}

// ----------------------------------------------------------------------------
// Pure evaluators — exported for unit testing without a DB.
// ----------------------------------------------------------------------------

/**
 * Evaluate whether a maintenance item is overdue / due-soon / OK given the
 * current vessel state. Pure function — no I/O.
 *
 * An item with `interval_hours` requires its vessel's hour-meter; an item
 * with `interval_days` checks elapsed days since last_serviced_at. If both
 * are set the item is overdue when EITHER trips.
 *
 * "Never serviced" items (last_serviced_at IS NULL) are immediately overdue
 * — the captain needs to establish a baseline before tracking begins.
 */
export function evaluateOverdue(
  item: MaintenanceItemRow,
  vessel: VesselRow,
  now: Date = new Date(),
): OverdueEvaluation {
  // Never serviced — surface immediately as overdue with a baseline note.
  if (item.last_serviced_at === null) {
    return {
      status: "overdue",
      daysUntilDue: null,
      hoursUntilDue: null,
      reason: "Never serviced — record a baseline service to start tracking.",
    };
  }

  const lastMs = new Date(item.last_serviced_at).getTime();
  if (!Number.isFinite(lastMs)) {
    return {
      status: "overdue",
      daysUntilDue: null,
      hoursUntilDue: null,
      reason: "Invalid last-serviced timestamp — re-record this service.",
    };
  }

  let daysUntilDue: number | null = null;
  let hoursUntilDue: number | null = null;
  const reasons: string[] = [];

  if (item.interval_days !== null) {
    const elapsedMs = now.getTime() - lastMs;
    const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);
    daysUntilDue = item.interval_days - elapsedDays;
    if (daysUntilDue <= 0) {
      reasons.push(
        `${Math.round(-daysUntilDue)} days overdue (interval ${item.interval_days} d)`,
      );
    }
  }

  if (item.interval_hours !== null && item.hours_meter_source !== null) {
    const baseline = item.last_serviced_at_hours ?? 0;
    const current =
      item.hours_meter_source === "engine"
        ? vessel.current_engine_hours
        : vessel.current_watermaker_hours;
    const elapsedHours = current - baseline;
    hoursUntilDue = item.interval_hours - elapsedHours;
    if (hoursUntilDue <= 0) {
      reasons.push(
        `${Math.round(-hoursUntilDue)} h overdue (interval ${item.interval_hours} h on ${item.hours_meter_source})`,
      );
    }
  }

  if (reasons.length > 0) {
    return {
      status: "overdue",
      daysUntilDue,
      hoursUntilDue,
      reason: reasons.join("; "),
    };
  }

  // Due-soon when within MAINTENANCE_DUE_SOON_FRACTION of interval.
  const daysSoon =
    daysUntilDue !== null &&
    item.interval_days !== null &&
    daysUntilDue / item.interval_days <= MAINTENANCE_DUE_SOON_FRACTION;
  const hoursSoon =
    hoursUntilDue !== null &&
    item.interval_hours !== null &&
    hoursUntilDue / item.interval_hours <= MAINTENANCE_DUE_SOON_FRACTION;

  if (daysSoon || hoursSoon) {
    const parts: string[] = [];
    if (daysSoon && daysUntilDue !== null)
      parts.push(`due in ${Math.round(daysUntilDue)} days`);
    if (hoursSoon && hoursUntilDue !== null)
      parts.push(`due in ${Math.round(hoursUntilDue)} h`);
    return {
      status: "due_soon",
      daysUntilDue,
      hoursUntilDue,
      reason: parts.join(", "),
    };
  }

  return {
    status: "ok",
    daysUntilDue,
    hoursUntilDue,
    reason: "Within service interval.",
  };
}
