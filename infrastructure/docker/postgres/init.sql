-- PostgreSQL initialization script for Passage Planner

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Agent capabilities table
CREATE TABLE agent_capabilities (
    agent_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL,
    capabilities JSONB NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent status log
CREATE TABLE agent_status_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details JSONB
);

-- Ports database
CREATE TABLE ports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(2) NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Port facilities
CREATE TABLE port_facilities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    port_id UUID REFERENCES ports(id) ON DELETE CASCADE,
    facility_type VARCHAR(50) NOT NULL,
    available BOOLEAN DEFAULT true,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Port contacts
CREATE TABLE port_contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    port_id UUID REFERENCES ports(id) ON DELETE CASCADE,
    contact_type VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    vhf_channel INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User accounts
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    subscription VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    preferences JSONB DEFAULT '{}'::jsonb
);

-- API keys
CREATE TABLE api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    scopes JSONB DEFAULT '["read"]'::jsonb,
    rate_limit JSONB DEFAULT '{"requestsPerMinute": 10, "requestsPerDay": 100}'::jsonb
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
    token VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Passage plans
CREATE TABLE passage_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    departure_port_id UUID REFERENCES ports(id),
    destination_port_id UUID REFERENCES ports(id),
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE,
    distance NUMERIC(10, 2),
    distance_unit VARCHAR(10),
    plan_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sessions
CREATE TABLE sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Request logs
CREATE TABLE request_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    method VARCHAR(50) NOT NULL,
    path VARCHAR(255) NOT NULL,
    status_code INTEGER,
    duration_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Marine zones
CREATE TABLE marine_zones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    zone_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    boundaries GEOGRAPHY(POLYGON, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Navigational hazards
CREATE TABLE navigational_hazards (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    description TEXT,
    avoidance_radius NUMERIC(10, 2),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_agent_status_log_agent_id ON agent_status_log(agent_id);
CREATE INDEX idx_agent_status_log_timestamp ON agent_status_log(timestamp);
CREATE INDEX idx_ports_coordinates ON ports USING GIST(coordinates);
CREATE INDEX idx_ports_country ON ports(country);
CREATE INDEX idx_port_facilities_port_id ON port_facilities(port_id);
CREATE INDEX idx_port_contacts_port_id ON port_contacts(port_id);
CREATE INDEX idx_passage_plans_user_id ON passage_plans(user_id);
CREATE INDEX idx_passage_plans_created_at ON passage_plans(created_at);
CREATE INDEX idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX idx_marine_zones_zone_id ON marine_zones(zone_id);
CREATE INDEX idx_marine_zones_boundaries ON marine_zones USING GIST(boundaries);
CREATE INDEX idx_navigational_hazards_location ON navigational_hazards USING GIST(location);
CREATE INDEX idx_navigational_hazards_type ON navigational_hazards(type);

-- Auth indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Insert sample data
INSERT INTO ports (name, country, coordinates, timezone) VALUES
('Boston, MA', 'US', ST_GeogFromText('POINT(-71.0589 42.3601)'), 'America/New_York'),
('Portland, ME', 'US', ST_GeogFromText('POINT(-70.2568 43.6591)'), 'America/New_York'),
('Newport, RI', 'US', ST_GeogFromText('POINT(-71.3128 41.4901)'), 'America/New_York'),
('New York, NY', 'US', ST_GeogFromText('POINT(-74.0060 40.7128)'), 'America/New_York'),
('Miami, FL', 'US', ST_GeogFromText('POINT(-80.1918 25.7617)'), 'America/New_York'),
('Key West, FL', 'US', ST_GeogFromText('POINT(-81.7799 24.5551)'), 'America/New_York'),
('Charleston, SC', 'US', ST_GeogFromText('POINT(-79.9311 32.7765)'), 'America/New_York'),
('Annapolis, MD', 'US', ST_GeogFromText('POINT(-76.4922 38.9784)'), 'America/New_York');

-- Insert sample port facilities
INSERT INTO port_facilities (port_id, facility_type, available, details)
SELECT 
    p.id,
    f.facility_type,
    true,
    '{}'::jsonb
FROM 
    ports p
    CROSS JOIN (VALUES ('fuel'), ('water'), ('provisions'), ('repairs')) AS f(facility_type)
WHERE 
    p.name IN ('Boston, MA', 'Portland, ME', 'Newport, RI');

-- Insert sample marine zones
INSERT INTO marine_zones (zone_id, name, region) VALUES
('ANZ250', 'Boston Harbor Approach', 'New England'),
('ANZ251', 'Cape Cod Bay', 'New England'),
('ANZ252', 'Nantucket Sound', 'New England'),
('AMZ350', 'Long Island Sound', 'Mid-Atlantic'),
('AMZ450', 'Chesapeake Bay', 'Mid-Atlantic'),
('GMZ650', 'Florida Keys', 'Gulf of Mexico');

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ports_updated_at BEFORE UPDATE ON ports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_passage_plans_updated_at BEFORE UPDATE ON passage_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_navigational_hazards_updated_at BEFORE UPDATE ON navigational_hazards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 