-- Vessel Profiles Database Schema
-- Phase 4: Vessel & Crew Readiness Management

-- Vessel profiles table
CREATE TABLE IF NOT EXISTS vessel_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vessel_name VARCHAR(255) NOT NULL,
    
    -- Hull specifications
    hull_type VARCHAR(50), -- monohull, catamaran, trimaran
    length_overall_feet NUMERIC(5,2),
    beam_feet NUMERIC(5,2),
    draft_feet NUMERIC(4,2),
    displacement_lbs NUMERIC(8,0),
    hull_material VARCHAR(50), -- fiberglass, aluminum, steel, wood
    
    -- Performance characteristics
    cruise_speed_knots NUMERIC(4,1),
    max_speed_knots NUMERIC(4,1),
    motor_cruising_speed_knots NUMERIC(4,1),
    fuel_capacity_gallons NUMERIC(6,1),
    fuel_consumption_gph NUMERIC(4,2), -- gallons per hour
    water_capacity_gallons NUMERIC(6,1),
    
    -- Safety limits
    max_wind_knots NUMERIC(3,0),
    max_wave_height_feet NUMERIC(4,1),
    comfortable_heel_degrees NUMERIC(3,0),
    
    -- Equipment
    has_radar BOOLEAN DEFAULT false,
    has_ais BOOLEAN DEFAULT false,
    has_autopilot BOOLEAN DEFAULT false,
    has_wind_instruments BOOLEAN DEFAULT false,
    has_chart_plotter BOOLEAN DEFAULT false,
    has_epirb BOOLEAN DEFAULT false,
    has_life_raft BOOLEAN DEFAULT false,
    has_satellite_phone BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Maintenance tracking
CREATE TABLE IF NOT EXISTS vessel_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID NOT NULL REFERENCES vessel_profiles(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(50), -- engine, rigging, electronics, safety, hull
    description TEXT,
    interval_hours INTEGER, -- engine hours between maintenance
    interval_days INTEGER, -- calendar days between maintenance
    last_completed_date DATE,
    next_due_date DATE,
    is_critical BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Safety equipment inventory
CREATE TABLE IF NOT EXISTS safety_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID NOT NULL REFERENCES vessel_profiles(id) ON DELETE CASCADE,
    equipment_type VARCHAR(100) NOT NULL, -- life_jacket, flare, fire_extinguisher, etc
    quantity INTEGER NOT NULL DEFAULT 1,
    expiration_date DATE,
    last_inspected_date DATE,
    location_on_vessel VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-departure checklists
CREATE TABLE IF NOT EXISTS checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    passage_type VARCHAR(50), -- day_sail, overnight, coastal, offshore, ocean_crossing
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
    category VARCHAR(50), -- vessel_systems, safety, weather, provisions, documentation
    item_text TEXT NOT NULL,
    is_critical BOOLEAN DEFAULT false,
    requires_photo BOOLEAN DEFAULT false,
    requires_signature BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Passage-specific checklist instances
CREATE TABLE IF NOT EXISTS passage_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passage_id VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES checklist_templates(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS passage_checklist_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passage_checklist_id UUID NOT NULL REFERENCES passage_checklists(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES checklist_items(id),
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    photo_url VARCHAR(500),
    signature_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vessel_profiles_user_id ON vessel_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_vessel_maintenance_vessel_id ON vessel_maintenance(vessel_id);
CREATE INDEX IF NOT EXISTS idx_vessel_maintenance_next_due ON vessel_maintenance(next_due_date);
CREATE INDEX IF NOT EXISTS idx_safety_equipment_vessel_id ON safety_equipment(vessel_id);
CREATE INDEX IF NOT EXISTS idx_safety_equipment_expiration ON safety_equipment(expiration_date);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_user_id ON checklist_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_passage_checklists_passage_id ON passage_checklists(passage_id);

-- Default checklist template
INSERT INTO checklist_templates (id, template_name, passage_type, is_default)
VALUES ('00000000-0000-0000-0000-000000000001', 'Standard Coastal Passage', 'coastal', true)
ON CONFLICT DO NOTHING;

-- Default checklist items
INSERT INTO checklist_items (template_id, category, item_text, is_critical, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'weather', 'Obtain and review current weather forecast', true, 1),
('00000000-0000-0000-0000-000000000001', 'weather', 'Check for weather warnings and advisories', true, 2),
('00000000-0000-0000-0000-000000000001', 'safety', 'Verify all life jackets accessible and in good condition', true, 3),
('00000000-0000-0000-0000-000000000001', 'safety', 'Check EPIRB/PLB registered and functional', true, 4),
('00000000-0000-0000-0000-000000000001', 'safety', 'Verify flares within date', true, 5),
('00000000-0000-0000-0000-000000000001', 'safety', 'Test VHF radio on Channel 16', true, 6),
('00000000-0000-0000-0000-000000000001', 'safety', 'Check fire extinguishers accessible', true, 7),
('00000000-0000-0000-0000-000000000001', 'safety', 'Verify first aid kit stocked', false, 8),
('00000000-0000-0000-0000-000000000001', 'vessel_systems', 'Engine start and run check', true, 9),
('00000000-0000-0000-0000-000000000001', 'vessel_systems', 'Test navigation lights', true, 10),
('00000000-0000-0000-0000-000000000001', 'vessel_systems', 'Check bilge pumps operational', true, 11),
('00000000-0000-0000-0000-000000000001', 'vessel_systems', 'Verify anchor and ground tackle secure', false, 12),
('00000000-0000-0000-0000-000000000001', 'provisions', 'Fuel adequate with 20% reserve', true, 13),
('00000000-0000-0000-0000-000000000001', 'provisions', 'Water adequate with 30% reserve', true, 14),
('00000000-0000-0000-0000-000000000001', 'provisions', 'Provisions for duration plus 48 hours', false, 15),
('00000000-0000-0000-0000-000000000001', 'documentation', 'Float plan filed with shore contact', true, 16),
('00000000-0000-0000-0000-000000000001', 'documentation', 'Charts and navigation materials ready', false, 17)
ON CONFLICT DO NOTHING;

