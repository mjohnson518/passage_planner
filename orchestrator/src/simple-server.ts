import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import pino from 'pino';
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

// Initialize Redis
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Initialize PostgreSQL
const postgres = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin:secure_password@localhost:5432/passage_planner',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const redisConnected = redis.isOpen;
    const pgResult = await postgres.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      services: {
        redis: redisConnected,
        postgres: pgResult.rowCount === 1,
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Passage planning endpoint
app.post('/api/passage/plan', async (req, res) => {
  const { departure, destination, departureTime, boatType, preferences } = req.body;
  
  logger.info({ departure, destination }, 'Planning passage');
  
  // For now, return a mock response
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
    tides: [],
    safety: {
      emergencyContacts: [],
      hazards: [],
      requiredEquipment: ['Life jackets', 'Flares', 'VHF Radio'],
      weatherWindows: []
    }
  };
  
  // Emit to WebSocket clients
  io.emit('plan:complete', mockPlan);
  
  res.json({
    success: true,
    plan: mockPlan
  });
});

// Agent status endpoint
app.get('/api/agents/status', async (req, res) => {
  res.json({
    agents: [
      { id: 'weather-agent', name: 'Weather Agent', status: 'active', lastSeen: new Date() },
      { id: 'tidal-agent', name: 'Tidal Agent', status: 'active', lastSeen: new Date() },
      { id: 'port-agent', name: 'Port Agent', status: 'idle', lastSeen: new Date() },
      { id: 'route-agent', name: 'Route Agent', status: 'active', lastSeen: new Date() },
      { id: 'safety-agent', name: 'Safety Agent', status: 'idle', lastSeen: new Date() },
      { id: 'wind-agent', name: 'Wind Agent', status: 'active', lastSeen: new Date() }
    ]
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');
  
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
  
  socket.on('request:status', () => {
    socket.emit('status:update', {
      activeRequests: 0,
      queueDepth: 0,
      agents: 6
    });
  });
});

// Start function
export async function startServer() {
  try {
    // Connect to Redis
    await redis.connect();
    logger.info('Connected to Redis');
    
    // Test PostgreSQL connection
    await postgres.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');
    
    // Start HTTP server
    const port = parseInt(process.env.PORT || '8080', 10);
    httpServer.listen(port, () => {
      logger.info(`Server listening on port ${port}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`WebSocket endpoint: ws://localhost:${port}`);
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    if (error instanceof Error) {
      logger.error(`Error details: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close();
  await redis.quit();
  await postgres.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  httpServer.close();
  await redis.quit();
  await postgres.end();
  process.exit(0);
});

// Start if run directly
if (require.main === module) {
  startServer();
} 