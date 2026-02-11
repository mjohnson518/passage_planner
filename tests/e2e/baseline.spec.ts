import { test, expect } from '@playwright/test'
import {
  PUBLIC_ROUTES,
  AUTH_ROUTES,
  ADMIN_ROUTES,
  captureAllBreakpoints,
  smokeTestRoute,
} from './utils/screenshots'

// Baseline screenshots need more time — 4 breakpoints × navigation + settle per route
test.setTimeout(120_000)

test.describe('Baseline Screenshots — Public Routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`capture ${route.name} (${route.path})`, async ({ page }) => {
      // Smoke test — log status but don't fail on it (we want to capture current state)
      const smoke = await smokeTestRoute(page, route)
      if (smoke.status && smoke.status >= 500) {
        console.warn(`[baseline] ${route.path} returned ${smoke.status} — capturing error state`)
      }

      // Capture all breakpoints
      const screenshots = await captureAllBreakpoints(page, route)
      expect(screenshots).toHaveLength(4)
    })
  }
})

test.describe('Baseline Screenshots — Auth Routes (unauthenticated)', () => {
  for (const route of AUTH_ROUTES) {
    test(`capture ${route.name} unauthenticated (${route.path})`, async ({ page }) => {
      // These may redirect to /login or timeout — capture whatever state we see
      const smoke = await smokeTestRoute(page, route)
      if (smoke.redirected) {
        console.log(`[baseline] ${route.path} redirected to ${smoke.finalUrl}`)
      }

      const screenshots = await captureAllBreakpoints(page, route)
      expect(screenshots).toHaveLength(4)
    })
  }
})

test.describe('Baseline Screenshots — Admin Routes (unauthenticated)', () => {
  for (const route of ADMIN_ROUTES) {
    test(`capture ${route.name} unauthenticated (${route.path})`, async ({ page }) => {
      // Admin routes likely redirect or block — capture the current behavior
      const smoke = await smokeTestRoute(page, route)
      if (smoke.redirected) {
        console.log(`[baseline] ${route.path} redirected to ${smoke.finalUrl}`)
      }

      const screenshots = await captureAllBreakpoints(page, route)
      expect(screenshots).toHaveLength(4)
    })
  }
})
