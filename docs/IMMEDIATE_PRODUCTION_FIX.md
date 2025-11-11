# IMMEDIATE PRODUCTION FIX - Orchestrator Deployment

**Date:** October 24, 2025  
**Priority:** 🚨 **P0 CRITICAL - SERVICE DOWN**  
**Estimated Fix Time:** 30 minutes

---

## 🎯 ROOT CAUSE IDENTIFIED

**Problem:** Line 10 in `orchestrator/package.json`:

```json
"start:prod": "node -r ts-node/register src/index.ts"
```

This is trying to run TypeScript directly with `ts-node` in production, which:
1. ❌ Requires source files (src/) not just compiled files
2. ❌ Slow (interprets TypeScript at runtime)
3. ❌ Not recommended for production
4. ❌ May be causing Railway deployment failure

**Railway is also skipping the build step** (screenshot shows: `echo "Skipping build - using ts-node"`)

---

## 🔧 IMMEDIATE FIX (30 Minutes)

### Step 1: Fix package.json Scripts (5 minutes)

**File:** `orchestrator/package.json`

**Change line 10 from:**
```json
"start:prod": "node -r ts-node/register src/index.ts",
```

**To:**
```json
"start:prod": "node dist/index.js",
```

**Verification:**
```bash
cd orchestrator
cat package.json | grep "start:prod"
# Should show: "start:prod": "node dist/index.js",
```

---

### Step 2: Test Build Locally (10 minutes)

**Run build and verify it works:**

```bash
cd /Users/marcjohnson/Desktop/MJ2/Stuff/MJ_Info/Projects/sail/passage-planner/orchestrator

# Clean any existing build
rm -rf dist/

# Build TypeScript
npm run build

# Verify dist/ directory created
ls -la dist/

# Should see:
# - index.js
# - index.js.map
# - (other compiled .js files)
```

**If build fails:**
- Note the specific TypeScript errors
- Fix compilation errors first
- Re-run `npm run build` until it succeeds

**Common build errors:**
- Missing type definitions (@types/*)
- Import path issues
- Type mismatches

---

### Step 3: Test Compiled Code Runs (5 minutes)

**Test the compiled JavaScript locally:**

```bash
cd orchestrator

# Set minimal environment variables for testing
export NODE_ENV=development
export PORT=3000

# Run compiled code
npm run start:prod

# Should see:
# - Server starting on port 3000
# - Agent initialization messages
# - "Orchestrator ready" or similar
```

**If it crashes:**
- Check error messages
- Fix any runtime issues
- Re-build and test again

**Press Ctrl+C to stop after verifying it starts**

---

### Step 4: Create Railway Configuration (5 minutes)

**Create file:** `railway.json` (in repository root)

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build --workspace=@passage-planner/orchestrator"
  },
  "deploy": {
    "startCommand": "npm run start:prod --workspace=@passage-planner/orchestrator",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**This configuration:**
- ✅ Actually builds TypeScript (`npm run build`)
- ✅ Runs compiled JavaScript (`npm run start:prod`)
- ✅ Uses workspace command for monorepo
- ✅ Adds restart policy for resilience

---

### Step 5: Commit and Deploy (5 minutes)

```bash
cd /Users/marcjohnson/Desktop/MJ2/Stuff/MJ_Info/Projects/sail/passage-planner

# Stage changes
git add orchestrator/package.json
git add railway.json

# Commit with clear message
git commit -m "Fix orchestrator production deployment"

# Push to trigger Railway deployment
git push origin main
```

**Railway will automatically:**
1. Detect the push
2. Run the new build command
3. Build TypeScript to JavaScript
4. Start orchestrator with compiled code
5. Show deployment status in Railway dashboard

---

## ✅ VERIFICATION STEPS

### 1. Check Railway Deployment Status (2-3 minutes)

**Go to Railway dashboard:**
- Watch deployment logs in real-time
- Build should succeed in 3-5 minutes
- Status should change from "Building" → "Deploying" → "Active"

**Look for in logs:**
```
✓ Detected Node
✓ Installing dependencies
✓ npm run build
✓ TypeScript compilation successful
✓ Starting application
✓ Server listening on port 3000
```

---

### 2. Test Health Endpoint (1 minute)

**Get your Railway URL** (from Railway dashboard, looks like):
```
https://passage-plannerorchestrator-production.up.railway.app
```

**Test health check:**
```bash
curl https://passage-plannerorchestrator-production.up.railway.app/health
```

**Expected response:**
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

---

### 3. Test Passage Planning Endpoint (2 minutes)

**Test the actual API:**
```bash
curl -X POST https://passage-plannerorchestrator-production.up.railway.app/api/passage-planning/analyze \
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

**Expected:** JSON response with route, weather, tidal data, and safety analysis

**If it fails:** Check Railway logs for specific error messages

---

### 4. Test Frontend Connection (2 minutes)

**Visit:** https://helmwise.co/

**Try to:**
1. Log in (if auth working)
2. Create a new passage
3. Enter departure: Boston
4. Enter destination: Portland
5. Click "Analyze Route"

**Expected:**
- Loading indicator appears
- Results display after 2-5 seconds
- Map shows route
- Weather/tidal data visible
- Safety recommendations displayed

**If it fails:**
- Check browser console for errors (F12)
- Look for CORS errors
- Check network tab for failed API calls

---

## 🚨 IF IT STILL DOESN'T WORK

### Build Fails with TypeScript Errors

**Most likely:** NOAA test type issues (known from Week 2)

**Quick fix:** Temporarily exclude test files from build

**Update `orchestrator/tsconfig.json`:**
```json
{
  "compilerOptions": {
    // ... existing options
  },
  "exclude": [
    "node_modules",
    "**/__tests__/**",
    "**/*.test.ts",
    "../shared/src/**/__tests__/**",
    "../shared/src/**/*.test.ts"
  ]
}
```

Then rebuild and redeploy.

---

### Orchestrator Crashes on Startup

**Check Railway logs for error message.**

**Common issues:**

**1. Missing Environment Variables**

Required:
```
NODE_ENV=production
PORT=(Railway sets this automatically)
```

Optional but recommended:
```
REDIS_URL=(if using Redis)
DATABASE_URL=(if using database)
CORS_ORIGIN=https://helmwise.co
```

**2. Agent Initialization Failures**

If agents aren't starting:
- Check agent URLs are correct
- Verify agents can be reached from orchestrator
- May need to deploy agents separately

**3. Port Binding Issues**

Ensure orchestrator binds to Railway's PORT:
```typescript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

---

### Frontend Still Can't Connect

**1. Check CORS Configuration**

In orchestrator, ensure CORS allows helmwise.co:

```typescript
import cors from 'cors';

app.use(cors({
  origin: ['https://helmwise.co', 'http://localhost:3000'],
  credentials: true
}));
```

**2. Check Frontend API URL**

In Cloudflare Pages environment variables:
```
NEXT_PUBLIC_API_URL=https://passage-plannerorchestrator-production.up.railway.app
```

**3. Rebuild Frontend**

If env var changed, trigger Cloudflare Pages rebuild.

---

## 📋 CHECKLIST

**Before deploying:**
- [ ] `orchestrator/package.json` start:prod fixed
- [ ] Local build succeeds (`npm run build`)
- [ ] Compiled code runs locally (`npm run start:prod`)
- [ ] `railway.json` created with proper config
- [ ] Changes committed and pushed

**After deploying:**
- [ ] Railway deployment succeeds (green check)
- [ ] Orchestrator shows "Active" status
- [ ] Health endpoint responds correctly
- [ ] Passage planning API works
- [ ] Frontend can connect to backend
- [ ] No CORS errors in browser console

---

## ⏱️ TIMELINE

**Total estimated time: 30 minutes**

- Step 1 (Fix package.json): 5 min
- Step 2 (Test build locally): 10 min
- Step 3 (Test compiled code): 5 min
- Step 4 (Create railway.json): 5 min
- Step 5 (Commit and deploy): 5 min
- Verification: 5-10 min

**Railway deployment time: 3-5 minutes**

---

## 🎯 SUCCESS CRITERIA

✅ Railway deployment status: **Active (green)**  
✅ Health endpoint: **Returns 200 OK**  
✅ API endpoint: **Returns valid JSON**  
✅ Frontend: **Can create passages**  
✅ No CORS errors  
✅ Orchestrator logs: **No startup errors**

---

## 📞 NEXT STEPS AFTER FIX

1. **Monitor for 30 minutes** - Watch Railway logs for any issues
2. **Test all features** - Create passages, check weather, verify safety warnings
3. **Set up monitoring** - Add UptimeRobot, Sentry, etc. (P2-1, P2-2)
4. **Address P1 issues** - Build performance, frontend config, etc.
5. **Gather user feedback** - See how real users interact with the system

---

## 🔍 ROOT CAUSE ANALYSIS

**Why did this happen?**

1. **Development convenience vs production readiness**: ts-node is great for development (no build step) but inappropriate for production
2. **Build command was literally skipping build**: Railway config said "echo 'Skipping build'"
3. **No CI/CD validation**: Deployment went straight to production without testing the build process
4. **Missing railway.json**: No explicit Railway configuration file

**Lessons learned:**
- Always test production build locally before deploying
- Use proper build → deploy workflow
- Don't use ts-node in production
- Create explicit deployment configuration files
- Add CI/CD pipeline for validation

---

## 🚀 DEPLOY THE FIX NOW

**This is the single most critical issue blocking the entire application.**

**Every minute the orchestrator is down, the entire Helmwise platform is non-functional.**

**Priority: DROP EVERYTHING AND FIX THIS IMMEDIATELY.**

---

**After you complete this fix, the application should be fully functional and you can move on to P1 and P2 issues.**

