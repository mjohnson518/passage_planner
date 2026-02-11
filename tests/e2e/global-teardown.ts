import { FullConfig } from '@playwright/test'

/**
 * Global teardown for Playwright tests.
 * Cleanup stub — extend as needed for test database resets, temp file cleanup, etc.
 */
async function globalTeardown(_config: FullConfig) {
  // No-op for now. Add cleanup logic here if needed.
}

export default globalTeardown
