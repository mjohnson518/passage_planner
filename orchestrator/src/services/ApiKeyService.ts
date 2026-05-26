import * as crypto from "crypto";
import type { Pool } from "pg";
import type Redis from "ioredis";
import type { Logger } from "pino";

// ============================================================================
// ApiKeyService (F2) — Pro-tier API key generation, lookup, and rate limits
//
// Wire format: `hwk_<prefix>_<secret>` where prefix is 8 chars (visible) and
// secret is 32 bytes base64url-encoded (~43 chars). The full key is hashed
// with HMAC-SHA256 keyed by API_KEY_SECRET and stored as hex. The raw key
// is returned ONCE at creation — lost keys require regeneration.
//
// Lookup at request time (handled by AuthMiddleware) is a single indexed
// query on key_hash. No caching: revocation must be instant on a Pro
// security feature.
// ============================================================================

export const KEY_PREFIX = "hwk_";
export const KEY_PREFIX_VISIBLE_LENGTH = 8; // "hwk_" + 4 chars

export type ApiScope = "read" | "write";
export const VALID_SCOPES: readonly ApiScope[] = ["read", "write"];
export const DEFAULT_RATE_LIMIT_PER_DAY = 1000;

export interface ApiKeyRow {
  id: string;
  user_id: string;
  key_prefix: string;
  name: string;
  scopes: ApiScope[];
  rate_limit_per_day: number;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreateKeyResult {
  /** The full raw key — shown to the user ONCE. Never stored, never logged. */
  rawKey: string;
  row: ApiKeyRow;
}

export class ApiKeyService {
  private readonly pool: Pool;
  private readonly redis: Redis | null;
  private readonly hmacSecret: string;
  private readonly logger: Logger;

  constructor(pool: Pool, redis: Redis | null, logger: Logger) {
    this.pool = pool;
    this.redis = redis;
    this.logger = logger.child({ service: "api-keys" });
    // Match the AuthMiddleware fallback: API_KEY_SECRET preferred, else
    // JWT_SECRET. Verified upstream at startup so this is non-null in
    // practice; the OR keeps the type checker happy.
    this.hmacSecret =
      process.env.API_KEY_SECRET || process.env.JWT_SECRET || "";
    if (!this.hmacSecret) {
      this.logger.warn(
        "Neither API_KEY_SECRET nor JWT_SECRET is set — API keys will not function.",
      );
    }
  }

  /**
   * Generate a new API key for `userId`. Returns the raw key (shown once)
   * and the stored row. Throws when the 10-key cap is hit (DB trigger).
   */
  async createKey(args: {
    userId: string;
    name: string;
    scopes?: ApiScope[];
    rateLimitPerDay?: number;
    expiresAt?: Date | null;
  }): Promise<CreateKeyResult> {
    const scopes = args.scopes ?? ["read"];
    const sanitizedScopes = scopes.filter((s): s is ApiScope =>
      VALID_SCOPES.includes(s),
    );
    if (sanitizedScopes.length === 0) {
      throw new Error("At least one valid scope (read|write) is required.");
    }
    const rateLimit = args.rateLimitPerDay ?? DEFAULT_RATE_LIMIT_PER_DAY;

    const { rawKey, prefix, hash } = this.generateKey();
    const result = await this.pool.query<ApiKeyRow>(
      `INSERT INTO api_keys
         (user_id, key_hash, key_prefix, name, scopes,
          rate_limit_per_day, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, key_prefix, name, scopes,
                 rate_limit_per_day, expires_at, last_used_at,
                 revoked_at, created_at`,
      [
        args.userId,
        hash,
        prefix,
        args.name,
        sanitizedScopes,
        rateLimit,
        args.expiresAt ?? null,
      ],
    );
    this.logger.info(
      {
        userId: args.userId,
        keyId: result.rows[0].id,
        keyPrefix: prefix,
        scopes: sanitizedScopes,
        rateLimit,
      },
      "API key created",
    );
    return { rawKey, row: result.rows[0] };
  }

  async listKeys(userId: string): Promise<ApiKeyRow[]> {
    const result = await this.pool.query<ApiKeyRow>(
      `SELECT id, user_id, key_prefix, name, scopes,
              rate_limit_per_day, expires_at, last_used_at,
              revoked_at, created_at
         FROM api_keys
         WHERE user_id = $1
         ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  /**
   * Soft-revoke a key. Sets revoked_at; subsequent auth lookups should
   * reject revoked keys (AuthMiddleware verifyApiKey filter is added in F2).
   */
  async revokeKey(userId: string, keyId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE api_keys
         SET revoked_at = NOW()
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [keyId, userId],
    );
    const revoked = (result.rowCount ?? 0) > 0;
    if (revoked) {
      this.logger.info({ userId, keyId }, "API key revoked");
    }
    return revoked;
  }

  /**
   * Compute HMAC-SHA256 of a raw key for lookup. Used by the AuthMiddleware
   * — exposed here so the same function generates and verifies hashes.
   */
  hashForStorage(rawKey: string): string {
    return crypto
      .createHmac("sha256", this.hmacSecret)
      .update(rawKey)
      .digest("hex");
  }

  /**
   * Per-key rate limit check, Redis-backed daily bucket. Returns true when
   * the key is within budget (and increments the bucket as a side effect);
   * returns false when over budget so the caller can 429.
   *
   * No-op (returns true) when Redis is unavailable — better to over-serve
   * than to falsely 429 every Pro request when the cache layer is down.
   */
  async checkPerKeyRateLimit(
    keyId: string,
    rateLimitPerDay: number,
  ): Promise<boolean> {
    if (!this.redis) return true;
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
    const bucket = `ratelimit:apikey:${keyId}:${day}`;
    try {
      const count = await this.redis.incr(bucket);
      if (count === 1) {
        // First hit of the day — set TTL so the bucket expires after 26h
        // (small buffer past midnight to absorb clock skew).
        await this.redis.expire(bucket, 26 * 60 * 60);
      }
      return count <= rateLimitPerDay;
    } catch (err) {
      this.logger.warn(
        { err, keyId },
        "Per-key rate-limit check failed; allowing",
      );
      return true;
    }
  }

  // --------------------------------------------------------------------------
  // private
  // --------------------------------------------------------------------------

  private generateKey(): { rawKey: string; prefix: string; hash: string } {
    // 32 bytes → ~43 base64url chars. Enough entropy that brute force is
    // not a realistic threat model.
    const secret = crypto.randomBytes(32).toString("base64url");
    // Prefix is constant "hwk_" + 4 random hex chars for visual identification
    // in listings. NOT a secret — included in DB.
    const prefixSuffix = crypto.randomBytes(2).toString("hex");
    const prefix = `${KEY_PREFIX}${prefixSuffix}`;
    const rawKey = `${prefix}_${secret}`;
    const hash = this.hashForStorage(rawKey);
    return { rawKey, prefix, hash };
  }
}
