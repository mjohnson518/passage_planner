-- Boat profiles table for storing user vessels
CREATE TABLE IF NOT EXISTS boat_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('sailboat', 'motorboat', 'catamaran', 'trimaran')),
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  year INTEGER CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
  
  -- Dimensions (in feet)
  length DECIMAL(5,2) NOT NULL CHECK (length > 0 AND length < 500),
  beam DECIMAL(5,2) CHECK (beam > 0 AND beam < 100),
  draft DECIMAL(4,2) NOT NULL CHECK (draft >= 0 AND draft < 50),
  displacement INTEGER CHECK (displacement > 0),
  
  -- Sailing specific
  sail_configuration VARCHAR(20) CHECK (sail_configuration IN ('sloop', 'cutter', 'ketch', 'yawl', 'schooner', 'cat')),
  mast_height DECIMAL(5,2) CHECK (mast_height > 0 AND mast_height < 300),
  
  -- Motor specific
  engine_type VARCHAR(20) CHECK (engine_type IN ('inboard', 'outboard', 'inboard/outboard')),
  engine_power INTEGER CHECK (engine_power > 0),
  fuel_capacity DECIMAL(6,2) CHECK (fuel_capacity >= 0),
  fuel_consumption DECIMAL(5,2) CHECK (fuel_consumption >= 0),
  
  -- Navigation equipment
  has_autopilot BOOLEAN DEFAULT false,
  has_radar BOOLEAN DEFAULT false,
  has_ais BOOLEAN DEFAULT false,
  has_chartplotter BOOLEAN DEFAULT false,
  has_wind_instruments BOOLEAN DEFAULT false,
  
  -- Comfort/capacity
  water_capacity DECIMAL(6,2) CHECK (water_capacity >= 0),
  sleeps INTEGER CHECK (sleeps >= 0 AND sleeps < 50),
  
  -- Performance
  hull_speed DECIMAL(4,2) CHECK (hull_speed > 0 AND hull_speed < 100),
  cruising_speed DECIMAL(4,2) CHECK (cruising_speed > 0 AND cruising_speed < 100),
  max_speed DECIMAL(4,2) CHECK (max_speed > 0 AND max_speed < 100),
  
  -- Preferences (JSON)
  default_preferences JSONB DEFAULT '{}',
  
  -- Metadata
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_boat_profiles_user_id (user_id),
  INDEX idx_boat_profiles_is_default (is_default),
  
  -- Constraints
  CONSTRAINT valid_speeds CHECK (cruising_speed <= max_speed),
  CONSTRAINT valid_hull_speed CHECK (hull_speed <= max_speed)
);

-- Create trigger to update timestamp
CREATE OR REPLACE FUNCTION update_boat_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_boat_profiles_timestamp
  BEFORE UPDATE ON boat_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_boat_profile_timestamp();

-- Ensure only one default boat per user
CREATE OR REPLACE FUNCTION ensure_single_default_boat()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE boat_profiles 
    SET is_default = false 
    WHERE user_id = NEW.user_id 
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_boat_trigger
  BEFORE INSERT OR UPDATE ON boat_profiles
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_boat();

-- Default passage preferences structure
COMMENT ON COLUMN boat_profiles.default_preferences IS 'JSON object containing:
{
  "maxWindSpeed": number (knots),
  "maxWaveHeight": number (meters),
  "minVisibility": number (nautical miles),
  "avoidNight": boolean,
  "preferMotoring": boolean,
  "maxDailyHours": number,
  "preferredDepartureTime": string (HH:MM),
  "minDepth": number (feet),
  "avoidTidalGates": boolean,
  "preferSheltered": boolean,
  "maxDistanceFromShore": number (nautical miles),
  "requireVHFCoverage": boolean,
  "comfortLevel": "racing" | "cruising" | "comfort"
}'; 