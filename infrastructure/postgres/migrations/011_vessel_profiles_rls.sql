-- Row Level Security for Vessel Profile Tables
-- Phase 5: Security Hardening - User Data Protection

-- Enable RLS on all vessel-related tables
ALTER TABLE vessel_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessel_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE passage_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE passage_checklist_completions ENABLE ROW LEVEL SECURITY;

-- vessel_profiles policies (direct user_id reference)
CREATE POLICY "Users can view their own vessel profiles"
    ON vessel_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vessel profiles"
    ON vessel_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vessel profiles"
    ON vessel_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vessel profiles"
    ON vessel_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- vessel_maintenance policies (via vessel_profiles)
CREATE POLICY "Users can view their vessel maintenance"
    ON vessel_maintenance FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vessel_profiles
            WHERE vessel_profiles.id = vessel_maintenance.vessel_id
            AND vessel_profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their vessel maintenance"
    ON vessel_maintenance FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM vessel_profiles
            WHERE vessel_profiles.id = vessel_maintenance.vessel_id
            AND vessel_profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their vessel maintenance"
    ON vessel_maintenance FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM vessel_profiles
            WHERE vessel_profiles.id = vessel_maintenance.vessel_id
            AND vessel_profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their vessel maintenance"
    ON vessel_maintenance FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM vessel_profiles
            WHERE vessel_profiles.id = vessel_maintenance.vessel_id
            AND vessel_profiles.user_id = auth.uid()
        )
    );

-- safety_equipment policies (via vessel_profiles)
CREATE POLICY "Users can view their safety equipment"
    ON safety_equipment FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vessel_profiles
            WHERE vessel_profiles.id = safety_equipment.vessel_id
            AND vessel_profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their safety equipment"
    ON safety_equipment FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM vessel_profiles
            WHERE vessel_profiles.id = safety_equipment.vessel_id
            AND vessel_profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their safety equipment"
    ON safety_equipment FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM vessel_profiles
            WHERE vessel_profiles.id = safety_equipment.vessel_id
            AND vessel_profiles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their safety equipment"
    ON safety_equipment FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM vessel_profiles
            WHERE vessel_profiles.id = safety_equipment.vessel_id
            AND vessel_profiles.user_id = auth.uid()
        )
    );

-- checklist_templates policies
-- User-owned templates
CREATE POLICY "Users can view their own templates"
    ON checklist_templates FOR SELECT
    USING (
        user_id = auth.uid() OR user_id IS NULL -- Allow viewing default templates
    );

CREATE POLICY "Users can create their own templates"
    ON checklist_templates FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own templates"
    ON checklist_templates FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own templates"
    ON checklist_templates FOR DELETE
    USING (user_id = auth.uid());

-- checklist_items policies (via checklist_templates)
CREATE POLICY "Users can view checklist items"
    ON checklist_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM checklist_templates
            WHERE checklist_templates.id = checklist_items.template_id
            AND (checklist_templates.user_id = auth.uid() OR checklist_templates.user_id IS NULL)
        )
    );

CREATE POLICY "Users can manage their checklist items"
    ON checklist_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM checklist_templates
            WHERE checklist_templates.id = checklist_items.template_id
            AND checklist_templates.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their checklist items"
    ON checklist_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM checklist_templates
            WHERE checklist_templates.id = checklist_items.template_id
            AND checklist_templates.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their checklist items"
    ON checklist_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM checklist_templates
            WHERE checklist_templates.id = checklist_items.template_id
            AND checklist_templates.user_id = auth.uid()
        )
    );

-- passage_checklists policies
-- Note: passage_id is a VARCHAR that references the passage - we need to join to passages table
CREATE POLICY "Users can view their passage checklists"
    ON passage_checklists FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM passages
            WHERE passages.id::text = passage_checklists.passage_id
            AND passages.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create passage checklists"
    ON passage_checklists FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM passages
            WHERE passages.id::text = passage_checklists.passage_id
            AND passages.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their passage checklists"
    ON passage_checklists FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM passages
            WHERE passages.id::text = passage_checklists.passage_id
            AND passages.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their passage checklists"
    ON passage_checklists FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM passages
            WHERE passages.id::text = passage_checklists.passage_id
            AND passages.user_id = auth.uid()
        )
    );

-- passage_checklist_completions policies (via passage_checklists)
CREATE POLICY "Users can view their checklist completions"
    ON passage_checklist_completions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM passage_checklists
            JOIN passages ON passages.id::text = passage_checklists.passage_id
            WHERE passage_checklists.id = passage_checklist_completions.passage_checklist_id
            AND passages.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create checklist completions"
    ON passage_checklist_completions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM passage_checklists
            JOIN passages ON passages.id::text = passage_checklists.passage_id
            WHERE passage_checklists.id = passage_checklist_completions.passage_checklist_id
            AND passages.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their checklist completions"
    ON passage_checklist_completions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM passage_checklists
            JOIN passages ON passages.id::text = passage_checklists.passage_id
            WHERE passage_checklists.id = passage_checklist_completions.passage_checklist_id
            AND passages.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their checklist completions"
    ON passage_checklist_completions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM passage_checklists
            JOIN passages ON passages.id::text = passage_checklists.passage_id
            WHERE passage_checklists.id = passage_checklist_completions.passage_checklist_id
            AND passages.user_id = auth.uid()
        )
    );

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON vessel_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vessel_maintenance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON safety_equipment TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON checklist_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON checklist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON passage_checklists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON passage_checklist_completions TO authenticated;

-- Service role bypass for admin operations
ALTER TABLE vessel_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE vessel_maintenance FORCE ROW LEVEL SECURITY;
ALTER TABLE safety_equipment FORCE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE checklist_items FORCE ROW LEVEL SECURITY;
ALTER TABLE passage_checklists FORCE ROW LEVEL SECURITY;
ALTER TABLE passage_checklist_completions FORCE ROW LEVEL SECURITY;
