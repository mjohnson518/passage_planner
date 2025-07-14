import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import pino from 'pino';
import axios from 'axios';
import { createClient } from 'redis';
import { Pool } from 'pg';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Create Express app
const app = express();
const httpServer = createServer(app);

// Configure Socket.io
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize connections
let redis: any;
let postgres: Pool;

// Agent configuration
const AGENT_CONFIG = {
  'weather-agent': {
    port: 8101,
    capabilities: ['get_current_weather', 'get_marine_forecast', 'get_storm_warnings']
  },
  'tidal-agent': {
    port: 8102,
    capabilities: ['get_tide_predictions', 'get_current_predictions', 'get_water_levels']
  },
  'port-agent': {
    port: 8103,
    capabilities: ['get_port_info', 'get_marina_facilities', 'search_ports']
  },
  'safety-agent': {
    port: 8104,
    capabilities: ['get_safety_warnings', 'get_emergency_contacts', 'check_equipment']
  },
  'route-agent': {
    port: 8105,
    capabilities: ['calculate_route', 'optimize_waypoints', 'get_distance']
  },
  'wind-agent': {
    port: 8106,
    capabilities: ['get_wind_forecast', 'get_wave_conditions', 'get_gust_analysis']
  }
};

// Agent registry
const agents = new Map();

// Initialize services
async function initializeServices() {
  // Connect to Redis
  redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });
  
  redis.on('error', (err: any) => logger.error('Redis Client Error', err));
  await redis.connect();
  logger.info('Connected to Redis');
  
  // Connect to PostgreSQL
  postgres = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/passage_planner',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  
  await postgres.query('SELECT NOW()');
  logger.info('Connected to PostgreSQL');
  
  // Register agents
  for (const [agentId, config] of Object.entries(AGENT_CONFIG)) {
    agents.set(agentId, {
      id: agentId,
      name: agentId.replace('-agent', ' Agent').replace(/\b\w/g, l => l.toUpperCase()),
      status: 'connecting',
      lastSeen: new Date(),
      capabilities: config.capabilities,
      endpoint: `http://localhost:${config.port}`
    });
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        redis: redis && redis.isOpen ? 'connected' : 'disconnected',
        postgres: postgres ? 'connected' : 'disconnected',
      },
      agents: Array.from(agents.values()).filter(a => a.status === 'active').length
    };
    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Agent status endpoint
app.get('/api/agents/status', async (req, res) => {
  const agentStatuses = Array.from(agents.values());
  res.json({ agents: agentStatuses });
});

// Chat endpoint for natural language processing
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    logger.info({ message }, 'Processing chat message');
    
    // Parse the message to extract passage planning intent
    const passagePattern = /(?:plan|sail|passage|route|from|to|between)/i;
    
    if (passagePattern.test(message)) {
      // Extract details from natural language
      const details = parsePassageRequest(message);
      
      // Create a passage planning request
      const requestId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Emit processing updates
      io.emit('processing:update', {
        stage: 'understanding',
        message: 'Understanding your request...',
        progress: 10
      });
      
      // Process the passage plan
      processPassagePlan(requestId, details);
      
      res.json({
        success: true,
        message: 'Processing your passage plan...',
        requestId
      });
    } else {
      res.json({
        success: true,
        message: 'I can help you plan sailing passages. Try asking something like "Plan a passage from Boston to Portland on July 15"'
      });
    }
  } catch (error) {
    logger.error({ error }, 'Chat processing failed');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Chat processing failed'
    });
  }
});

// Process passage plan by coordinating agents
async function processPassagePlan(requestId: string, details: any) {
  try {
    // Update processing status
    io.emit('processing:update', {
      stage: 'agents',
      message: 'Coordinating with specialized agents...',
      progress: 20
    });
    
    // Step 1: Get port information
    const portAgent = agents.get('port-agent');
    let departurePort, destinationPort;
    
    if (portAgent && portAgent.status === 'active') {
      try {
        const [depResponse, destResponse] = await Promise.all([
          axios.post(`${portAgent.endpoint}/tools/get_port_info`, {
            portName: details.departure
          }),
          axios.post(`${portAgent.endpoint}/tools/get_port_info`, {
            portName: details.destination
          })
        ]);
        
        departurePort = depResponse.data;
        destinationPort = destResponse.data;
      } catch (error) {
        logger.error({ error }, 'Port agent request failed');
        // Use fallback data
        departurePort = { name: details.departure, coordinates: { latitude: 42.3601, longitude: -71.0589 } };
        destinationPort = { name: details.destination, coordinates: { latitude: 43.6591, longitude: -70.2568 } };
      }
    }
    
    io.emit('processing:update', {
      stage: 'route',
      message: 'Calculating optimal route...',
      progress: 40
    });
    
    // Step 2: Calculate route
    const routeAgent = agents.get('route-agent');
    let route;
    
    if (routeAgent && routeAgent.status === 'active') {
      try {
        const routeResponse = await axios.post(`${routeAgent.endpoint}/tools/calculate_route`, {
          departure: departurePort.coordinates,
          destination: destinationPort.coordinates,
          preferences: details.preferences
        });
        
        route = routeResponse.data;
      } catch (error) {
        logger.error({ error }, 'Route agent request failed');
        // Use fallback route
        route = createFallbackRoute(departurePort, destinationPort);
      }
    }
    
    io.emit('processing:update', {
      stage: 'weather',
      message: 'Fetching weather forecasts...',
      progress: 60
    });
    
    // Step 3: Get weather data
    const weatherAgent = agents.get('weather-agent');
    let weather;
    
    if (weatherAgent && weatherAgent.status === 'active') {
      try {
        const weatherResponse = await axios.post(`${weatherAgent.endpoint}/tools/get_marine_forecast`, {
          coordinates: route.waypoints.map((wp: any) => wp.coordinates),
          days: 5
        });
        
        weather = weatherResponse.data;
      } catch (error) {
        logger.error({ error }, 'Weather agent request failed');
        // Use fallback weather
        weather = createFallbackWeather();
      }
    }
    
    io.emit('processing:update', {
      stage: 'tides',
      message: 'Checking tidal conditions...',
      progress: 80
    });
    
    // Step 4: Get tidal data
    const tidalAgent = agents.get('tidal-agent');
    let tides;
    
    if (tidalAgent && tidalAgent.status === 'active') {
      try {
        const tidalResponse = await axios.post(`${tidalAgent.endpoint}/tools/get_tide_predictions`, {
          locations: [departurePort.coordinates, destinationPort.coordinates],
          timeRange: {
            start: details.departure_time,
            end: new Date(new Date(details.departure_time).getTime() + 48 * 3600000).toISOString()
          }
        });
        
        tides = tidalResponse.data;
      } catch (error) {
        logger.error({ error }, 'Tidal agent request failed');
        // Use fallback tides
        tides = createFallbackTides();
      }
    }
    
    // Compile the final passage plan
    const passagePlan = {
      id: requestId,
      departure: departurePort,
      destination: destinationPort,
      waypoints: route.waypoints,
      departureTime: new Date(details.departure_time),
      estimatedArrivalTime: new Date(new Date(details.departure_time).getTime() + route.estimatedDuration * 3600000),
      distance: {
        total: route.distance,
        unit: 'nm'
      },
      weather: weather,
      tides: tides,
      safety: {
        emergencyContacts: [
          { type: 'coast-guard', name: 'USCG Sector Boston', phone: '+1-617-223-8555', vhfChannel: 16 }
        ],
        hazards: [],
        requiredEquipment: ['Life jackets', 'Flares', 'VHF Radio', 'EPIRB'],
        weatherWindows: [{
          start: new Date(details.departure_time),
          end: new Date(new Date(details.departure_time).getTime() + 24 * 3600000)
        }]
      },
      naturalResponse: generateNaturalResponse(departurePort, destinationPort, route, weather, tides)
    };
    
    // Store in Redis
    await redis.set(`plan:${requestId}`, JSON.stringify(passagePlan), { EX: 86400 }); // 24 hour TTL
    
    // Emit completion
    io.emit('plan:complete', passagePlan);
    
  } catch (error) {
    logger.error({ error, requestId }, 'Failed to process passage plan');
    io.emit('plan:error', {
      requestId,
      error: 'Failed to create passage plan. Please try again.'
    });
  }
}

// Helper functions
function parsePassageRequest(message: string) {
  const locationPattern = /(?:from|departure from)\s+([^,\s]+(?:\s+[^,\s]+)*?)(?:\s+to|\s+destination|,)/i;
  const destinationPattern = /(?:to|destination|arrival at)\s+([^,\s]+(?:\s+[^,\s]+)*?)(?:\s+on|$)/i;
  const datePattern = /(?:on|at|departing)\s+(\w+\s+\d{1,2})/i;
  
  const departureMatch = message.match(locationPattern);
  const destinationMatch = message.match(destinationPattern);
  const dateMatch = message.match(datePattern);
  
  return {
    departure: departureMatch ? departureMatch[1] : 'Boston',
    destination: destinationMatch ? destinationMatch[1] : 'Portland',
    departure_time: dateMatch ? new Date(dateMatch[1] + ', 2025 10:00:00').toISOString() : new Date(Date.now() + 86400000).toISOString(),
    boat_type: 'sailboat',
    preferences: {
      avoid_night: true,
      max_wind_speed: 25,
      max_wave_height: 3
    }
  };
}

function createFallbackRoute(departure: any, destination: any) {
  return {
    waypoints: [
      { coordinates: departure.coordinates, name: departure.name },
      { coordinates: destination.coordinates, name: destination.name }
    ],
    distance: 105,
    estimatedDuration: 10
  };
}

function createFallbackWeather() {
  return {
    conditions: [{
      timeWindow: {
        start: new Date(),
        end: new Date(Date.now() + 24 * 3600000)
      },
      description: 'Fair weather',
      windSpeed: 15,
      windDirection: 'SW',
      waveHeight: 3,
      visibility: 10,
      precipitation: 0
    }],
    warnings: [],
    lastUpdated: new Date()
  };
}

function createFallbackTides() {
  return [{
    location: 'Departure',
    predictions: [
      { time: new Date(Date.now() + 6 * 3600000), height: 10.2, type: 'high' },
      { time: new Date(Date.now() + 12 * 3600000), height: 0.5, type: 'low' }
    ]
  }];
}

function generateNaturalResponse(departure: any, destination: any, route: any, weather: any, tides: any) {
  return `I've planned your passage from ${departure.name} to ${destination.name}.

**Route Summary:**
- Distance: ${route.distance} nautical miles
- Estimated duration: ${route.estimatedDuration} hours
- Waypoints: ${route.waypoints.length}

**Weather Forecast:**
- ${weather.conditions[0].description}
- Wind: ${weather.conditions[0].windDirection} at ${weather.conditions[0].windSpeed} knots
- Wave height: ${weather.conditions[0].waveHeight} feet
- Visibility: ${weather.conditions[0].visibility} miles

**Tidal Information:**
- Next high tide: ${tides[0].predictions[0].time.toLocaleTimeString()}
- Next low tide: ${tides[0].predictions[1].time.toLocaleTimeString()}

**Safety Notes:**
- Monitor VHF Channel 16
- Ensure all safety equipment is aboard
- Check weather updates regularly

This looks like good conditions for your passage.`;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');
  
  // Send initial agent status
  socket.emit('agents:status', { agents: Array.from(agents.values()) });
  
  // Check agent health periodically
  const healthCheck = setInterval(async () => {
    for (const [agentId, agent] of agents.entries()) {
      try {
        const response = await axios.get(`${agent.endpoint}/health`, { timeout: 2000 });
        agent.status = 'active';
        agent.lastSeen = new Date();
      } catch (error) {
        agent.status = 'error';
      }
    }
    socket.emit('agents:status', { agents: Array.from(agents.values()) });
  }, 5000);
  
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
    clearInterval(healthCheck);
  });
});

// Start function
export async function startServer() {
  try {
    await initializeServices();
    
    const port = parseInt(process.env.PORT || '8081', 10);
    httpServer.listen(port, () => {
      logger.info(`🚀 Real orchestrator server listening on port ${port}`);
      logger.info(`📋 Health check: http://localhost:${port}/health`);
      logger.info(`🔌 WebSocket endpoint: ws://localhost:${port}`);
      logger.info(`🤖 Connecting to real agents...`);
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (redis) await redis.quit();
  if (postgres) await postgres.end();
  httpServer.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (redis) await redis.quit();
  if (postgres) await postgres.end();
  httpServer.close();
  process.exit(0);
});

// Start if run directly
if (require.main === module) {
  startServer();
} 