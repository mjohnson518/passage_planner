-- ============================================================================
-- Vessel maintenance (V2) — user_vessels + vessel_maintenance
--
-- Maintenance items have TWO independent overdue triggers: time (every N
-- months, e.g. flares) and hours (every N engine hours, e.g. oil change).
-- Some items have both (engine oil: 100 h OR 12 months, whichever first);
-- the CHECK constraint enforces that at least one interval is set.
--
-- Hour-based intervals require a live hour meter. We can't talk to the
-- engine sensor over the wire, so the captain manually updates
-- current_engine_hours / current_watermaker_hours on the vessel record
-- (after each trip). Maintenance items reference the meter via
-- `hours_meter_source`.
--
-- This is deliberately separate from the existing fleet_vessels /
-- vessel_profiles tables — those schemas serve different purposes and are
-- not consistently used. user_vessels is the focused maintenance owner;
-- future cleanup can map this back to a single vessel concept.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_vessels (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  -- Live hour-meter readings. Captain updates these manually after each trip
  -- via PUT /api/vessels/:id/hours. Defaults to 0 so brand-new vessels start
  -- at zero hours.
  current_engine_hours        NUMERIC NOT NULL DEFAULT 0,
  current_watermaker_hours    NUMERIC NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_vessels_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT user_vessels_engine_hours_nonneg CHECK (current_engine_hours >= 0),
  CONSTRAINT user_vessels_watermaker_hours_nonneg CHECK (current_watermaker_hours >= 0)
);

CREATE INDEX IF NOT EXISTS user_vessels_user_id_idx
  ON public.user_vessels (user_id);

ALTER TABLE public.user_vessels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_vessels_self_read   ON public.user_vessels;
DROP POLICY IF EXISTS user_vessels_self_insert ON public.user_vessels;
DROP POLICY IF EXISTS user_vessels_self_update ON public.user_vessels;
DROP POLICY IF EXISTS user_vessels_self_delete ON public.user_vessels;

CREATE POLICY user_vessels_self_read   ON public.user_vessels
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_vessels_self_insert ON public.user_vessels
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_vessels_self_update ON public.user_vessels
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY user_vessels_self_delete ON public.user_vessels
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_vessels IS
  'Per-user vessel records owned by the maintenance feature (V2). RLS: owner-only.';

-- ----------------------------------------------------------------------------
-- vessel_maintenance — items with time + hours intervals
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vessel_maintenance (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vessel_id                 UUID NOT NULL REFERENCES public.user_vessels(id) ON DELETE CASCADE,
  item                      TEXT NOT NULL,
  category                  TEXT,
  interval_hours            NUMERIC,
  interval_days             INTEGER,
  hours_meter_source        TEXT,
  last_serviced_at          TIMESTAMPTZ,
  last_serviced_at_hours    NUMERIC,
  notes                     TEXT,
  -- Drives the weekly-dedup window in the MaintenanceMonitor cron job —
  -- once an overdue alert fires for this item we don't re-alert for 7 days
  -- even if the item remains overdue. Stamped on every notification.
  last_alerted_at           TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT vessel_maintenance_item_length
    CHECK (char_length(item) BETWEEN 1 AND 200),
  CONSTRAINT vessel_maintenance_category_check
    CHECK (
      category IS NULL OR
      category IN ('engine','watermaker','rigging','safety','sails','hull','electrical','other')
    ),
  CONSTRAINT vessel_maintenance_meter_check
    CHECK (
      hours_meter_source IS NULL OR
      hours_meter_source IN ('engine','watermaker')
    ),
  CONSTRAINT vessel_maintenance_interval_check
    CHECK (interval_hours IS NOT NULL OR interval_days IS NOT NULL),
  CONSTRAINT vessel_maintenance_intervals_positive
    CHECK (
      (interval_hours IS NULL OR interval_hours > 0) AND
      (interval_days IS NULL OR interval_days > 0)
    ),
  CONSTRAINT vessel_maintenance_meter_when_hours
    CHECK (interval_hours IS NULL OR hours_meter_source IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS vessel_maintenance_vessel_id_idx
  ON public.vessel_maintenance (vessel_id);
CREATE INDEX IF NOT EXISTS vessel_maintenance_user_id_idx
  ON public.vessel_maintenance (user_id);

ALTER TABLE public.vessel_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vessel_maintenance_self_read   ON public.vessel_maintenance;
DROP POLICY IF EXISTS vessel_maintenance_self_insert ON public.vessel_maintenance;
DROP POLICY IF EXISTS vessel_maintenance_self_update ON public.vessel_maintenance;
DROP POLICY IF EXISTS vessel_maintenance_self_delete ON public.vessel_maintenance;

CREATE POLICY vessel_maintenance_self_read   ON public.vessel_maintenance
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY vessel_maintenance_self_insert ON public.vessel_maintenance
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY vessel_maintenance_self_update ON public.vessel_maintenance
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY vessel_maintenance_self_delete ON public.vessel_maintenance
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.vessel_maintenance IS
  'Per-item maintenance schedule. Overdue when interval_days OR interval_hours trips. RLS: owner-only.';
