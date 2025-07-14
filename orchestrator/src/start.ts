// orchestrator/src/start.ts
// Start script for the orchestrator service

import { startServer } from './server';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

// Start the server
(async () => {
  try {
    logger.info('Starting orchestrator service...');
    await startServer();
  } catch (error) {
    logger.error({ error }, 'Failed to start orchestrator');
    process.exit(1);
  }
})(); 