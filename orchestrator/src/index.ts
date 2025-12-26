// Entry point for orchestrator
import { SimpleOrchestrator } from './SimpleOrchestrator';
import { validateEnv, getSafeEnvInfo } from '@passage-planner/shared';
import { initSentry } from './sentry';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Validate environment FIRST - fail fast with clear errors
try {
  const env = validateEnv();
  logger.info({ env: getSafeEnvInfo() }, 'Environment validation passed');
} catch (error) {
  logger.fatal({ error: (error as Error).message }, 'Environment validation failed');
  process.exit(1);
}

// Initialize error tracking SECOND - after validation
initSentry();

const orchestrator = new SimpleOrchestrator();

orchestrator.start().catch((error) => {
  logger.fatal({ error }, 'Failed to start orchestrator');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await orchestrator.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await orchestrator.shutdown();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  await orchestrator.shutdown();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.fatal({ reason, promise: String(promise) }, 'Unhandled rejection');
  await orchestrator.shutdown();
  process.exit(1);
});
