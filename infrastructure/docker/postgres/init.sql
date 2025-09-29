-- Comprehensive schema initialization for Helmwise passage planner
-- Generated from passage-planner-tech-spec.md

-- Extensions ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Utility functions ---------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free','premium','pro')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active','canceled','past_due','trialing')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  monthly_passage_count INTEGER DEFAULT 0,
  usage_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 month',
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Vessels -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vessels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('sailboat','powerboat','catamaran','trimaran')),
  length_ft NUMERIC(5,2),
  beam_ft NUMERIC(5,2),
  draft_ft NUMERIC(5,2),
  hull_speed_kts NUMERIC(4,2),
  cruise_speed_kts NUMERIC(4,2),
  max_speed_kts NUMERIC(4,2),
  fuel_capacity_gal NUMERIC(7,2),
  water_capacity_gal NUMERIC(7,2),
  mmsi TEXT,
  call_sign TEXT,
  registration_number TEXT,
  home_port TEXT,
  current_location GEOGRAPHY(POINT,4326),
  equipment JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, name)
);

CREATE TRIGGER vessels_updated_at
  BEFORE UPDATE ON vessels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Passages ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS passages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  departure_port TEXT NOT NULL,
  departure_coords GEOGRAPHY(POINT,4326) NOT NULL,
  destination_port TEXT NOT NULL,
  destination_coords GEOGRAPHY(POINT,4326) NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  distance_nm NUMERIC(8,2),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','active','completed','cancelled')),
  route_points JSONB NOT NULL,
  weather_data JSONB,
  tidal_data JSONB,
  safety_notes JSONB,
  crew_list JSONB,
  float_plan_sent BOOLEAN DEFAULT FALSE,
  shared_with UUID[] DEFAULT '{}',
  planning_parameters JSONB,
  agent_responses JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER passages_updated_at
  BEFORE UPDATE ON passages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Waypoints -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waypoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passage_id UUID REFERENCES passages(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  name TEXT,
  coordinates GEOGRAPHY(POINT,4326) NOT NULL,
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(passage_id, sequence_number)
);

-- Usage records -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  passage_id UUID REFERENCES passages(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  counted_towards_limit BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics events ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::JSONB,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent health --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('healthy','degraded','offline')),
  last_heartbeat TIMESTAMPTZ,
  cpu_usage NUMERIC(5,2),
  memory_usage NUMERIC(5,2),
  request_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  average_response_time_ms NUMERIC(8,2),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER agent_health_updated_at
  BEFORE UPDATE ON agent_health
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fleet management ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS fleets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fleet_id UUID REFERENCES fleets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','captain','crew','viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fleet_id, user_id)
);

CREATE TABLE IF NOT EXISTS fleet_vessels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fleet_id UUID REFERENCES fleets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  length NUMERIC(5,2),
  beam NUMERIC(5,2),
  draft NUMERIC(4,2),
  registration TEXT,
  home_port TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_passages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fleet_id UUID REFERENCES fleets(id) ON DELETE CASCADE,
  passage_id UUID REFERENCES passages(id) ON DELETE CASCADE,
  vessel_id UUID REFERENCES fleet_vessels(id),
  shared_by UUID REFERENCES profiles(id),
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  distance_nm NUMERIC(8,2),
  UNIQUE(fleet_id, passage_id)
);

CREATE TABLE IF NOT EXISTS fleet_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fleet_id UUID REFERENCES fleets(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  vessel_ids UUID[] DEFAULT '{}',
  invited_by UUID REFERENCES profiles(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_member_vessels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID REFERENCES fleet_members(id) ON DELETE CASCADE,
  vessel_id UUID REFERENCES fleet_vessels(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT TRUE,
  can_plan BOOLEAN DEFAULT FALSE,
  UNIQUE(member_id, vessel_id)
);

CREATE TRIGGER fleets_updated_at
  BEFORE UPDATE ON fleets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER fleet_vessels_updated_at
  BEFORE UPDATE ON fleet_vessels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_vessels_owner ON vessels(owner_id);
CREATE INDEX IF NOT EXISTS idx_passages_user ON passages(user_id);
CREATE INDEX IF NOT EXISTS idx_passages_status ON passages(status);
CREATE INDEX IF NOT EXISTS idx_passages_departure_time ON passages(departure_time);
CREATE INDEX IF NOT EXISTS idx_waypoints_passage ON waypoints(passage_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_usage_records_user ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_health_name ON agent_health(agent_name);
CREATE INDEX IF NOT EXISTS idx_fleets_owner ON fleets(owner_id);
CREATE INDEX IF NOT EXISTS idx_fleet_members_fleet ON fleet_members(fleet_id);
CREATE INDEX IF NOT EXISTS idx_fleet_members_user ON fleet_members(user_id);
CREATE INDEX IF NOT EXISTS idx_fleet_vessels_fleet ON fleet_vessels(fleet_id);
CREATE INDEX IF NOT EXISTS idx_fleet_passages_fleet ON fleet_passages(fleet_id);

-- RLS policies --------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_member_vessels ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS profiles_select_self ON profiles;
DROP POLICY IF EXISTS profiles_update_self ON profiles;
CREATE POLICY profiles_select_self ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Vessels policies
DROP POLICY IF EXISTS vessels_select_owner ON vessels;
DROP POLICY IF EXISTS vessels_insert_owner ON vessels;
DROP POLICY IF EXISTS vessels_update_owner ON vessels;
DROP POLICY IF EXISTS vessels_delete_owner ON vessels;
CREATE POLICY vessels_select_owner ON vessels
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY vessels_insert_owner ON vessels
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY vessels_update_owner ON vessels
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY vessels_delete_owner ON vessels
  FOR DELETE USING (auth.uid() = owner_id);

-- Passages policies
DROP POLICY IF EXISTS passages_select_user ON passages;
DROP POLICY IF EXISTS passages_insert_user ON passages;
DROP POLICY IF EXISTS passages_update_user ON passages;
DROP POLICY IF EXISTS passages_delete_user ON passages;
CREATE POLICY passages_select_user ON passages
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = ANY(shared_with));
CREATE POLICY passages_insert_user ON passages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY passages_update_user ON passages
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY passages_delete_user ON passages
  FOR DELETE USING (auth.uid() = user_id);

-- Waypoints policies
DROP POLICY IF EXISTS waypoints_rw ON waypoints;
CREATE POLICY waypoints_rw ON waypoints
  USING (auth.uid() = (SELECT user_id FROM passages WHERE passages.id = passage_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM passages WHERE passages.id = passage_id));

-- Fleet policies (simplified)
DROP POLICY IF EXISTS fleets_rw ON fleets;
CREATE POLICY fleets_rw ON fleets
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS fleet_members_rw ON fleet_members;
CREATE POLICY fleet_members_rw ON fleet_members
  USING (auth.uid() = user_id OR auth.uid() = (SELECT owner_id FROM fleets WHERE fleets.id = fleet_id))
  WITH CHECK (auth.uid() = (SELECT owner_id FROM fleets WHERE fleets.id = fleet_id));

-- Maintenance routines ------------------------------------------------------
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET monthly_passage_count = 0,
      usage_reset_at = NOW() + INTERVAL '1 month'
  WHERE usage_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule('reset-monthly-usage', '0 0 1 * *', 'SELECT reset_monthly_usage();');


