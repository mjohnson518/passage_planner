import { test, expect } from '@playwright/test'
import { createAuthenticatedUser, mockWeatherAPI, mockAgentResponses } from '../helpers/test-utils'

test.describe('Passage Planning Flow', () => {
  let authToken: string

  test.beforeAll(async () => {
    // Setup authenticated user
    const user = await createAuthenticatedUser('premium')
    authToken = user.token
  })

  test.beforeEach(async ({ context }) => {
    // Set auth token in context
    await context.addCookies([
      {
        name: 'auth-token',
        value: authToken,
        domain: 'localhost',
        path: '/',
      }
    ])

    // Mock external APIs
    await mockWeatherAPI()
    await mockAgentResponses()
  })

  test('should create passage plan using natural language', async ({ page }) => {
    await page.goto('/planner')

    // Enter natural language query
    await page.fill('[data-testid="passage-input"]', 'Plan a passage from Boston to Portland Maine leaving tomorrow morning')
    
    // Submit plan
    await page.click('[data-testid="plan-button"]')

    // Should show loading state
    await expect(page.locator('[data-testid="planning-loader"]')).toBeVisible()

    // Wait for results
    await expect(page.locator('[data-testid="passage-results"]')).toBeVisible({ timeout: 30000 })

    // Verify route details
    await expect(page.locator('text=Boston Harbor')).toBeVisible()
    await expect(page.locator('text=Portland Harbor')).toBeVisible()
    await expect(page.locator('text=/\\d+ nm/')).toBeVisible() // Distance
    await expect(page.locator('text=/\\d+h \\d+m/')).toBeVisible() // Duration

    // Verify weather information
    await expect(page.locator('[data-testid="weather-summary"]')).toBeVisible()
    await expect(page.locator('text=/Wind: .+ from .+/')).toBeVisible()
    
    // Verify tidal information
    await expect(page.locator('[data-testid="tidal-info"]')).toBeVisible()
    await expect(page.locator('text=/High tide/')).toBeVisible()

    // Save passage
    await page.click('[data-testid="save-passage-button"]')
    await expect(page.locator('text=Passage saved')).toBeVisible()
  })

  test('should handle complex multi-waypoint passages', async ({ page }) => {
    await page.goto('/planner')

    // Create multi-waypoint passage
    await page.fill('[data-testid="passage-input"]', 
      'Plan a passage from Boston to Bar Harbor with stops in Gloucester and Portsmouth'
    )
    await page.click('[data-testid="plan-button"]')

    await expect(page.locator('[data-testid="passage-results"]')).toBeVisible({ timeout: 30000 })

    // Verify all waypoints
    const waypoints = ['Boston Harbor', 'Gloucester', 'Portsmouth', 'Bar Harbor']
    for (const waypoint of waypoints) {
      await expect(page.locator(`text=${waypoint}`)).toBeVisible()
    }

    // Verify leg information
    await expect(page.locator('[data-testid="passage-legs"]')).toBeVisible()
    await expect(page.locator('[data-testid="leg-info"]')).toHaveCount(3)
  })

  test('should respect user preferences', async ({ page }) => {
    await page.goto('/planner')

    // Set preferences
    await page.click('[data-testid="preferences-button"]')
    await page.check('[data-testid="avoid-night-sailing"]')
    await page.fill('[data-testid="max-wind-speed"]', '20')
    await page.click('[data-testid="save-preferences"]')

    // Plan passage
    await page.fill('[data-testid="passage-input"]', 'Plan overnight passage from Boston to New York')
    await page.click('[data-testid="plan-button"]')

    await expect(page.locator('[data-testid="passage-results"]')).toBeVisible({ timeout: 30000 })

    // Should show warning about night sailing
    await expect(page.locator('text=includes night sailing')).toBeVisible()
    
    // Should suggest alternative with stops
    await expect(page.locator('text=Suggested alternative with overnight stops')).toBeVisible()
  })

  test('should export passage in multiple formats', async ({ page, context }) => {
    await page.goto('/planner')

    // Create simple passage
    await page.fill('[data-testid="passage-input"]', 'Boston to Provincetown direct')
    await page.click('[data-testid="plan-button"]')
    await expect(page.locator('[data-testid="passage-results"]')).toBeVisible({ timeout: 30000 })

    // Test GPX export
    const [gpxDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-gpx"]')
    ])
    expect(gpxDownload.suggestedFilename()).toMatch(/passage.*\.gpx/)

    // Test PDF export
    await page.click('[data-testid="export-pdf"]')
    await expect(page.locator('[data-testid="pdf-preview"]')).toBeVisible()
    
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-pdf"]')
    ])
    expect(pdfDownload.suggestedFilename()).toMatch(/passage.*\.pdf/)
  })

  test('should handle API errors gracefully', async ({ page, context }) => {
    await page.goto('/planner')

    // Mock API failure
    await context.route('**/api/passages/plan', route => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Weather service unavailable' }) })
    })

    await page.fill('[data-testid="passage-input"]', 'Boston to Portland')
    await page.click('[data-testid="plan-button"]')

    // Should show error message
    await expect(page.locator('text=Weather service unavailable')).toBeVisible()
    
    // Should allow retry
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  })

  test('should show real-time updates during planning', async ({ page }) => {
    await page.goto('/planner')

    await page.fill('[data-testid="passage-input"]', 'Boston to Newport Rhode Island')
    await page.click('[data-testid="plan-button"]')

    // Should show agent progress
    await expect(page.locator('text=Analyzing route...')).toBeVisible()
    await expect(page.locator('text=Fetching weather data...')).toBeVisible()
    await expect(page.locator('text=Calculating tides...')).toBeVisible()
    await expect(page.locator('text=Checking safety information...')).toBeVisible()

    await expect(page.locator('[data-testid="passage-results"]')).toBeVisible({ timeout: 30000 })
  })

  test('should integrate with fleet management for Pro users', async ({ page }) => {
    // Login as Pro user
    await page.goto('/logout')
    const proUser = await createAuthenticatedUser('pro')
    await page.context().addCookies([
      {
        name: 'auth-token',
        value: proUser.token,
        domain: 'localhost',
        path: '/',
      }
    ])

    await page.goto('/planner')

    // Create passage
    await page.fill('[data-testid="passage-input"]', 'Boston to Martha\'s Vineyard')
    await page.click('[data-testid="plan-button"]')
    await expect(page.locator('[data-testid="passage-results"]')).toBeVisible({ timeout: 30000 })

    // Should show fleet sharing option
    await expect(page.locator('[data-testid="share-with-fleet"]')).toBeVisible()
    
    await page.click('[data-testid="share-with-fleet"]')
    await expect(page.locator('[data-testid="fleet-share-dialog"]')).toBeVisible()
    
    // Select vessels and crew
    await page.check('[data-testid="vessel-1"]')
    await page.check('[data-testid="crew-member-1"]')
    await page.click('[data-testid="confirm-share"]')

    await expect(page.locator('text=Passage shared with fleet')).toBeVisible()
  })

  test('should work offline with cached data', async ({ page, context }) => {
    // First, create a passage online
    await page.goto('/planner')
    await page.fill('[data-testid="passage-input"]', 'Boston to Salem')
    await page.click('[data-testid="plan-button"]')
    await expect(page.locator('[data-testid="passage-results"]')).toBeVisible({ timeout: 30000 })
    await page.click('[data-testid="save-passage-button"]')

    // Go offline
    await context.setOffline(true)

    // Navigate to saved passages
    await page.goto('/passages')
    
    // Should show cached passage
    await expect(page.locator('text=Boston to Salem')).toBeVisible()
    
    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible()

    // Try to create new passage offline
    await page.goto('/planner')
    await page.fill('[data-testid="passage-input"]', 'Boston to Marblehead')
    await page.click('[data-testid="plan-button"]')

    // Should show offline message
    await expect(page.locator('text=Planning unavailable offline')).toBeVisible()
  })
}) 