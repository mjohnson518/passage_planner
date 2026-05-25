-- ============================================================================
-- Sat-comm position reporting (S2) — devices + position history
--
-- A "device" is a satellite tracker the user owns: Garmin InReach, IridiumGo,
-- YB Tracker, or a generic Helmwise-format device for vendors we haven't
-- integrated with yet. Each device has a webhook secret used to verify
-- HMAC-SHA256 signatures on inbound position webhooks.
--
-- Position reports are append-only, time-series. They are the most sensitive
-- data Helmwise stores: real-time vessel position can attract piracy, theft,
-- or stalking. Hence:
--   - RLS on reads (owner-only via device FK)
--   - 90-day retention by application policy (purge job belongs to CronService)
--   - "Clear position data" action exposed in the device UI
--   - raw_payload kept for audit / debugging but redacted from any
--     non-owner-facing view
--
-- Vendor partner agreements may grow over time; the `vendor` column is TEXT
-- (not an enum) so new vendors can be added without a migration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sat_comm_devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor            TEXT NOT NULL,
  device_id         TEXT NOT NULL,
  nickname          TEXT,
  webhook_secret    TEXT NOT NULL,
  -- Tracks the device's last-known on/off-route state so we send one alert
  -- per excursion rather than one per position ping. NULL means we have not
  -- yet evaluated this device against an active passage.
  deviation_state   TEXT,
  last_report_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sat_comm_devices_vendor_check
    CHECK (vendor IN ('generic','garmin_inreach','iridiumgo','yb_tracking')),
  CONSTRAINT sat_comm_devices_deviation_check
    CHECK (deviation_state IS NULL OR deviation_state IN ('on','off')),
  CONSTRAINT sat_comm_devices_vendor_device_unique
    UNIQUE (vendor, device_id)
);

CREATE INDEX IF NOT EXISTS sat_comm_devices_user_id_idx
  ON public.sat_comm_devices (user_id);

ALTER TABLE public.sat_comm_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sat_comm_devices_self_read   ON public.sat_comm_devices;
DROP POLICY IF EXISTS sat_comm_devices_self_insert ON public.sat_comm_devices;
DROP POLICY IF EXISTS sat_comm_devices_self_update ON public.sat_comm_devices;
DROP POLICY IF EXISTS sat_comm_devices_self_delete ON public.sat_comm_devices;

CREATE POLICY sat_comm_devices_self_read   ON public.sat_comm_devices
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sat_comm_devices_self_insert ON public.sat_comm_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sat_comm_devices_self_update ON public.sat_comm_devices
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY sat_comm_devices_self_delete ON public.sat_comm_devices
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.sat_comm_devices IS
  'Satellite tracker registrations. webhook_secret used for HMAC verify. RLS: owner-only.';

-- ----------------------------------------------------------------------------
-- position_reports — time-series, append-only
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.position_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     UUID NOT NULL REFERENCES public.sat_comm_devices(id) ON DELETE CASCADE,
  reported_at   TIMESTAMPTZ NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat           DOUBLE PRECISION NOT NULL,
  lon           DOUBLE PRECISION NOT NULL,
  speed_kn      DOUBLE PRECISION,
  course_deg    DOUBLE PRECISION,
  battery_pct   INTEGER,
  message_text  TEXT,
  raw_payload   JSONB,
  vendor        TEXT NOT NULL,

  CONSTRAINT position_reports_lat_range CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT position_reports_lon_range CHECK (lon BETWEEN -180 AND 180),
  CONSTRAINT position_reports_speed_range
    CHECK (speed_kn IS NULL OR speed_kn BETWEEN 0 AND 200),
  CONSTRAINT position_reports_course_range
    CHECK (course_deg IS NULL OR course_deg BETWEEN 0 AND 360),
  CONSTRAINT position_reports_battery_range
    CHECK (battery_pct IS NULL OR battery_pct BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS position_reports_device_reported_idx
  ON public.position_reports (device_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS position_reports_received_idx
  ON public.position_reports (received_at);

ALTER TABLE public.position_reports ENABLE ROW LEVEL SECURITY;

-- Reads allowed only when the caller owns the device. Writes happen via the
-- service role in the webhook handler (which has already verified the HMAC).
DROP POLICY IF EXISTS position_reports_owner_read ON public.position_reports;

CREATE POLICY position_reports_owner_read ON public.position_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sat_comm_devices d
       WHERE d.id = position_reports.device_id
         AND d.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.position_reports IS
  'Append-only sat-comm position history. 90-day app-level retention. RLS: owner via device FK.';
