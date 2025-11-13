/**
 * Jest setup file for shared module tests
 * Configures test environment and global utilities
 */
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
process.env.REDIS_URL = 'redis://localhost:6379';
// Suppress console output during tests (keep for debugging if needed)
const originalConsole = { ...console };
global.console = {
    ...console,
    log: () => { },
    debug: () => { },
    info: () => { },
    warn: () => { },
    // Keep error for actual test failures
    error: originalConsole.error,
};
//# sourceMappingURL=jest.setup.js.map