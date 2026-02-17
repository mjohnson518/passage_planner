# Frontend Dockerfile — builds from monorepo root
FROM node:20-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Copy package files for all workspaces
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

RUN npm ci

# Copy all source
COPY . .

# Build shared first, then frontend
RUN npm run build:shared && npm run build --workspace=passage-planner-frontend

# Production image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output (includes node_modules needed)
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

EXPOSE 3000

CMD ["node", "frontend/server.js"]
