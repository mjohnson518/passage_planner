-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table (extends auth provider)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  bio TEXT,
  sailing_experience VARCHAR(50), -- beginner, intermediate, advanced, professional
  boat_type VARCHAR(50),
  boat_name VARCHAR(100),
  home_port VARCHAR(100),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscription management
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL DEFAULT 'free', -- free, premium, pro, enterprise
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, canceled, past_due, paused
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- passage_planned, weather_checked, route_exported
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- API keys for programmatic access
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Passage plans
CREATE TABLE passage_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  departure_port VARCHAR(255) NOT NULL,
  destination_port VARCHAR(255) NOT NULL,
  departure_time TIMESTAMP NOT NULL,
  estimated_arrival_time TIMESTAMP,
  distance_nm DECIMAL(10, 2),
  waypoints JSONB,
  weather_data JSONB,
  tidal_data JSONB,
  safety_data JSONB,
  shared_token VARCHAR(255) UNIQUE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent capabilities registry
CREATE TABLE agent_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  tools JSONB DEFAULT '[]',
  resources JSONB DEFAULT '[]',
  prompts JSONB DEFAULT '[]',
  health_endpoint VARCHAR(255),
  performance_metrics JSONB,
  last_health_check TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions for authentication
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ports database
CREATE TABLE ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  alternate_names TEXT[],
  coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
  country VARCHAR(2) NOT NULL,
  region VARCHAR(100),
  timezone VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Port facilities
CREATE TABLE port_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  port_id UUID REFERENCES ports(id) ON DELETE CASCADE,
  facility_type VARCHAR(50) NOT NULL,
  available BOOLEAN DEFAULT true,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Port contacts
CREATE TABLE port_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  port_id UUID REFERENCES ports(id) ON DELETE CASCADE,
  contact_type VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  vhf_channel INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Marine hazards
CREATE TABLE marine_hazards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  description TEXT,
  avoidance_radius INTEGER, -- meters
  seasonal BOOLEAN DEFAULT FALSE,
  active_period JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Weather stations
CREATE TABLE weather_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  type VARCHAR(50), -- buoy, land, ship
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_usage_metrics_user_action ON usage_metrics(user_id, action, created_at);
CREATE INDEX idx_passage_plans_user_id ON passage_plans(user_id);
CREATE INDEX idx_passage_plans_created_at ON passage_plans(created_at);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_ports_coordinates ON ports USING GIST(coordinates);
CREATE INDEX idx_ports_name ON ports USING GIN(name gin_trgm_ops);
CREATE INDEX idx_marine_hazards_location ON marine_hazards USING GIST(location);
CREATE INDEX idx_weather_stations_location ON weather_stations USING GIST(location);

-- Create update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_passage_plans_updated_at BEFORE UPDATE ON passage_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_agent_capabilities_updated_at BEFORE UPDATE ON agent_capabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO ports (name, coordinates, country, timezone) VALUES
('Boston, MA', ST_GeogFromText('POINT(-71.0589 42.3601)'), 'US', 'America/New_York'),
('Portland, ME', ST_GeogFromText('POINT(-70.2568 43.6591)'), 'US', 'America/New_York'),
('Newport, RI', ST_GeogFromText('POINT(-71.3128 41.4901)'), 'US', 'America/New_York'),
('Miami, FL', ST_GeogFromText('POINT(-80.1918 25.7617)'), 'US', 'America/New_York'),
('Charleston, SC', ST_GeogFromText('POINT(-79.9311 32.7765)'), 'US', 'America/New_York'); 