import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { OrchestratorService } from './index';
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
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Initialize orchestrator
const orchestrator = new OrchestratorService();

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  };
  res.json(health);
});

// Agent registration endpoint
app.post('/api/agents/register', async (req, res) => {
  try {
    const agentSummary = req.body;
    logger.info({ agentId: agentSummary.agentId }, 'Agent registration request');
    
    orchestrator.emit('agent:register', agentSummary);
    
    res.json({ 
      success: true, 
      message: `Agent ${agentSummary.agentId} registered successfully` 
    });
  } catch (error: any) {
    logger.error({ error }, 'Agent registration failed');
    res.status(500).json({ error: error.message });
  }
});

// MCP tool call endpoint
app.post('/api/mcp/tools/call', async (req, res) => {
  try {
    const { tool, arguments: args } = req.body;
    
    logger.info({ tool, args }, 'Received tool call request');
    
    // Call the orchestrator's tool handler
    let result;
    switch (tool) {
      case 'plan_passage':
        result = await orchestrator['handlePassagePlanning'](
          `http-${Date.now()}`,
          args
        );
        break;
      case 'get_weather_briefing':
        result = await orchestrator['handleWeatherBriefing'](
          `http-${Date.now()}`,
          args
        );
        break;
      case 'check_agent_status':
        result = await orchestrator['handleAgentStatus'](
          `http-${Date.now()}`
        );
        break;
      default:
        return res.status(400).json({ error: `Unknown tool: ${tool}` });
    }
    
    res.json(result);
  } catch (error: any) {
    logger.error({ error }, 'Tool call failed');
    res.status(500).json({ error: error.message });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');
  
  // Send initial agent status
  socket.emit('agent:status', {
    id: 'orchestrator',
    name: 'Orchestrator',
    status: 'active'
  });
  
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
  
  socket.on('error', (error) => {
    logger.error({ socketId: socket.id, error }, 'Socket error');
  });
});

// Subscribe to orchestrator events and forward to clients
orchestrator.on('agent:status', (status) => {
  io.emit('agent:status', status);
});

orchestrator.on('processing:update', (update) => {
  io.emit('processing:update', update);
});

orchestrator.on('plan:complete', (plan) => {
  io.emit('plan:complete', plan);
});

// Create server instance
export async function createServer() {
  // Start orchestrator
  await orchestrator.start();
  return httpServer;
}

// Start server
export async function startServer() {
  try {
    const server = await createServer();
    
    // Start HTTP server
    const port = process.env.PORT || 8080;
    server.listen(port, () => {
      logger.info(`Server listening on port ${port}`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('HTTP server closed');
      });
      await orchestrator.shutdown();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start if run directly
if (require.main === module) {
  startServer();
} 