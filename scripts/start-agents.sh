#!/bin/bash

# Start all agents
echo "Starting all agent services..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Save the root directory
ROOT_DIR=$(pwd)

# Function to start an agent
start_agent() {
  local agent_name=$1
  local agent_dir="$ROOT_DIR/agents/$agent_name"
  
  if [ -d "$agent_dir" ]; then
    echo -e "${GREEN}Starting $agent_name agent...${NC}"
    cd "$agent_dir" && npm run dev > "$ROOT_DIR/logs/$agent_name-agent.log" 2>&1 &
    echo $! > "$ROOT_DIR/pids/$agent_name-agent.pid"
    cd "$ROOT_DIR"
  else
    echo -e "${RED}Agent directory $agent_dir not found${NC}"
  fi
}

# Create logs and pids directories
mkdir -p logs pids

# Start each agent
start_agent "weather"
start_agent "tidal"
start_agent "port"
start_agent "safety"
start_agent "route"
start_agent "wind"
start_agent "factory"
start_agent "currents"
start_agent "anchorages"
start_agent "fuel"

echo -e "${GREEN}All agents started. Check logs/ directory for output.${NC}"
echo "To stop all agents, run: ./scripts/stop-agents.sh" 