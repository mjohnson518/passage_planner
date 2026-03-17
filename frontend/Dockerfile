# Frontend — multi-stage build from monorepo root
# Stage 1: builder (installs devDeps + compiles Next.js)
FROM node:20-alpine AS builder

ENV NEXT_TELEMETRY_DISABLED=1

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

# Install ALL deps (devDeps needed for Next.js build: tailwind, postcss, etc.)
RUN npm ci

# Copy root tsconfig (shared extends it)
COPY tsconfig.json ./

# Copy all source
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Build shared first, then frontend (Next.js standalone output)
RUN npm run build:shared && npm run build --workspace=passage-planner-frontend

# ── Stage 2: runner (production-only) ──────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output (includes only production deps)
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./frontend/public

USER nextjs

EXPOSE 3000

# Next.js standalone server
CMD ["node", "frontend/server.js"]
