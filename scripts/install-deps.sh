#!/bin/bash

# Install dependencies for each workspace

echo "Installing dependencies for all workspaces..."

# Root dependencies
echo "Installing root dependencies..."
npm install --save-dev @types/jest @types/mocha

# Shared package
echo "Installing shared dependencies..."
cd shared
npm install @modelcontextprotocol/sdk redis @types/redis
cd ..

# Orchestrator package
echo "Installing orchestrator dependencies..."
cd orchestrator
npm install @modelcontextprotocol/sdk redis socket.io @types/redis stripe @supabase/supabase-js resend cron @types/cron @types/socket.io
npm install --save-dev @types/jest @types/mocha
cd ..

# Agent packages
for agent in port tidal weather; do
  echo "Installing $agent agent dependencies..."
  cd agents/$agent
  npm install @modelcontextprotocol/sdk
  cd ../..
done

# Frontend package
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "All dependencies installed!" 