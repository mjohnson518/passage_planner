# Docker-based Development Setup

This guide captures the minimal configuration required to run the passage planner stack locally with Docker. It assumes you have already cloned the repository and installed the root dependencies with `npm install`.

## 1. Environment Variables

Copy the provided example file and adjust values as needed:

```bash
cp .env.example .env
```

For Docker compose the following keys are required (values shown are suggested defaults for local usage):

| Variable | Suggested Value | Notes |
| --- | --- | --- |
| `APP_URL` | `http://localhost:3000` | Frontend base URL |
| `API_URL` | `http://localhost:8080` | Orchestrator HTTP URL |
| `DATABASE_URL` | `postgresql://admin:secure_password@postgres:5432/passage_planner` | Reuses credentials defined in `docker-compose.yml` |
| `REDIS_URL` | `redis://redis:6379` | Points to the compose Redis service |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Passed into the frontend build |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8081` | WebSocket endpoint for orchestrator |

You will also need API keys/secrets for integrations; placeholder values in `.env.example` indicate what to provide:

- Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`)
- Stripe (`STRIPE_*` variables)
- Email (`RESEND_API_KEY`, `EMAIL_FROM`)
- Weather / Marine APIs (`NOAA_API_KEY`, `OPENWEATHER_API_KEY`, etc.)

For initial local development you can leave Stripe/Resend values as dummy strings, but Supabase credentials are required for authentication flows to function.

## 2. Start the Stack

Build and launch services:

```bash
docker-compose up -d --build
```

The compose file starts Postgres, Redis, the orchestrator, and the frontend. Postgres runs all SQL files located in `infrastructure/docker/postgres/` (`init.sql`, `passages.sql`, `analytics.sql`, `subscriptions.sql`).

## 3. Database Migrations / Seeds

After containers are running, run any additional migrations or seed scripts as needed (e.g., Supabase migrations or custom SQL). For now the bundled SQL files create the Phase 1 schema with the required tables and policies.

## 4. Frontend / Orchestrator URLs

- Frontend: <http://localhost:3000>
- Orchestrator REST: <http://localhost:8080>
- Orchestrator MCP/WebSocket: <ws://localhost:8081>

## 5. Tear Down

```bash
docker-compose down
```

Optionally remove volumes when you want a clean database/Redis state:

```bash
docker-compose down -v
```

