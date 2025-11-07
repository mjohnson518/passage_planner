/**
 * Helmwise Backend - Minimal Working Version
 * Getting service online first, will add agents incrementally
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: ['https://helmwise.co', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0-minimal',
    message: 'Helmwise backend online - agents being integrated'
  });
});

// Readiness check
app.get('/ready', (req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Mock passage planning endpoint (will be replaced with real agents)
app.post('/api/passage-planning/analyze', (req, res) => {
  console.log('Received passage planning request:', req.body);
  
  // Mock response matching expected structure
  res.json({
    success: true,
    message: 'Backend operational - full agent integration in progress',
    route: {
      distance: 85.7,
      waypoints: [
        req.body.departure,
        req.body.destination
      ],
      estimatedDuration: '14h 30m'
    },
    weather: {
      status: 'Service integrating - check back soon'
    },
    tidal: {
      status: 'Service integrating - check back soon'
    },
    summary: {
      warnings: ['Backend in minimal mode - full features coming soon'],
      recommendations: ['System is being brought online incrementally']
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Helmwise Backend API',
    status: 'online',
    version: '1.0.0-minimal',
    endpoints: {
      health: '/health',
      ready: '/ready',
      passagePlanning: 'POST /api/passage-planning/analyze'
    }
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Helmwise backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌊 Ready for passage planning requests`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
