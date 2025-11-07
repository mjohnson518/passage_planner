// Entry point for orchestrator
import { SimpleOrchestrator } from './SimpleOrchestrator';

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
