#!/bin/bash

# Stop all agents
echo "Stopping all agent services..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to stop an agent
stop_agent() {
  local agent_name=$1
  local pid_file="pids/$agent_name-agent.pid"
  
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")
    if kill -0 $pid 2>/dev/null; then
      echo -e "${GREEN}Stopping $agent_name agent (PID: $pid)...${NC}"
      kill $pid
      rm "$pid_file"
    else
      echo -e "${RED}$agent_name agent not running${NC}"
      rm "$pid_file"
    fi
  else
    echo -e "${RED}No PID file found for $agent_name agent${NC}"
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

echo "All agents stopped." 