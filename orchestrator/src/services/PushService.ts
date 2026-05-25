import webpush from "web-push";
import type { Pool } from "pg";
import type { Logger } from "pino";

export const PUSH_TOPICS = [
  "safety_alerts",
  "weather_updates",
  "passage_reminders",
  "marketing",
] as const;
export type PushTopic = (typeof PUSH_TOPICS)[number];

// safety_alerts is non-optional — the UI cannot let a user turn it off because
// off-route / severe-weather / sat-comm SOS messages are life-safety. We still
// store it in the array (rather than treating it as implicit) so the SELECT
// query stays uniform: `WHERE $1 = ANY(topics)`.
export const ALWAYS_ON_TOPICS: PushTopic[] = ["safety_alerts"];

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export class PushService {
  private readonly logger: Logger;
  private readonly pool: Pool;
  private readonly enabled: boolean;

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger.child({ service: "push" });

    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:ops@helmwise.co";

    if (pub && priv) {
      webpush.setVapidDetails(subject, pub, priv);
      this.enabled = true;
      this.logger.info("Web Push configured");
    } else {
      this.enabled = false;
      this.logger.warn(
        "VAPID keys not set — push notifications disabled (subscribe endpoints will 503)",
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async upsertSubscription(
    userId: string,
    sub: PushSubscriptionInput,
    topics: PushTopic[],
    userAgent: string | undefined,
  ): Promise<void> {
    const sanitized = this.sanitizeTopics(topics);
    await this.pool.query(
      `INSERT INTO push_subscriptions
         (user_id, endpoint, p256dh_key, auth_key, topics, user_agent, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             p256dh_key = EXCLUDED.p256dh_key,
             auth_key = EXCLUDED.auth_key,
             topics = EXCLUDED.topics,
             user_agent = EXCLUDED.user_agent,
             last_used_at = NOW()`,
      [
        userId,
        sub.endpoint,
        sub.keys.p256dh,
        sub.keys.auth,
        sanitized,
        userAgent ?? null,
      ],
    );
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listSubscriptions(userId: string): Promise<
    Array<{
      endpoint: string;
      topics: PushTopic[];
      user_agent: string | null;
      created_at: string;
      last_used_at: string;
    }>
  > {
    const result = await this.pool.query(
      `SELECT endpoint, topics, user_agent, created_at, last_used_at
         FROM push_subscriptions
         WHERE user_id = $1
         ORDER BY last_used_at DESC`,
      [userId],
    );
    return result.rows;
  }

  // Updates the topic preferences across every subscription the user owns. UI
  // exposes a single set of toggles even though backing rows are per-device:
  // few users want one device on different topics than another, and the data
  // model can specialise later if that turns out to be wrong.
  async updateUserTopics(userId: string, topics: PushTopic[]): Promise<number> {
    const sanitized = this.sanitizeTopics(topics);
    const result = await this.pool.query(
      `UPDATE push_subscriptions SET topics = $1 WHERE user_id = $2`,
      [sanitized, userId],
    );
    return result.rowCount ?? 0;
  }

  // Fan out a payload to every subscription belonging to `userId` whose topics
  // include `topic`. Dead endpoints (404 / 410 from the push service — the
  // browser uninstalled or revoked the subscription) are pruned automatically;
  // other errors are logged but do not throw so a single bad endpoint does not
  // poison a fleet-wide broadcast.
  async sendToUser(
    userId: string,
    topic: PushTopic,
    payload: PushPayload,
  ): Promise<{ sent: number; pruned: number; failed: number }> {
    if (!this.enabled) {
      this.logger.warn({ userId, topic }, "Push send skipped — disabled");
      return { sent: 0, pruned: 0, failed: 0 };
    }

    const result = await this.pool.query(
      `SELECT endpoint, p256dh_key, auth_key
         FROM push_subscriptions
         WHERE user_id = $1 AND $2 = ANY(topics)`,
      [userId, topic],
    );

    const subs = result.rows;
    if (subs.length === 0) return { sent: 0, pruned: 0, failed: 0 };

    const body = JSON.stringify({ ...payload, topic });
    let sent = 0;
    let pruned = 0;
    let failed = 0;

    await Promise.all(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh_key, auth: row.auth_key },
            },
            body,
            { TTL: 60 * 60 * 12 }, // 12h: weather/safety alerts go stale fast
          );
          sent++;
          // last_used_at is best-effort — losing this on a failed UPDATE is fine.
          this.pool
            .query(
              `UPDATE push_subscriptions SET last_used_at = NOW() WHERE endpoint = $1`,
              [row.endpoint],
            )
            .catch(() => {});
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // Subscription is gone — prune so we stop hitting it.
            await this.pool.query(
              `DELETE FROM push_subscriptions WHERE endpoint = $1`,
              [row.endpoint],
            );
            pruned++;
          } else {
            failed++;
            this.logger.error(
              { err, endpoint: row.endpoint, status, topic },
              "Push send failed",
            );
          }
        }
      }),
    );

    this.logger.info({ userId, topic, sent, pruned, failed }, "Push fanout");
    return { sent, pruned, failed };
  }

  private sanitizeTopics(topics: PushTopic[]): PushTopic[] {
    const valid = new Set<PushTopic>(
      topics.filter((t): t is PushTopic =>
        (PUSH_TOPICS as readonly string[]).includes(t),
      ),
    );
    for (const required of ALWAYS_ON_TOPICS) valid.add(required);
    return Array.from(valid);
  }
}
