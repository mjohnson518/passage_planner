// orchestrator/src/server.ts
// HTTP/WebSocket Server for Orchestrator

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import pino from 'pino';
import { OrchestratorService } from './index';

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

// Initialize orchestrator
let orchestrator: OrchestratorService;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        redis: orchestrator ? 'connected' : 'disconnected',
        postgres: orchestrator ? 'connected' : 'disconnected',
      },
      agents: orchestrator ? await orchestrator.getConnectedAgents() : []
    };
    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// MCP tool call endpoint
app.post('/api/mcp/tools/call', async (req, res) => {
  try {
    const { tool, arguments: args } = req.body;
    
    if (!orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Handle different tool calls
    let result;
    switch (tool) {
      case 'plan_passage':
        result = await orchestrator.handlePassagePlanning(requestId, args);
        break;
      case 'get_weather_briefing':
        result = await orchestrator.handleWeatherBriefing(requestId, args);
        break;
      case 'check_agent_status':
        result = await orchestrator.handleAgentStatus(requestId);
        break;
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
    
    res.json({ success: true, result });
  } catch (error) {
    logger.error({ error }, 'Tool call failed');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Tool call failed'
    });
  }
});

// Agent registration endpoint
app.post('/api/agents/register', async (req, res) => {
  try {
    const { agentId, capabilities } = req.body;
    
    if (!orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    
    await orchestrator.registerAgent(agentId, capabilities);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Agent registration failed');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    });
  }
});

// Agent status endpoint
app.get('/api/agents/status', async (req, res) => {
  try {
    if (!orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    
    const agents = await orchestrator.getAgentStatuses();
    res.json({ agents });
  } catch (error) {
    logger.error({ error }, 'Failed to get agent status');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    });
  }
});

// Chat endpoint for natural language processing
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    
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
      
      // Call the orchestrator
      const result = await orchestrator.handlePassagePlanning(requestId, {
        ...details,
        userId: 'web-user',
        naturalLanguage: true
      });
      
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

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');
  
  // Send initial agent status
  if (orchestrator) {
    orchestrator.getAgentStatuses().then(agents => {
      socket.emit('agents:status', { agents });
    });
  }
  
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

// Helper function to parse passage request from natural language
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

// Start function
export async function startServer() {
  try {
    // Initialize orchestrator
    orchestrator = new OrchestratorService();
    
    // Set up event forwarding
    orchestrator.on('processing:update', (data) => {
      io.emit('processing:update', data);
    });
    
    orchestrator.on('plan:complete', (data) => {
      io.emit('plan:complete', data);
    });
    
    orchestrator.on('agent:status', (data) => {
      io.emit('agent:status', data);
    });
    
    // Start orchestrator
    await orchestrator.start();
    
    // Start HTTP server
    const port = parseInt(process.env.PORT || '8081', 10);
    httpServer.listen(port, () => {
      logger.info(`🚀 Orchestrator server listening on port ${port}`);
      logger.info(`📋 Health check: http://localhost:${port}/health`);
      logger.info(`🔌 WebSocket endpoint: ws://localhost:${port}`);
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (orchestrator) {
    await orchestrator.shutdown();
  }
  httpServer.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (orchestrator) {
    await orchestrator.shutdown();
  }
  httpServer.close();
  process.exit(0);
});

// Export for use in other modules
export { io, orchestrator }; 