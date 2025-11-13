// Entry point for orchestrator
import { SimpleOrchestrator } from './SimpleOrchestrator';
import { validateEnv, getSafeEnvInfo } from '@passage-planner/shared';
import { initSentry } from './sentry';

// Validate environment FIRST - fail fast with clear errors
try {
  const env = validateEnv();
  console.log('✅ Environment validation passed');
  console.log('📋 Environment:', getSafeEnvInfo());
} catch (error) {
  console.error('❌ FATAL: Environment validation failed');
  console.error((error as Error).message);
  console.error('\n💡 Fix the errors above and restart the orchestrator.');
  process.exit(1);
}

// Initialize error tracking SECOND - after validation
initSentry();

const orchestrator = new SimpleOrchestrator();

orchestrator.start().catch((error) => {
  console.error('Failed to start orchestrator:', error);
      process.exit(1);
});
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
    await orchestrator.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
    await orchestrator.shutdown();
    process.exit(0);
  });
  
// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await orchestrator.shutdown();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  await orchestrator.shutdown();
  process.exit(1);
});
