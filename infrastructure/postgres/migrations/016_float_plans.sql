-- ============================================================================
-- Float Plans (S1) — emergency contact registry + per-send audit trail
--
-- A float plan is the formal pre-departure document a mariner emails to family
-- or co-skippers describing the vessel, the planned passage, and what to do
-- if the vessel is overdue. Helmwise DOES NOT auto-alert SAR — the recipient
-- is responsible for that escalation. The PDF and email body must make this
-- contract explicit; these tables store the registry and the audit trail.
--
-- Two tables:
--   float_plan_contacts  — the user's roster of up-to-five emergency contacts.
--                          5-row cap is enforced DB-side via trigger so a
--                          buggy frontend cannot blow it out. Email format
--                          validated with a CHECK so we don't waste a Resend
--                          API call on `notanemail`.
--   float_plans          — one row per *send*. Re-sending creates a new row;
--                          rows are immutable after insert (no UPDATE / DELETE
--                          policy) so the safety audit trail is preserved.
--                          `snapshot` is a JSONB freeze of the passage data at
--                          send time so a regenerated PDF matches what the
--                          contact actually received.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- float_plan_contacts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.float_plan_contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  relationship        TEXT,
  notify_on_overdue   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT float_plan_contacts_email_format
    CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT float_plan_contacts_name_length
    CHECK (char_length(name) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS float_plan_contacts_user_id_idx
  ON public.float_plan_contacts (user_id);

-- 5-contact cap enforced DB-side. Captain + spouse + co-skipper + harbour
-- authority + relative is plenty; if a future tier needs more, lift this in a
-- follow-up migration rather than relaxing it silently.
CREATE OR REPLACE FUNCTION public.enforce_float_plan_contact_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.float_plan_contacts WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 emergency contacts per user'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_float_plan_contact_limit_trigger ON public.float_plan_contacts;
CREATE TRIGGER enforce_float_plan_contact_limit_trigger
  BEFORE INSERT ON public.float_plan_contacts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_float_plan_contact_limit();

ALTER TABLE public.float_plan_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS float_plan_contacts_self_read   ON public.float_plan_contacts;
DROP POLICY IF EXISTS float_plan_contacts_self_insert ON public.float_plan_contacts;
DROP POLICY IF EXISTS float_plan_contacts_self_update ON public.float_plan_contacts;
DROP POLICY IF EXISTS float_plan_contacts_self_delete ON public.float_plan_contacts;

CREATE POLICY float_plan_contacts_self_read   ON public.float_plan_contacts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY float_plan_contacts_self_insert ON public.float_plan_contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY float_plan_contacts_self_update ON public.float_plan_contacts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY float_plan_contacts_self_delete ON public.float_plan_contacts
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.float_plan_contacts IS
  'Emergency contacts for float plans (max 5 per user). RLS: owner-only.';

-- ----------------------------------------------------------------------------
-- float_plans (audit trail — append-only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.float_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- passage_id is a Redis key id (uuidv4 string) — see SimpleOrchestrator's
  -- passages:user:{userId}:{passageId} pattern. TEXT keeps this table
  -- decoupled from whatever future storage migration the passages live in.
  passage_id        TEXT NOT NULL,
  vessel_id         UUID,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at           TIMESTAMPTZ,
  recipients        JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivery_status   JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot          JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS float_plans_user_id_idx
  ON public.float_plans (user_id);
CREATE INDEX IF NOT EXISTS float_plans_passage_id_idx
  ON public.float_plans (passage_id);
CREATE INDEX IF NOT EXISTS float_plans_generated_at_idx
  ON public.float_plans (generated_at DESC);

ALTER TABLE public.float_plans ENABLE ROW LEVEL SECURITY;

-- Read + insert only. Float plans are an audit record — once a contact has
-- received the email, the platform must not be able to silently retract or
-- modify what was sent. To "update" the plan a user sends again, producing a
-- new row.
DROP POLICY IF EXISTS float_plans_self_read   ON public.float_plans;
DROP POLICY IF EXISTS float_plans_self_insert ON public.float_plans;

CREATE POLICY float_plans_self_read   ON public.float_plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY float_plans_self_insert ON public.float_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.float_plans IS
  'Append-only audit trail of float plans sent. RLS: owner read/insert only (no update/delete).';
