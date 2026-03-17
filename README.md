# Helmwise

**AI-powered passage planning for safer sailing.**

Helmwise is a production-ready SaaS platform that helps sailors plan safer, smarter passages using real-time weather, tidal, and marine safety data.

🌐 **Live:** [helmwise.co](https://helmwise.co)

## Features

- **Intelligent Route Planning** — AI agents analyze weather, tides, currents, and hazards
- **Real-Time Marine Data** — NOAA forecasts, NDBC buoy data, tidal predictions
- **Safety-Critical Architecture** — Non-negotiable margins: 20% keel clearance, 20% weather buffer, 30% fuel/water reserve
- **SAFETY_UNVERIFIED Status** — Plans blocked with a prominent warning when safety checks cannot be completed
- **Zod-Validated External Data** — All NOAA/NDBC API responses schema-validated before use in navigation decisions
- **Fleet Management** — Multi-vessel tracking with crew collaboration (Pro tier)
- **PWA Support** — Installable, offline-capable progressive web app

## Architecture

```
Frontend (Next.js 14, App Router)
        ↓ HTTP / Socket.IO
Orchestrator (Express.js, port 8080)
        ├─→ WeatherAgent   (NOAA + OpenWeather + NDBC buoys)
        ├─→ TidalAgent     (tidal predictions, current ETA adjustment)
        ├─→ RouteAgent     (geolib route calculations)
        ├─→ SafetyAgent    (hazard detection, restricted areas)
        └─→ PortAgent      (port information, 40+ ports)
        ↓
PostgreSQL/Supabase (PostGIS, RLS) + Redis/Upstash
```

## Quick Start

```bash
# Clone and install
git clone https://github.com/mjohnson518/passage_planner.git
cd passage-planner && npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start services
npm run docker:up
npm run dev
```

**Local URLs:**
- App: http://localhost:3000
- API: http://localhost:8080

## Safety Design

Helmwise treats safety as a first-class constraint, not a feature. Key design decisions:

| Concern | Implementation |
|---------|---------------|
| Stale weather data | Rejected if >1 hour old (`WEATHER_REJECT_AGE_MS`) |
| Stale tidal data | Rejected if >24 hours old (`TIDAL_REJECT_AGE_MS`) |
| Safety check failure | Plan marked `SAFETY_UNVERIFIED`; red banner shown; export blocked |
| Fuel/water reserves | 30% buffer enforced; critical warning if vessel capacity insufficient |
| Route duration | 20% weather delay buffer applied to all calculated durations |
| Restricted areas | Distance-adaptive sampling (1 point/nm, min 50) to catch small zones |
| External API data | Zod schema validation at every API boundary before use |
| Auth bypass | `SKIP_AUTH=true` causes immediate `process.exit(1)` in production |

All safety thresholds live in `shared/src/constants/safety-thresholds.ts` — the single source of truth across all agents.

## Pricing

| Tier | Price | Passages | Features |
|------|-------|----------|----------|
| Free | $0 | 5/month | Basic planning |
| Premium | $19/mo | 50/month | Advanced weather, priority support |
| Pro | $49/mo | Unlimited | Fleet management, API access |

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Socket.IO client, Zustand, Leaflet
- **Backend:** Node.js, Express, MCP (Model Context Protocol), Socket.IO
- **Auth:** Supabase (`@supabase/ssr`), JWT, httpOnly-ready cookies
- **Database:** PostgreSQL + PostGIS (Supabase), RLS on all tables
- **Cache:** Redis (Upstash)
- **Payments:** Stripe (webhook verification, customer portal)
- **Email:** Resend (CAN-SPAM compliant, List-Unsubscribe headers)
- **Observability:** Pino structured logging, Sentry error tracking, circuit breakers

## Security Highlights

- Rate limiting on all auth endpoints (5 attempts / 15 min; fail-closed when Redis unavailable)
- Rate limiting middleware applied to all authenticated routes
- Zod input validation on signup/login; schemas in place for all POST/PUT routes
- WebSocket connections rate-limited (5/IP/min) with 10-second auth timeout
- JWT secret required at startup in production; random fallback only in development
- API keys stored as HMAC-SHA256 hashes
- CSRF double-submit cookie protection
- Strict security headers (HSTS, CSP, CORP, COEP, COOP)

## Deployment

See [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) for complete deployment instructions including:
- Environment variables and API keys
- Database migrations
- Infrastructure setup
- Pre-launch checklist

**Required Services:**
- Supabase (auth + database)
- Redis (Upstash recommended)
- Stripe (payments)
- Resend (email)

**API Keys (all free tiers available):**
- NOAA Weather API
- NDBC Buoy Data (no key needed)
- OpenWeather API

## Development

```bash
# Run tests
npm test

# Build for production
npm run build

# Type checking
npm run type-check

# Single workspace test
cd agents/weather && npm test -- --testPathPattern="index"
```

**Test Coverage Requirements:**
- Overall: ≥85%
- Safety-critical paths (`agents/safety/`, `agents/weather/`, `agents/route/`, `agents/tidal/`): ≥90%

## Project Structure

```
passage-planner/
├── frontend/               # Next.js 14 App Router web app
│   ├── app/
│   │   ├── planner/        # Main passage planning interface
│   │   ├── contexts/       # Socket.IO, Auth contexts
│   │   └── components/     # UI components (legal, map, etc.)
│   └── Dockerfile          # Multi-stage production build
├── orchestrator/           # MCP orchestrator + Express API
│   ├── src/
│   │   ├── SimpleOrchestrator.ts  # Main orchestration logic
│   │   ├── server.ts              # Express routes, auth, rate limiting
│   │   └── services/              # Email, AgentManager, PassagePlanner
│   └── Dockerfile          # Multi-stage production build
├── agents/                 # Specialized MCP agents
│   ├── weather/            # NOAA + NDBC + OpenWeather
│   ├── tidal/              # Tidal predictions
│   ├── safety/             # Hazard detection, restricted areas
│   ├── route/              # Route optimization
│   └── port/               # Port database (40+ ports)
├── shared/                 # Shared across all workspaces
│   ├── src/constants/      # Safety thresholds (single source of truth)
│   ├── src/types/          # Zod schemas + TypeScript types
│   ├── src/services/       # NOAA, NDBC, Auth, CacheManager
│   └── src/middleware/     # Input validation, security headers
├── infrastructure/         # Docker Compose, PostgreSQL migrations
└── docs/                   # Deployment and testing guides
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests — safety-critical paths require ≥90% coverage
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE)

## Support

- **Free:** GitHub Issues
- **Premium:** support@helmwise.co
- **Pro:** Priority support with SLA

---

Built with the [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
