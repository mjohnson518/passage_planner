-- ============================================================================
-- Hazards Along Route — server-side spatial query
--
-- Returns hazards from the global feeds (piracy_zones today; navarea_warnings
-- and ice_hazards as future overloads) that fall within `buffer_nm` nautical
-- miles of a passage route. Centralising the spatial math keeps SafetyAgent
-- and any future caller (BI dashboards, mobile clients) using the same
-- definition of "near the route".
--
-- Buffer default 50 nm — roughly half a day's transit at 4 kn, and aligned
-- with how UKMTO defines the lower bound of its High Risk Area band.
-- Time window default 24 months — far enough back to surface seasonal
-- piracy patterns without flooding plans with decade-old reports.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hazards_along_route(
  route_geojson JSONB,
  buffer_nm NUMERIC DEFAULT 50,
  since_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '24 months')
)
RETURNS TABLE (
  id UUID,
  source TEXT,
  external_ref TEXT,
  occurred_at TIMESTAMPTZ,
  lat NUMERIC,
  lon NUMERIC,
  subregion TEXT,
  navarea TEXT,
  hostility TEXT,
  description TEXT,
  distance_nm NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH route AS (
    SELECT ST_GeomFromGeoJSON(route_geojson::text)::geography AS line
  )
  SELECT
    p.id,
    p.source::text,
    p.external_ref::text,
    p.occurred_at,
    p.lat,
    p.lon,
    p.subregion::text,
    p.navarea::text,
    p.hostility::text,
    p.description,
    (ST_Distance(p.geom, r.line) / 1852.0)::NUMERIC AS distance_nm
  FROM piracy_zones p, route r
  WHERE p.occurred_at >= since_date
    AND ST_DWithin(p.geom, r.line, buffer_nm * 1852.0)
  ORDER BY p.occurred_at DESC, distance_nm ASC;
$$;

-- Public-readable: piracy_zones already has anyone-read RLS, and this
-- function is STABLE / read-only. Granting to anon lets the frontend call it
-- directly via supabase.rpc(...) once we wire that.
GRANT EXECUTE ON FUNCTION public.hazards_along_route(JSONB, NUMERIC, TIMESTAMPTZ)
  TO anon, authenticated, service_role;
