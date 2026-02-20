# Frontend — single-stage build from monorepo root
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
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
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Build shared first, then frontend
RUN npm run build:shared && npm run build --workspace=passage-planner-frontend

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=passage-planner-frontend"]
