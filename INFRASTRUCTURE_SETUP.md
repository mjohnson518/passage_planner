# Infrastructure Setup Guide

This comprehensive guide covers all the infrastructure setup needed to deploy Passage Planner to production using Cloudflare, Supabase, and DigitalOcean.

## Prerequisites

- Domain name registered
- Credit card for services (most offer free tiers to start)
- GitHub account with the repository
- Local development environment working

## Overview

1. **Cloudflare**: DNS, CDN, SSL, and DDoS protection
2. **Supabase**: Database, authentication, and real-time subscriptions
3. **DigitalOcean**: App Platform for hosting the application
4. **Stripe**: Payment processing (covered separately)
5. **Resend**: Email service (covered separately)

---

## 1. Supabase Setup (Database & Auth)

### Step 1.1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up/login and create a new project
3. Choose a project name: `passage-planner-prod`
4. Set a strong database password (save this!)
5. Select region closest to your users (e.g., `us-east-1`)
6. Wait for project to provision (~2 minutes)

### Step 1.2: Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider:
   - Confirm email: ON
   - Secure email change: ON
   - Secure password change: ON
3. Configure **Email Templates**:
   - Go to **Authentication** → **Email Templates**
   - Customize each template with your branding
   - Example for Confirmation:
   ```html
   <h2>Welcome to Passage Planner!</h2>
   <p>Please confirm your email to start planning your sailing adventures.</p>
   <a href="{{ .ConfirmationURL }}">Confirm Email</a>
   ```

### Step 1.3: Set Up Database Schema

1. Go to **SQL Editor**
2. Run the initialization scripts in order:
   ```sql
   -- Run each file from infrastructure/docker/postgres/
   -- 1. init.sql
   -- 2. auth.sql
   -- 3. billing.sql
   -- 4. analytics.sql
   -- 5. boat-profiles.sql
   ```

### Step 1.4: Configure Row Level Security (RLS)

1. Go to **Authentication** → **Policies**
2. Create policies for each table:
   
   **users table**:
   ```sql
   -- Users can read their own data
   CREATE POLICY "Users can view own profile" ON users
   FOR SELECT USING (auth.uid() = id);
   
   -- Users can update their own data
   CREATE POLICY "Users can update own profile" ON users
   FOR UPDATE USING (auth.uid() = id);
   ```
   
   **passages table**:
   ```sql
   -- Users can CRUD their own passages
   CREATE POLICY "Users can manage own passages" ON passages
   FOR ALL USING (auth.uid() = user_id);
   ```

### Step 1.5: Get API Keys

1. Go to **Settings** → **API**
2. Copy and save:
   - Project URL: `https://[PROJECT_ID].supabase.co`
   - Anon/Public key: `eyJhbGc...` (safe for frontend)
   - Service role key: `eyJhbGc...` (backend only!)

### Step 1.6: Configure Storage Buckets

1. Go to **Storage**
2. Create buckets:
   - `avatars` (public)
   - `passage-exports` (private)
3. Set policies for each bucket

---

## 2. DigitalOcean App Platform Setup

### Step 2.1: Create DigitalOcean Account

1. Sign up at [https://digitalocean.com](https://digitalocean.com)
2. Add payment method
3. Create a new project: `passage-planner`

### Step 2.2: Create App

1. Go to **App Platform**
2. Click **Create App**
3. Choose **GitHub** as source
4. Authorize and select your repository
5. Choose branch: `main`

### Step 2.3: Configure App Components

**Frontend Component**:
- **Name**: `frontend`
- **Type**: Static Site
- **Build Command**: `cd passage-planner/frontend && npm install && npm run build`
- **Output Directory**: `passage-planner/frontend/.next`
- **Environment Variables**:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
  NEXT_PUBLIC_APP_URL=https://passageplanner.com
  ```

**Orchestrator Component**:
- **Name**: `orchestrator`
- **Type**: Web Service
- **Build Command**: `cd passage-planner && npm install && npm run build`
- **Run Command**: `cd passage-planner && npm run start:orchestrator`
- **HTTP Port**: 8080
- **Environment Variables**:
  ```
  NODE_ENV=production
  PORT=8080
  DATABASE_URL=postgresql://...
  SUPABASE_URL=https://[PROJECT_ID].supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
  REDIS_URL=redis://...
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  RESEND_API_KEY=re_...
  ```

**Redis Component**:
- **Name**: `redis`
- **Type**: Add-on
- Choose **Redis** from marketplace
- Select plan (Dev plan is free)

### Step 2.4: Configure Agents

For each agent (weather, tidal, port, etc.):
1. Add as a **Worker** component
2. Set build/run commands appropriately
3. Configure environment variables
4. Set resource limits

### Step 2.5: Configure Domains

1. Go to **Settings** → **Domains**
2. Add your domain: `passageplanner.com`
3. You'll get DNS records to add to Cloudflare

---

## 3. Cloudflare Setup (CDN & Security)

### Step 3.1: Add Site to Cloudflare

1. Sign up at [https://cloudflare.com](https://cloudflare.com)
2. Add your site: `passageplanner.com`
3. Choose the **Free** plan (upgrade later if needed)
4. Cloudflare will scan existing DNS records

### Step 3.2: Update Nameservers

1. Go to your domain registrar
2. Update nameservers to Cloudflare's:
   - `adam.ns.cloudflare.com`
   - `tina.ns.cloudflare.com`
3. Wait for propagation (5 mins - 24 hours)

### Step 3.3: Configure DNS Records

Add these DNS records in Cloudflare:

```
Type  Name    Content                     Proxy Status
A     @       [DigitalOcean IP]          Proxied
A     www     [DigitalOcean IP]          Proxied
CNAME api     [app-name].ondigitalocean.app  Proxied
TXT   @       "v=spf1 include:_spf.resend.com ~all"
TXT   _dmarc  "v=DMARC1; p=none;"
```

### Step 3.4: Configure SSL/TLS

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to **Full (strict)**
3. Go to **Edge Certificates**
4. Enable:
   - Always Use HTTPS
   - Automatic HTTPS Rewrites
   - Minimum TLS Version: 1.2

### Step 3.5: Configure Security

1. **Firewall** → **Firewall Rules**:
   ```
   Rule 1: Block Bad Bots
   - User Agent contains "bot" AND 
   - NOT Known Bots
   - Action: Block
   
   Rule 2: Rate Limiting API
   - URI Path contains "/api/"
   - Rate: 100 requests per minute
   - Action: Challenge
   ```

2. **Security** → **Bots**:
   - Enable Bot Fight Mode

3. **DDoS** → **DDoS Protection**:
   - Sensitivity: High

### Step 3.6: Configure Performance

1. **Speed** → **Optimization**:
   - Auto Minify: ON for all
   - Brotli: ON
   - Rocket Loader: OFF (can break React)
   - Mirage: ON
   - Polish: Lossy

2. **Caching** → **Configuration**:
   - Caching Level: Standard
   - Browser Cache TTL: 4 hours
   - Always Online: ON

### Step 3.7: Page Rules

Create these page rules:

1. `*passageplanner.com/api/*`
   - Cache Level: Bypass
   - Disable Performance

2. `*passageplanner.com/_next/static/*`
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month

3. `*passageplanner.com/images/*`
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   - Polish: Lossy
   - WebP: ON

---

## 4. Environment Configuration

### Step 4.1: Local Development (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
ORCHESTRATOR_URL=http://localhost:8080

# Stripe (test keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend
RESEND_API_KEY=re_...

# Redis
REDIS_URL=redis://localhost:6379
```

### Step 4.2: Production Environment

In DigitalOcean App Platform, set all production values:
- Use live Stripe keys
- Use production URLs
- Set `NODE_ENV=production`

---

## 5. Database Migrations

### Step 5.1: Set Up Migration System

1. Install migration tool:
   ```bash
   npm install -g supabase
   ```

2. Initialize migrations:
   ```bash
   supabase init
   supabase db remote set postgresql://[CONNECTION_STRING]
   ```

### Step 5.2: Create Migration Files

```bash
supabase migration new add_fleet_management
```

### Step 5.3: Run Migrations

```bash
# Development
supabase db push

# Production
supabase db push --db-url postgresql://[PROD_CONNECTION_STRING]
```

---

## 6. Monitoring & Alerts

### Step 6.1: DigitalOcean Monitoring

1. Go to **Insights** in App Platform
2. Set up alerts for:
   - CPU usage > 80%
   - Memory usage > 80%
   - Error rate > 1%
   - Response time > 1s

### Step 6.2: Cloudflare Analytics

1. Go to **Analytics** → **Traffic**
2. Monitor:
   - Unique visitors
   - Bandwidth usage
   - Cache hit rate
   - Threat blocked

### Step 6.3: Supabase Monitoring

1. Go to **Reports** in Supabase
2. Monitor:
   - Database size
   - API requests
   - Auth events
   - Realtime connections

### Step 6.4: External Monitoring

Set up [UptimeRobot](https://uptimerobot.com) or similar:
1. Monitor `https://passageplanner.com`
2. Monitor `https://api.passageplanner.com/health`
3. Set up email/SMS alerts

---

## 7. Backup Strategy

### Step 7.1: Database Backups

1. Supabase automatically backs up daily
2. For additional backups:
   ```bash
   # Create manual backup
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   
   # Upload to S3/DigitalOcean Spaces
   aws s3 cp backup_*.sql s3://passage-planner-backups/
   ```

### Step 7.2: Code Backups

- GitHub already serves as code backup
- Consider enabling GitHub's archive feature

---

## 8. Security Checklist

- [ ] All secrets in environment variables
- [ ] Supabase RLS policies enabled
- [ ] HTTPS enforced everywhere
- [ ] API rate limiting configured
- [ ] DDoS protection enabled
- [ ] Regular security updates scheduled
- [ ] Penetration testing planned
- [ ] GDPR compliance verified
- [ ] Privacy policy and ToS published
- [ ] Cookie consent implemented

---

## 9. Launch Checklist

### Pre-Launch
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] SSL certificates active
- [ ] Monitoring configured
- [ ] Backups tested
- [ ] Load testing completed
- [ ] Security scan passed

### Launch Day
- [ ] Switch DNS to production
- [ ] Monitor error logs
- [ ] Check all critical paths
- [ ] Verify payments working
- [ ] Send test emails
- [ ] Monitor performance

### Post-Launch
- [ ] Daily monitoring routine
- [ ] Weekly backup verification
- [ ] Monthly security updates
- [ ] Quarterly performance review

---

## 10. Scaling Considerations

### When to Scale

Monitor these metrics:
- Response time > 500ms consistently
- CPU usage > 70% sustained
- Memory usage > 80%
- Database connections > 80% of limit

### How to Scale

1. **Vertical Scaling** (DigitalOcean):
   - Upgrade to larger containers
   - Add more RAM/CPU

2. **Horizontal Scaling**:
   - Add more orchestrator instances
   - Use DigitalOcean Load Balancer
   - Implement database read replicas

3. **Edge Scaling** (Cloudflare):
   - Enable Argo Smart Routing
   - Use Workers for edge compute
   - Implement aggressive caching

---

## Support & Troubleshooting

### Common Issues

1. **CORS Errors**:
   - Add domain to Supabase allowed origins
   - Configure Next.js headers

2. **Database Connection Issues**:
   - Check connection pooling settings
   - Verify SSL requirements

3. **Slow Performance**:
   - Check Cloudflare cache hit rate
   - Review database queries
   - Enable APM monitoring

### Getting Help

- DigitalOcean Support: [https://digitalocean.com/support](https://digitalocean.com/support)
- Cloudflare Support: [https://support.cloudflare.com](https://support.cloudflare.com)
- Supabase Support: [https://supabase.com/support](https://supabase.com/support)

---

## Cost Estimation

### Monthly Costs (Production)

- **Cloudflare Free**: $0
- **Supabase Free Tier**: $0 (up to 500MB database)
- **Supabase Pro** (when needed): $25/month
- **DigitalOcean App Platform**: ~$50-100/month
  - Frontend: $0 (static hosting)
  - Orchestrator: $12/month (512MB instance)
  - Redis: $15/month
  - Each agent: $7/month
- **Total**: ~$50-150/month depending on scale

### Cost Optimization Tips

1. Use Cloudflare caching aggressively
2. Optimize database queries
3. Use DigitalOcean's autoscaling
4. Monitor and remove unused resources
5. Use reserved instances for discounts 