import { FullConfig } from '@playwright/test'

/**
 * Global setup for Playwright tests.
 * Verifies the dev server is accessible before running tests.
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000'

  // Verify dev server is accessible
  try {
    const response = await fetch(baseURL, { method: 'HEAD' })
    if (!response.ok) {
      console.warn(`Dev server returned ${response.status} — tests may fail`)
    }
  } catch {
    console.warn(
      `Could not reach dev server at ${baseURL}. ` +
      `Ensure it is running (npm run dev:frontend) or set PLAYWRIGHT_BASE_URL.`
    )
  }
}

export default globalSetup
