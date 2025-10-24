# Standalone orchestrator deployment
# Includes all dependencies inline

FROM node:18-alpine

# Install build tools for native modules
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy entire monorepo (needed for workspace dependencies)
COPY . .

# Install all dependencies at root level
RUN npm install

# Set working directory to orchestrator
WORKDIR /app/orchestrator

# Expose port
EXPOSE ${PORT:-3000}

# Use ts-node directly (simplest approach that works)
# --transpile-only skips type checking for faster startup
CMD ["npx", "ts-node", "--transpile-only", "src/index.ts"]
