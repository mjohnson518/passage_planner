# Simple Deployment Guide (ELI5)

## 🎯 Goal
Get your passage planner live on the internet so people can use it!

## 📦 What We're Deploying

1. **Backend (Orchestrator)** → Railway.app
   - The "brain" that coordinates the AI agents
   - Will live at: `https://passage-planner.up.railway.app`

2. **Frontend (Website)** → Cloudflare Pages  
   - The website people see and interact with
   - Will live at: `https://helmwise.pages.dev`

---

## 🚂 Part 1: Deploy Backend to Railway (10 minutes)

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Sign up with GitHub (easiest option)

### Step 2: Create New Project
1. Click "New Project"
2. Choose "Deploy from GitHub repo"
3. Select your `passage_planner` repository
4. Railway will ask "What should we deploy?" 
5. Select the **orchestrator** folder

### Step 3: Add PostgreSQL Database
1. In your Railway project, click "New"
2. Choose "Database" → "PostgreSQL"
3. Railway creates it automatically
4. It will auto-add `DATABASE_URL` to your environment variables

### Step 4: Add Redis
1. Click "New" again
2. Choose "Database" → "Redis"
3. Railway creates it automatically  
4. It will auto-add `REDIS_URL` to your environment variables

### Step 5: Add Environment Variables
1. Click on your orchestrator service
2. Go to "Variables" tab
3. Add these:

```
PORT=8080
NODE_ENV=production
NOAA_API_KEY=your-key-here
OPENWEATHER_API_KEY=your-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

**Where to get API keys:**
- NOAA: Free, register at https://www.ncdc.noaa.gov/cdo-web/token
- OpenWeather: Free tier at https://openweathermap.org/api
- Supabase: Your project at https://supabase.com/dashboard

### Step 6: Deploy!
1. Railway automatically deploys when you push to GitHub
2. Wait 3-5 minutes for build
3. You'll get a URL like `https://passage-planner-production.up.railway.app`
4. Click it to test: `https://your-url.up.railway.app/health`

**✅ Backend is live!**

---

## ☁️ Part 2: Deploy Frontend to Cloudflare Pages (5 minutes)

### Step 1: Create Cloudflare Account
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up (free tier is fine)
3. Verify your email

### Step 2: Create Pages Project
1. Click "Workers & Pages" in the sidebar
2. Click "Create Application"
3. Choose "Pages" tab
4. Click "Connect to Git"
5. Authorize GitHub
6. Select your `passage_planner` repository

### Step 3: Configure Build Settings
When asked for build configuration:

```
Framework preset: Next.js
Build command: cd frontend && npm run build
Build output directory: frontend/.next
Root directory: (leave empty)
```

### Step 4: Add Environment Variables
Before deploying, click "Environment variables":

```
Production:
NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
NEXT_PUBLIC_WS_URL=wss://your-railway-url.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Important:** Use your Railway URL from Part 1!

### Step 5: Deploy!
1. Click "Save and Deploy"
2. Wait 2-3 minutes for build
3. You'll get a URL like `https://passage-planner.pages.dev`

**✅ Frontend is live!**

---

## 🔗 Part 3: Connect Them Together (2 minutes)

### Update Backend CORS
1. Go back to Railway
2. Add frontend URL to environment variables:

```
ALLOWED_ORIGINS=https://passage-planner.pages.dev,https://helmwise.pages.dev
```

### Test the Connection
1. Open your Cloudflare Pages URL
2. Go to `/planner`
3. Fill out the form
4. Click "Plan Passage"
5. Watch the magic happen! ✨

---

## 🎉 You're Done!

Your passage planner is now **live on the internet**!

### What to Share
- **Public URL**: `https://passage-planner.pages.dev`
- **API Health**: `https://your-railway-url.up.railway.app/health`

### How to Update
Just push to GitHub:
```bash
git add .
git commit -m "Update something"
git push
```

Both Railway and Cloudflare auto-deploy on push!

---

## 🆘 If Something Goes Wrong

### Backend won't start on Railway
- Check the logs in Railway dashboard
- Verify all environment variables are set
- Make sure PostgreSQL and Redis are running

### Frontend can't connect to backend
- Check CORS error in browser console
- Verify `NEXT_PUBLIC_API_URL` is correct
- Make sure Railway app is running

### WebSocket not connecting
- Check URL uses `wss://` not `ws://` in production
- Verify Railway allows WebSocket connections (it does by default)
- Check browser console for connection errors

---

## 💰 Costs

- **Railway**: Free tier includes $5/month credit (plenty for testing)
- **Cloudflare Pages**: Completely free (unlimited bandwidth!)
- **Total**: $0-5/month depending on usage

---

**Ready to deploy?** Start with Railway (Part 1) and work through each step. Let me know if you get stuck!

