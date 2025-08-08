# Infrastructure Setup Guide

This comprehensive guide covers all the infrastructure setup needed to deploy Passage Planner to production using Cloudflare, Supabase, and either DigitalOcean App Platform or Kubernetes.

## Prerequisites

- Domain name registered (helmwise.co). Optional: secondary domain (helmwise.xyz) for redirects
- Credit card for services (most offer free tiers to start)
- GitHub account with the repository
- Local development environment working
- Docker Desktop installed (for local testing)
- kubectl installed (if using Kubernetes)

## Overview

1. **Cloudflare**: DNS, CDN, SSL, WAF, and DDoS protection
2. **Supabase**: Database, authentication, and real-time subscriptions
3. **DigitalOcean/Kubernetes**: Application hosting
4. **Stripe**: Payment processing
5. **Resend**: Email service
6. **Monitoring**: Prometheus & Grafana
7. **Redis**: Caching and session management

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
   -- 1. init.sql (base tables and fleet management)
   -- 2. boat-profiles.sql (vessel profiles)
   -- 3. analytics.sql (usage tracking)
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

   **boat_profiles table**:
   ```sql
   -- Users can manage their own boats
   CREATE POLICY "Users can manage own boats" ON boat_profiles
   FOR ALL USING (auth.uid() = user_id);
   ```

   **fleets table**:
   ```sql
   -- Fleet owners can manage their fleets
   CREATE POLICY "Fleet owners can manage" ON fleets
   FOR ALL USING (auth.uid() = owner_id);
   
   -- Fleet members can view fleets
   CREATE POLICY "Fleet members can view" ON fleets
   FOR SELECT USING (
     EXISTS (
       SELECT 1 FROM fleet_members 
       WHERE fleet_id = fleets.id 
       AND user_id = auth.uid()
     )
   );
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
   - `charts` (private)
3. Set policies for each bucket

---

## 2. Deployment Options

### Option A: DigitalOcean App Platform

#### Step 2A.1: Create DigitalOcean Account

1. Sign up at [https://digitalocean.com](https://digitalocean.com)
2. Add payment method
3. Create a new project: `passage-planner`

#### Step 2A.2: Create App

1. Go to **App Platform**
2. Click **Create App**
3. Choose **GitHub** as source
4. Authorize and select your repository
5. Choose branch: `main`

#### Step 2A.3: Configure App Components

**Frontend Component (Next.js SSR)**:
- **Name**: `frontend`
- **Type**: Web Service
- **Build Command**: `npm ci && npm run build`
- **Run Command**: `npm --workspace=frontend run start`
- **HTTP Port**: 3000
- **Domains**: `helmwise.co`, `www.helmwise.co`
- **Environment Variables** (Build + Runtime):
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
  NEXT_PUBLIC_APP_URL=https://helmwise.co
  NEXT_PUBLIC_API_URL=https://api.helmwise.co
  NEXT_PUBLIC_WS_URL=wss://api.helmwise.co
  ```

**Orchestrator Component**:
- **Name**: `orchestrator`
- **Type**: Web Service
- **Build Command**: `npm ci && npm run build`
- **Run Command**: `npm --workspace=orchestrator run start`
- **HTTP Port**: 8080
- **Health Check Path**: `/health`
- **Environment Variables**:
  ```
  NODE_ENV=production
  PORT=8080
  DATABASE_URL=postgresql://... (use Supabase connection string with sslmode=require)
  SUPABASE_URL=https://[PROJECT_ID].supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
  REDIS_URL=redis://...
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  RESEND_API_KEY=re_...
  JWT_SECRET=[generate-secure-secret]
  NEXT_PUBLIC_API_URL=https://helmwise.co
  ```

**Agent Components** (Create one for each):

Weather Agent:
- **Name**: `weather-agent`
- **Type**: Worker
- **Build Command**: `cd passage-planner && npm install && npm run build:agents`
- **Run Command**: `cd passage-planner && npm run start:agent:weather`
- **Environment Variables**:
  ```
  NODE_ENV=production
  REDIS_URL=redis://...
  NOAA_API_KEY=[if-required]
  ```

Tidal Agent:
- **Name**: `tidal-agent`
- **Type**: Worker
- **Build Command**: `cd passage-planner && npm install && npm run build:agents`
- **Run Command**: `cd passage-planner && npm run start:agent:tidal`
- **Environment Variables**:
  ```
  NODE_ENV=production
  REDIS_URL=redis://...
  ```

Port Agent:
- **Name**: `port-agent`
- **Type**: Worker
- **Build Command**: `cd passage-planner && npm install && npm run build:agents`
- **Run Command**: `cd passage-planner && npm run start:agent:port`
- **Environment Variables**:
  ```
  NODE_ENV=production
  REDIS_URL=redis://...
  ```

**Redis Component**:
- **Name**: `redis`
- **Type**: Add-on
- Choose **Redis** from marketplace
- Select plan (Dev plan is free for testing, upgrade for production)

**Database Component** (if not using Supabase):
- **Name**: `postgres`
- **Type**: Add-on
- Choose **PostgreSQL** from marketplace
- Select plan based on needs

### Option B: Kubernetes Deployment

#### Step 2B.1: Kubernetes Cluster Setup

1. Create a Kubernetes cluster (DigitalOcean, GKE, EKS, or AKS)
2. Install required tools:
   ```bash
   # Install Helm
   curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
   
   # Install cert-manager for SSL
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
   ```

#### Step 2B.2: Create Kubernetes Manifests

Create `infrastructure/kubernetes/production/` directory and add:

**namespace.yaml**:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: passage-planner
```

**configmap.yaml**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: passage-planner
data:
  NEXT_PUBLIC_APP_URL: "https://helmwise.co"
  NEXT_PUBLIC_API_URL: "https://api.helmwise.co"
  NEXT_PUBLIC_WS_URL: "wss://api.helmwise.co"
```

**secrets.yaml**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: passage-planner
type: Opaque
stringData:
  DATABASE_URL: "postgresql://..."
  REDIS_URL: "redis://..."
  JWT_SECRET: "..."
  STRIPE_SECRET_KEY: "sk_live_..."
  SUPABASE_SERVICE_ROLE_KEY: "..."
```

**frontend-deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: passage-planner
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: passageplanner/frontend:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: app-config
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

**orchestrator-deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orchestrator
  namespace: passage-planner
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orchestrator
  template:
    metadata:
      labels:
        app: orchestrator
    spec:
      containers:
      - name: orchestrator
        image: passageplanner/orchestrator:latest
        ports:
        - containerPort: 8080
        - containerPort: 8081
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 8081
          initialDelaySeconds: 30
          periodSeconds: 10
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

**services.yaml**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: passage-planner
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: orchestrator
  namespace: passage-planner
spec:
  selector:
    app: orchestrator
  ports:
  - name: http
    port: 80
    targetPort: 8080
  - name: websocket
    port: 8081
    targetPort: 8081
```

**ingress.yaml**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: passage-planner
  namespace: passage-planner
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/websocket-services: "orchestrator"
spec:
  tls:
  - hosts:
    - helmwise.co
    - api.helmwise.co
    secretName: passage-planner-tls
  rules:
  - host: helmwise.co
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
  - host: api.helmwise.co
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: orchestrator
            port:
              number: 80
```

---

## 3. Cloudflare Setup (CDN, WAF & Security)

### Step 3.1: Add Site to Cloudflare

1. Sign up at [https://cloudflare.com](https://cloudflare.com)
2. Add your primary site: `helmwise.co` and optional secondary: `helmwise.xyz`
3. Choose the **Pro** plan for WAF features (or start with Free)
4. Cloudflare will scan existing DNS records

### Step 3.2: Update Nameservers

1. Go to your domain registrar
2. Update nameservers to Cloudflare's (provided after adding site)
3. Wait for propagation (5 mins - 24 hours)

### Step 3.3: Configure DNS Records

Add these DNS records in Cloudflare (helmwise.co zone):

```
Type   Name   Content (target)                          Proxy
CNAME  @      <DO App Platform frontend hostname>       Proxied (flattened)
CNAME  www    <DO App Platform frontend hostname>       Proxied
CNAME  api    <DO App Platform orchestrator hostname>   Proxied
TXT    @      "v=spf1 include:_spf.resend.com ~all"
TXT    _dmarc "v=DMARC1; p=none;"
```

For `helmwise.xyz` (redirect-only): no origin records required. Create Redirect Rules in Step 3.8.

### Step 3.4: Configure SSL/TLS

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to **Full (strict)**
3. Go to **Edge Certificates**
4. Enable:
   - Always Use HTTPS
   - Automatic HTTPS Rewrites
   - Minimum TLS Version: 1.2
   - Opportunistic Encryption
   - TLS 1.3

### Step 3.5: Import WAF Rules

1. Go to **Security** → **WAF**
2. Create Custom Rules using the configuration from `infrastructure/cloudflare-waf-rules.json`
3. Key rules to implement:
   - Block common attack patterns
   - Rate limit API endpoints (100/min general, 10/5min for auth)
   - Block SQL injection attempts
   - Challenge suspicious user agents
   - Implement OWASP Core Rule Set

### Step 3.6: Configure Security Settings

1. **Security** → **Settings**:
   - Security Level: Medium
   - Challenge Threshold: 30
   - Browser Integrity Check: ON
   - Privacy Pass Support: ON

2. **Security** → **Bots**:
   - Bot Fight Mode: ON
   - Verified Bot Access: Allow

3. **Security** → **DDoS**:
   - DDoS Protection: Enabled
   - Sensitivity: High
   - Advanced TCP Protection: ON

### Step 3.7: Configure Performance

1. **Speed** → **Optimization**:
   - Auto Minify: ON for all
   - Brotli: ON
   - Rocket Loader: OFF (can break React)
   - Mirage: ON
   - Polish: Lossless
   - WebP: ON

2. **Caching** → **Configuration**:
   - Caching Level: Standard
   - Browser Cache TTL: 4 hours
   - Always Online: ON

3. **Speed** → **Tiered Cache**:
   - Enable Tiered Cache (Argo)

### Step 3.8: Cache & Redirect Rules

Create these rules (Cache Rules and Redirect Rules):

1. `*helmwise.co/api/*`
   - Cache Level: Bypass
   - Security Level: High

2. `*helmwise.co/_next/static/*`
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   - Browser Cache TTL: 1 month

3. `*helmwise.co/images/*`
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   - Polish: Lossy
   - WebP: ON

4. `*helmwise.co/sw.js`
   - Cache Level: Bypass
   - Browser Cache TTL: 0

Redirect Rules (helmwise.xyz → helmwise.co):
   - Host equals `helmwise.xyz` → 301 to `https://helmwise.co/$1`
   - Host equals `www.helmwise.xyz` → 301 to `https://www.helmwise.co/$1`
   - Host equals `api.helmwise.xyz` → 301 to `https://api.helmwise.co/$1`

### Step 3.9: Workers Configuration (Optional)

1. Create Workers for edge computing:
   - API request routing
   - Asset optimization
   - Geographic routing

2. Configure using `infrastructure/cdn/cloudflare-config.json`

---

## 4. Environment Configuration

### Step 4.1: Local Development (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8081
ORCHESTRATOR_URL=http://localhost:8080

# Database (for local PostgreSQL)
DATABASE_URL=postgresql://admin:password@localhost:5432/passage_planner

# Stripe (test keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=hello@passageplanner.ai

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-secure-jwt-secret-here

# Monitoring (optional)
GRAFANA_PASSWORD=secure-password
```

### Step 4.2: Production Environment

In your deployment platform, set all production values:
- Use live Stripe keys
- Use production URLs
- Set `NODE_ENV=production`
- Generate secure secrets for JWT_SECRET and database passwords

### Step 4.3: Docker Secrets (for production)

```bash
# Create Docker secrets
echo "your-db-password" | docker secret create db_password -
echo "your-jwt-secret" | docker secret create jwt_secret -
```

---

## 5. Database Migrations

### Step 5.1: Set Up Migration System

1. Install Supabase CLI:
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
# Create new migration
supabase migration new add_feature_name

# List migrations
supabase migration list
```

### Step 5.3: Run Migrations

```bash
# Development
supabase db push

# Production
supabase db push --db-url postgresql://[PROD_CONNECTION_STRING]
```

### Step 5.4: Backup Before Migrations

```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore if needed
psql $DATABASE_URL < backup_20240115_120000.sql
```

---

## 6. Monitoring & Observability

### Step 6.1: Prometheus Setup

1. Configure Prometheus targets in `infrastructure/docker/prometheus/prometheus.yml`:
   ```yaml
   global:
     scrape_interval: 15s
   
   scrape_configs:
     - job_name: 'orchestrator'
       static_configs:
         - targets: ['orchestrator:8081']
     
     - job_name: 'postgres'
       static_configs:
         - targets: ['postgres-exporter:9187']
     
     - job_name: 'redis'
       static_configs:
         - targets: ['redis-exporter:9121']
   ```

2. Deploy Prometheus (included in docker-compose.prod.yml)

### Step 6.2: Grafana Dashboards

1. Access Grafana at `http://your-server:3001`
2. Default login: admin/[GRAFANA_PASSWORD]
3. Import dashboards:
   - Node.js Application Dashboard (ID: 11159)
   - PostgreSQL Database (ID: 9628)
   - Redis Dashboard (ID: 763)
   - Custom Passage Planner Dashboard

### Step 6.3: Application Monitoring

1. **DigitalOcean Monitoring** (if using App Platform):
   - Go to **Insights**
   - Set up alerts for:
     - CPU usage > 80%
     - Memory usage > 80%
     - Error rate > 1%
     - Response time > 1s

2. **Cloudflare Analytics**:
   - Monitor via **Analytics** → **Traffic**
   - Set up alerts for:
     - Spike in 4xx/5xx errors
     - Unusual traffic patterns
     - Cache hit rate < 80%

3. **Supabase Monitoring**:
   - Monitor via **Reports**
   - Track:
     - Database connections
     - Query performance
     - Storage usage
     - Auth events

### Step 6.4: External Monitoring

1. Set up [UptimeRobot](https://uptimerobot.com) or [Pingdom](https://pingdom.com):
   - Monitor: `https://helmwise.co`
   - Monitor: `https://api.helmwise.co/health`
   - Monitor: `wss://api.helmwise.co` (WebSocket)
   - Set up email/SMS/Slack alerts

2. Configure status page:
   - Use [Statuspage.io](https://statuspage.io) or
   - Deploy open-source [Cachet](https://cachethq.io)

### Step 6.5: Logging

1. **Centralized Logging**:
   ```bash
   # Using DigitalOcean App Platform
   doctl apps logs [APP_ID] --follow
   
   # Using Kubernetes
   kubectl logs -f deployment/orchestrator -n passage-planner
   ```

2. **Log Aggregation** (optional):
   - Set up ELK stack (Elasticsearch, Logstash, Kibana) or
   - Use managed service like Datadog or New Relic

---

## 7. CI/CD Pipeline

### Step 7.1: GitHub Actions Setup

1. Go to repository **Settings** → **Secrets**
2. Add these secrets:
   ```
   DOCKER_REGISTRY_TOKEN
   DIGITALOCEAN_ACCESS_TOKEN
   KUBECONFIG (base64 encoded)
   SUPABASE_PROJECT_ID
   PRODUCTION_DATABASE_URL
   ```

3. The `.github/workflows/ci-cd.yml` handles:
   - Running tests on PR
   - Building Docker images
   - Deploying to staging on develop branch
   - Deploying to production on tags/releases

### Step 7.2: Deployment Process

1. **Development**:
   ```bash
   git push origin feature/my-feature
   # Creates PR, runs tests
   ```

2. **Staging**:
   ```bash
   git checkout develop
   git merge feature/my-feature
   git push origin develop
   # Automatically deploys to staging
   ```

3. **Production**:
   ```bash
   git checkout main
   git merge develop
   git tag v1.2.3
   git push origin main --tags
   # Automatically deploys to production
   ```

---

## 8. High Availability & Scaling

### Step 8.1: Database High Availability

1. **Supabase** (managed):
   - Automatic failover included in Pro plan
   - Point-in-time recovery available

2. **Self-hosted PostgreSQL**:
   ```bash
   # Set up streaming replication
   # Primary server postgresql.conf
   wal_level = replica
   max_wal_senders = 3
   wal_keep_segments = 64
   
   # Standby server recovery.conf
   standby_mode = 'on'
   primary_conninfo = 'host=primary-db port=5432 user=replicator'
   ```

### Step 8.2: Redis High Availability

1. **Redis Sentinel** setup:
   ```bash
   # sentinel.conf
   port 26379
   sentinel monitor mymaster redis-primary 6379 2
   sentinel down-after-milliseconds mymaster 5000
   sentinel parallel-syncs mymaster 1
   sentinel failover-timeout mymaster 10000
   ```

2. **Redis Cluster** (for larger scale):
   ```bash
   redis-cli --cluster create \
     redis1:6379 redis2:6379 redis3:6379 \
     redis4:6379 redis5:6379 redis6:6379 \
     --cluster-replicas 1
   ```

### Step 8.3: Application Scaling

1. **Horizontal Pod Autoscaling** (Kubernetes):
   ```yaml
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   metadata:
     name: orchestrator-hpa
     namespace: passage-planner
   spec:
     scaleTargetRef:
       apiVersion: apps/v1
       kind: Deployment
       name: orchestrator
     minReplicas: 2
     maxReplicas: 10
     metrics:
     - type: Resource
       resource:
         name: cpu
         target:
           type: Utilization
           averageUtilization: 70
     - type: Resource
       resource:
         name: memory
         target:
           type: Utilization
           averageUtilization: 80
   ```

2. **Load Balancing**:
   - Use Cloudflare Load Balancing for geographic distribution
   - Configure health checks for automatic failover

### Step 8.4: WebSocket Scaling

1. **Sticky Sessions**:
   ```yaml
   # Kubernetes Service
   apiVersion: v1
   kind: Service
   metadata:
     name: orchestrator
     annotations:
       service.beta.kubernetes.io/aws-load-balancer-backend-protocol: "tcp"
       service.beta.kubernetes.io/aws-load-balancer-ssl-cert: "arn:aws:acm:..."
   spec:
     sessionAffinity: ClientIP
     sessionAffinityConfig:
       clientIP:
         timeoutSeconds: 3600
   ```

2. **Redis Pub/Sub for WebSocket**:
   - Implement Redis adapter for Socket.IO
   - Allows WebSocket connections across multiple servers

---

## 9. Backup & Disaster Recovery

### Step 9.1: Automated Backups

1. **Database Backups**:
   ```bash
   # Daily backup script
   #!/bin/bash
   BACKUP_NAME="passage-planner-$(date +%Y%m%d-%H%M%S).sql"
   pg_dump $DATABASE_URL > /tmp/$BACKUP_NAME
   
   # Upload to S3/Spaces
   aws s3 cp /tmp/$BACKUP_NAME s3://passage-planner-backups/$BACKUP_NAME
   
   # Keep last 30 days
   aws s3 ls s3://passage-planner-backups/ | \
     grep "\.sql$" | \
     sort -r | \
     tail -n +31 | \
     awk '{print $4}' | \
     xargs -I {} aws s3 rm s3://passage-planner-backups/{}
   ```

2. **Application State**:
   - Redis snapshots every hour
   - Uploaded file backups to object storage

### Step 9.2: Disaster Recovery Plan

1. **Recovery Time Objective (RTO)**: 1 hour
2. **Recovery Point Objective (RPO)**: 1 hour

3. **Runbook**:
   ```markdown
   1. Identify failure type (database, application, network)
   2. Switch DNS to backup region (if regional failure)
   3. Restore database from latest backup
   4. Restore Redis from snapshot
   5. Deploy application to new infrastructure
   6. Verify all services operational
   7. Update status page
   ```

---

## 10. Security Hardening

### Step 10.1: Security Checklist

- [ ] All secrets in environment variables or secret management
- [ ] Supabase RLS policies enabled and tested
- [ ] HTTPS enforced everywhere
- [ ] API rate limiting configured
- [ ] WAF rules active
- [ ] DDoS protection enabled
- [ ] Regular security updates scheduled
- [ ] Dependency scanning in CI/CD
- [ ] Container image scanning
- [ ] Penetration testing scheduled quarterly
- [ ] GDPR compliance verified
- [ ] Privacy policy and ToS published
- [ ] Cookie consent implemented
- [ ] Security headers configured (HSTS, CSP, etc.)

### Step 10.2: Security Headers

Add to Cloudflare Transform Rules or application:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss://api.helmwise.co https://*.supabase.co https://api.stripe.com;
```

---

## 11. Launch Checklist

### Pre-Launch (1 week before)
- [ ] All environment variables configured
- [ ] Database migrations tested and ready
- [ ] SSL certificates active
- [ ] Monitoring dashboards configured
- [ ] Backup system tested
- [ ] Load testing completed (see tests/load/)
- [ ] Security scan passed
- [ ] WAF rules tested
- [ ] Email deliverability verified
- [ ] Payment flow tested end-to-end

### Launch Day
- [ ] Create database backup
- [ ] Switch DNS to production
- [ ] Monitor error logs closely
- [ ] Check all critical user paths:
  - [ ] Sign up flow
  - [ ] Login flow
  - [ ] Passage planning
  - [ ] Payment processing
  - [ ] Email notifications
- [ ] Monitor performance metrics
- [ ] Update status page
- [ ] Announce launch

### Post-Launch (first week)
- [ ] Daily monitoring review
- [ ] Address any bug reports
- [ ] Scale resources if needed
- [ ] Review security logs
- [ ] Backup verification
- [ ] Performance optimization based on real usage

### Ongoing Maintenance
- [ ] Weekly backup verification
- [ ] Monthly security updates
- [ ] Monthly cost review
- [ ] Quarterly security audit
- [ ] Quarterly performance review
- [ ] Annual penetration test
- [ ] Annual disaster recovery drill

---

## 12. Cost Estimation & Optimization

### Monthly Costs (Production)

- **Cloudflare Pro**: $20/month (WAF, advanced features)
- **Supabase**:
  - Free tier: $0 (up to 500MB database, 2GB bandwidth)
  - Pro: $25/month (8GB database, 50GB bandwidth)
- **DigitalOcean** (App Platform):
  - Frontend: $0 (static hosting included)
  - Orchestrator: $20/month (Professional 1GB RAM)
  - Each Agent: $10/month (Basic 512MB RAM)
  - Redis: $15/month (managed)
  - Load Balancer: $12/month
- **Alternative: Kubernetes** (DigitalOcean):
  - 3-node cluster: $45/month (1GB RAM nodes)
  - Load Balancer: $12/month
  - Block Storage: $10/month (100GB)
- **Monitoring**: $0 (self-hosted) or $50/month (Datadog)
- **Total Estimate**: $100-200/month

### Cost Optimization

1. **Start Small**:
   - Use free tiers initially
   - Single orchestrator instance
   - Basic monitoring

2. **Scale Gradually**:
   - Add replicas based on load
   - Upgrade database as needed
   - Add monitoring when traffic justifies

3. **Optimize Resources**:
   - Use Cloudflare caching aggressively
   - Implement efficient database queries
   - Use autoscaling to match demand
   - Review and remove unused resources monthly

4. **Reserved Instances**:
   - DigitalOcean droplets: 10% discount for annual
   - Consider committed use discounts for cloud providers

---

## Support & Resources

### Documentation
- Cloudflare: [https://developers.cloudflare.com](https://developers.cloudflare.com)
- Supabase: [https://supabase.com/docs](https://supabase.com/docs)
- DigitalOcean: [https://docs.digitalocean.com](https://docs.digitalocean.com)
- Kubernetes: [https://kubernetes.io/docs](https://kubernetes.io/docs)

### Community Support
- GitHub Issues: [Your Repository]/issues
- Discord: [Your Discord Server]
- Stack Overflow: Tag with `passage-planner`

### Professional Support
- Cloudflare Support: Available with Pro plan
- Supabase Support: Available with Pro plan
- DigitalOcean Support: 24/7 with all plans
- Custom Support: support@helmwise.co

---

## Appendix: Quick Commands

```bash
# View logs
doctl apps logs [APP_ID] --follow
kubectl logs -f deployment/orchestrator -n passage-planner

# Scale application
doctl apps update [APP_ID] --spec app-spec.yaml
kubectl scale deployment orchestrator --replicas=5 -n passage-planner

# Database operations
pg_dump $DATABASE_URL > backup.sql
psql $DATABASE_URL < backup.sql

# Redis operations
redis-cli -h redis.example.com
redis-cli --scan --pattern "session:*" | xargs redis-cli del

# Certificate renewal (if manual)
certbot renew --nginx

# Performance testing
k6 run tests/load/passage-planning-load.js

# Security scanning
docker scan passageplanner/frontend:latest
npm audit --production
```

---

Last Updated: July 2025
Version: 2.0 