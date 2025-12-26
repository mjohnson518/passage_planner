-- ============================================================================
-- Production Readiness Migration
-- Adds tables required for production features added in Phase 1/2 fixes
-- ============================================================================

-- ============================================================================
-- USAGE EVENTS TABLE (for FeatureGate subscription limit tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient usage queries
CREATE INDEX IF NOT EXISTS idx_usage_events_user_action_date
    ON usage_events(user_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_action
    ON usage_events(action);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at
    ON usage_events(created_at DESC);

-- RLS for usage_events
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage" ON usage_events
    FOR SELECT USING (auth.uid() = user_id);

-- System can insert usage (service role)
CREATE POLICY "Service can insert usage" ON usage_events
    FOR INSERT WITH CHECK (true);

-- Admins can view all usage
CREATE POLICY "Admins can view all usage" ON usage_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.role = 'admin'
        )
    );

-- ============================================================================
-- SAFETY AUDIT LOGS TABLE (for maritime safety compliance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS safety_audit_logs (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    request_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'route_analyzed',
        'warning_generated',
        'override_applied',
        'hazard_detected',
        'recommendation_made',
        'data_source_used'
    )),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'warning', 'critical')),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_safety_audit_logs_request_id
    ON safety_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_safety_audit_logs_user_id
    ON safety_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_audit_logs_action
    ON safety_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_safety_audit_logs_result
    ON safety_audit_logs(result);
CREATE INDEX IF NOT EXISTS idx_safety_audit_logs_timestamp
    ON safety_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_safety_audit_logs_critical
    ON safety_audit_logs(timestamp DESC) WHERE result = 'critical';

-- RLS for safety_audit_logs
ALTER TABLE safety_audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs" ON safety_audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Service can insert audit logs
CREATE POLICY "Service can insert audit logs" ON safety_audit_logs
    FOR INSERT WITH CHECK (true);

-- Admins can view all audit logs (required for incident investigation)
CREATE POLICY "Admins can view all audit logs" ON safety_audit_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.role = 'admin'
        )
    );

-- ============================================================================
-- RESTRICTED AREAS TABLE (for database-backed restricted area management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS restricted_areas (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'military',
        'marine_sanctuary',
        'shipping_lane',
        'anchor_prohibited',
        'speed_restricted',
        'other'
    )),
    description TEXT,
    restrictions TEXT[] DEFAULT ARRAY[]::TEXT[],
    active BOOLEAN DEFAULT true,

    -- Geographic bounds (for rectangular areas)
    bounds_north DECIMAL(9,6),
    bounds_south DECIMAL(9,6),
    bounds_east DECIMAL(9,6),
    bounds_west DECIMAL(9,6),

    -- Polygon coordinates (for irregular shapes, stored as JSON array of {lat, lon})
    polygon JSONB,

    -- Schedule information
    schedule_start VARCHAR(100),
    schedule_end VARCHAR(100),
    schedule_recurring VARCHAR(255),

    -- Authority and enforcement
    authority VARCHAR(255),
    penalty TEXT,

    -- Data provenance
    source VARCHAR(255),
    source_id VARCHAR(255),
    last_verified TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for restricted area queries
CREATE INDEX IF NOT EXISTS idx_restricted_areas_type
    ON restricted_areas(type);
CREATE INDEX IF NOT EXISTS idx_restricted_areas_active
    ON restricted_areas(active);
CREATE INDEX IF NOT EXISTS idx_restricted_areas_bounds
    ON restricted_areas(bounds_north, bounds_south, bounds_east, bounds_west)
    WHERE bounds_north IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restricted_areas_source
    ON restricted_areas(source);

-- Trigger for updated_at
CREATE TRIGGER update_restricted_areas_updated_at
    BEFORE UPDATE ON restricted_areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for restricted_areas
ALTER TABLE restricted_areas ENABLE ROW LEVEL SECURITY;

-- Everyone can read restricted areas (public safety data)
CREATE POLICY "Anyone can read restricted areas" ON restricted_areas
    FOR SELECT USING (true);

-- Only admins can modify restricted areas
CREATE POLICY "Admins can manage restricted areas" ON restricted_areas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.role = 'admin'
        )
    );

-- ============================================================================
-- SEED DEFAULT RESTRICTED AREAS (US East Coast examples)
-- ============================================================================

INSERT INTO restricted_areas (id, name, type, description, restrictions, active,
    bounds_north, bounds_south, bounds_east, bounds_west, authority, penalty, source)
VALUES
    (
        'US-MIL-001',
        'Naval Exercise Area - Cape Cod',
        'military',
        'Naval exercises may be in progress. Contact USCG before entering.',
        ARRAY['Civilian vessels prohibited during active exercises', 'Monitor VHF Channel 16 for notices', 'Maintain 5nm standoff when exercises active'],
        true,
        42.5, 42.0, -69.5, -70.5,
        'US Navy / USCG',
        'Federal offense - may result in vessel seizure',
        'NOAA NTM'
    ),
    (
        'SANCTUARY-001',
        'Stellwagen Bank National Marine Sanctuary',
        'marine_sanctuary',
        'Protected marine sanctuary. Special regulations apply.',
        ARRAY['No discharge of any kind', 'Speed restrictions may apply during whale season', 'No anchoring in designated areas', 'Report whale sightings to authorities'],
        true,
        42.75, 42.08, -70.02, -70.60,
        'NOAA National Marine Sanctuaries',
        'Up to $100,000 per violation',
        'NOAA'
    ),
    (
        'SHIPPING-LANE-001',
        'Boston TSS (Traffic Separation Scheme)',
        'shipping_lane',
        'Traffic Separation Scheme - IMO Collision Regulations apply.',
        ARRAY['Cross at right angles to traffic flow', 'Do not impede vessels in traffic lanes', 'Avoid separation zone except when crossing', 'Monitor VHF Channel 13 (bridge-to-bridge)'],
        true,
        42.45, 42.25, -70.75, -70.95,
        'IMO / USCG',
        'Violation of COLREGS Rule 10',
        'IMO'
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    restrictions = EXCLUDED.restrictions,
    updated_at = NOW();

-- ============================================================================
-- HELPER FUNCTION: Check if point is in restricted area bounds
-- ============================================================================

CREATE OR REPLACE FUNCTION point_in_restricted_area(
    lat DECIMAL,
    lon DECIMAL
) RETURNS TABLE (
    area_id VARCHAR(100),
    area_name VARCHAR(255),
    area_type VARCHAR(50),
    restrictions TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ra.id,
        ra.name,
        ra.type,
        ra.restrictions
    FROM restricted_areas ra
    WHERE ra.active = true
    AND ra.bounds_north IS NOT NULL
    AND lat >= ra.bounds_south
    AND lat <= ra.bounds_north
    AND lon >= ra.bounds_west
    AND lon <= ra.bounds_east;
END;
$$ LANGUAGE plpgsql;
