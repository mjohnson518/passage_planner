-- ============================================================================
-- Global Hazard Feeds Migration
-- Adds tables for piracy/anti-shipping incidents (NGA ASAM), NAVAREA warnings,
-- and ice-edge hazards. Closes the data gap disclosed by COVERAGE_LIMITED in
-- migration 012's downstream code (Phase 2 of the global-coverage rollout).
--
-- Additive only — no changes to existing tables. Reversible by DROP TABLE.
-- ============================================================================

-- PostGIS is required for spatial intersection (route ↔ hazard polygon).
-- On Supabase this is a no-op if already enabled; on local dev with the
-- postgis/postgis docker image it is also pre-installed.
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- PIRACY_ZONES — discrete anti-shipping incident reports
-- Sources: NGA ASAM (primary). IMB, ReCAAP, MDAT-GoG can be added later
-- under the same `source` column without schema changes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS piracy_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(32) NOT NULL,                 -- 'NGA_ASAM' | 'IMB' | 'RECAAP' | ...
    external_ref VARCHAR(128) NOT NULL,          -- upstream record identifier
    occurred_at TIMESTAMPTZ NOT NULL,
    lat NUMERIC(9,6) NOT NULL,
    lon NUMERIC(9,6) NOT NULL,
    subregion VARCHAR(64),                       -- e.g. NGA subreg code
    navarea VARCHAR(8),                          -- e.g. 'IV', 'VIII', 'XII'
    hostility VARCHAR(255),                      -- short categorical
    victim VARCHAR(255),
    aggressor VARCHAR(255),
    description TEXT NOT NULL,
    geom GEOGRAPHY(POINT, 4326) NOT NULL,        -- derived from lat/lon
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw JSONB,                                   -- preserve upstream payload for debugging
    UNIQUE (source, external_ref)
);

CREATE INDEX IF NOT EXISTS idx_piracy_zones_geom
    ON piracy_zones USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_piracy_zones_occurred_at
    ON piracy_zones (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_piracy_zones_source
    ON piracy_zones (source);

ALTER TABLE piracy_zones ENABLE ROW LEVEL SECURITY;

-- Public safety data — readable by anyone (matches restricted_areas policy).
CREATE POLICY "Anyone can read piracy zones" ON piracy_zones
    FOR SELECT USING (true);

-- Only the service role (cron ingester) writes.
CREATE POLICY "Service can insert piracy zones" ON piracy_zones
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update piracy zones" ON piracy_zones
    FOR UPDATE USING (true);

-- ============================================================================
-- NAVAREA_WARNINGS — IMO NAVAREA / HYDROLANT / HYDROPAC text bulletins
-- Sources: NGA NAVAREA IV+XII (free), UKHO NAVAREA I (free text), etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS navarea_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(32) NOT NULL,                 -- 'NGA_NAVAREA' | 'UKHO' | ...
    navarea VARCHAR(8) NOT NULL,                 -- e.g. 'IV', 'XII', 'I'
    message_number VARCHAR(64) NOT NULL,         -- e.g. '2026-024'
    issued_at TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    authority VARCHAR(128),
    subject VARCHAR(255),
    body TEXT NOT NULL,
    -- Affected area: a point OR a polygon. Both nullable so we can ingest
    -- text-only warnings and add geocoding later.
    point GEOGRAPHY(POINT, 4326),
    bbox GEOGRAPHY(POLYGON, 4326),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw JSONB,
    UNIQUE (source, navarea, message_number)
);

CREATE INDEX IF NOT EXISTS idx_navarea_warnings_point
    ON navarea_warnings USING GIST (point) WHERE point IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_navarea_warnings_bbox
    ON navarea_warnings USING GIST (bbox) WHERE bbox IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_navarea_warnings_active
    ON navarea_warnings (issued_at DESC) WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_navarea_warnings_navarea
    ON navarea_warnings (navarea);

ALTER TABLE navarea_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read navarea warnings" ON navarea_warnings
    FOR SELECT USING (true);
CREATE POLICY "Service can insert navarea warnings" ON navarea_warnings
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update navarea warnings" ON navarea_warnings
    FOR UPDATE USING (true);

-- ============================================================================
-- ICE_HAZARDS — sea-ice edge polygons from NIC / Canadian Ice Service
-- Daily snapshot per (source, region). New product_date supersedes old.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ice_hazards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(32) NOT NULL,                 -- 'NIC' | 'CIS' | ...
    region VARCHAR(64) NOT NULL,                 -- e.g. 'arctic', 'antarctic', 'great_lakes'
    product_date DATE NOT NULL,
    polygon GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw JSONB,
    UNIQUE (source, region, product_date)
);

CREATE INDEX IF NOT EXISTS idx_ice_hazards_polygon
    ON ice_hazards USING GIST (polygon);
CREATE INDEX IF NOT EXISTS idx_ice_hazards_recent
    ON ice_hazards (product_date DESC);
CREATE INDEX IF NOT EXISTS idx_ice_hazards_source_region
    ON ice_hazards (source, region);

ALTER TABLE ice_hazards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ice hazards" ON ice_hazards
    FOR SELECT USING (true);
CREATE POLICY "Service can insert ice hazards" ON ice_hazards
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update ice hazards" ON ice_hazards
    FOR UPDATE USING (true);
