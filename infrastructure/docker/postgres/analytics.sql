-- Analytics tables for business metrics tracking

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_name VARCHAR(100) NOT NULL,
  properties JSONB DEFAULT '{}',
  session_id VARCHAR(100),
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_analytics_events_user_id (user_id),
  INDEX idx_analytics_events_event_name (event_name),
  INDEX idx_analytics_events_created_at (created_at),
  INDEX idx_analytics_events_session_id (session_id)
);

-- Revenue tracking table
CREATE TABLE IF NOT EXISTS revenue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  mrr DECIMAL(10, 2) NOT NULL DEFAULT 0,
  arr DECIMAL(10, 2) NOT NULL DEFAULT 0,
  new_mrr DECIMAL(10, 2) NOT NULL DEFAULT 0,
  churned_mrr DECIMAL(10, 2) NOT NULL DEFAULT 0,
  expansion_mrr DECIMAL(10, 2) NOT NULL DEFAULT 0,
  contraction_mrr DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_customers INTEGER NOT NULL DEFAULT 0,
  new_customers INTEGER NOT NULL DEFAULT 0,
  churned_customers INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User cohorts for retention analysis
CREATE TABLE IF NOT EXISTS user_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  cohort_month DATE NOT NULL,
  acquisition_channel VARCHAR(50),
  initial_plan VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id),
  INDEX idx_user_cohorts_cohort_month (cohort_month),
  INDEX idx_user_cohorts_acquisition_channel (acquisition_channel)
);

-- Feature usage tracking
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  feature_name VARCHAR(100) NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  first_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, feature_name),
  INDEX idx_feature_usage_feature_name (feature_name),
  INDEX idx_feature_usage_last_used_at (last_used_at)
);

-- Funnel events for conversion tracking
CREATE TABLE IF NOT EXISTS funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  funnel_name VARCHAR(100) NOT NULL,
  step_name VARCHAR(100) NOT NULL,
  step_order INTEGER NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_funnel_events_user_id (user_id),
  INDEX idx_funnel_events_funnel_name (funnel_name),
  INDEX idx_funnel_events_created_at (created_at)
);

-- Create function to update revenue metrics daily
CREATE OR REPLACE FUNCTION update_daily_revenue_metrics()
RETURNS void AS $$
BEGIN
  INSERT INTO revenue_metrics (
    date,
    mrr,
    arr,
    new_mrr,
    churned_mrr,
    total_customers,
    new_customers,
    churned_customers
  )
  SELECT 
    CURRENT_DATE as date,
    SUM(CASE 
      WHEN s.subscription_tier = 'premium' THEN 19
      WHEN s.subscription_tier = 'pro' THEN 49
      ELSE 0
    END) as mrr,
    SUM(CASE 
      WHEN s.subscription_tier = 'premium' THEN 19 * 12
      WHEN s.subscription_tier = 'pro' THEN 49 * 12
      ELSE 0
    END) as arr,
    -- New MRR (subscriptions created today)
    SUM(CASE 
      WHEN s.subscription_tier = 'premium' AND DATE(u.created_at) = CURRENT_DATE THEN 19
      WHEN s.subscription_tier = 'pro' AND DATE(u.created_at) = CURRENT_DATE THEN 49
      ELSE 0
    END) as new_mrr,
    -- Churned MRR (subscriptions canceled today)
    SUM(CASE 
      WHEN s.subscription_tier = 'premium' AND s.subscription_status = 'canceled' 
           AND DATE(s.updated_at) = CURRENT_DATE THEN 19
      WHEN s.subscription_tier = 'pro' AND s.subscription_status = 'canceled' 
           AND DATE(s.updated_at) = CURRENT_DATE THEN 49
      ELSE 0
    END) as churned_mrr,
    COUNT(CASE WHEN s.subscription_tier != 'free' THEN 1 END) as total_customers,
    COUNT(CASE WHEN s.subscription_tier != 'free' AND DATE(u.created_at) = CURRENT_DATE THEN 1 END) as new_customers,
    COUNT(CASE WHEN s.subscription_status = 'canceled' AND DATE(s.updated_at) = CURRENT_DATE THEN 1 END) as churned_customers
  FROM users u
  JOIN subscriptions s ON u.id = s.user_id
  WHERE s.subscription_status IN ('active', 'trialing')
  ON CONFLICT (date) DO UPDATE SET
    mrr = EXCLUDED.mrr,
    arr = EXCLUDED.arr,
    new_mrr = EXCLUDED.new_mrr,
    churned_mrr = EXCLUDED.churned_mrr,
    total_customers = EXCLUDED.total_customers,
    new_customers = EXCLUDED.new_customers,
    churned_customers = EXCLUDED.churned_customers,
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for quick metrics access
CREATE MATERIALIZED VIEW IF NOT EXISTS business_metrics_summary AS
SELECT 
  -- Current metrics
  (SELECT mrr FROM revenue_metrics ORDER BY date DESC LIMIT 1) as current_mrr,
  (SELECT arr FROM revenue_metrics ORDER BY date DESC LIMIT 1) as current_arr,
  (SELECT total_customers FROM revenue_metrics ORDER BY date DESC LIMIT 1) as total_customers,
  
  -- Growth rates (month over month)
  (
    SELECT 
      CASE 
        WHEN prev.mrr > 0 THEN ((curr.mrr - prev.mrr) / prev.mrr * 100)
        ELSE 0 
      END
    FROM revenue_metrics curr
    LEFT JOIN revenue_metrics prev ON prev.date = curr.date - INTERVAL '30 days'
    ORDER BY curr.date DESC
    LIMIT 1
  ) as mrr_growth_rate,
  
  -- Churn rate (last 30 days)
  (
    SELECT 
      CASE 
        WHEN COUNT(*) FILTER (WHERE subscription_tier != 'free' AND created_at <= NOW() - INTERVAL '30 days') > 0
        THEN (
          COUNT(*) FILTER (WHERE subscription_status = 'canceled' AND updated_at >= NOW() - INTERVAL '30 days')::FLOAT /
          COUNT(*) FILTER (WHERE subscription_tier != 'free' AND created_at <= NOW() - INTERVAL '30 days')::FLOAT * 100
        )
        ELSE 0
      END
    FROM users u
    JOIN subscriptions s ON u.id = s.user_id
  ) as churn_rate,
  
  -- Average revenue per user
  (
    SELECT 
      CASE 
        WHEN COUNT(*) FILTER (WHERE subscription_tier != 'free') > 0
        THEN (
          SUM(CASE 
            WHEN subscription_tier = 'premium' THEN 19
            WHEN subscription_tier = 'pro' THEN 49
            ELSE 0
          END)::FLOAT / COUNT(*) FILTER (WHERE subscription_tier != 'free')::FLOAT
        )
        ELSE 0
      END
    FROM users u
    JOIN subscriptions s ON u.id = s.user_id
    WHERE subscription_status = 'active'
  ) as arpu,
  
  -- Lifetime value estimate (ARPU * 1/churn_rate)
  (
    SELECT 
      CASE 
        WHEN churn_rate > 0 THEN arpu / (churn_rate / 100)
        ELSE arpu * 12 -- Default to 12 months if no churn
      END
    FROM (
      SELECT 
        -- ARPU
        CASE 
          WHEN COUNT(*) FILTER (WHERE subscription_tier != 'free') > 0
          THEN (
            SUM(CASE 
              WHEN subscription_tier = 'premium' THEN 19
              WHEN subscription_tier = 'pro' THEN 49
              ELSE 0
            END)::FLOAT / COUNT(*) FILTER (WHERE subscription_tier != 'free')::FLOAT
          )
          ELSE 0
        END as arpu,
        -- Churn rate
        CASE 
          WHEN COUNT(*) FILTER (WHERE subscription_tier != 'free' AND created_at <= NOW() - INTERVAL '30 days') > 0
          THEN (
            COUNT(*) FILTER (WHERE subscription_status = 'canceled' AND updated_at >= NOW() - INTERVAL '30 days')::FLOAT /
            COUNT(*) FILTER (WHERE subscription_tier != 'free' AND created_at <= NOW() - INTERVAL '30 days')::FLOAT * 100
          )
          ELSE 0
        END as churn_rate
      FROM users u
      JOIN subscriptions s ON u.id = s.user_id
    ) metrics
  ) as ltv,
  
  NOW() as last_updated;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW business_metrics_summary; 