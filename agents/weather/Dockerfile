# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy shared module
COPY shared ./shared

# Copy agent files
COPY agents/weather/package*.json ./agents/weather/
COPY agents/weather/tsconfig.json ./agents/weather/
COPY agents/weather/src ./agents/weather/src

# Install dependencies
WORKDIR /app/shared
RUN npm ci

WORKDIR /app/agents/weather
RUN npm ci

# Build shared module
WORKDIR /app/shared
RUN npm run build

# Build agent
WORKDIR /app/agents/weather
RUN npm run build

# Production stage
FROM node:20-alpine

# Install production dependencies
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/shared/dist ./shared/dist
COPY --from=builder --chown=nodejs:nodejs /app/shared/package*.json ./shared/
COPY --from=builder --chown=nodejs:nodejs /app/agents/weather/dist ./agents/weather/dist
COPY --from=builder --chown=nodejs:nodejs /app/agents/weather/package*.json ./agents/weather/

# Install production dependencies only
WORKDIR /app/shared
RUN npm ci --only=production

WORKDIR /app/agents/weather
RUN npm ci --only=production

# Switch to non-root user
USER nodejs

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the agent
CMD ["node", "dist/index.js"] 