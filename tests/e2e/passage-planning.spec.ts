import { test, expect } from '@playwright/test'
import {
  createDemoSession,
  mockAgentResponses,
  selectPort,
} from '../helpers/test-utils'

test.describe('Passage Planning Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock the orchestrator API so tests don't need a running backend
    await mockAgentResponses(context)

    // Enter demo mode and navigate to planner
    await createDemoSession(page)
  })

  test('should display planner page with route form', async ({ page }) => {
    await page.goto('/planner')

    // Verify page heading
    await expect(page.locator('h1')).toContainText('Plan New Passage')

    // Verify tabs
    await expect(page.locator('[data-testid="planner-tab-route"]')).toBeVisible()
    await expect(page.locator('[data-testid="planner-tab-details"]')).toBeVisible()
    await expect(page.locator('[data-testid="planner-tab-preferences"]')).toBeVisible()

    // Verify departure and destination port selectors
    await expect(page.locator('[data-testid="port-selector-departure"]')).toBeVisible()
    await expect(page.locator('[data-testid="port-selector-destination"]')).toBeVisible()

    // Verify submit button
    await expect(page.locator('[data-testid="planner-submit"]')).toBeVisible()

    // Verify add waypoint button
    await expect(page.locator('[data-testid="planner-add-waypoint"]')).toBeVisible()
  })

  test('should select ports from dropdown autocomplete', async ({ page }) => {
    await page.goto('/planner')

    // Select departure port
    await selectPort(page, 'departure', 'Boston, MA')

    // Verify the input was filled
    const depInput = page.locator('[data-testid="port-selector-departure-input"]')
    await expect(depInput).toHaveValue('Boston, MA')

    // Select destination port
    await selectPort(page, 'destination', 'Portland, ME')

    const destInput = page.locator('[data-testid="port-selector-destination-input"]')
    await expect(destInput).toHaveValue('Portland, ME')
  })

  test('should create a passage plan and verify all 6 result sections', async ({ page }) => {
    await page.goto('/planner')

    // Select ports
    await selectPort(page, 'departure', 'Boston, MA')
    await selectPort(page, 'destination', 'Portland, ME')

    // Submit the plan
    await page.locator('[data-testid="planner-submit"]').click()

    // Wait for results to appear (loading should show first)
    await expect(page.locator('[data-testid="planner-safety-decision"]')).toBeVisible({ timeout: 15000 })

    // Verify all 6 result sections
    await expect(page.locator('[data-testid="planner-route-results"]')).toBeVisible()
    await expect(page.locator('[data-testid="planner-weather-results"]')).toBeVisible()
    await expect(page.locator('[data-testid="planner-tidal-results"]')).toBeVisible()
    await expect(page.locator('[data-testid="planner-nav-warnings"]')).toBeVisible()
    await expect(page.locator('[data-testid="planner-safety-analysis"]')).toBeVisible()
    await expect(page.locator('[data-testid="planner-port-info"]')).toBeVisible()

    // Verify safety decision shows GO
    await expect(page.locator('[data-testid="planner-safety-decision"]')).toContainText('GO')
  })

  test('should fill vessel details tab', async ({ page }) => {
    await page.goto('/planner')

    // Switch to details tab
    await page.locator('[data-testid="planner-tab-details"]').click()

    // Fill vessel details
    await page.locator('[data-testid="planner-boat-type"]').selectOption('sailboat')
    await page.locator('[data-testid="planner-cruise-speed"]').fill('7')
    await page.locator('[data-testid="planner-draft"]').fill('5.5')

    // Verify values were set
    await expect(page.locator('[data-testid="planner-boat-type"]')).toHaveValue('sailboat')
    await expect(page.locator('[data-testid="planner-cruise-speed"]')).toHaveValue('7')
    await expect(page.locator('[data-testid="planner-draft"]')).toHaveValue('5.5')
  })

  test('should fill preferences tab', async ({ page }) => {
    await page.goto('/planner')

    // Switch to preferences tab
    await page.locator('[data-testid="planner-tab-preferences"]').click()

    // Verify fuel and water planning sections are visible
    await expect(page.locator('text=Fuel Planning')).toBeVisible()
    await expect(page.locator('text=Water Planning')).toBeVisible()
    await expect(page.locator('text=Pre-Departure Checklist')).toBeVisible()
  })

  test('should export GPX and PDF', async ({ page }) => {
    await page.goto('/planner')

    // Select ports and create plan
    await selectPort(page, 'departure', 'Boston, MA')
    await selectPort(page, 'destination', 'Portland, ME')
    await page.locator('[data-testid="planner-submit"]').click()

    // Wait for results
    await expect(page.locator('[data-testid="planner-safety-decision"]')).toBeVisible({ timeout: 15000 })

    // Test GPX export
    await expect(page.locator('[data-testid="planner-export-gpx"]')).toBeVisible()

    // Test PDF export
    await expect(page.locator('[data-testid="planner-export-pdf"]')).toBeVisible()
  })

  test('should handle API errors gracefully', async ({ page, context }) => {
    // Override the mock to return an error
    await context.route('**/api/passage-planning/analyze', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Weather service unavailable' }),
      })
    })

    await page.goto('/planner')

    // Select ports
    await selectPort(page, 'departure', 'Boston, MA')
    await selectPort(page, 'destination', 'Portland, ME')

    // Submit
    await page.locator('[data-testid="planner-submit"]').click()

    // Should show error toast — the planner uses sonner toast for errors
    await expect(page.locator('text=Weather service unavailable').or(page.locator('text=Failed to'))).toBeVisible({ timeout: 10000 })
  })
})
