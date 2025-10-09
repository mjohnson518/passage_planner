# Helmwise User Testing & Feedback - Deployment Guide

## Summary of Enhancements

### Features Implemented

1. **User Feedback System** ✓
   - Floating feedback widget on all pages
   - Bug reports, feature requests, general feedback
   - Context capture (page URL, browser info)
   - Admin review workflow
   - Database storage with RLS security

2. **Analytics & Event Tracking** ✓
   - Privacy-conscious event tracking
   - Key events: passage created, route exported, safety warnings, etc.
   - Session tracking
   - User consent management

3. **Mock Data Generators** ✓
   - Realistic test passages (Boston-Portland, SF-LA, Miami-Keys)
   - Test vessel profiles (sailboat, catamaran, motor yacht)
   - Weather scenarios (calm, moderate, stormy, hurricane)
   - Safety scenarios for testing

4. **Feature Flags** ✓
   - Enable/disable features without deployment
   - Gradual rollout support (percentage-based)
   - Per-user access control
   - Database-driven with caching

---

## Database Migrations

### Run These Migrations In Order

**Migration 1: Vessel Profiles** (if not already run)
```bash
# File: infrastructure/postgres/migrations/007_vessel_profiles.sql
# Supabase Dashboard → SQL Editor → Paste and Run
```

**Migration 2: User Feedback**
```bash
# File: infrastructure/postgres/migrations/008_user_feedback.sql
# Supabase Dashboard → SQL Editor → Paste and Run
```

**Migration 3: Analytics & Feature Flags**
```bash
# File: infrastructure/postgres/migrations/009_analytics_events.sql
# Supabase Dashboard → SQL Editor → Paste and Run
```

### Verification

After running migrations, verify tables created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'vessel_profiles',
  'vessel_maintenance',
  'safety_equipment',
  'checklist_templates',
  'checklist_items',
  'user_feedback',
  'analytics_events',
  'error_logs',
  'feature_flags',
  'performance_metrics',
  'user_onboarding'
);
```

Should return 11 tables.

---

## Environment Variables

### No New Variables Required!

All new features work with existing environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

### Optional (Already Documented)
```bash
# When you receive it
UKMO_API_KEY=your_uk_met_office_key_here
```

---

## Integration Instructions

### 1. Add Feedback Widget to Layout

**File:** `frontend/app/layout.tsx`

```typescript
import { FeedbackWidget } from '@/components/FeedbackWidget';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <FeedbackWidget /> {/* Add this */}
      </body>
    </html>
  );
}
```

### 2. Add Analytics to Key Actions

**Example: After passage creation**
```typescript
import { useAnalytics } from '@/lib/analytics';

function PassagePlanner() {
  const { trackPassageCreated } = useAnalytics();

  const handleCreatePassage = async () => {
    // ...create passage...
    
    await trackPassageCreated({
      distance_nm: 95,
      duration_hours: 16,
      waypoint_count: 4,
      departure_port: 'Boston',
      destination_port: 'Portland',
    });
  };
}
```

### 3. Add Feature Flag Checks

**Example: Conditional feature rendering**
```typescript
import { FeatureFlagsService } from '@passage-planner/shared';

const featureFlags = new FeatureFlagsService(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// In component
const showAdvancedRouting = await featureFlags.isEnabled('advanced-routing', userId);

if (showAdvancedRouting) {
  // Render advanced routing UI
}
```

---

## Testing Instructions

### Critical Test Scenarios

**1. Feedback Widget**
```
Test Steps:
1. Navigate to any page
2. Click floating feedback button (bottom-right)
3. Select "Bug Report"
4. Enter description
5. Submit
6. Verify success message
7. Check Supabase → user_feedback table for entry
```

**2. Analytics Tracking**
```
Test Steps:
1. Create a passage plan
2. Check Supabase → analytics_events table
3. Should see "passage_created" event with properties
4. Export route to GPX
5. Should see "route_exported" event
```

**3. Feature Flags**
```
Test Steps:
1. Check Supabase → feature_flags table
2. Verify default flags inserted
3. Enable 'weather-visualization' flag
4. Verify feature appears in UI
5. Disable flag
6. Verify feature hidden
```

**4. Mock Data Generation**
```typescript
import { mockDataGenerator } from '@passage-planner/shared';

// Generate test passage
const passage = mockDataGenerator.generatePassage();
console.log(passage); // Boston → Portland with waypoints

// Generate test vessel
const vessel = mockDataGenerator.generateVessel();
console.log(vessel); // Sea Sprite, 35ft sailboat

// Generate weather scenario
const weather = mockDataGenerator.generateWeatherScenario(3);
console.log(weather); // Hurricane conditions
```

---

## Admin Access

### View Feedback

**Supabase Dashboard:**
```
1. Go to Supabase Dashboard
2. Table Editor → user_feedback
3. View all submitted feedback
4. Filter by status, type, date
```

**Future:** Admin dashboard at `/admin/feedback` (can be built next)

### View Analytics

**Supabase Dashboard:**
```
1. Go to Supabase Dashboard  
2. Table Editor → analytics_events
3. SQL Editor → Run analytics queries
```

**Example Analytics Queries:**
```sql
-- Daily active users (last 7 days)
SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as daily_users
FROM analytics_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Most popular features
SELECT event_name, COUNT(*) as count
FROM analytics_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY event_name
ORDER BY count DESC
LIMIT 10;

-- Passage creation rate
SELECT COUNT(*) as total_passages
FROM analytics_events
WHERE event_name = 'passage_created'
AND created_at > NOW() - INTERVAL '30 days';
```

---

## Feature Flags Configuration

### Default Flags (Auto-Created by Migration)

| Flag Name | Enabled | Description |
|-----------|---------|-------------|
| `advanced-routing` | No | Multi-criteria route optimization |
| `weather-visualization` | Yes | Animated weather maps |
| `fleet-management` | No | Multi-vessel management |
| `uk-met-office` | No | UK Met Office integration |
| `premium-weather` | No | ECMWF/Windy premium sources |

### Enable a Feature

**Via Supabase Dashboard:**
```sql
UPDATE feature_flags 
SET enabled = true 
WHERE flag_name = 'advanced-routing';
```

### Gradual Rollout

```sql
-- Enable for 25% of users
UPDATE feature_flags 
SET enabled = true, rollout_percentage = 25
WHERE flag_name = 'advanced-routing';

-- Enable for specific users
UPDATE feature_flags 
SET enabled = true, allowed_user_ids = ARRAY['user-id-1', 'user-id-2']
WHERE flag_name = 'advanced-routing';
```

---

## Monitoring Your Launch

### Day 1: Monitor These Metrics

**1. User Signups**
```sql
SELECT COUNT(*) as new_users
FROM auth.users
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**2. Passages Created**
```sql
SELECT COUNT(*) as passages_today
FROM analytics_events
WHERE event_name = 'passage_created'
AND created_at > NOW() - INTERVAL '24 hours';
```

**3. Feedback Submitted**
```sql
SELECT feedback_type, COUNT(*) as count
FROM user_feedback
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY feedback_type;
```

**4. Errors**
```sql
SELECT error_type, COUNT(*) as count
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_type
ORDER BY count DESC;
```

### Week 1: Track These KPIs

- Daily Active Users (DAU)
- Passages Created Per User
- Route Export Rate (% of passages exported)
- Feature Usage Distribution
- Feedback Volume and Sentiment
- Error Rate

---

## What to Watch For

### Red Flags (Act Immediately)

- **High error rate** (>5% of requests) → Check error_logs table
- **No analytics events** → Verify tracking code deployed
- **Feedback all negative** → Review common themes
- **Low passage creation** (<50% of signups) → Onboarding issue

### Green Flags (Celebrate!)

- **Users creating multiple passages** → Core value confirmed
- **High export rate** (>70%) → Users trust the routes
- **Positive feedback** → Feature validation
- **Low error rate** (<1%) → Technical quality good

---

## Quick Wins for User Testing

### Make These Small Improvements for Better Feedback

1. **Add sample data** on first login
   - "Try a sample passage: Boston → Portland"
   - Pre-populate vessel profile
   - Show example checklist

2. **Add contextual help**
   - Tooltips on complex features
   - "What's this?" links to docs
   - Inline examples

3. **Add success confirmations**
   - "Passage plan created successfully!"
   - "Route exported to GPX"
   - "Safety check complete"

4. **Add loading states**
   - "Analyzing weather patterns..."
   - "Checking restricted areas..."
   - "Generating route..."

---

## Files Created

**Database:**
- `infrastructure/postgres/migrations/008_user_feedback.sql` (125 lines)
- `infrastructure/postgres/migrations/009_analytics_events.sql` (145 lines)

**Frontend:**
- `frontend/app/components/FeedbackWidget.tsx` (230 lines)
- `frontend/app/api/feedback/route.ts` (72 lines)
- `frontend/app/lib/analytics.ts` (220 lines)

**Shared:**
- `shared/src/testing/mock-data-generator.ts` (245 lines)
- `shared/src/services/feature-flags.ts` (155 lines)

**Total:** 7 files, ~1,200 lines

---

## Next Development Priorities

Based on user feedback collection, build next:

**High Priority:**
1. Admin dashboard for viewing feedback/analytics
2. Onboarding tour for new users
3. Sample data/demo mode
4. Contextual help system

**Medium Priority:**
1. Performance monitoring dashboard
2. Error reporting dashboard
3. Email notifications for feedback
4. Advanced analytics queries

**Low Priority:**
1. A/B testing framework
2. User behavior funnels
3. Cohort analysis
4. Export analytics data

---

## Success Metrics

After 1 week of user testing, you should have data on:

- **Engagement:** DAU, passages per user, feature usage
- **Quality:** Error rate, feedback sentiment, bug reports
- **Conversion:** Signup → first passage → export rate
- **Retention:** Users returning after first passage

**This data will guide your next development priorities.**

---

**STATUS:** User testing infrastructure READY ✓  
**READY TO:** Deploy and collect real user feedback  
**COST:** $0 additional (uses existing Supabase)

