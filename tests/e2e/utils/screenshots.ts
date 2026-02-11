import { Page } from '@playwright/test'
import path from 'path'

/**
 * Viewport breakpoints for responsive screenshot capture.
 */
export const BREAKPOINTS = {
  mobile:  { width: 375,  height: 812,  name: 'mobile'  },
  tablet:  { width: 768,  height: 1024, name: 'tablet'  },
  laptop:  { width: 1024, height: 768,  name: 'laptop'  },
  desktop: { width: 1440, height: 900,  name: 'desktop' },
} as const

export type BreakpointName = keyof typeof BREAKPOINTS

/**
 * Route definitions for baseline capture.
 */
export interface RouteDefinition {
  path: string
  name: string
}

export const PUBLIC_ROUTES: RouteDefinition[] = [
  { path: '/',               name: 'landing' },
  { path: '/login',          name: 'login' },
  { path: '/signup',         name: 'signup' },
  { path: '/reset-password', name: 'reset-password' },
  { path: '/pricing',        name: 'pricing' },
  { path: '/api-docs',       name: 'api-docs' },
  { path: '/offline',        name: 'offline' },
]

export const AUTH_ROUTES: RouteDefinition[] = [
  { path: '/dashboard',  name: 'dashboard' },
  { path: '/planner',    name: 'planner' },
  { path: '/passages',   name: 'passages' },
  { path: '/fleet',      name: 'fleet' },
  { path: '/weather',    name: 'weather' },
  { path: '/onboarding', name: 'onboarding' },
]

export const ADMIN_ROUTES: RouteDefinition[] = [
  { path: '/admin',           name: 'admin' },
  { path: '/admin/agents',    name: 'admin-agents' },
  { path: '/admin/analytics', name: 'admin-analytics' },
]

export const ALL_ROUTES: RouteDefinition[] = [
  ...PUBLIC_ROUTES,
  ...AUTH_ROUTES,
  ...ADMIN_ROUTES,
]

const SCREENSHOT_BASE_DIR = path.join(__dirname, '..', 'screenshots', 'baseline')

/**
 * Wait for the page to settle (DOM content loaded + brief pause for rendering).
 */
async function waitForSettle(page: Page) {
  // Wait for DOM to be ready
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  // Brief pause for CSS/fonts/animations to settle
  await page.waitForTimeout(500)
}

/**
 * Capture a full-page screenshot at the current viewport.
 */
export async function captureScreenshot(
  page: Page,
  routeName: string,
  breakpointName: string,
): Promise<string> {
  const screenshotPath = path.join(SCREENSHOT_BASE_DIR, routeName, `${breakpointName}.png`)

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  })

  return screenshotPath
}

/**
 * Navigate to a route and capture screenshots at all 4 breakpoints.
 * Returns an array of screenshot file paths.
 * Gracefully handles navigation timeouts — captures whatever state is visible.
 */
export async function captureAllBreakpoints(
  page: Page,
  route: RouteDefinition,
): Promise<string[]> {
  const paths: string[] = []

  for (const [key, bp] of Object.entries(BREAKPOINTS)) {
    await page.setViewportSize({ width: bp.width, height: bp.height })

    try {
      await page.goto(route.path, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch {
      // Navigation timeout — page may be partially loaded (SSR hang, missing backend).
      // Capture whatever is visible as the baseline.
    }

    await waitForSettle(page)
    const screenshotPath = await captureScreenshot(page, route.name, key)
    paths.push(screenshotPath)
  }

  return paths
}

/**
 * Basic smoke test for a route: checks status code, redirect behavior,
 * and absence of error indicators.
 * Handles navigation timeouts gracefully for baseline capture.
 */
export async function smokeTestRoute(
  page: Page,
  route: RouteDefinition,
): Promise<{
  status: number | null
  redirected: boolean
  finalUrl: string
  hasErrorIndicator: boolean
  timedOut: boolean
}> {
  let response
  let timedOut = false

  try {
    response = await page.goto(route.path, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
  } catch {
    // Navigation timeout — page may be partially loaded
    timedOut = true
  }

  const status = response?.status() ?? null
  const finalUrl = page.url()
  const redirected = !finalUrl.endsWith(route.path)

  // Check for common error indicators
  let hasErrorIndicator = false
  try {
    hasErrorIndicator = await page.evaluate(() => {
      const body = document.body?.innerText?.toLowerCase() ?? ''
      return (
        body.includes('application error') ||
        body.includes('internal server error') ||
        body.includes('unhandled runtime error')
      )
    })
  } catch {
    // Page may not have a body yet if it timed out
  }

  return { status, redirected, finalUrl, hasErrorIndicator, timedOut }
}
