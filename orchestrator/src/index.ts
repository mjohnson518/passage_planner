// Entry point for orchestrator
// Use console.log for early startup — pino may not be imported yet
console.log('[BOOT] Orchestrator entry point loaded');
console.log('[BOOT] Node:', process.version, 'CWD:', process.cwd());
console.log('[BOOT] PORT:', process.env.PORT, 'NODE_ENV:', process.env.NODE_ENV);

import { SimpleOrchestrator } from './SimpleOrchestrator';
import { validateEnv, getSafeEnvInfo } from '@passage-planner/shared';
import { initSentry } from './sentry';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

console.log('[BOOT] All imports resolved');

// Handle errors that happen during startup
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  process.exit(1);
});

async function main() {
  // Validate environment FIRST - fail fast with clear errors
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    logger.warn('Skipping environment validation (SKIP_ENV_VALIDATION=true)');
  } else {
    try {
      const env = validateEnv();
      logger.info({ env: getSafeEnvInfo() }, 'Environment validation passed');
    } catch (error) {
      logger.fatal({ error: (error as Error).message }, 'Environment validation failed');
      process.exit(1);
    }
  }

  // Initialize error tracking SECOND - after validation
  console.log('[BOOT] Initializing Sentry...');
  initSentry();

  console.log('[BOOT] Creating SimpleOrchestrator...');
  let orchestrator: SimpleOrchestrator;
  try {
    orchestrator = new SimpleOrchestrator();
  } catch (error) {
    console.error('[FATAL] Failed to create SimpleOrchestrator:', error);
    process.exit(1);
    return; // unreachable, but satisfies TS
  }

  console.log('[BOOT] Starting orchestrator...');
  try {
    await orchestrator.start();
    console.log('[BOOT] Orchestrator started successfully');
  } catch (error) {
    console.error('[FATAL] Failed to start orchestrator:', error);
    process.exit(1);
  }

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
}

main();
