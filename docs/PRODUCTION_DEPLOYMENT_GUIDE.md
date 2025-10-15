# Helmwise Production Deployment Guide

**Last Updated:** October 15, 2025  
**Version:** 1.0.0  
**Status:** Build configuration fixes needed before deployment

---

## Deployment Readiness Status

### ✓ READY (Verified)
- [✓] 246 comprehensive tests passing
- [✓] All critical safety paths tested
- [✓] Code committed and pushed (7 commits)
- [✓] Frontend UI complete (95%)
- [✓] Backend services tested
- [✓] Database migrations ready
- [✓] User testing infrastructure ready
- [✓] Documentation comprehensive

### ⚠ NEEDS FIXING (Before Deploy)
- [⚠] TypeScript build configuration (agents)
- [⚠] Frontend build (missing chart components)
- [⚠] Import path resolution

**Estimated Fix Time:** 1-2 hours

---

## Pre-Deployment Fixes Required

### Fix 1: Agent TypeScript Configuration (30 min)

**Issue:** Agents can't import from shared module due to rootDir settings

**Solution A - Update tsconfig.json for each agent:**
```json
// agents/safety/tsconfig.json
{
  "compilerOptions": {
    "rootDir": "../../",  // Change from "./src"
    "outDir": "./dist",
    // ... rest of config
  }
}
```

**Solution B - Use TypeScript project references:**
```json
// agents/safety/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    // ...
  },
  "references": [
    { "path": "../../shared" }
  ]
}
```

**Files to fix:**
- `agents/safety/tsconfig.json`
- `agents/weather/tsconfig.json`
- `agents/route/tsconfig.json`
- `agents/tidal/tsconfig.json`

### Fix 2: Add Missing Dependencies (5 min)

```bash
# Add @types/cron
cd agents/route && npm install --save-dev @types/cron
cd agents/tidal && npm install --save-dev @types/cron
```

### Fix 3: Frontend Chart Components (15 min)

Create stub components or remove imports:

```bash
# Option A: Create stubs
mkdir -p frontend/app/components/charts
touch frontend/app/components/charts/WeatherChart.tsx
touch frontend/app/components/charts/TideChart.tsx

# Option B: Remove imports from performance.ts
# Comment out chart imports until charts are built
```

### Fix 4: Fix Import Paths (10 min)

Verify all imports use consistent path aliasing:
- `@/lib/` for app/lib
- `@/components/` for app/components
- OR relative paths consistently

**After fixes, verify build:**
```bash
npm run build
# Should complete without errors
```

---

## Deployment Architecture

### Recommended Stack

**Frontend:** Cloudflare Pages (Next.js)
- Cost: FREE
- Auto-deploy from Git
- Global CDN
- Unlimited bandwidth

**Backend:** Railway (Node.js)
- Cost: $5-20/month
- Includes PostgreSQL + Redis
- Auto-deploy from Git
- Easy scaling

**Database:** Supabase
- Cost: FREE tier sufficient for beta
- PostgreSQL with auth
- Real-time subscriptions
- Row-level security

**Total Cost:** $5-20/month

---

## Step-by-Step Deployment Process

### PHASE 1: Fix Build Issues (1-2 hours)

Follow fixes above, then:
```bash
# Verify build works
npm run build

# Verify all tests still pass
npm test

# Commit fixes
git add -A
git commit -m "Fix production build config"
git push origin main
```

### PHASE 2: Database Migrations (15 minutes)

**Supabase Dashboard** (https://app.supabase.com):

1. Navigate to SQL Editor
2. Create new query

3. **Run Migration 007:**
```sql
-- Copy entire contents of:
-- infrastructure/postgres/migrations/007_vessel_profiles.sql
-- Paste and run
```

Verify:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'vessel%' OR table_name LIKE 'checklist%';
-- Should return 6 tables
```

4. **Run Migration 008:**
```sql
-- Copy entire contents of:
-- infrastructure/postgres/migrations/008_user_feedback.sql
-- Paste and run
```

Verify:
```sql
SELECT count(*) FROM user_feedback;
-- Should return 0 (empty but exists)
```

5. **Run Migration 009:**
```sql
-- Copy entire contents of:
-- infrastructure/postgres/migrations/009_analytics_events.sql
-- Paste and run
```

Verify:
```sql
SELECT count(*) FROM feature_flags;
-- Should return 5 (default flags inserted)
```

### PHASE 3: Deploy Backend to Railway (20 minutes)

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub
   - Authorize Railway to access your repos

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `passage_planner` repository
   - Select `orchestrator` as root directory

3. **Add PostgreSQL**
   - In Railway project → Click "+ New"
   - Select "Database" → "PostgreSQL"
   - Railway auto-creates DATABASE_URL

4. **Add Redis**
   - Click "+ New" → "Database" → "Redis"
   - Railway auto-creates REDIS_URL

5. **Configure Environment Variables**

In Railway dashboard → Variables tab:
```bash
PORT=8080
NODE_ENV=production
NOAA_API_KEY=[your-noaa-key]
SUPABASE_URL=[your-supabase-url]
SUPABASE_SERVICE_KEY=[your-service-key]
ALLOWED_ORIGINS=https://helmwise.pages.dev,https://helmwise.co
```

6. **Deploy**
   - Railway auto-deploys on Git push
   - Monitor build logs
   - Wait for "Deployed" status (3-5 min)

7. **Get Railway URL**
   - Copy your Railway URL (e.g., `helmwise-production.up.railway.app`)
   - Save for frontend configuration

8. **Test Health Endpoint:**
```bash
curl https://[your-railway-url]/health
# Expected: {"status":"ok",...}

curl https://[your-railway-url]/metrics
# Expected: Prometheus metrics
```

### PHASE 4: Deploy Frontend to Cloudflare Pages (20 minutes)

1. **Create Cloudflare Account**
   - Go to https://dash.cloudflare.com
   - Sign up if needed
   - Navigate to "Workers & Pages"

2. **Create Pages Project**
   - Click "Create Application" → "Pages"
   - Click "Connect to Git"
   - Authorize Cloudflare to access GitHub
   - Select `passage_planner` repository

3. **Configure Build Settings**
```
Framework preset: Next.js
Build command: cd frontend && npm run build
Build output directory: frontend/.next
Root directory: (leave empty)
Node version: 18.x
```

4. **Add Environment Variables**

In Cloudflare → Environment Variables (Production):
```bash
NEXT_PUBLIC_API_URL=https://[your-railway-url]
NEXT_PUBLIC_WS_URL=wss://[your-railway-url]
NEXT_PUBLIC_SUPABASE_URL=[your-supabase-url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=[your-stripe-key]
NEXT_PUBLIC_APP_URL=https://helmwise.pages.dev
```

5. **Deploy**
   - Click "Save and Deploy"
   - Monitor build logs
   - Wait for "Success" status (2-3 min)

6. **Get Cloudflare URL**
   - Your site: `https://[project-name].pages.dev`
   - Will auto-update from Git pushes

### PHASE 5: Configure Custom Domain (Optional, 15 min)

**For helmwise.co:**

1. In Cloudflare Pages → Custom domains
2. Add `helmwise.co` and `www.helmwise.co`
3. Update DNS records as instructed
4. Wait for SSL certificate (auto, ~5 min)

---

## Post-Deployment Verification

### Test Core Functionality

**1. Frontend Loads:**
```bash
curl -I https://[your-cloudflare-url]
# Should return 200 OK
```

**2. Backend Responds:**
```bash
curl https://[your-railway-url]/health
# Should return {"status":"ok"}
```

**3. Full User Journey:**
- Visit your Cloudflare URL
- Sign up with test account
- Plan a passage (Boston → Portland)
- Verify warnings display
- Export to GPX
- Submit feedback

**4. Database Check:**
```sql
-- In Supabase
SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 5;
SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 5;
SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 5;
```

---

## Monitoring Setup

### Metrics Endpoint

Visit: `https://[your-railway-url]/metrics`

You'll see:
```
passage_planning_total 0
agent_requests_total{agent="weather"} 0
safety_warnings_total 0
```

### Error Logging

Check Supabase → `error_logs` table daily for first week.

### User Feedback

Check Supabase → `user_feedback` table daily for first week.

---

## Known Build Issues & Workarounds

### Issue: Agent TypeScript Compilation

**Problem:** Agents can't compile due to shared module imports

**Workaround for Deployment:**
- Tests pass (use test environment)
- Deploy agents without TypeScript compilation
- Use ts-node in production temporarily
- OR fix tsconfig (recommended, 30 min)

### Issue: Frontend Missing Charts

**Problem:** WeatherChart and TideChart components don't exist yet

**Workaround:**
- Remove chart imports temporarily
- Deploy without charts
- Add charts post-launch

---

## Rollback Procedure

**If Critical Issues Found:**

1. **Railway:** 
   - Go to Deployments tab
   - Click previous deployment
   - Click "Redeploy"

2. **Cloudflare:**
   - Go to Deployments
   - Select previous deployment
   - Click "Rollback to this deployment"

3. **Database:**
   - If migrations cause issues:
   ```sql
   -- Reverse order
   DROP TABLE user_onboarding;
   DROP TABLE performance_metrics;
   -- etc.
   ```

---

## Cost Breakdown

**Monthly Operational Costs:**
- Railway (backend): $5-20/month
- Cloudflare Pages (frontend): FREE
- Supabase (database): FREE tier
- External APIs: FREE (NOAA, UK Met Office free tiers)

**Total:** $5-20/month

---

## Support & Resources

**Documentation:**
- This guide: `docs/PRODUCTION_DEPLOYMENT_GUIDE.md`
- Launch decision: `docs/LAUNCH_DECISION_REPORT.md`
- Testing: Test files in each agent
- Integration guides: `docs/integrations/`

**External Services:**
- Railway: https://railway.app/help
- Cloudflare: https://developers.cloudflare.com/pages
- Supabase: https://supabase.com/docs

**Emergency:**
- Rollback: See procedure above
- Database backup: Supabase auto-backup
- Code backup: GitHub (all commits)

---

## Next Steps

**Immediate (Before Deploy):**
1. Fix TypeScript build configs (1-2 hours)
2. Test builds locally: `npm run build`
3. Verify no compilation errors

**Then Deploy (1 hour):**
1. Run database migrations
2. Deploy backend to Railway
3. Deploy frontend to Cloudflare
4. Verify functionality

**Post-Deploy (Ongoing):**
1. Monitor error_logs table
2. Check user_feedback daily
3. Watch analytics for usage patterns
4. Fix any issues within 24 hours
5. Iterate based on real user feedback

---

**Current Status:** READY except for build config fixes  
**Time to Deploy:** 2-3 hours (including fixes)  
**Confidence:** 90% after fixes applied


