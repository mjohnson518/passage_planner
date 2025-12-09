-- ============================================================================
-- Helmwise Database Schema for Supabase
-- Run this in Supabase SQL Editor to set up your database
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROFILES TABLE (links to Supabase auth.users)
-- ============================================================================

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

-- ============================================================================
-- VESSELS TABLE
-- ============================================================================

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
  equipment JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, name)
);

CREATE TRIGGER vessels_updated_at
  BEFORE UPDATE ON vessels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- PASSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS passages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  departure_port TEXT NOT NULL,
  departure_lat NUMERIC(9,6) NOT NULL,
  departure_lon NUMERIC(9,6) NOT NULL,
  destination_port TEXT NOT NULL,
  destination_lat NUMERIC(9,6) NOT NULL,
  destination_lon NUMERIC(9,6) NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  distance_nm NUMERIC(8,2),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','active','completed','cancelled')),
  route_points JSONB NOT NULL DEFAULT '[]'::JSONB,
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

-- ============================================================================
-- WAYPOINTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS waypoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passage_id UUID REFERENCES passages(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  name TEXT,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(passage_id, sequence_number)
);

-- ============================================================================
-- USAGE RECORDS TABLE (for tracking subscription limits)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  passage_id UUID REFERENCES passages(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  counted_towards_limit BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ANALYTICS EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::JSONB,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USER FEEDBACK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'general', 'safety')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER user_feedback_updated_at
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- INDEXES (for faster queries)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_vessels_owner ON vessels(owner_id);
CREATE INDEX IF NOT EXISTS idx_passages_user ON passages(user_id);
CREATE INDEX IF NOT EXISTS idx_passages_status ON passages(status);
CREATE INDEX IF NOT EXISTS idx_passages_departure_time ON passages(departure_time);
CREATE INDEX IF NOT EXISTS idx_waypoints_passage ON waypoints(passage_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_usage_records_user ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Users can only see their own data
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Vessels: Users can CRUD their own vessels
CREATE POLICY "Users can view own vessels" ON vessels
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own vessels" ON vessels
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own vessels" ON vessels
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own vessels" ON vessels
  FOR DELETE USING (auth.uid() = owner_id);

-- Passages: Users can CRUD their own passages
CREATE POLICY "Users can view own passages" ON passages
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = ANY(shared_with));

CREATE POLICY "Users can insert own passages" ON passages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own passages" ON passages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own passages" ON passages
  FOR DELETE USING (auth.uid() = user_id);

-- Waypoints: Users can access waypoints of their passages
CREATE POLICY "Users can access own waypoints" ON waypoints
  USING (auth.uid() = (SELECT user_id FROM passages WHERE passages.id = passage_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM passages WHERE passages.id = passage_id));

-- Usage records: Users can view their own
CREATE POLICY "Users can view own usage" ON usage_records
  FOR SELECT USING (auth.uid() = user_id);

-- Analytics: Users can insert their own events
CREATE POLICY "Users can insert own analytics" ON analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Feedback: Users can CRUD their own feedback
CREATE POLICY "Users can view own feedback" ON user_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert feedback" ON user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- FUNCTION: Auto-create profile when user signs up
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Done! Your database is ready.
-- ============================================================================

