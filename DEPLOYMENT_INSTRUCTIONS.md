# Helmwise Deployment Instructions - Railway + Cloudflare

**Platform:** Railway (Backend) + Cloudflare Pages (Frontend)  
**Cost:** $5-20/month total  
**Time:** 1-2 hours  
**Difficulty:** Easy (mostly clicking through dashboards)

---

## Prerequisites

**Accounts Needed:**
- GitHub account (you have this)
- Railway account (free tier: https://railway.app)
- Cloudflare account (free: https://cloudflare.com)
- Supabase account (free: https://supabase.com)

**API Keys Ready:**
- NOAA API key (you have this)
- Supabase URL + keys (you have this)
- Stripe keys (if using payments)

---

## PART 1: Database Migrations (15 minutes)

### Run These in Supabase Dashboard

1. Go to: https://app.supabase.com/project/[your-project]/sql
2. Click "New query"
3. Run each migration:

**Migration 007 - Vessel Profiles:**
```sql
-- Copy all contents from:
-- infrastructure/postgres/migrations/007_vessel_profiles.sql
-- Paste here and click "Run"
```

Verify:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'vessel%' OR table_name LIKE 'checklist%';
-- Should show 6 tables
```

**Migration 008 - User Feedback:**
```sql
-- Copy all contents from:
-- infrastructure/postgres/migrations/008_user_feedback.sql
-- Paste and run
```

Verify:
```sql
SELECT count(*) FROM user_feedback;
-- Should return 0
```

**Migration 009 - Analytics:**
```sql
-- Copy all contents from:
-- infrastructure/postgres/migrations/009_analytics_events.sql
-- Paste and run
```

Verify:
```sql
SELECT count(*) FROM feature_flags;
-- Should return 5
```

---

## PART 2: Deploy Backend to Railway (20 minutes)

### Step 1: Create Railway Project

1. Go to https://railway.app
2. Click "Start a New Project"
3. Sign up/login with GitHub
4. Click "Deploy from GitHub repo"
5. Select `passage_planner` repository
6. Railway will ask what to deploy

**Important:** For the service configuration:
- Name: `helmwise-orchestrator`
- Root Directory: `orchestrator`
- Start Command: `npm run dev` (uses ts-node, avoids build issues)

### Step 2: Add Databases

**Add PostgreSQL:**
1. In Railway project → Click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway auto-creates it
4. Note: You already have Supabase, so you might skip this and use Supabase connection string

**Add Redis:**
1. Click "+ New" → "Database" → "Redis"
2. Railway auto-creates REDIS_URL
3. This is needed for agent caching

### Step 3: Configure Environment Variables

In Railway dashboard → Your orchestrator service → Variables tab:

```bash
# Core Settings
PORT=8080
NODE_ENV=production

# Database (use your Supabase URL)
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_KEY=[your-service-role-key]

# APIs
NOAA_API_KEY=[your-noaa-key]

# CORS (will update after getting Cloudflare URL)
ALLOWED_ORIGINS=https://helmwise.pages.dev,https://helmwise.co

# Redis (auto-provided by Railway if you added Redis database)
REDIS_URL=[auto-filled]
```

### Step 4: Deploy

Railway auto-deploys from GitHub main branch.

1. Wait 3-5 minutes for build
2. Check "Deployments" tab for status
3. Once deployed, click on your service to get the URL
4. **Save this URL** - you'll need it for frontend

**Your Railway URL:** `https://helmwise-production.up.railway.app`

### Step 5: Test Backend

```bash
# Test health endpoint
curl https://[your-railway-url]/health

# Should return:
# {"status":"ok","version":"0.1.0",...}

# Test metrics endpoint
curl https://[your-railway-url]/metrics

# Should return Prometheus format metrics
```

**If health check fails:**
- Check Railway logs for errors
- Verify all environment variables are set
- Check that Redis is running

---

## PART 3: Deploy Frontend to Cloudflare Pages (20 minutes)

### Step 1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com
2. Sign up (free tier is fine)
3. Navigate to "Workers & Pages"

### Step 2: Create Pages Project

1. Click "Create application"
2. Select "Pages" tab
3. Click "Connect to Git"
4. Authorize Cloudflare to access GitHub
5. Select `passage_planner` repository
6. Click "Begin setup"

### Step 3: Configure Build

**Build configuration:**
```
Production branch: main
Framework preset: Next.js
Build command: cd frontend && npm run build
Build output directory: frontend/.next
Root directory: (leave empty)
Node version: 18
```

### Step 4: Add Environment Variables

Click "Environment variables" before deploying:

**Production variables:**
```bash
# Backend connection (use your Railway URL from Part 2)
NEXT_PUBLIC_API_URL=https://[your-railway-url]
NEXT_PUBLIC_WS_URL=wss://[your-railway-url]

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]

# Stripe (if using payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=[your-stripe-pk]

# App URL (will be your Cloudflare URL)
NEXT_PUBLIC_APP_URL=https://helmwise.pages.dev
```

### Step 5: Deploy

1. Click "Save and Deploy"
2. Wait 2-3 minutes for build
3. Watch build logs for any errors
4. Once complete, you'll get a URL like: `https://helmwise.pages.dev`

**Your Cloudflare URL:** `https://helmwise.pages.dev`

### Step 6: Update Railway CORS

Now that you have your Cloudflare URL, go back to Railway:

1. Go to your orchestrator service → Variables
2. Update `ALLOWED_ORIGINS`:
```bash
ALLOWED_ORIGINS=https://helmwise.pages.dev,https://helmwise.co
```

3. Railway will auto-redeploy with new config

---

## PART 4: Test Full Integration (15 minutes)

### Test 1: Frontend Loads

1. Visit your Cloudflare URL: `https://helmwise.pages.dev`
2. Should see landing page
3. Check browser console for errors

### Test 2: Signup Flow

1. Click "Sign Up" or "Start Free Trial"
2. Create test account with your email
3. Check email for Supabase confirmation
4. Confirm email and login

### Test 3: Create Passage

1. Navigate to "Plan Passage" or "/planner"
2. Enter:
   - Departure: Boston, MA
   - Destination: Portland, ME
   - Departure date: Tomorrow
   - Boat type: Sailboat
3. Click "Create Passage Plan"
4. Watch for real-time updates (agent status)
5. Wait for completion (should take 5-30 seconds)

**Expected Results:**
- See agent activity updates
- Get passage plan with distance, duration
- See orange warning text if any warnings
- See recommendations

### Test 4: Export Route

1. In the passage results or passage detail page
2. Look for "Export" button
3. Click Export → GPX
4. File should download: `passage-plan-[id].gpx`
5. Open file in text editor
6. Verify coordinates present (42.36, -71.05, etc.)

### Test 5: Submit Feedback

1. Look for floating feedback button (bottom-right corner)
2. Click it
3. Select "Feature Request"
4. Type test message
5. Submit
6. Should see success message

### Test 6: Check Database

Go to Supabase Dashboard → Table Editor:

```sql
-- Should have entries
SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 5;
SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 5;

-- Should be empty (no errors yet)
SELECT * FROM error_logs;
```

---

## PART 5: Configure Custom Domain (Optional, 15 min)

### Setup helmwise.co

**In Cloudflare Pages:**

1. Go to your Pages project
2. Click "Custom domains"
3. Click "Set up a custom domain"
4. Enter: `helmwise.co`
5. Cloudflare will provide DNS instructions

**Update DNS:**
- Usually a CNAME record pointing to your Pages deployment
- SSL certificate auto-provisions (5-10 minutes)

**For www subdomain:**
- Add `www.helmwise.co` as another custom domain
- Set up redirect from www → apex

---

## Troubleshooting

### Frontend Can't Connect to Backend

**Error:** "Failed to fetch" or CORS errors in console

**Fix:**
1. Verify `NEXT_PUBLIC_API_URL` is set correctly in Cloudflare
2. Verify `ALLOWED_ORIGINS` includes your Cloudflare URL in Railway
3. Check both services are running (green status)

### Backend Not Starting on Railway

**Error:** Service crashes or won't start

**Fix:**
1. Check Railway logs for error messages
2. Verify all environment variables are set
3. Verify Redis is running
4. Check that `npm run dev` is the start command (not `npm start`)

### WebSocket Not Connecting

**Error:** Real-time updates don't work

**Fix:**
1. Verify `NEXT_PUBLIC_WS_URL` uses `wss://` not `ws://`
2. Check Railway allows WebSocket (should by default)
3. Check browser console for WebSocket errors

### Database Connection Issues

**Error:** "Database connection failed"

**Fix:**
1. If using Supabase: Verify connection string includes `?sslmode=require`
2. Check Supabase service is running
3. Verify SERVICE_KEY (not ANON_KEY) is used on backend

---

## Monitoring After Deploy

### First 24 Hours - Check Every 4 Hours

**Railway Logs:**
```
1. Go to Railway → Your service
2. Click "Deployments" → "View logs"
3. Look for errors or crashes
```

**Supabase Tables:**
```sql
-- Check for errors
SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 10;

-- Check user activity
SELECT event_name, count(*) FROM analytics_events 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_name;

-- Check feedback
SELECT * FROM user_feedback ORDER BY created_at DESC;
```

**Metrics Endpoint:**
```bash
curl https://[your-railway-url]/metrics

# Watch for:
# - passage_planning_total (increasing)
# - error rates (should be near 0)
# - agent response times (should be <2s)
```

### First Week - Daily Checks

- Review error_logs table
- Read all user feedback
- Monitor passage creation rate
- Check export success rate
- Verify no safety false negatives

---

## Quick Commands

```bash
# View Railway logs
railway logs --follow

# Check Cloudflare deployment status
wrangler pages deployment list

# Test health endpoint
curl https://[railway-url]/health

# Check metrics
curl https://[railway-url]/metrics

# Manual redeploy Railway
railway up --detach

# Manual redeploy Cloudflare
cd frontend && npx wrangler pages deploy .next
```

---

## What's Deployed

### Backend Services (Railway)
- Orchestrator (coordinating agents)
- Weather Agent (NOAA API)
- Tidal Agent (tidal predictions)
- Route Agent (navigation calculations)
- Safety Agent (grounding prevention, restricted areas)

### Frontend (Cloudflare Pages)
- Landing page
- Signup/login
- Dashboard
- Passage planner with real-time updates
- Export functionality (GPX/KML/CSV)
- Feedback widget
- Admin dashboards

### Database (Supabase)
- User authentication
- Vessel profiles
- Passage storage
- Analytics events
- User feedback
- Error logs
- Feature flags

---

## Expected Costs

**Monthly Operational:**
- Railway: $5-20 (includes Redis, some compute)
- Cloudflare Pages: $0 (free tier, unlimited bandwidth)
- Supabase: $0 (free tier sufficient for beta)
- **Total: $5-20/month**

**As You Scale:**
- Railway scales automatically (pay for usage)
- Cloudflare Pages stays free
- Upgrade Supabase at ~500 users ($25/month)

---

## After Deployment Checklist

- [ ] Frontend loads at Cloudflare URL
- [ ] Backend /health returns 200 OK
- [ ] Can create user account
- [ ] Can plan a passage
- [ ] Safety warnings display
- [ ] Can export to GPX
- [ ] Feedback button works
- [ ] No errors in error_logs table
- [ ] Analytics events recording
- [ ] Metrics endpoint working

---

## Next Steps After Live

**Within 48 Hours:**
1. Test with 3-5 real passages
2. Invite 5-10 beta testers
3. Monitor error logs closely
4. Fix any critical bugs immediately

**Within 2 Weeks:**
1. Collect user feedback
2. Prioritize fixes and features
3. Consider UK Met Office API registration (free)
4. Add any user-requested features

**Ongoing:**
1. Monitor daily for first month
2. Iterate based on real usage
3. Add features users actually want
4. Scale infrastructure as needed

---

## Support

**If you get stuck:**
- Railway docs: https://docs.railway.app
- Cloudflare Pages: https://developers.cloudflare.com/pages
- Supabase: https://supabase.com/docs

**Your code is ready. The tests pass. Deploy with confidence!**


