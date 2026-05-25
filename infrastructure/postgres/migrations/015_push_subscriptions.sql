-- ============================================================================
-- Push Subscriptions — Web Push (W3C) endpoint registry per user device
--
-- Each row is one (user, device) pair: a browser/PWA install has a unique
-- endpoint URL from the push service (FCM / APNs-relay / Mozilla) plus the
-- p256dh + auth keys needed to encrypt payloads. A single user typically has
-- several rows (phone + laptop + tablet).
--
-- The `topics` column gates which categories of notifications fan out to this
-- subscription:
--   safety_alerts     — life-safety: off-route, severe weather, sat-comm SOS.
--                       Always-on; UI does not let the user disable this.
--   weather_updates   — re-plan / drift alerts when a saved passage's forecast
--                       degrades (Phase R4).
--   passage_reminders — float plan confirmations, "you depart in 2 h", etc.
--   marketing         — product news. Default OFF; opt-in only.
--
-- Endpoints are globally unique (a single browser device has one). Re-subscribe
-- from the same device → UPDATE existing row (preserves topic preferences and
-- created_at), do not insert a duplicate.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh_key   TEXT NOT NULL,
  auth_key     TEXT NOT NULL,
  topics       TEXT[] NOT NULL DEFAULT ARRAY['safety_alerts','weather_updates','passage_reminders']::TEXT[],
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

-- GIN on topics so the sender can SELECT WHERE 'safety_alerts' = ANY(topics)
-- efficiently when fanning out an alert.
CREATE INDEX IF NOT EXISTS push_subscriptions_topics_idx
  ON public.push_subscriptions USING GIN (topics);

-- ----------------------------------------------------------------------------
-- RLS — users see only their own subscriptions. Service role (the orchestrator)
-- bypasses RLS to send to anyone, but profile UIs reading via the JWT see only
-- the caller's rows.
-- ----------------------------------------------------------------------------
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_self_read   ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_self_insert ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_self_update ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_self_delete ON public.push_subscriptions;

CREATE POLICY push_subscriptions_self_read   ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY push_subscriptions_self_insert ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_self_update ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY push_subscriptions_self_delete ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push subscriptions (one row per browser/device). Topic-filtered fanout. RLS: owner-only.';
