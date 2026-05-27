-- ============================================================================
-- Crew certifications (F1) — Pro-tier per-crew cert expiry tracking
--
-- Two subject modes (CHECK enforces one):
--   - crew_user_id — an invited fleet member who has a Helmwise account
--   - crew_name    — free-text name for non-user crew (one-off charters,
--                    weekend guests, contract crew without accounts)
--
-- The planner can pass a list of cert IDs (or fleet user IDs / crew names)
-- as "crew on board"; the orchestrator looks up expired certs for those
-- subjects and appends warnings to plan.safety.warnings. **No cert is
-- blocking** — all expiries surface as advisory warnings, never gate the
-- plan from running. This matches the broader Helmwise safety doctrine:
-- decision support, not gatekeeping.
--
-- Document hosting: link only (document_url to user's own Drive/Dropbox).
-- Helmwise does NOT host the PDFs. Surfaced in the UI.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crew_certifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Subject (one of):
  crew_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  crew_name           TEXT,
  -- Cert metadata:
  cert_type           TEXT NOT NULL,
  cert_label          TEXT,
  issued_date         DATE,
  expiry_date         DATE NOT NULL,
  issuing_authority   TEXT,
  document_url        TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT crew_certifications_subject_required
    CHECK (crew_user_id IS NOT NULL OR crew_name IS NOT NULL),
  CONSTRAINT crew_certifications_issued_before_expiry
    CHECK (issued_date IS NULL OR issued_date <= expiry_date),
  CONSTRAINT crew_certifications_name_length
    CHECK (crew_name IS NULL OR char_length(crew_name) BETWEEN 1 AND 100),
  CONSTRAINT crew_certifications_label_length
    CHECK (cert_label IS NULL OR char_length(cert_label) <= 200),
  CONSTRAINT crew_certifications_url_length
    CHECK (document_url IS NULL OR char_length(document_url) <= 2000),
  CONSTRAINT crew_certifications_type_known
    CHECK (cert_type IN (
      'stcw_bst',
      'stcw_advanced',
      'uscg_oupv',
      'uscg_master',
      'medical_eng1',
      'medical_cg719k',
      'first_aid',
      'gmdss_rro',
      'gmdss_goc',
      'passport',
      'visa',
      'yachtmaster',
      'icc',
      'powerboat_l2',
      'other'
    ))
);

CREATE INDEX IF NOT EXISTS crew_certifications_user_id_idx
  ON public.crew_certifications (user_id);
CREATE INDEX IF NOT EXISTS crew_certifications_crew_user_idx
  ON public.crew_certifications (crew_user_id)
  WHERE crew_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crew_certifications_expiry_idx
  ON public.crew_certifications (expiry_date);

ALTER TABLE public.crew_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crew_certifications_self_read   ON public.crew_certifications;
DROP POLICY IF EXISTS crew_certifications_self_insert ON public.crew_certifications;
DROP POLICY IF EXISTS crew_certifications_self_update ON public.crew_certifications;
DROP POLICY IF EXISTS crew_certifications_self_delete ON public.crew_certifications;

CREATE POLICY crew_certifications_self_read   ON public.crew_certifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY crew_certifications_self_insert ON public.crew_certifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY crew_certifications_self_update ON public.crew_certifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY crew_certifications_self_delete ON public.crew_certifications
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.crew_certifications IS
  'Crew certification expiry tracking (F1). RLS: owner-only. Documents are linked, never hosted.';
