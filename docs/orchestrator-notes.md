# Orchestrator Implementation Notes

## Architecture Overview

The Orchestrator is the central coordination service that:
1. **Manages agent lifecycle** - Initializes, monitors, and shuts down all specialized agents
2. **Routes tool calls** - Directs requests to appropriate agents using prefix routing
3. **Coordinates workflows** - Orchestrates multi-agent passage planning sequences
4. **Provides real-time updates** - WebSocket broadcasting for UI feedback
5. **Exposes health endpoints** - HTTP endpoints for monitoring and Kubernetes probes

## Components

### 1. MCP Server (Stdio Transport)
- **Purpose**: Standard MCP protocol interface for agent communication
- **Transport**: Stdio (stdin/stdout) for process-based communication
- **Tools Exposed**: 
  - `plan_passage` (orchestrator-level)
  - `{agent}_{tool}` (agent-level, e.g., `weather_get_marine_forecast`)

### 2. HTTP Server (Port 8080)
- **Purpose**: Health checks and readiness probes
- **Endpoints**:
  - `GET /health` - Returns orchestrator and agent health status
  - `GET /ready` - Kubernetes readiness probe (checks Redis connectivity)

### 3. WebSocket Server (Port 8080, same as HTTP)
- **Purpose**: Real-time updates during passage planning
- **Events Broadcast**:
  - `planning_started` - Planning initiated with ID
  - `agent_active` - Agent is processing (includes status message)
  - `planning_completed` - Full passage plan ready
  - `planning_error` - Planning failed with error message

### 4. Agent Registry
Manages three core agents:
- **WeatherAgent**: Marine forecasts and warnings (30min cache)
- **TidalAgent**: Tide and current predictions (24hr cache)
- **RouteAgent**: Route calculation and optimization (1hr cache)

## Passage Planning Workflow

### Sequence
```
1. Client calls plan_passage tool
2. Generate unique planning ID (UUID)
3. Broadcast planning_started
4. Step 1: Route calculation
   └─> RouteAgent.calculate_route()
   └─> Broadcast agent_active (route)
5. Step 2: Weather forecast
   └─> WeatherAgent.get_marine_forecast() for each waypoint
   └─> Broadcast agent_active (weather)
   └─> Handle failures gracefully (return null for failed forecasts)
6. Step 3: Tidal predictions
   └─> TidalAgent.get_tide_predictions() for departure location
   └─> Broadcast agent_active (tidal)
   └─> Handle failures gracefully (continue without tidal data)
7. Compile passage plan
   └─> Generate warnings from weather/tidal data
   └─> Generate recommendations
8. Save to Supabase (if userId provided)
9. Broadcast planning_completed
10. Return complete passage plan
```

### Error Handling Philosophy
- **Fail gracefully**: If one agent fails, return partial results with warnings
- **Continue on save failures**: Don't fail planning if database save fails
- **Null handling**: Filter out null weather data from failed fetches
- **Broadcast errors**: Always notify clients of failures via WebSocket

## Tool Routing

### Prefix Format
Agent tools are prefixed with agent name:
```
Original: get_marine_forecast
Prefixed: weather_get_marine_forecast

Original: calculate_route
Prefixed: route_calculate_route
```

### Routing Logic
```typescript
const [agentName, ...toolParts] = name.split('_');
const toolName = toolParts.join('_');

if (this.agents[agentName]) {
  return await this.agents[agentName].handleToolCall(toolName, args);
}
```

### Special Case: plan_passage
- Handled directly by orchestrator (not routed to agent)
- Coordinates all three agents in sequence
- Returns comprehensive passage plan

## Data Structures

### Passage Plan Output
```typescript
{
  id: string;              // UUID for tracking
  request: {               // Original request params
    departure: {...},
    destination: {...},
    vessel: {...},
    preferences: {...}
  },
  route: {                 // From RouteAgent
    waypoints: [...],
    segments: [...],
    totalDistance: number,
    estimatedDuration: number,
    optimized: boolean
  },
  weather: [               // From WeatherAgent (array per waypoint)
    [...forecasts],        // null if fetch failed
  ],
  tides: {...} | null,     // From TidalAgent (null if failed)
  summary: {
    totalDistance: number,
    estimatedDuration: number,
    departureTime: Date,
    estimatedArrival: Date,
    warnings: string[],
    recommendations: string[]
  }
}
```

### WebSocket Message Format
```typescript
{
  type: 'planning_started' | 'agent_active' | 'planning_completed' | 'planning_error',
  planningId: string,
  agent?: string,          // For agent_active
  status?: string,         // For agent_active
  plan?: object,           // For planning_completed
  error?: string,          // For planning_error
  request?: object         // For planning_started
}
```

## Warning Generation

### Weather Warnings
- **Strong winds**: Wind speed > 25 knots anywhere in forecast
- **Rough seas**: Wave height > 3 meters anywhere in forecast

### Recommendations
- **Light winds** (avg < 5 knots): Consider motor sailing
- **Strong winds** (avg > 20 knots): Reef early and monitor
- **Long passages** (> 200nm): Ensure adequate provisions
- **Multi-day** (> 24 hours): Plan watch schedule
- **Always**: File float plan, check safety equipment

## Database Integration

### Supabase Schema
Table: `passages`

### Geography Format
PostGIS POINT format: `POINT(longitude latitude)`
```typescript
departure_coords: `POINT(${lon} ${lat})`
```

### Stored Data
- Passage metadata (IDs, ports, times, distance)
- Route waypoints (JSONB)
- Weather data snapshot (JSONB)
- Tidal data snapshot (JSONB)
- Planning parameters (JSONB)
- Agent responses (JSONB)

### Error Handling
- Log save errors but don't throw
- Allow planning to complete even if save fails
- Client still receives full passage plan

## Health Monitoring

### Agent Health Check
Queries Redis for each agent:
```
agent:health:{agent-name}
  - status: healthy | degraded | offline
  - lastHeartbeat: ISO timestamp
  - metadata: JSON string
```

### Health Response Format
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "agents": {
    "weather": {
      "status": "healthy",
      "lastHeartbeat": "2024-01-01T00:00:00.000Z"
    },
    "tidal": {
      "status": "healthy",
      "lastHeartbeat": "2024-01-01T00:00:00.000Z"
    },
    "route": {
      "status": "healthy",
      "lastHeartbeat": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Readiness Probe
- Checks Redis connectivity via `PING`
- Returns `{ ready: true }` if Redis responds
- Returns 503 status if Redis unavailable

## Graceful Shutdown

### Shutdown Sequence
1. Log shutdown initiation
2. Shutdown all agents (with error handling)
3. Close Redis connection
4. Close all WebSocket clients
5. Close WebSocket server
6. Close HTTP server
7. Log completion

### Signal Handling
- **SIGINT** (Ctrl+C): Graceful shutdown, exit 0
- **SIGTERM** (Docker/Kubernetes): Graceful shutdown, exit 0

## Testing Strategy

### Unit Tests (11 passing)
- ✅ Initialization
- ✅ Agent registration
- ✅ Tool listing
- ✅ Health endpoints
- ✅ WebSocket setup
- ✅ Error handling
- ✅ Workflow components

### Mocking Strategy
- Mock MCP SDK to avoid ESM issues
- Mock Redis for agent health
- Mock Supabase for database saves
- Mock Express/HTTP for server setup
- Mock WebSocket for broadcasting
- Mock Turf.js for geospatial calculations

### Integration Testing
For full integration:
1. Run real Redis instance
2. Use test Supabase project
3. Test actual WebSocket connections
4. Verify agent coordination
5. Check database persistence

## Performance Considerations

### Parallel vs Sequential
Current implementation is **sequential** for predictability:
1. Route (required for next steps)
2. Weather (depends on route waypoints)
3. Tidal (independent but sequential)

### Future Optimization
Weather and tidal could run in **parallel** since tidal doesn't depend on route waypoints:
```typescript
const [weatherData, tidalData] = await Promise.all([
  getWeatherForWaypoints(route.waypoints),
  getTidalPredictions(departure)
]);
```

### Caching Strategy
- Orchestrator doesn't cache (agents handle caching)
- Each agent caches independently with appropriate TTL
- Planning results could be cached by client if needed

## Environment Variables

### Required
- `REDIS_URL` - Redis connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `NOAA_API_KEY` - NOAA API key (optional for some endpoints)
- `OPENWEATHER_API_KEY` - OpenWeather API key

### Optional
- `PORT` - HTTP/WebSocket port (default: 8080)
- `NODE_ENV` - Environment (development, test, production)

## Deployment

### Docker
Already configured in `orchestrator/Dockerfile`:
- Multi-stage build
- Node 20 Alpine base
- Health check on `/health`
- Non-root user
- Port 8080 exposed

### Kubernetes
Health and readiness probes:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Scaling Considerations
- **Stateless**: No local state (uses Redis)
- **Horizontal scaling**: Can run multiple instances
- **Load balancing**: Round-robin or least-connections
- **Session affinity**: Not required (WebSocket reconnects handled by client)

## WebSocket Connection Management

### Client Connection
```typescript
const ws = new WebSocket('ws://localhost:8080');

ws.on('message', (data) => {
  const update = JSON.parse(data);
  
  switch (update.type) {
    case 'planning_started':
      showSpinner(update.planningId);
      break;
    case 'agent_active':
      updateAgentStatus(update.agent, update.status);
      break;
    case 'planning_completed':
      displayPassagePlan(update.plan);
      break;
    case 'planning_error':
      showError(update.error);
      break;
  }
});
```

### Connection Lifecycle
1. Client connects → `connection` event fires
2. Server stores client in `wss.clients` Set
3. Updates broadcast to all clients in Set with `readyState === OPEN`
4. Client disconnects → `close` event fires → client removed from Set

### Error Resilience
- Ignore errors on individual client sends
- Handle client disconnects gracefully
- Don't block on WebSocket sends
- Log connection errors but continue operation

## Future Enhancements

### Phase 3 Additions
1. **Port Agent**: Add port information to planning workflow
2. **Safety Agent**: Include navigation warnings
3. **Wind Agent**: Add sailing-specific wind analysis
4. **Agent Factory**: Dynamic agent creation for new capabilities

### Advanced Features
1. **Request queuing**: Handle multiple concurrent planning requests
2. **Progress tracking**: More granular updates (e.g., "Fetching weather: 3/5 waypoints")
3. **Cancellation**: Allow clients to cancel in-progress planning
4. **Retry logic**: Automatic retry for failed agent calls
5. **Circuit breaker**: Disable failing agents temporarily
6. **Rate limiting**: Per-user planning rate limits
7. **Analytics**: Track planning success rates, agent performance

### Performance Optimizations
1. **Parallel agent calls**: Weather + Tidal simultaneously
2. **Streaming results**: Send partial results as they arrive
3. **Pre-warming**: Keep agents "warm" with periodic health checks
4. **Connection pooling**: Reuse HTTP connections to external APIs

## Troubleshooting

### Common Issues

**Problem**: Agent health shows 'unknown'
- **Cause**: Agent didn't initialize or Redis connection failed
- **Solution**: Check Redis connectivity, verify agent initialization logs

**Problem**: Planning never completes
- **Cause**: Agent hanging on external API call
- **Solution**: Check agent timeout settings, verify API keys are valid

**Problem**: WebSocket clients not receiving updates
- **Cause**: Client disconnected or wrong readyState
- **Solution**: Verify client connection, check `readyState === OPEN`

**Problem**: Database save fails
- **Cause**: Invalid geography format or missing required fields
- **Solution**: Verify POINT format, check all required fields present

### Debugging

Enable detailed logging:
```bash
NODE_ENV=development DEBUG=* npm start
```

Check agent health:
```bash
curl http://localhost:8080/health
```

Check readiness:
```bash
curl http://localhost:8080/ready
```

Monitor WebSocket traffic:
```javascript
wscat -c ws://localhost:8080
```

## Production Checklist

### Before Deployment
- [ ] All environment variables configured
- [ ] Redis connection tested
- [ ] Supabase credentials verified
- [ ] External API keys valid
- [ ] Health endpoint responds
- [ ] Readiness probe passes
- [ ] WebSocket connections work
- [ ] Agent initialization succeeds

### Monitoring
- [ ] Track health endpoint status
- [ ] Monitor WebSocket connection count
- [ ] Alert on agent degraded status
- [ ] Track planning success rate
- [ ] Monitor external API errors
- [ ] Track database save failures

### Security
- [ ] Validate all user inputs
- [ ] Sanitize geography coordinates
- [ ] Rate limit planning requests
- [ ] Authenticate WebSocket connections
- [ ] Encrypt sensitive data in database
- [ ] Use HTTPS/WSS in production

## API Examples

### Health Check
```bash
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "agents": {
    "weather": {
      "status": "healthy",
      "lastHeartbeat": "2024-01-01T12:00:00.000Z"
    },
    "tidal": {
      "status": "healthy",
      "lastHeartbeat": "2024-01-01T12:00:00.000Z"
    },
    "route": {
      "status": "healthy",
      "lastHeartbeat": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

### Plan Passage (via MCP)
```json
{
  "method": "tools/call",
  "params": {
    "name": "plan_passage",
    "arguments": {
      "departure": {
        "port": "Boston, MA",
        "latitude": 42.3601,
        "longitude": -71.0589,
        "time": "2024-07-15T10:00:00Z"
      },
      "destination": {
        "port": "Portland, ME",
        "latitude": 43.6591,
        "longitude": -70.2568
      },
      "vessel": {
        "type": "sailboat",
        "cruiseSpeed": 6,
        "maxSpeed": 8
      },
      "preferences": {
        "avoidNight": true,
        "maxWindSpeed": 25,
        "maxWaveHeight": 2
      }
    }
  }
}
```

### WebSocket Updates (during planning)
```json
// 1. Planning started
{
  "type": "planning_started",
  "planningId": "550e8400-e29b-41d4-a716-446655440000",
  "request": {...}
}

// 2. Agent working
{
  "type": "agent_active",
  "planningId": "550e8400-e29b-41d4-a716-446655440000",
  "agent": "route",
  "status": "Calculating optimal route..."
}

// 3. Next agent
{
  "type": "agent_active",
  "planningId": "550e8400-e29b-41d4-a716-446655440000",
  "agent": "weather",
  "status": "Fetching weather forecast..."
}

// 4. Complete
{
  "type": "planning_completed",
  "planningId": "550e8400-e29b-41d4-a716-446655440000",
  "plan": {...}
}
```

## Testing

### Run All Tests
```bash
cd orchestrator
NODE_ENV=test npm test -- --forceExit
```

### Test Coverage
- 11 passing tests
- Covers initialization, tool routing, health endpoints, WebSocket, error handling

### Mock Dependencies
All external dependencies mocked for isolated testing:
- ✅ MCP SDK (Server, Transport)
- ✅ Redis (ioredis)
- ✅ Supabase
- ✅ Express + HTTP
- ✅ WebSocket (ws)
- ✅ Turf.js
- ✅ Axios

## Metrics to Monitor

### Key Metrics
1. **Planning Success Rate**: % of successful plan_passage calls
2. **Average Planning Time**: Time from started to completed
3. **Agent Health**: % time each agent is healthy vs degraded
4. **WebSocket Connections**: Current and peak concurrent connections
5. **Database Save Rate**: % successful saves to Supabase
6. **External API Errors**: Count by API (NOAA, OpenWeather)

### SLO Targets
- Planning success rate: > 95%
- Average planning time: < 10 seconds
- Agent health: > 99% healthy
- Database save rate: > 99%
- HTTP endpoint latency: < 100ms

## Known Limitations

### Current Version
1. **Sequential processing**: Agents run one at a time (not parallel)
2. **Limited agents**: Only 3 core agents (Weather, Tidal, Route)
3. **No request queuing**: Concurrent requests may overload agents
4. **No authentication**: WebSocket and HTTP endpoints are open
5. **No rate limiting**: Clients can spam planning requests
6. **Simplified warnings**: Basic threshold checks only

### Planned Improvements
1. Parallel agent execution where possible
2. Add Port, Safety, and Wind agents
3. Implement request queue with Redis
4. Add JWT authentication for all endpoints
5. Per-user rate limiting
6. ML-based warning generation
7. Historical data analysis for recommendations

## Development

### Local Setup
```bash
# Install dependencies
cd orchestrator
npm install

# Set env vars
cp ../.env.example .env
# Edit .env with valid API keys

# Run in dev mode
npm run dev

# Run tests
NODE_ENV=test npm test
```

### Building
```bash
npm run build
# Output: dist/Orchestrator.js
```

### Starting
```bash
npm start
# Listens on port 8080 (HTTP + WebSocket)
# MCP server on stdio
```

## Integration with Frontend

### API Client Example
```typescript
import { WebSocket } from 'ws';

class OrchestratorClient {
  private ws: WebSocket;
  
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.setupListeners();
  }
  
  private setupListeners() {
    this.ws.on('message', (data) => {
      const update = JSON.parse(data.toString());
      this.handleUpdate(update);
    });
  }
  
  async planPassage(params: any): Promise<string> {
    // Call via HTTP or MCP
    // Returns planning ID
    // Listen for updates via WebSocket
  }
  
  private handleUpdate(update: any) {
    switch (update.type) {
      case 'planning_completed':
        this.emit('complete', update.plan);
        break;
      case 'planning_error':
        this.emit('error', update.error);
        break;
      // ... other cases
    }
  }
}
```

---

**Status**: Orchestrator COMPLETE ✅
**Agents Coordinated**: 3 (Weather, Tidal, Route)
**Tests Passing**: 11/11
**Ready for**: Frontend integration and deployment

