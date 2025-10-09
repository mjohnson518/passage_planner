-- User Feedback System
-- Captures user feedback, bug reports, and feature requests

CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Feedback details
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'general')),
    feedback_text TEXT NOT NULL,
    
    -- Context
    page_url TEXT,
    user_agent TEXT,
    screenshot_url TEXT,
    contact_email TEXT,
    
    -- Metadata
    browser_info JSONB,
    device_info JSONB,
    session_data JSONB,
    
    -- Status tracking
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'closed')),
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    assigned_to UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at DESC);

-- Feedback responses (for following up with users)
CREATE TABLE IF NOT EXISTS feedback_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
    responder_id UUID REFERENCES auth.users(id),
    response_text TEXT NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_feedback_id ON feedback_responses(feedback_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_feedback_updated_at BEFORE UPDATE ON user_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON user_feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create feedback
CREATE POLICY "Users can create feedback" ON user_feedback
    FOR INSERT WITH CHECK (true);

-- Only admins can update/delete feedback
CREATE POLICY "Admins can manage all feedback" ON user_feedback
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.role = 'admin'
        )
    );

-- Admins can manage responses
CREATE POLICY "Admins can manage responses" ON feedback_responses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.role = 'admin'
        )
    );

-- Users can view responses to their feedback
CREATE POLICY "Users can view responses to their feedback" ON feedback_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_feedback
            WHERE user_feedback.id = feedback_responses.feedback_id
            AND user_feedback.user_id = auth.uid()
        )
    );

