-- Supplemental analytics schema from tech spec

CREATE TABLE IF NOT EXISTS revenue_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  mrr NUMERIC(10,2) NOT NULL DEFAULT 0,
  arr NUMERIC(10,2) NOT NULL DEFAULT 0,
  new_mrr NUMERIC(10,2) NOT NULL DEFAULT 0,
  churned_mrr NUMERIC(10,2) NOT NULL DEFAULT 0,
  expansion_mrr NUMERIC(10,2) NOT NULL DEFAULT 0,
  contraction_mrr NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_customers INTEGER NOT NULL DEFAULT 0,
  new_customers INTEGER NOT NULL DEFAULT 0,
  churned_customers INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  cohort_month DATE NOT NULL,
  acquisition_channel TEXT,
  initial_plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  first_used_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_name)
);

CREATE TABLE IF NOT EXISTS funnel_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  funnel_name TEXT NOT NULL,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  properties JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_metrics_date ON revenue_metrics(date);
CREATE INDEX IF NOT EXISTS idx_user_cohorts_month ON user_cohorts(cohort_month);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature ON feature_usage(feature_name);
CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel ON funnel_events(funnel_name);

CREATE OR REPLACE FUNCTION update_daily_revenue_metrics()
RETURNS void AS $$
BEGIN
  INSERT INTO revenue_metrics (
    date, mrr, arr, new_mrr, churned_mrr,
    total_customers, new_customers, churned_customers
  )
  SELECT
    CURRENT_DATE,
    SUM(CASE WHEN subscription_tier = 'premium' THEN 19
             WHEN subscription_tier = 'pro' THEN 49 ELSE 0 END),
    SUM(CASE WHEN subscription_tier = 'premium' THEN 19*12
             WHEN subscription_tier = 'pro' THEN 49*12 ELSE 0 END),
    SUM(CASE WHEN subscription_tier != 'free' AND DATE(created_at) = CURRENT_DATE
             THEN CASE WHEN subscription_tier = 'premium' THEN 19 ELSE 49 END ELSE 0 END),
    SUM(CASE WHEN subscription_status = 'canceled' AND DATE(updated_at) = CURRENT_DATE
             THEN CASE WHEN subscription_tier = 'premium' THEN 19 ELSE 49 END ELSE 0 END),
    COUNT(*) FILTER (WHERE subscription_tier != 'free'),
    COUNT(*) FILTER (WHERE subscription_tier != 'free' AND DATE(created_at) = CURRENT_DATE),
    COUNT(*) FILTER (WHERE subscription_status = 'canceled' AND DATE(updated_at) = CURRENT_DATE)
  FROM profiles
  ON CONFLICT (date) DO UPDATE SET
    mrr = EXCLUDED.mrr,
    arr = EXCLUDED.arr,
    new_mrr = EXCLUDED.new_mrr,
    churned_mrr = EXCLUDED.churned_mrr,
    total_customers = EXCLUDED.total_customers,
    new_customers = EXCLUDED.new_customers,
    churned_customers = EXCLUDED.churned_customers,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule('update-daily-revenue-metrics', '0 1 * * *', 'SELECT update_daily_revenue_metrics();');

