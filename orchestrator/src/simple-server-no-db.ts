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
  { id: 'weather-agent', name: 'Weather Agent', status: 'active', lastSeen: new Date() },
  { id: 'tidal-agent', name: 'Tidal Agent', status: 'active', lastSeen: new Date() },
  { id: 'port-agent', name: 'Port Agent', status: 'idle', lastSeen: new Date() },
  { id: 'route-agent', name: 'Route Agent', status: 'active', lastSeen: new Date() },
  { id: 'safety-agent', name: 'Safety Agent', status: 'idle', lastSeen: new Date() },
  { id: 'wind-agent', name: 'Wind Agent', status: 'active', lastSeen: new Date() }
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
    res.json({
      success: true,
      plan: mockPlan
    });
  }, 3000);
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
  
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
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