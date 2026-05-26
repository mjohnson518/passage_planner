-- ============================================================================
-- Vessel polars (V1) — per-vessel speed-vs-wind tables for polar-aware routing
--
-- A polar diagram is the vessel's predicted speed for every combination of
-- TWS (true wind speed) and TWA (true wind angle off the bow). It's what
-- the isochrone routing algorithm consumes to pick the fastest heading at
-- every step. Without a polar, routing falls back to a generic
-- percentage-of-max-speed table that's right on average but wrong for any
-- specific boat.
--
-- A user can store multiple named polars per vessel (e.g. "Light air",
-- "Heavy weather") and mark exactly one as active. The active polar is
-- what the planner uses when `usePolars: true` is passed.
--
-- polar_data is JSONB in the canonical shape produced by PolarService:
--   { tws: number[], twa: number[], speeds: number[][] }
-- where speeds[twa_idx][tws_idx] is the predicted boat speed in knots.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vessel_polars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vessel_id       UUID NOT NULL REFERENCES public.user_vessels(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- "upload" — user-uploaded CSV; "starter" — bundled defaults; "edited" —
  -- user-edited starter or upload. Drives provenance display in the UI.
  source          TEXT NOT NULL DEFAULT 'upload',
  polar_data      JSONB NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  max_wind_kt     NUMERIC,
  max_wave_m      NUMERIC,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT vessel_polars_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT vessel_polars_source_check
    CHECK (source IN ('upload', 'starter', 'edited')),
  CONSTRAINT vessel_polars_max_wind_range
    CHECK (max_wind_kt IS NULL OR (max_wind_kt > 0 AND max_wind_kt <= 100)),
  CONSTRAINT vessel_polars_max_wave_range
    CHECK (max_wave_m IS NULL OR (max_wave_m > 0 AND max_wave_m <= 30)),
  CONSTRAINT vessel_polars_unique_name UNIQUE (vessel_id, name)
);

CREATE INDEX IF NOT EXISTS vessel_polars_vessel_idx
  ON public.vessel_polars (vessel_id);
CREATE INDEX IF NOT EXISTS vessel_polars_user_idx
  ON public.vessel_polars (user_id);

-- Partial unique index: at most one active polar per vessel. Enforces the
-- "exactly one active" invariant at the DB level — flipping is a two-step
-- update in the service: deactivate old, activate new.
CREATE UNIQUE INDEX IF NOT EXISTS vessel_polars_one_active_per_vessel
  ON public.vessel_polars (vessel_id) WHERE is_active = TRUE;

ALTER TABLE public.vessel_polars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vessel_polars_self_read   ON public.vessel_polars;
DROP POLICY IF EXISTS vessel_polars_self_insert ON public.vessel_polars;
DROP POLICY IF EXISTS vessel_polars_self_update ON public.vessel_polars;
DROP POLICY IF EXISTS vessel_polars_self_delete ON public.vessel_polars;

CREATE POLICY vessel_polars_self_read   ON public.vessel_polars
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY vessel_polars_self_insert ON public.vessel_polars
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY vessel_polars_self_update ON public.vessel_polars
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY vessel_polars_self_delete ON public.vessel_polars
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.vessel_polars IS
  'Per-vessel speed polars consumed by the isochrone router (V1). RLS: owner-only.';
