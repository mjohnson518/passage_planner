import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Create Express app
const app = express();
const httpServer = createHttpServer(app);

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

// In-memory storage (replace with database later)
const mockAgents = [
  { id: 'weather-agent', name: 'Weather Agent', status: 'active', lastSeen: new Date(), capabilities: ['get_current_weather', 'get_marine_forecast'] },
  { id: 'tidal-agent', name: 'Tidal Agent', status: 'active', lastSeen: new Date(), capabilities: ['get_tide_predictions', 'get_current_predictions'] },
  { id: 'port-agent', name: 'Port Agent', status: 'active', lastSeen: new Date(), capabilities: ['get_port_info', 'get_marina_facilities'] },
  { id: 'route-agent', name: 'Route Agent', status: 'active', lastSeen: new Date(), capabilities: ['calculate_route', 'optimize_waypoints'] },
  { id: 'safety-agent', name: 'Safety Agent', status: 'active', lastSeen: new Date(), capabilities: ['get_safety_warnings', 'get_emergency_contacts'] },
  { id: 'wind-agent', name: 'Wind Agent', status: 'active', lastSeen: new Date(), capabilities: ['get_wind_forecast', 'get_gust_analysis'] }
];

// Health check endpoint
app.get('/health', async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    services: {
      redis: 'mock',
      postgres: 'mock',
    }
  });
});

// Passage planning endpoint
app.post('/api/passage/plan', async (req, res) => {
  const { departure, destination, departureTime, boatType, preferences } = req.body;
  
  logger.info({ departure, destination }, 'Planning passage');
  
  // Simulate processing
  io.emit('processing:update', {
    stage: 'analyzing',
    message: 'Analyzing route options...',
    progress: 20
  });
  
  setTimeout(() => {
    io.emit('processing:update', {
      stage: 'weather',
      message: 'Fetching weather data...',
      progress: 40
    });
  }, 1000);
  
  setTimeout(() => {
    io.emit('processing:update', {
      stage: 'tides',
      message: 'Calculating tidal windows...',
      progress: 60
    });
  }, 2000);
  
  // Mock passage plan
  const mockPlan = {
    id: `plan-${Date.now()}`,
    departure: {
      name: departure,
      coordinates: { latitude: 42.3601, longitude: -71.0589 }
    },
    destination: {
      name: destination,
      coordinates: { latitude: 43.6591, longitude: -70.2568 }
    },
    waypoints: [
      {
        id: 'wp-1',
        name: 'Cape Ann',
        coordinates: { latitude: 42.6197, longitude: -70.5883 },
        estimatedArrival: new Date(Date.now() + 3600000)
      },
      {
        id: 'wp-2',
        name: 'Isles of Shoals',
        coordinates: { latitude: 42.9867, longitude: -70.6233 },
        estimatedArrival: new Date(Date.now() + 7200000)
      }
    ],
    departureTime: new Date(departureTime),
    estimatedArrivalTime: new Date(Date.now() + 14400000),
    distance: {
      total: 105,
      unit: 'nm'
    },
    weather: {
      conditions: [{
        timeWindow: {
          start: new Date(),
          end: new Date(Date.now() + 14400000)
        },
        description: 'Partly cloudy',
        windSpeed: 12,
        windDirection: 'NW',
        waveHeight: 2,
        visibility: 10,
        precipitation: 0
      }],
      warnings: [],
      lastUpdated: new Date()
    },
    tides: [
      {
        location: 'Boston',
        predictions: [
          { time: new Date(Date.now() + 21600000), height: 10.2, type: 'high' },
          { time: new Date(Date.now() + 43200000), height: 0.5, type: 'low' }
        ]
      }
    ],
    safety: {
      emergencyContacts: [
        { type: 'coast-guard', name: 'USCG Boston', phone: '+1-617-555-0123', vhfChannel: 16 }
      ],
      hazards: [],
      requiredEquipment: ['Life jackets', 'Flares', 'VHF Radio', 'EPIRB'],
      weatherWindows: [{
        start: new Date(),
        end: new Date(Date.now() + 28800000)
      }]
    }
  };
  
  // Emit completion after delay
  setTimeout(() => {
    io.emit('plan:complete', mockPlan);
  }, 3000);
  
  res.json({
    success: true,
    plan: mockPlan
  });
});

// Chat endpoint for natural language processing
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  
  logger.info({ message }, 'Processing chat message');
  
  // Simple pattern matching for passage planning
  const passagePattern = /(?:plan|sail|passage|route|from|to|between)/i;
  const locationPattern = /(?:from|departure from)\s+([^,\s]+(?:\s+[^,\s]+)*?)(?:\s+to|\s+destination|,)/i;
  const destinationPattern = /(?:to|destination|arrival at)\s+([^,\s]+(?:\s+[^,\s]+)*?)(?:\s+on|$)/i;
  const datePattern = /(?:on|at|departing)\s+(\w+\s+\d{1,2})/i;
  
  if (passagePattern.test(message)) {
    // Extract locations
    const departureMatch = message.match(locationPattern);
    const destinationMatch = message.match(destinationPattern);
    const dateMatch = message.match(datePattern);
    
    const departure = departureMatch ? departureMatch[1] : 'Boston';
    const destination = destinationMatch ? destinationMatch[1] : 'Portland';
    const departureTime = dateMatch ? new Date(dateMatch[1] + ', 2025 10:00:00') : new Date(Date.now() + 86400000);
    
    logger.info({ departure, destination, departureTime }, 'Extracted passage details from chat');
    
    // Simulate agent processing
    io.emit('processing:update', {
      stage: 'understanding',
      message: 'Understanding your request...',
      progress: 10
    });
    
    setTimeout(() => {
      io.emit('processing:update', {
        stage: 'analyzing',
        message: `Planning passage from ${departure} to ${destination}...`,
        progress: 30
      });
    }, 500);
    
    setTimeout(() => {
      io.emit('processing:update', {
        stage: 'weather',
        message: 'Consulting weather agents...',
        progress: 50
      });
    }, 1500);
    
    setTimeout(() => {
      io.emit('processing:update', {
        stage: 'tides',
        message: 'Checking tidal conditions...',
        progress: 70
      });
    }, 2500);
    
    // Create a comprehensive passage plan
    const plan = {
      id: `plan-${Date.now()}`,
      departure: {
        name: departure,
        coordinates: { latitude: 42.3601, longitude: -71.0589 },
        country: 'US'
      },
      destination: {
        name: destination,
        coordinates: { latitude: 43.6591, longitude: -70.2568 },
        country: 'US'
      },
      waypoints: [
        {
          id: 'wp-1',
          name: 'Cape Ann',
          coordinates: { latitude: 42.6197, longitude: -70.5883 },
          estimatedArrival: new Date(departureTime.getTime() + 3600000 * 3)
        },
        {
          id: 'wp-2',
          name: 'Portsmouth Harbor',
          coordinates: { latitude: 43.0718, longitude: -70.7626 },
          estimatedArrival: new Date(departureTime.getTime() + 3600000 * 7)
        }
      ],
      departureTime: departureTime,
      estimatedArrivalTime: new Date(departureTime.getTime() + 3600000 * 10),
      distance: {
        total: 105,
        unit: 'nm'
      },
      weather: {
        conditions: [{
          timeWindow: {
            start: departureTime,
            end: new Date(departureTime.getTime() + 3600000 * 12)
          },
          description: 'Fair weather with moderate winds',
          windSpeed: 15,
          windDirection: 'SW',
          waveHeight: 3,
          visibility: 10,
          precipitation: 0
        }],
        warnings: [],
        lastUpdated: new Date()
      },
      tides: [
        {
          location: departure,
          predictions: [
            { time: new Date(departureTime.getTime() + 3600000 * 2), height: 10.2, type: 'high' },
            { time: new Date(departureTime.getTime() + 3600000 * 8), height: 0.5, type: 'low' }
          ]
        }
      ],
      safety: {
        emergencyContacts: [
          { type: 'coast-guard', name: 'USCG Sector Boston', phone: '+1-617-223-8555', vhfChannel: 16 }
        ],
        hazards: [],
        requiredEquipment: ['Life jackets', 'Flares', 'VHF Radio', 'EPIRB'],
        weatherWindows: [{
          start: departureTime,
          end: new Date(departureTime.getTime() + 3600000 * 12)
        }]
      },
      naturalResponse: `I've planned your passage from ${departure} to ${destination}, departing on ${departureTime.toLocaleDateString()}.

**Route Summary:**
- Distance: 105 nautical miles
- Estimated duration: 10 hours
- Key waypoints: Cape Ann, Portsmouth Harbor

**Weather Forecast:**
- Fair conditions with southwest winds at 15 knots
- Wave height: 3 feet
- Good visibility (10 miles)

**Tidal Information:**
- High tide at ${departure}: 2 hours after departure
- Favorable current for most of the journey

**Safety Notes:**
- Monitor VHF Channel 16
- USCG Sector Boston: +1-617-223-8555
- Ensure all safety equipment is aboard

This looks like excellent conditions for your passage. The southwest wind will give you a nice beam reach for most of the journey.`
    };
    
    // Emit the plan after processing
    setTimeout(() => {
      io.emit('plan:complete', plan);
    }, 3500);
    
    res.json({
      success: true,
      message: 'Processing your passage plan...'
    });
  } else {
    // Handle non-passage planning queries
    res.json({
      success: true,
      message: 'I can help you plan sailing passages. Try asking something like "Plan a passage from Boston to Portland on July 15"'
    });
  }
});

// Agent status endpoint
app.get('/api/agents/status', async (req, res) => {
  // Randomly update agent status
  mockAgents.forEach(agent => {
    if (Math.random() > 0.7) {
      agent.status = agent.status === 'active' ? 'idle' : 'active';
      agent.lastSeen = new Date();
    }
  });
  
  res.json({ agents: mockAgents });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');
  
  // Send initial agent status
  socket.emit('agents:status', { agents: mockAgents });
  
  // Send periodic agent status updates
  const statusInterval = setInterval(() => {
    // Simulate some agents changing status
    mockAgents.forEach(agent => {
      // Randomly update last seen time
      agent.lastSeen = new Date();
      // Occasionally change status
      if (Math.random() > 0.8) {
        agent.status = agent.status === 'active' ? 'processing' : 'active';
      }
    });
    socket.emit('agents:status', { agents: mockAgents });
  }, 5000); // Every 5 seconds
  
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
    clearInterval(statusInterval);
  });
  
  socket.on('request:status', () => {
    socket.emit('status:update', {
      activeRequests: Math.floor(Math.random() * 5),
      queueDepth: Math.floor(Math.random() * 10),
      agents: mockAgents.filter(a => a.status === 'active').length
    });
  });
});

// Start function
export async function startServer() {
  try {
    const port = parseInt(process.env.PORT || '8080', 10);
    httpServer.listen(port, () => {
      logger.info(`🚀 Server listening on port ${port}`);
      logger.info(`📋 Health check: http://localhost:${port}/health`);
      logger.info(`🔌 WebSocket endpoint: ws://localhost:${port}`);
      logger.info(`🗺️  API endpoints:`);
      logger.info(`   POST http://localhost:${port}/api/passage/plan`);
      logger.info(`   GET  http://localhost:${port}/api/agents/status`);
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  httpServer.close();
  process.exit(0);
});

// Start if run directly
if (require.main === module) {
  startServer();
} 