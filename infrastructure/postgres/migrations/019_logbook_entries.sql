-- ============================================================================
-- Logbook entries (V3) — append-only per-passage vessel log
--
-- Maritime tradition + insurance/SAR evidentiary value require an append-only
-- record. Corrections are made by adding new entries that reference the
-- original, NOT by editing prior rows. RLS reflects this: read + insert only,
-- no UPDATE policy. DELETE allowed only for typo-undo within 5 minutes
-- (enforced at the API layer — the DB just exposes the column).
--
-- Two timestamps:
--   occurred_at  — when the event happened (squall, fix, engine start)
--   recorded_at  — when the OOW wrote it down
-- These are usually identical for real-time entries but DIVERGE for
-- after-the-fact entries — divergence is itself information.
--
-- passage_id is the Redis-key string the planner generates (uuidv4) — see
-- SimpleOrchestrator's passages:user:{u}:{p} pattern. Kept as TEXT to stay
-- decoupled from whatever future storage migration passages live in.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.logbook_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passage_id      TEXT NOT NULL,
  vessel_id       UUID,
  entry_type      TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by     TEXT,
  position_lat    DOUBLE PRECISION,
  position_lon    DOUBLE PRECISION,
  conditions      JSONB,
  notes           TEXT,

  CONSTRAINT logbook_entries_type_check
    CHECK (entry_type IN (
      'departure',
      'arrival',
      'position',
      'watch_handover',
      'weather',
      'engine',
      'fuel',
      'event',
      'note'
    )),
  CONSTRAINT logbook_entries_lat_range
    CHECK (position_lat IS NULL OR position_lat BETWEEN -90 AND 90),
  CONSTRAINT logbook_entries_lon_range
    CHECK (position_lon IS NULL OR position_lon BETWEEN -180 AND 180),
  CONSTRAINT logbook_entries_notes_length
    CHECK (notes IS NULL OR char_length(notes) <= 4000),
  CONSTRAINT logbook_entries_recorded_by_length
    CHECK (recorded_by IS NULL OR char_length(recorded_by) <= 100)
);

CREATE INDEX IF NOT EXISTS logbook_entries_passage_occurred_idx
  ON public.logbook_entries (passage_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS logbook_entries_user_idx
  ON public.logbook_entries (user_id);

ALTER TABLE public.logbook_entries ENABLE ROW LEVEL SECURITY;

-- Read + insert only — no UPDATE policy. Maritime-tradition append-only.
-- DELETE policy allows owner deletes; the API layer enforces the 5-minute
-- typo-undo window (CHECK constraints can't reference time).
DROP POLICY IF EXISTS logbook_entries_self_read   ON public.logbook_entries;
DROP POLICY IF EXISTS logbook_entries_self_insert ON public.logbook_entries;
DROP POLICY IF EXISTS logbook_entries_self_delete ON public.logbook_entries;

CREATE POLICY logbook_entries_self_read   ON public.logbook_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY logbook_entries_self_insert ON public.logbook_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY logbook_entries_self_delete ON public.logbook_entries
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.logbook_entries IS
  'Append-only per-passage vessel logbook (V3). RLS: owner read/insert; delete via API within 5-minute typo-undo window.';
