# Local Testing Guide - Frontend + Orchestrator

## Prerequisites

1. **Redis running** (required for agent caching):
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   ```

2. **Environment variables** configured:
   ```bash
   cp env.example .env
   # Edit .env with your API keys
   ```

3. **Dependencies installed**:
   ```bash
   npm install
   ```

## Step-by-Step Local Testing

### Terminal 1: Start Orchestrator

```bash
cd /Users/marcjohnson/Desktop/MJ2/Stuff/MJ_Info/Projects/sail/passage-planner/orchestrator

# Install dependencies if needed
npm install

# Set environment variables
export REDIS_URL=redis://localhost:6379
export NOAA_API_KEY=your-key-here
export OPENWEATHER_API_KEY=your-key-here
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_KEY=your-service-key
export PORT=8080

# Start orchestrator
npm start
```

**Expected output:**
```
All agents initialized
weather-agent agent initialized
tidal-agent agent initialized
route-agent agent initialized
HTTP server listening on port 8080
WebSocket server listening on port 8080
MCP server started on stdio
```

### Terminal 2: Start Frontend

```bash
cd /Users/marcjohnson/Desktop/MJ2/Stuff/MJ_Info/Projects/sail/passage-planner/frontend

# Install dependencies if needed
npm install

# Set environment variables
export NEXT_PUBLIC_API_URL=http://localhost:8080
export NEXT_PUBLIC_WS_URL=ws://localhost:8080
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Start frontend
npm run dev
```

**Expected output:**
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Ready in X.Xs
```

### Terminal 3: Test API Health

```bash
# Check orchestrator health
curl http://localhost:8080/health

# Check readiness
curl http://localhost:8080/ready

# Test WebSocket connection
wscat -c ws://localhost:8080
# You should see: Connected (press ^C to disconnect)
```

## Testing the Planning Workflow

### 1. Open Browser
Navigate to: `http://localhost:3000/planner`

### 2. Fill Out Form
- **Departure Port**: Boston, MA
- **Destination Port**: Portland, ME
- **Departure Date**: Select any future date
- **Boat Type**: Sailboat
- **Cruise Speed**: 6 kts
- **Max Speed**: 8 kts

### 3. Submit and Watch
Click "Plan Passage" button and observe:

#### Frontend UI Updates:
1. **Planning in Progress** card appears
2. **WebSocket status**: Should show 🟢 Connected
3. **Agent statuses** appear one by one:
   - `route: Calculating optimal route...`
   - `weather: Fetching weather forecast...`
   - `tidal: Calculating tides and currents...`
4. **Passage Plan Ready** card appears with:
   - Total distance (~87 nautical miles Boston→Portland)
   - Estimated duration (~14-15 hours at 6 kts)
   - Warnings (if weather is bad)
   - Recommendations

#### Browser Console Logs:
```
WebSocket connected to orchestrator
Planning started: <uuid>
route: Calculating optimal route...
weather: Fetching weather forecast...
tidal: Calculating tides and currents...
Passage plan complete!
```

#### Orchestrator Terminal Output:
```
weather-agent agent initialized
tidal-agent agent initialized
route-agent agent initialized
WebSocket client connected
{Planning workflow logs...}
```

## Troubleshooting

### WebSocket Shows 🔴 Disconnected

**Problem**: Frontend can't connect to WebSocket  
**Solutions**:
1. Check orchestrator is running on port 8080
2. Verify `NEXT_PUBLIC_WS_URL=ws://localhost:8080` in frontend env
3. Check browser console for connection errors
4. Ensure no firewall blocking WebSocket connections

### Planning Never Completes

**Problem**: Request hangs, no updates  
**Solutions**:
1. Check orchestrator terminal for errors
2. Verify Redis is running: `redis-cli ping` → `PONG`
3. Check API keys are valid (NOAA, OpenWeather)
4. Look for agent timeout/retry errors in orchestrator logs

### "Failed to save passage" in Orchestrator Logs

**Problem**: Database save fails  
**Solutions**:
1. Check Supabase credentials are correct
2. Verify `passages` table exists in database
3. Check RLS policies allow inserts
4. **Note**: Planning will still complete even if save fails!

### Agent Status Shows "unknown"

**Problem**: Can't read agent health from Redis  
**Solutions**:
1. Check Redis is accessible
2. Verify agents initialized successfully
3. Check Redis keys: `redis-cli KEYS "agent:health:*"`

### CORS Errors in Browser

**Problem**: Browser blocks API calls  
**Solutions**:
1. Check orchestrator CORS middleware includes `http://localhost:3000`
2. Verify frontend is running on port 3000
3. Check browser console for specific CORS error

## Expected API Responses

### POST /api/plan
**Request**:
```json
{
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
  }
}
```

**Response**:
```json
{
  "success": true,
  "plan": {
    "id": "uuid-here",
    "route": {
      "waypoints": [...],
      "totalDistance": 87.3,
      "estimatedDuration": 14.55
    },
    "weather": [...],
    "tides": {...},
    "summary": {
      "totalDistance": 87.3,
      "estimatedDuration": 14.55,
      "warnings": [...],
      "recommendations": [...]
    }
  }
}
```

### WebSocket Messages

**1. Planning Started**:
```json
{
  "type": "planning_started",
  "planningId": "uuid",
  "request": {...}
}
```

**2. Agent Active**:
```json
{
  "type": "agent_active",
  "planningId": "uuid",
  "agent": "route",
  "status": "Calculating optimal route..."
}
```

**3. Planning Complete**:
```json
{
  "type": "planning_completed",
  "planningId": "uuid",
  "plan": {...}
}
```

## Performance Expectations

### Local Development
- **Planning Time**: 5-15 seconds
  - Route calculation: < 1 second
  - Weather fetch: 2-5 seconds (external API)
  - Tidal fetch: 2-5 seconds (external API)
  - Summary generation: < 1 second

### Network Latency
- **WebSocket latency**: < 50ms locally
- **HTTP API calls**: < 100ms locally
- **External APIs**: 1-3 seconds (NOAA, OpenWeather)

## Next Steps After Local Testing

Once everything works locally:

1. **Test with real coordinates**:
   - Try different departure/destination ports
   - Test long routes (>200nm)
   - Test with waypoints

2. **Test error scenarios**:
   - Invalid coordinates
   - Missing API keys
   - Redis down
   - Supabase down

3. **Test concurrent requests**:
   - Open multiple browser tabs
   - Submit plans simultaneously
   - Verify WebSocket updates go to correct clients

4. **Prepare for deployment**:
   - Document production environment variables
   - Test Docker builds
   - Verify CORS for production domain
   - Set up Railway configuration

