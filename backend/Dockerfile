# Helmwise Backend - Standalone Production Deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --include=dev

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Verify build output
RUN ls -la dist/

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Set production environment
ENV NODE_ENV=production

# Expose port (Railway will override with their PORT env var)
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]

