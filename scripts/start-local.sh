#!/bin/bash

echo "🚀 Starting Passage Planner Locally"
echo "===================================="
echo ""

# Set environment variables
export REDIS_URL=redis://localhost:6379
export PORT=8080
export NOAA_API_KEY=test
export OPENWEATHER_API_KEY=test
export SUPABASE_URL=https://test.supabase.co
export SUPABASE_SERVICE_KEY=test-key
export NODE_ENV=development

echo "📦 Environment variables set:"
echo "  REDIS_URL=$REDIS_URL"
echo "  PORT=$PORT"
echo "  NODE_ENV=$NODE_ENV"
echo ""

cd orchestrator

echo "🔧 Building orchestrator (this may take a moment)..."
echo ""

# Use ts-node to run directly (handles cross-directory imports)
npx ts-node src/index.ts

