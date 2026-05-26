-- ============================================================================
-- API keys (F2) — Pro-tier API key management with per-key rate limits
--
-- The existing AuthMiddleware (orchestrator/src/middleware/auth.ts:141-176)
-- already queries this table on every X-API-Key header — but the table
-- doesn't exist yet, so API-key auth silently fails today. This migration
-- creates it and adds F2 columns.
--
-- Wire format: `hwk_<prefix>_<secret>` where prefix is 8 chars (visible to
-- the user in the UI for identification) and secret is the rest. The
-- middleware HMAC-SHA256s the full string (with API_KEY_SECRET as the key)
-- and looks up by `key_hash`. The raw key is shown ONCE at creation; lost
-- keys require regeneration.
--
-- Stored hash:    HMAC-SHA256(rawKey, API_KEY_SECRET) hex-encoded (64 chars)
-- Display prefix: first 8 chars of rawKey, kept human-visible for listing
--
-- Soft delete via `revoked_at` preserves audit trail of which key made
-- which requests after revocation. Hard delete is never offered.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 64-char hex (HMAC-SHA256 output). UNIQUE so duplicate key generation
  -- collisions are caught at insert time (vanishingly unlikely but cheap
  -- to guard).
  key_hash             TEXT NOT NULL UNIQUE,
  -- Short visible prefix (e.g. "hwk_a1b2"). NOT a secret — it's what the
  -- user sees in the listing to identify a key without revealing it.
  key_prefix           TEXT NOT NULL,
  name                 TEXT NOT NULL,
  scopes               TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
  rate_limit_per_day   INTEGER NOT NULL DEFAULT 1000,
  expires_at           TIMESTAMPTZ,
  last_used_at         TIMESTAMPTZ,
  revoked_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT api_keys_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT api_keys_prefix_length CHECK (char_length(key_prefix) BETWEEN 4 AND 32),
  CONSTRAINT api_keys_rate_limit_range
    CHECK (rate_limit_per_day BETWEEN 1 AND 1000000),
  CONSTRAINT api_keys_scopes_valid
    CHECK (
      scopes <@ ARRAY['read', 'write']::TEXT[]
      AND array_length(scopes, 1) > 0
    )
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_active_idx
  ON public.api_keys (user_id) WHERE revoked_at IS NULL;

-- 10-keys-per-user cap (counted excluding revoked). Prevents abuse via
-- key enumeration attacks on the creation endpoint.
CREATE OR REPLACE FUNCTION public.enforce_api_key_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.api_keys
     WHERE user_id = NEW.user_id AND revoked_at IS NULL
  ) >= 10 THEN
    RAISE EXCEPTION 'Maximum 10 active API keys per user. Revoke unused keys first.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_api_key_limit_trigger ON public.api_keys;
CREATE TRIGGER enforce_api_key_limit_trigger
  BEFORE INSERT ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.enforce_api_key_limit();

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Read + insert + update (for revocation). No DELETE policy — keys are
-- soft-deleted via revoked_at to preserve the audit trail.
DROP POLICY IF EXISTS api_keys_self_read   ON public.api_keys;
DROP POLICY IF EXISTS api_keys_self_insert ON public.api_keys;
DROP POLICY IF EXISTS api_keys_self_update ON public.api_keys;

CREATE POLICY api_keys_self_read   ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY api_keys_self_insert ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY api_keys_self_update ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.api_keys IS
  'Pro-tier API keys. Stored hash only (HMAC-SHA256 with API_KEY_SECRET). RLS: owner-only.';
