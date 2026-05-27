-- ============================================================================
-- Anchorages + cruiser notes (D1) — community knowledge layer
--
-- Two tables on purpose:
--   anchorages       — one POI per location, structured aggregate fields
--                      (depth, holding, shelter direction). Author-only edits
--                      on the aggregate to prevent edit wars.
--   anchorage_notes  — append-mostly per-contributor reviews with own author,
--                      timestamp, ratings, and free-text body. Authors edit
--                      their own; others contribute new notes.
--
-- PostGIS geom column is GENERATED ALWAYS (always stays in sync with lat/lon)
-- and indexed via GIST so "anchorages within 50 km of me" stays fast as the
-- table grows. PostGIS is available per CLAUDE.md.
--
-- RLS posture is intentionally public-read / authenticated-write — the whole
-- point of the feature is shared knowledge. Author-only edit/delete is
-- enforced at the row level; admin-level moderation is via service role.
--
-- Honest scope cuts (deferred): photo uploads, reputation/voting, separate
-- hazards table, map-tile overlays, push alerts, scraping other databases.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- anchorages — one POI per location
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.anchorages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  lat                 DOUBLE PRECISION NOT NULL,
  lon                 DOUBLE PRECISION NOT NULL,
  country             TEXT,
  region              TEXT,
  -- Structured aggregate fields. Author-only-editable to prevent edit wars.
  -- Each note also carries its own contributor opinions for transparency.
  description         TEXT,
  approx_depth_m      NUMERIC,
  holding             TEXT,
  shelter_from        TEXT[],
  swing_room          TEXT,
  -- Derived aggregates, kept in sync via triggers on anchorage_notes.
  notes_count         INTEGER NOT NULL DEFAULT 0,
  last_note_at        TIMESTAMPTZ,
  -- Metadata
  created_by          UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- GENERATED ALWAYS: geom mirrors lat/lon for fast spatial queries.
  geom                GEOGRAPHY(POINT, 4326)
                      GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography) STORED,

  CONSTRAINT anchorages_name_length CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT anchorages_lat_range CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT anchorages_lon_range CHECK (lon BETWEEN -180 AND 180),
  CONSTRAINT anchorages_holding_check
    CHECK (holding IS NULL OR holding IN ('good', 'fair', 'poor', 'unknown')),
  CONSTRAINT anchorages_swing_room_check
    CHECK (swing_room IS NULL OR swing_room IN ('tight', 'moderate', 'spacious')),
  CONSTRAINT anchorages_shelter_directions_valid
    CHECK (
      shelter_from IS NULL
      OR shelter_from <@ ARRAY['N','NE','E','SE','S','SW','W','NW']::TEXT[]
    ),
  CONSTRAINT anchorages_description_length
    CHECK (description IS NULL OR char_length(description) <= 4000)
);

CREATE INDEX IF NOT EXISTS anchorages_geom_idx
  ON public.anchorages USING GIST (geom);
CREATE INDEX IF NOT EXISTS anchorages_country_idx
  ON public.anchorages (country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS anchorages_name_trgm_idx
  ON public.anchorages USING GIN (name gin_trgm_ops);

ALTER TABLE public.anchorages ENABLE ROW LEVEL SECURITY;

-- Public read; authenticated write; author-only edit/delete.
DROP POLICY IF EXISTS anchorages_public_read   ON public.anchorages;
DROP POLICY IF EXISTS anchorages_auth_insert   ON public.anchorages;
DROP POLICY IF EXISTS anchorages_author_update ON public.anchorages;
DROP POLICY IF EXISTS anchorages_author_delete ON public.anchorages;

CREATE POLICY anchorages_public_read ON public.anchorages
  FOR SELECT USING (TRUE);
CREATE POLICY anchorages_auth_insert ON public.anchorages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);
CREATE POLICY anchorages_author_update ON public.anchorages
  FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY anchorages_author_delete ON public.anchorages
  FOR DELETE USING (auth.uid() = created_by);

COMMENT ON TABLE public.anchorages IS
  'Community-contributed cruising POIs. Public read, authenticated insert, author-only update/delete. PostGIS geom column for spatial queries.';

-- ----------------------------------------------------------------------------
-- anchorage_notes — per-contributor reviews
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.anchorage_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchorage_id    UUID NOT NULL REFERENCES public.anchorages(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visited_on      DATE,
  body            TEXT NOT NULL,
  rating_overall  INTEGER,
  rating_holding  INTEGER,
  rating_shelter  INTEGER,
  conditions      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT anchorage_notes_body_length
    CHECK (char_length(body) BETWEEN 10 AND 4000),
  CONSTRAINT anchorage_notes_rating_overall_range
    CHECK (rating_overall IS NULL OR rating_overall BETWEEN 1 AND 5),
  CONSTRAINT anchorage_notes_rating_holding_range
    CHECK (rating_holding IS NULL OR rating_holding BETWEEN 1 AND 5),
  CONSTRAINT anchorage_notes_rating_shelter_range
    CHECK (rating_shelter IS NULL OR rating_shelter BETWEEN 1 AND 5),
  CONSTRAINT anchorage_notes_conditions_check
    CHECK (
      conditions IS NULL
      OR conditions IN ('calm','breezy','gusty','rough','stormy')
    )
);

CREATE INDEX IF NOT EXISTS anchorage_notes_anchorage_id_idx
  ON public.anchorage_notes (anchorage_id, created_at DESC);
CREATE INDEX IF NOT EXISTS anchorage_notes_author_idx
  ON public.anchorage_notes (author_id);

ALTER TABLE public.anchorage_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anchorage_notes_public_read    ON public.anchorage_notes;
DROP POLICY IF EXISTS anchorage_notes_auth_insert    ON public.anchorage_notes;
DROP POLICY IF EXISTS anchorage_notes_author_update  ON public.anchorage_notes;
DROP POLICY IF EXISTS anchorage_notes_author_delete  ON public.anchorage_notes;

CREATE POLICY anchorage_notes_public_read   ON public.anchorage_notes
  FOR SELECT USING (TRUE);
CREATE POLICY anchorage_notes_auth_insert   ON public.anchorage_notes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);
CREATE POLICY anchorage_notes_author_update ON public.anchorage_notes
  FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY anchorage_notes_author_delete ON public.anchorage_notes
  FOR DELETE USING (auth.uid() = author_id);

COMMENT ON TABLE public.anchorage_notes IS
  'Per-contributor anchorage reviews. Append-mostly: authors edit their own; new contributors add their own. Public read.';

-- ----------------------------------------------------------------------------
-- Triggers — keep aggregate notes_count + last_note_at in sync on anchorages.
-- App-level updates would race; DB triggers keep this consistent.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.anchorage_notes_aggregate_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.anchorages
       SET notes_count = notes_count + 1,
           last_note_at = NEW.created_at,
           updated_at = NOW()
     WHERE id = NEW.anchorage_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.anchorages
       SET notes_count = GREATEST(0, notes_count - 1),
           last_note_at = (
             SELECT MAX(created_at) FROM public.anchorage_notes
              WHERE anchorage_id = OLD.anchorage_id
           ),
           updated_at = NOW()
     WHERE id = OLD.anchorage_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS anchorage_notes_aggregate_sync_trigger
  ON public.anchorage_notes;
CREATE TRIGGER anchorage_notes_aggregate_sync_trigger
  AFTER INSERT OR DELETE ON public.anchorage_notes
  FOR EACH ROW EXECUTE FUNCTION public.anchorage_notes_aggregate_sync();
