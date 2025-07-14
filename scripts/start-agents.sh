#!/bin/bash

# Start all agents
echo "Starting all agent services..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to start an agent
start_agent() {
  local agent_name=$1
  local agent_dir="agents/$agent_name"
  
  if [ -d "$agent_dir" ]; then
    echo -e "${GREEN}Starting $agent_name agent...${NC}"
    cd "$agent_dir" && npm run dev > "../../logs/$agent_name-agent.log" 2>&1 &
    echo $! > "../../pids/$agent_name-agent.pid"
    cd ../..
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

echo "All agents started. Check logs/ directory for output."
echo "To stop all agents, run: ./scripts/stop-agents.sh" 