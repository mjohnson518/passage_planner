-- ============================================================================
-- Pricing Foundations Migration
-- Fixes subscription tier constraint + adds top-up/founding member columns
-- ============================================================================

-- Allow enterprise tier in subscriptions table (was sometimes excluded)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('free', 'premium', 'pro', 'enterprise'));

-- Top-up passage pack columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bonus_passages INTEGER DEFAULT 0;

-- Founding member tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_founding_member BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS founding_member_at TIMESTAMPTZ;

-- Internal whitelist (bypasses all quotas for testing/partners)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_whitelisted BOOLEAN DEFAULT FALSE;

-- Idempotent webhook processing table
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_stripe_id
  ON subscription_events (stripe_event_id);

-- RLS for subscription_events (admin only)
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view subscription events" ON subscription_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );
CREATE POLICY "Service can insert subscription events" ON subscription_events
  FOR INSERT WITH CHECK (true);
