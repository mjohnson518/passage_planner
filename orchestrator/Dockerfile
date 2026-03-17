# Orchestrator — multi-stage build from monorepo root
# Stage 1: builder (installs devDeps + compiles TypeScript)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests for all workspaces (enables layer caching)
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY orchestrator/package*.json ./orchestrator/
COPY agents/base/package*.json ./agents/base/
COPY agents/weather/package*.json ./agents/weather/
COPY agents/tidal/package*.json ./agents/tidal/
COPY agents/route/package*.json ./agents/route/
COPY agents/safety/package*.json ./agents/safety/
COPY agents/port/package*.json ./agents/port/
COPY frontend/package*.json ./frontend/

# Install ALL deps (devDeps needed for tsc build step)
RUN npm ci

# Copy root tsconfig (shared and orchestrator extend it)
COPY tsconfig.json ./

# Copy all source
COPY shared/ ./shared/
COPY orchestrator/ ./orchestrator/
COPY agents/ ./agents/

# Build shared first, then orchestrator
RUN npm run build:shared && npm run build --workspace=@passage-planner/orchestrator

# ── Stage 2: runner (production-only) ──────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# Copy package manifests for production install
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY orchestrator/package*.json ./orchestrator/
COPY agents/base/package*.json ./agents/base/
COPY agents/weather/package*.json ./agents/weather/
COPY agents/tidal/package*.json ./agents/tidal/
COPY agents/route/package*.json ./agents/route/
COPY agents/safety/package*.json ./agents/safety/
COPY agents/port/package*.json ./agents/port/
COPY frontend/package*.json ./frontend/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/orchestrator/dist ./orchestrator/dist
COPY --from=builder /app/agents ./agents

EXPOSE 8080

CMD ["node", "orchestrator/dist/orchestrator/src/index.js"]
