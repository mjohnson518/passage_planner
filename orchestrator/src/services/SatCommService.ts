import * as crypto from "crypto";
import type { Pool } from "pg";
import type Redis from "ioredis";
import type { Logger } from "pino";
import { PushService } from "./PushService";
import type { NormalisedPosition, Vendor } from "./satcomm/adapters";

// ============================================================================
// SatCommService — sat-comm device registry + position ingestion + off-route
// detection + push fanout.
//
// Ingestion pipeline:
//   1. Caller (the webhook handler) has already verified the HMAC signature
//      using the device's webhook_secret.
//   2. Insert position_reports row.
//   3. Find the user's active passage (departure within last 7 days; ETA in
//      the future). Skip if none.
//   4. Compute distance from the current position to the nearest segment of
//      the planned route. If > OFF_ROUTE_THRESHOLD_NM, transition the
//      device's deviation_state and (on the on→off transition) send a push
//      alert. Inverse transition optionally sends an "on route" notification.
//
// Off-route distance is approximated with euclidean nearest-point-on-segment
// using haversine distances at the endpoints — fine for coastal passages
// (<100 nm). Ocean crossings would benefit from true great-circle nearest-
// point math; flagged as a follow-up.
// ============================================================================

export const OFF_ROUTE_THRESHOLD_NM = 5;
const POSITION_RETENTION_DAYS = 90;
const ACTIVE_PASSAGE_LOOKBACK_DAYS = 7;

export interface DeviceRow {
  id: string;
  user_id: string;
  vendor: Vendor;
  device_id: string;
  nickname: string | null;
  webhook_secret: string;
  deviation_state: "on" | "off" | null;
  last_report_at: string | null;
  created_at: string;
  updated_at: string;
}

export class SatCommService {
  private readonly pool: Pool;
  private readonly redis: Redis | null;
  private readonly push: PushService | null;
  private readonly logger: Logger;

  constructor(
    pool: Pool,
    redis: Redis | null,
    push: PushService | null,
    logger: Logger,
  ) {
    this.pool = pool;
    this.redis = redis;
    this.push = push;
    this.logger = logger.child({ service: "satcomm" });
  }

  // 32 bytes hex (~64 chars) — secret used as HMAC-SHA256 key. Long enough
  // that the brute-force attack model is irrelevant.
  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async createDevice(args: {
    userId: string;
    vendor: Vendor;
    deviceId: string;
    nickname?: string;
  }): Promise<DeviceRow> {
    const secret = this.generateWebhookSecret();
    const result = await this.pool.query<DeviceRow>(
      `INSERT INTO sat_comm_devices
         (user_id, vendor, device_id, nickname, webhook_secret)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [args.userId, args.vendor, args.deviceId, args.nickname ?? null, secret],
    );
    return result.rows[0];
  }

  async listDevices(userId: string): Promise<DeviceRow[]> {
    const result = await this.pool.query<DeviceRow>(
      `SELECT * FROM sat_comm_devices WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async getDeviceForOwner(
    userId: string,
    deviceId: string,
  ): Promise<DeviceRow | null> {
    const result = await this.pool.query<DeviceRow>(
      `SELECT * FROM sat_comm_devices WHERE id = $1 AND user_id = $2`,
      [deviceId, userId],
    );
    return result.rows[0] ?? null;
  }

  // Lookup for the webhook handler — does not require auth, only the vendor+
  // device_id pair plus successful signature verification at the call site.
  async getDeviceByVendorDeviceId(
    vendor: string,
    deviceId: string,
  ): Promise<DeviceRow | null> {
    const result = await this.pool.query<DeviceRow>(
      `SELECT * FROM sat_comm_devices WHERE vendor = $1 AND device_id = $2`,
      [vendor, deviceId],
    );
    return result.rows[0] ?? null;
  }

  async deleteDevice(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM sat_comm_devices WHERE id = $1 AND user_id = $2`,
      [deviceId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listLatestPositions(deviceId: string, limit = 100): Promise<unknown[]> {
    const result = await this.pool.query(
      `SELECT id, reported_at, received_at, lat, lon, speed_kn, course_deg,
              battery_pct, message_text, vendor
         FROM position_reports
         WHERE device_id = $1
         ORDER BY reported_at DESC
         LIMIT $2`,
      [deviceId, Math.min(limit, 500)],
    );
    return result.rows;
  }

  async purgePositionReports(deviceId: string): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM position_reports WHERE device_id = $1`,
      [deviceId],
    );
    return result.rowCount ?? 0;
  }

  async purgeOldPositionReports(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM position_reports
         WHERE received_at < NOW() - INTERVAL '${POSITION_RETENTION_DAYS} days'`,
    );
    return result.rowCount ?? 0;
  }

  // Core ingestion path. The webhook handler has already done auth (HMAC)
  // and translated the vendor payload to NormalisedPosition. Returns the
  // off-route distance (if calculable) so the handler can surface diagnostics
  // in its response — useful when operators are testing webhooks.
  async ingestPosition(
    device: DeviceRow,
    position: NormalisedPosition,
  ): Promise<{
    stored: boolean;
    offRouteDistanceNm: number | null;
    transition: "on->off" | "off->on" | null;
  }> {
    await this.pool.query(
      `INSERT INTO position_reports
         (device_id, reported_at, lat, lon, speed_kn, course_deg,
          battery_pct, message_text, raw_payload, vendor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        device.id,
        position.reportedAt,
        position.lat,
        position.lon,
        position.speedKn ?? null,
        position.courseDeg ?? null,
        position.batteryPct ?? null,
        position.messageText ?? null,
        JSON.stringify(position.rawPayload ?? {}),
        device.vendor,
      ],
    );
    await this.pool.query(
      `UPDATE sat_comm_devices SET last_report_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [device.id],
    );

    // Off-route check — requires Redis (where passages live) and an active
    // passage. If anything is missing we still successfully ingested the
    // position; we just can't evaluate deviation.
    let offRouteDistanceNm: number | null = null;
    let transition: "on->off" | "off->on" | null = null;
    if (this.redis) {
      try {
        const active = await this.findActivePassage(device.user_id);
        if (active) {
          offRouteDistanceNm = this.distanceFromRouteNm(
            position.lat,
            position.lon,
            active.waypoints,
          );
          transition = await this.maybeAlertDeviation(
            device,
            position,
            offRouteDistanceNm,
            active.name,
          );
        }
      } catch (err) {
        this.logger.warn(
          { err, deviceId: device.id },
          "Off-route check failed (ingestion still succeeded)",
        );
      }
    }

    return { stored: true, offRouteDistanceNm, transition };
  }

  // ----------------------------------------------------------------------
  // private — passage lookup + math + alerting
  // ----------------------------------------------------------------------
  private async findActivePassage(userId: string): Promise<{
    id: string;
    name: string;
    waypoints: Array<{ lat: number; lon: number }>;
  } | null> {
    if (!this.redis) return null;
    const ids = (await this.redis.zrevrange(
      `passages:user:${userId}`,
      0,
      19,
    )) as string[];
    if (ids.length === 0) return null;

    const now = Date.now();
    const lookbackMs = ACTIVE_PASSAGE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

    for (const id of ids) {
      const blob = await this.redis.get(`passages:user:${userId}:${id}`);
      if (!blob) continue;
      try {
        const record = JSON.parse(blob) as { name?: string; plan?: unknown };
        const plan = (record.plan ?? {}) as Record<string, any>;
        const summary = (plan.summary ?? {}) as Record<string, any>;
        const departureTime =
          summary.departureTime ?? plan.request?.departure?.time;
        const estimatedArrival = summary.estimatedArrival;
        if (!departureTime) continue;
        const depMs = new Date(departureTime).getTime();
        const etaMs = estimatedArrival
          ? new Date(estimatedArrival).getTime()
          : depMs + 24 * 60 * 60 * 1000; // fallback 24h
        if (depMs < now - lookbackMs) continue;
        if (etaMs < now) continue;

        const route = (plan.route ?? {}) as Record<string, any>;
        const waypoints: Array<{ lat: number; lon: number }> = Array.isArray(
          route.waypoints,
        )
          ? route.waypoints
              .map((w: any) => ({
                lat: typeof w.lat === "number" ? w.lat : w.latitude,
                lon: typeof w.lon === "number" ? w.lon : w.longitude,
              }))
              .filter(
                (w: { lat: number; lon: number }) =>
                  Number.isFinite(w.lat) && Number.isFinite(w.lon),
              )
          : [];
        if (waypoints.length < 2) continue;
        return { id, name: record.name ?? "Active passage", waypoints };
      } catch {
        continue;
      }
    }
    return null;
  }

  // Off-route distance: minimum great-circle distance from the point to any
  // segment of the planned route. Uses haversine at the endpoints and a
  // local linear approximation for the "perpendicular distance from segment"
  // part — accurate within ~1% for passages <100 nm. Returns nm.
  private distanceFromRouteNm(
    lat: number,
    lon: number,
    waypoints: Array<{ lat: number; lon: number }>,
  ): number {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const d = this.distanceFromSegmentNm(
        lat,
        lon,
        waypoints[i],
        waypoints[i + 1],
      );
      if (d < min) min = d;
    }
    return min;
  }

  private distanceFromSegmentNm(
    plat: number,
    plon: number,
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
  ): number {
    // Local equirectangular projection — accurate for short segments. For
    // ocean-crossing passages with thousands-of-mile segments this would
    // need true great-circle nearest-point; flagged for follow-up.
    const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
    const cosMean = Math.cos(meanLat);
    const ax = a.lon * cosMean;
    const ay = a.lat;
    const bx = b.lon * cosMean;
    const by = b.lat;
    const px = plon * cosMean;
    const py = plat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const nearestLat = ay + t * (by - ay);
    const nearestLon = (ax + t * (bx - ax)) / cosMean;
    return this.haversineNm(plat, plon, nearestLat, nearestLon);
  }

  private haversineNm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R_NM = 3440.065; // Earth radius in nm
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const dφ = ((lat2 - lat1) * Math.PI) / 180;
    const dλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // Transition-aware alerting. We only push on the on→off edge to avoid
  // spamming the user (and their family, via S3) every 10 minutes while the
  // vessel is off-route. Inverse transition optionally sends an "all good"
  // notification — soft signal, also non-spammy.
  private async maybeAlertDeviation(
    device: DeviceRow,
    position: NormalisedPosition,
    distanceNm: number,
    passageName: string,
  ): Promise<"on->off" | "off->on" | null> {
    const isOff = distanceNm > OFF_ROUTE_THRESHOLD_NM;
    const prev = device.deviation_state;
    const next = isOff ? "off" : "on";
    if (prev === next) return null;

    await this.pool.query(
      `UPDATE sat_comm_devices SET deviation_state = $1, updated_at = NOW() WHERE id = $2`,
      [next, device.id],
    );

    if (this.push) {
      const nickname = device.nickname ?? "Vessel";
      if (next === "off") {
        await this.push
          .sendToUser(device.user_id, "safety_alerts", {
            title: `${nickname} is off-route`,
            body: `Last position is ${distanceNm.toFixed(1)} nm from the planned route for "${passageName}".`,
            url: "/account/devices",
            tag: `off-route-${device.id}`,
          })
          .catch((err: unknown) =>
            this.logger.warn(
              { err, deviceId: device.id },
              "Off-route push failed",
            ),
          );
      } else {
        await this.push
          .sendToUser(device.user_id, "safety_alerts", {
            title: `${nickname} back on route`,
            body: `Position is within ${OFF_ROUTE_THRESHOLD_NM} nm of the planned route again.`,
            url: "/account/devices",
            tag: `off-route-${device.id}`,
          })
          .catch(() => undefined);
      }
    }

    this.logger.info(
      {
        deviceId: device.id,
        transition: `${prev ?? "init"}->${next}`,
        distanceNm,
        lat: position.lat,
        lon: position.lon,
      },
      "Sat-comm deviation transition",
    );
    return prev === "off" && next === "on"
      ? "off->on"
      : prev !== "off" && next === "off"
        ? "on->off"
        : null;
  }
}
