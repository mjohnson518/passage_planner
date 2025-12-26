# Helmwise

**AI-powered passage planning for safer sailing.**

Helmwise is a production-ready SaaS platform that helps sailors plan safer, smarter passages using real-time weather, tidal, and marine safety data.

🌐 **Live:** [helmwise.co](https://helmwise.co)

## Features

- **Intelligent Route Planning** — AI agents analyze weather, tides, currents, and hazards
- **Real-Time Marine Data** — NOAA forecasts, NDBC buoy data, tidal predictions
- **Safety First** — Restricted area warnings, depth calculations with tidal adjustments
- **Fleet Management** — Multi-vessel tracking with crew collaboration (Pro tier)
- **Beautiful Interface** — Modern, responsive design built with Next.js

## Architecture

```
Frontend (Next.js) → Orchestrator → Specialized Agents
                          ↓              ↓
                        Redis      Weather | Tidal | Safety | Route | Port
                          ↓
                     PostgreSQL (Supabase)
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

## Pricing

| Tier | Price | Passages | Features |
|------|-------|----------|----------|
| Free | $0 | 5/month | Basic planning |
| Premium | $19/mo | 50/month | Advanced weather, priority support |
| Pro | $49/mo | Unlimited | Fleet management, API access |

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, MCP (Model Context Protocol)
- **Database:** PostgreSQL (Supabase)
- **Cache:** Redis
- **Payments:** Stripe
- **Email:** Resend

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
npm run typecheck
```

## Project Structure

```
passage-planner/
├── frontend/          # Next.js web app
├── orchestrator/      # MCP orchestrator service
├── agents/            # Specialized AI agents
│   ├── weather/       # NOAA weather forecasts
│   ├── tidal/         # Tide predictions
│   ├── safety/        # Navigation safety
│   ├── route/         # Route optimization
│   └── port/          # Port information
├── shared/            # Shared types and utilities
├── infrastructure/    # Docker, Kubernetes, SQL
└── docs/              # Documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE)

## Support

- **Free:** GitHub Issues
- **Premium:** support@helmwise.co
- **Pro:** Priority support with SLA

---

Built with the [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
