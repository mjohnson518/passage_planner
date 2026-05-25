import * as crypto from "crypto";
import type Redis from "ioredis";
import type { Logger } from "pino";

// ============================================================================
// Public share links (S4)
//
// Captain saves a passage → hits "Share" → gets `/p/<token>` URL they can text
// to family or crew. Recipient opens without an account; payload is heavily
// redacted before it leaves the server (no MMSI/EPIRB/InReach IDs, no owner
// email, no medical notes). Tokens expire — default 7 days, max 30 — and can
// be revoked or rotated by the owner at any time.
//
// Storage: two Redis keys per active share so a token → passage lookup is O(1)
// without scanning user-scoped keys.
//
//   share:token:{token}    →  { userId, passageId, expiresAt } with TTL
//   passages:user:{u}:{p}  →  existing record + share { token, expiresAt, … }
//
// Why a reverse index instead of scanning: the public read path runs on a
// public URL with no auth; we want it bounded and predictable, not
// proportional to the user's passage count.
// ============================================================================

export const SHARE_DEFAULT_EXPIRY_DAYS = 7;
export const SHARE_MAX_EXPIRY_DAYS = 30;

export interface ShareMetadata {
  token: string;
  expiresAt: string;
  createdAt: string;
  viewCount: number;
  lastViewedAt: string | null;
}

export interface ShareTokenRecord {
  userId: string;
  passageId: string;
  expiresAt: string;
}

export interface PublicSharePayload {
  vessel: {
    name?: string;
    type?: string;
    length_ft?: number;
    color?: string;
  };
  passage: {
    name?: string;
    departure_port?: string;
    destination_port?: string;
    departure_time?: string;
    eta?: string;
    distance_nm?: number;
  };
  route: {
    waypoints: Array<{
      name?: string;
      lat?: number;
      lon?: number;
      eta?: string;
    }>;
  };
  weather_summary?: string;
  crew_count?: number;
  // First name only; never email, never last name.
  shared_by?: string;
  generated_at?: string;
}

export class ShareService {
  private readonly redis: Redis;
  private readonly logger: Logger;

  constructor(redis: Redis, logger: Logger) {
    this.redis = redis;
    this.logger = logger.child({ service: "share" });
  }

  passageKey(userId: string, passageId: string): string {
    return `passages:user:${userId}:${passageId}`;
  }

  tokenKey(token: string): string {
    return `share:token:${token}`;
  }

  // Cryptographically secure URL-safe token. 24 bytes → 32 base64url chars,
  // ~10^43 keyspace — brute force is not a realistic attack here, but log a
  // 410 on stale/expired so the response is the same for guessed and revoked
  // tokens (no info leak about which tokens have ever existed).
  generateToken(): string {
    return crypto.randomBytes(24).toString("base64url");
  }

  // Create a new share link (or rotate the existing one, atomically: the old
  // reverse-index key is deleted before the new one is created so a stale
  // token can never coexist with its replacement).
  async createOrRotate(
    userId: string,
    passageId: string,
    expiresInDays: number,
  ): Promise<ShareMetadata> {
    if (
      expiresInDays < 1 ||
      expiresInDays > SHARE_MAX_EXPIRY_DAYS ||
      !Number.isFinite(expiresInDays)
    ) {
      throw new Error(`expiresInDays must be 1..${SHARE_MAX_EXPIRY_DAYS}`);
    }

    const passageJson = await this.redis.get(
      this.passageKey(userId, passageId),
    );
    if (!passageJson) {
      throw new Error("PASSAGE_NOT_FOUND");
    }
    const passage = JSON.parse(passageJson) as {
      share?: ShareMetadata;
      [k: string]: unknown;
    };

    // Revoke previous token's reverse index first so the old URL stops working
    // immediately.
    if (passage.share?.token) {
      await this.redis.del(this.tokenKey(passage.share.token));
    }

    const token = this.generateToken();
    const now = Date.now();
    const expiresAtMs = now + expiresInDays * 24 * 60 * 60 * 1000;
    const expiresAtIso = new Date(expiresAtMs).toISOString();

    const meta: ShareMetadata = {
      token,
      expiresAt: expiresAtIso,
      createdAt: new Date(now).toISOString(),
      viewCount: 0,
      lastViewedAt: null,
    };

    // Reverse index with TTL — Redis evicts it automatically at expiry, so the
    // public read endpoint never has to compare timestamps in the hot path
    // (defence in depth: read also checks).
    const ttlSeconds = Math.ceil((expiresAtMs - now) / 1000);
    const record: ShareTokenRecord = {
      userId,
      passageId,
      expiresAt: expiresAtIso,
    };
    await this.redis.set(
      this.tokenKey(token),
      JSON.stringify(record),
      "EX",
      ttlSeconds,
    );

    // Persist share metadata back onto the passage record without disturbing
    // any other fields.
    passage.share = meta;
    await this.redis.set(
      this.passageKey(userId, passageId),
      JSON.stringify(passage),
      "KEEPTTL",
    );

    this.logger.info(
      { userId, passageId, expiresAt: expiresAtIso },
      "Share link created",
    );
    return meta;
  }

  async getStatus(
    userId: string,
    passageId: string,
  ): Promise<ShareMetadata | null> {
    const passageJson = await this.redis.get(
      this.passageKey(userId, passageId),
    );
    if (!passageJson) return null;
    const passage = JSON.parse(passageJson) as { share?: ShareMetadata };
    if (!passage.share) return null;
    if (new Date(passage.share.expiresAt).getTime() <= Date.now()) {
      // Expired in-place — surface that the share is gone rather than returning
      // a misleading "still active".
      return null;
    }
    return passage.share;
  }

  async revoke(userId: string, passageId: string): Promise<boolean> {
    const passageJson = await this.redis.get(
      this.passageKey(userId, passageId),
    );
    if (!passageJson) return false;
    const passage = JSON.parse(passageJson) as {
      share?: ShareMetadata;
      [k: string]: unknown;
    };
    if (!passage.share) return false;

    await this.redis.del(this.tokenKey(passage.share.token));
    delete passage.share;
    await this.redis.set(
      this.passageKey(userId, passageId),
      JSON.stringify(passage),
      "KEEPTTL",
    );
    this.logger.info({ userId, passageId }, "Share link revoked");
    return true;
  }

  // Public read path — does NOT take a userId. Returns null on missing,
  // expired, or revoked tokens (caller decides 404 vs 410). Increments the
  // view counter on the underlying passage as a best-effort write.
  async lookupByToken(token: string): Promise<{
    payload: PublicSharePayload;
    senderFirstName: string | null;
  } | null> {
    const tokenJson = await this.redis.get(this.tokenKey(token));
    if (!tokenJson) return null;
    const record = JSON.parse(tokenJson) as ShareTokenRecord;
    if (new Date(record.expiresAt).getTime() <= Date.now()) return null;

    const passageJson = await this.redis.get(
      this.passageKey(record.userId, record.passageId),
    );
    if (!passageJson) return null;

    const passage = JSON.parse(passageJson) as {
      name?: string;
      plan?: unknown;
      share?: ShareMetadata;
    };
    if (!passage.share || passage.share.token !== token) {
      // Token reverse index points to a passage whose share block has been
      // rotated or removed. Treat as 404.
      return null;
    }

    // Bump view counter — fire-and-forget; failure here must not block the
    // read response.
    passage.share.viewCount = (passage.share.viewCount ?? 0) + 1;
    passage.share.lastViewedAt = new Date().toISOString();
    this.redis
      .set(
        this.passageKey(record.userId, record.passageId),
        JSON.stringify(passage),
        "KEEPTTL",
      )
      .catch((err: unknown) =>
        this.logger.warn({ err, token }, "Share view counter update failed"),
      );

    const payload = this.redact(passage);
    return payload;
  }

  // Strip safety/PII fields before returning to a public caller. Any field
  // added to the passage record in the future is omitted by default — the
  // allow-list shape below is the contract for what leaves the server.
  private redact(passage: { name?: string; plan?: unknown }): {
    payload: PublicSharePayload;
    senderFirstName: string | null;
  } {
    const plan = (passage.plan ?? {}) as Record<string, any>;
    const route = (plan.route ?? {}) as Record<string, any>;
    const summary = (plan.summary ?? {}) as Record<string, any>;
    const ports = (plan.ports ?? {}) as Record<string, any>;
    const vesselSrc = (plan.vessel ?? plan.request?.vessel ?? {}) as Record<
      string,
      any
    >;

    const fmtTime = (t: unknown): string | undefined => {
      if (!t) return undefined;
      try {
        return new Date(t as string).toISOString();
      } catch {
        return undefined;
      }
    };

    const waypoints: PublicSharePayload["route"]["waypoints"] = Array.isArray(
      route.waypoints,
    )
      ? route.waypoints.slice(0, 50).map((wp: any) => ({
          name: wp.name ?? wp.label,
          lat: typeof wp.lat === "number" ? wp.lat : wp.latitude,
          lon: typeof wp.lon === "number" ? wp.lon : wp.longitude,
          eta: fmtTime(wp.eta),
        }))
      : [];

    const warnings: string[] = Array.isArray(summary.warnings)
      ? summary.warnings.slice(0, 4)
      : [];

    // Sender attribution — first name only. We pull the planner's stored
    // "request.sender_name" if present, falling back to nothing. Never the
    // email, never the last name (heuristic: split on whitespace).
    const rawSender = (plan.request?.sender_name ??
      plan.sender_name ??
      null) as string | null;
    const senderFirstName = rawSender
      ? String(rawSender).trim().split(/\s+/)[0] || null
      : null;

    const payload: PublicSharePayload = {
      vessel: {
        // Identifiers (registration, MMSI, EPIRB, InReach) are intentionally
        // omitted — exposing them enables maritime impersonation and beacon
        // fraud, neither of which is acceptable on a public URL.
        name: vesselSrc.name,
        type: vesselSrc.type,
        length_ft: vesselSrc.length_ft ?? vesselSrc.lengthFt,
        color: vesselSrc.color,
      },
      passage: {
        name: passage.name,
        departure_port:
          ports.departure?.nearest?.name ??
          plan.request?.departure?.port ??
          plan.request?.departure?.name,
        destination_port:
          ports.arrival?.nearest?.name ??
          plan.request?.destination?.port ??
          plan.request?.destination?.name,
        departure_time: fmtTime(
          summary.departureTime ?? plan.request?.departure?.time,
        ),
        eta: fmtTime(summary.estimatedArrival),
        distance_nm:
          typeof route.totalDistance === "number"
            ? route.totalDistance
            : typeof summary.totalDistance === "number"
              ? summary.totalDistance
              : undefined,
      },
      route: { waypoints },
      weather_summary: warnings.length > 0 ? warnings.join("\n") : undefined,
      crew_count: Array.isArray(plan.crew) ? plan.crew.length : undefined,
      shared_by: senderFirstName ?? undefined,
      generated_at: new Date().toISOString(),
    };

    return { payload, senderFirstName };
  }
}
