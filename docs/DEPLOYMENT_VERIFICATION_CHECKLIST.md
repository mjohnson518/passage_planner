# Deployment Verification Checklist

**Deployment:** Fix Production Config (Commit 5a62a05)  
**Date:** October 24, 2025  
**Status:** 🟡 **DEPLOYING** → Railway build in progress

---

## 🚀 DEPLOYMENT STATUS

**Changes Deployed:**
- ✅ Fixed orchestrator/package.json start:prod script
- ✅ Created railway.json with proper build configuration
- ✅ Pushed to origin/main (commit 5a62a05)
- 🟡 Railway automatic deployment triggered

**Expected Result:**
- Orchestrator compiles TypeScript to JavaScript
- Starts using compiled code (not ts-node)
- Service becomes Active on Railway
- API endpoints become accessible

---

## ✅ VERIFICATION STEPS

### Step 1: Check Railway Deployment Status

**Go to:** Railway Dashboard → passage-planner/orchestrator project

**Expected Status Progression:**
1. 🔵 **Building** (0-4 minutes) - npm install + TypeScript compilation
2. 🟡 **Deploying** (4-5 minutes) - Starting service
3. 🟢 **Active** (5+ minutes) - Service running

**Build Logs to Watch For:**
```
✓ Detected Node
✓ Installing dependencies
✓ npm install
✓ npm run build --workspace=@passage-planner/orchestrator
✓ TypeScript compilation successful
✓ Starting application
✓ Server listening on port [PORT]
```

**Red Flags:**
- ❌ "Cannot find module" errors
- ❌ TypeScript compilation errors
- ❌ Service crash loop
- ❌ Build timeout (>10 minutes)

**Action if fails:** Check logs for specific error, fix and redeploy

---

### Step 2: Test Health Endpoint

**Wait for:** Railway status shows "Active" (green)

**Get Railway URL:**
- From Railway dashboard (looks like: `https://passage-plannerorchestrator-production.up.railway.app`)

**Test Command:**
```bash
curl https://[YOUR-RAILWAY-URL]/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-24T...",
  "uptime": 123.45,
  "agents": {
    "route": "connected",
    "weather": "connected",
    "tidal": "connected"
  }
}
```

**Or simpler:**
```json
{
  "status": "healthy"
}
```

**If health check fails:**
- Check if service is actually running (Railway logs)
- Check if /health endpoint exists in code
- Check if port is correct (Railway sets PORT env var)

**Status:** ⬜ Not yet tested (waiting for deployment)

---

### Step 3: Test Passage Planning API

**Endpoint:** `POST /api/passage-planning/analyze`

**Test Command:**
```bash
curl -X POST https://[YOUR-RAILWAY-URL]/api/passage-planning/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "departure": {"lat": 42.3601, "lon": -71.0589, "name": "Boston"},
    "destination": {"lat": 43.6591, "lon": -70.2568, "name": "Portland"},
    "departureDate": "2025-10-25T08:00:00Z",
    "vessel": {
      "name": "Test Vessel",
      "type": "sailboat",
      "draft": 2.0
    }
  }'
```

**Expected Response:**
- HTTP 200 OK
- JSON response with route, weather, tidal data
- Response time: 2-5 seconds

**Expected Structure:**
```json
{
  "route": {
    "distance": "~85nm",
    "waypoints": [...],
    "estimatedDuration": "..."
  },
  "weather": {
    "forecasts": [...],
    "warnings": [...]
  },
  "tidal": {
    "predictions": [...],
    "windows": [...]
  },
  "summary": {
    "recommendations": [...],
    "warnings": [...]
  }
}
```

**If API fails:**
- Check logs for agent initialization errors
- Check if agents are properly instantiated
- Check if external APIs (NOAA) are reachable
- Check environment variables (API keys, URLs)

**Status:** ⬜ Not yet tested (waiting for deployment)

---

### Step 4: Test Frontend Connection

**Go to:** https://helmwise.co/

**Test Workflow:**
1. Open browser dev tools (F12)
2. Go to Network tab
3. Try to create a passage:
   - Departure: Boston
   - Destination: Portland
   - Date: Tomorrow
   - Click "Analyze Route"
4. Watch Network tab for API calls

**Expected Results:**
- ✅ API call to Railway URL appears in Network tab
- ✅ Status: 200 OK
- ✅ Response time: 2-5 seconds
- ✅ Results display on frontend
- ✅ Map shows route
- ✅ Weather/tidal data visible

**Common Issues:**
- ❌ **CORS Error:** Backend not allowing helmwise.co origin
  - Fix: Add CORS middleware to orchestrator
  - `app.use(cors({ origin: 'https://helmwise.co' }))`

- ❌ **Network Error:** Frontend has wrong API URL
  - Check: Cloudflare Pages env var `NEXT_PUBLIC_API_URL`
  - Should be: Railway orchestrator URL

- ❌ **Timeout:** API taking too long
  - Check: Orchestrator performance logs
  - Check: Agent response times

**Status:** ⬜ Not yet tested (waiting for deployment)

---

### Step 5: Monitor for 30 Minutes

**After successful deployment**, monitor for stability:

**Watch:**
- Railway logs for any errors
- Response times (should be <5 seconds)
- Error rate (should be 0%)
- Memory usage (should be stable)

**Test Scenarios:**
- Create multiple passages
- Test different routes (coastal, offshore)
- Test from different locations
- Test on mobile and desktop

**Red Flags:**
- Memory increasing over time (memory leak)
- Response times increasing (performance degradation)
- Intermittent errors (agent failures)
- Service restarts (crash loop)

**Status:** ⬜ Not yet monitored (waiting for deployment)

---

## 🎯 SUCCESS CRITERIA

**ALL must be true:**
- [ ] Railway deployment status: **Active** (green)
- [ ] Health endpoint: Returns 200 OK
- [ ] Passage planning API: Returns valid JSON
- [ ] Frontend: Can create passages successfully
- [ ] Browser console: No CORS errors
- [ ] Response times: <5 seconds
- [ ] No errors in Railway logs
- [ ] Service stable for 30 minutes

**When ALL checked:** ✅ **P0-1 RESOLVED** - Orchestrator deployment fixed!

---

## 📊 DEPLOYMENT RESULTS (To Be Filled)

**Deployment Completion Time:** _____
**First Successful Health Check:** _____
**First Successful API Call:** _____
**First Successful Frontend Test:** _____

**Issues Encountered:**
- _____
- _____

**Fixes Applied:**
- _____
- _____

**Final Status:** ⬜ SUCCESS / ⬜ PARTIAL / ⬜ FAILURE

---

## 🚨 IF DEPLOYMENT FAILS

### Common Failure Scenarios:

**1. TypeScript Compilation Errors**
- Check: Railway build logs for specific errors
- Fix: Address TypeScript errors in code
- Redeploy: Push fix to GitHub

**2. Module Not Found Errors**
- Check: Are all dependencies in package.json?
- Fix: Add missing dependencies
- Redeploy: Push fix to GitHub

**3. Service Won't Start**
- Check: Railway logs for crash reason
- Fix: Address startup error (env vars, port binding, etc.)
- Redeploy: Push fix to GitHub

**4. Build Timeout**
- Check: Build taking >10 minutes?
- Fix: Optimize build process
- Consider: Railway build settings

**5. Environment Variables Missing**
- Check: Railway project settings → Variables
- Fix: Add required environment variables
- Restart: Trigger manual restart in Railway

---

## 📝 NOTES

**Build Configuration Changes:**
- Changed from ts-node (dev tool) to compiled JavaScript (production)
- Added proper Railway build command
- Fixed start:prod script path

**Why This Should Work:**
- TypeScript compilation creates clean JavaScript output
- No runtime TypeScript transpilation overhead
- Standard Node.js execution (faster, more stable)
- Proper dependency resolution in Railway environment

**Expected Performance Improvement:**
- Faster startup time (no ts-node overhead)
- Lower memory usage (no TypeScript compiler in memory)
- Better error messages (compiled code)
- More reliable (production-appropriate setup)

---

**WAITING FOR RAILWAY DEPLOYMENT TO COMPLETE...**

**Check Railway dashboard for build progress.**

