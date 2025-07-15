#!/bin/bash

# Install dependencies for all agents
echo "Installing dependencies for all agents..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Save the root directory
ROOT_DIR=$(pwd)

# Function to install dependencies for an agent
install_agent_deps() {
  local agent_name=$1
  local agent_dir="$ROOT_DIR/agents/$agent_name"
  
  if [ -d "$agent_dir" ]; then
    echo -e "${GREEN}Installing dependencies for $agent_name agent...${NC}"
    cd "$agent_dir" && npm install
    cd "$ROOT_DIR"
  else
    echo -e "${RED}Agent directory $agent_dir not found${NC}"
  fi
}

# Install shared dependencies first
echo -e "${GREEN}Installing shared dependencies...${NC}"
cd "$ROOT_DIR/shared" && npm install
cd "$ROOT_DIR"

# Install orchestrator dependencies
echo -e "${GREEN}Installing orchestrator dependencies...${NC}"
cd "$ROOT_DIR/orchestrator" && npm install
cd "$ROOT_DIR"

# Install frontend dependencies
echo -e "${GREEN}Installing frontend dependencies...${NC}"
cd "$ROOT_DIR/frontend" && npm install
cd "$ROOT_DIR"

# Install each agent's dependencies
install_agent_deps "weather"
install_agent_deps "tidal"
install_agent_deps "port"
install_agent_deps "safety"
install_agent_deps "route"
install_agent_deps "wind"
install_agent_deps "factory"
install_agent_deps "currents"
install_agent_deps "anchorages"
install_agent_deps "fuel"

echo -e "${GREEN}All dependencies installed!${NC}"
echo "You can now run ./scripts/start-agents.sh to start all services" 