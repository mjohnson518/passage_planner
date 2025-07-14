#!/usr/bin/env node

// Start the orchestrator with HTTP/WebSocket server
import { createServer } from './server.js';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

async function start() {
  try {
    const port = parseInt(process.env.PORT || '8080', 10);
    const server = await createServer();
    
    server.listen(port, () => {
      logger.info(`Orchestrator HTTP server listening on port ${port}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`WebSocket endpoint: ws://localhost:${port}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

start(); 