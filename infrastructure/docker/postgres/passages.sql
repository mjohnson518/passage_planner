-- Passages table for storing user passage plans
CREATE TABLE IF NOT EXISTS passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    boat_id UUID REFERENCES boats(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    departure VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    departure_date TIMESTAMP WITH TIME ZONE NOT NULL,
    distance_nm DECIMAL(10, 2),
    estimated_duration VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planned', 'completed')),
    weather_summary TEXT,
    route_data JSONB,
    max_wind_speed DECIMAL(5, 2),
    max_wave_height DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_passages_user_id ON passages(user_id);
CREATE INDEX idx_passages_departure_date ON passages(departure_date);
CREATE INDEX idx_passages_status ON passages(status);
CREATE INDEX idx_passages_created_at ON passages(created_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_passages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER passages_updated_at_trigger
    BEFORE UPDATE ON passages
    FOR EACH ROW
    EXECUTE FUNCTION update_passages_updated_at();

-- Add some example data for testing (optional - remove in production)
-- INSERT INTO passages (user_id, boat_id, name, departure, destination, departure_date, distance_nm, estimated_duration, status, weather_summary)
-- VALUES 
--     ('user_id_here', 'boat_id_here', 'Summer Cruise to Nantucket', 'Boston, MA', 'Nantucket, MA', 
--      NOW() + INTERVAL '7 days', 87, '14-16 hours', 'planned', 'Fair conditions, SW 10-15 kts');
