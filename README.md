# Passage Planner - Multi-Agent Maritime Navigation System

A production-ready passage planning system built with the Model Context Protocol (MCP) that orchestrates specialized AI agents to provide comprehensive sailing route planning. The system uses a hierarchical architecture where an orchestrator agent manages specialized sub-agents for weather forecasting, tidal predictions, port information, safety planning, and route optimization.

## 🌟 Key Features

- **Hierarchical Agent Architecture**: Orchestrator pattern managing specialized MCP agents
- **Dynamic Agent Creation**: Meta-agent capable of creating new agents for unforeseen requirements
- **Real-time Visualization**: Live architecture diagram showing agent interactions and request flow
- **Comprehensive Planning**: Weather, tides, currents, port facilities, safety considerations, and optimal routing
- **Production-Ready**: Kubernetes deployment, monitoring, security, and scalability built-in
- **Natural Language Interface**: Plan sailing passages using conversational queries
- **Real-Time Data Integration**: Live weather, tidal predictions, and safety warnings

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│   Orchestrator  │────▶│  Specialized    │
│   (Next.js)     │◀────│     (MCP)       │◀────│    Agents       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                         │
                               ▼                         ▼
                        ┌─────────────┐          ┌──────────────┐
                        │    Redis    │          │  PostgreSQL  │
                        │   (State)   │          │   (Data)     │
                        └─────────────┘          └──────────────┘
```

### Specialized Agents

- **Weather Agent**: NOAA weather data, marine forecasts, storm warnings
- **Tidal Agent**: Tide predictions, current forecasts, water depth calculations
- **Port Agent**: Port information, facilities, contacts, entry requirements
- **Safety Agent**: Navigation warnings, emergency contacts, safety checklists
- **Route Agent**: Route calculation, waypoint optimization, distance calculations
- **Wind Agent**: Wind forecasts, gust analysis, optimal sail recommendations
- **Agent Factory**: Dynamic agent creation for new capabilities

## 🛠️ Technical Stack

- **Framework**: Model Context Protocol (MCP) by Anthropic
- **Language**: TypeScript/Node.js
- **Frontend**: Next.js 14 with real-time WebSocket updates
- **Infrastructure**: Kubernetes, Redis, PostgreSQL
- **Monitoring**: Prometheus, Grafana, Jaeger
- **Security**: JWT auth, rate limiting, encryption
- **APIs**: NOAA Weather, OpenWeatherMap, WindFinder
- **Container**: Docker

## 🎯 Use Cases

- **Recreational Sailors**: Planning coastal or offshore passages with comprehensive weather and safety information
- **Professional Delivery Crews**: Optimizing routes for time and weather windows
- **Marine Educators**: Teaching passage planning with real-world data and considerations
- **Developers**: Learning MCP and agentic architectures through a practical implementation

## 📋 Prerequisites

- Node.js 20.x LTS
- Docker & Docker Compose
- PostgreSQL 15+ (via Docker)
- Redis 7+ (via Docker)
- Git

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/mjohnson518/passage_planner.git
   cd passage-planner
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start infrastructure**
   ```bash
   docker-compose up -d
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Orchestrator Health: http://localhost:8081/health
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

## 📁 Project Structure

```
passage-planner/
├── frontend/               # Next.js web application
├── orchestrator/          # MCP orchestrator service
├── agents/                # Specialized agent implementations
│   ├── weather/
│   ├── wind/
│   ├── tidal/
│   ├── port/
│   ├── safety/
│   ├── route/
│   └── factory/
├── shared/                # Shared types and utilities
├── infrastructure/        # Docker, Kubernetes, Terraform configs
├── tests/                 # Integration and E2E tests
└── docs/                  # Documentation
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run load tests
npm run test:load
```

## 📊 Monitoring

The system includes comprehensive monitoring:

- **Metrics**: Prometheus collects metrics from all components
- **Dashboards**: Grafana provides real-time visualization
- **Alerts**: Configured alerts for system health
- **Tracing**: Distributed tracing with Jaeger for request flow analysis

## 🔒 Security

- JWT authentication for API access
- API key management for external services
- Rate limiting and input validation
- Encrypted data storage
- GDPR compliance features

## 🚢 Example Usage

```typescript
// Plan a passage from Boston to Portland
const plan = await orchestrator.callTool('plan_passage', {
  departure: 'Boston, MA',
  destination: 'Portland, ME',
  departure_time: '2024-07-15T10:00:00Z',
  boat_type: 'sailboat',
  preferences: {
    avoid_night: true,
    max_wind_speed: 25,
    max_wave_height: 2
  }
});
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Model Context Protocol (MCP) by Anthropic
- NOAA for weather and marine data APIs
- The sailing community for inspiration

## 📞 Support

For questions and support:
- Create an issue in the GitHub repository