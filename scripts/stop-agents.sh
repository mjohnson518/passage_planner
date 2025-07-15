#!/bin/bash

# Stop all agents
echo "Stopping all agent services..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Save the root directory
ROOT_DIR=$(pwd)

# Function to stop an agent
stop_agent() {
  local agent_name=$1
  local pid_file="$ROOT_DIR/pids/$agent_name-agent.pid"
  
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${YELLOW}Stopping $agent_name agent (PID: $pid)...${NC}"
      kill "$pid"
      rm "$pid_file"
      echo -e "${GREEN}$agent_name agent stopped${NC}"
    else
      echo -e "${YELLOW}$agent_name agent not running (stale PID file)${NC}"
      rm "$pid_file"
    fi
  else
    echo -e "${YELLOW}No PID file found for $agent_name agent${NC}"
  fi
}

# Stop each agent
stop_agent "weather"
stop_agent "tidal"
stop_agent "port"
stop_agent "safety"
stop_agent "route"
stop_agent "wind"
stop_agent "factory"
stop_agent "currents"
stop_agent "anchorages"
stop_agent "fuel"

# Also stop the orchestrator if running
stop_agent "orchestrator"

echo -e "${GREEN}All agents stopped.${NC}" 