import { Page, BrowserContext } from '@playwright/test'

/**
 * Activate demo mode via localStorage
 */
export async function activateDemoMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('helmwise_demo_mode', 'true')
  })
}

/**
 * Create a demo session: set demo mode and navigate to dashboard
 */
export async function createDemoSession(page: Page): Promise<void> {
  await page.goto('/login')
  await activateDemoMode(page)
  await page.goto('/dashboard')
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Login via demo mode button on the login page
 */
export async function loginViaDemoMode(page: Page): Promise<void> {
  await page.goto('/login')
  await page.click('[data-testid="login-demo"]')
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

/**
 * Mock weather API responses via Playwright route interception
 */
export async function mockWeatherAPI(context: BrowserContext): Promise<void> {
  await context.route('**/api.weather.gov/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        properties: {
          periods: [{
            temperature: 72,
            windSpeed: '12 mph',
            windDirection: 'SE',
            shortForecast: 'Mostly Clear',
            detailedForecast: 'Clear skies with light winds.',
          }],
        },
      }),
    })
  })
}

/**
 * Mock orchestrator API responses via Playwright route interception
 */
export async function mockAgentResponses(context: BrowserContext): Promise<void> {
  await context.route('**/api/passage-planning/analyze', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        route: {
          distance: 98.5,
          distanceNm: 98.5,
          distanceKm: 182.4,
          bearing: 42,
          estimatedDuration: '16h 25m',
          estimatedDurationHours: 16.4,
          waypoints: [
            { latitude: 42.36, longitude: -71.06, name: 'Boston, MA' },
            { latitude: 43.66, longitude: -70.26, name: 'Portland, ME' },
          ],
          departure: 'Boston, MA',
          destination: 'Portland, ME',
        },
        weather: {
          departure: {
            forecast: 'Mostly Clear',
            windSpeed: 12,
            windDirection: 135,
            waveHeight: 2.5,
            temperature: 72,
            conditions: 'Clear',
            warnings: [],
            source: 'NOAA',
            timestamp: new Date().toISOString(),
            windDescription: '12 kts SE',
          },
          destination: {
            forecast: 'Partly Cloudy',
            windSpeed: 15,
            windDirection: 180,
            waveHeight: 3.0,
            temperature: 68,
            conditions: 'Partly Cloudy',
            warnings: [],
            source: 'NOAA',
            timestamp: new Date().toISOString(),
            windDescription: '15 kts S',
          },
          summary: {
            maxWindSpeed: 15,
            suitable: true,
            warnings: [],
            overall: 'Conditions suitable for passage',
          },
        },
        tidal: {
          departure: {
            station: 'Boston Harbor',
            predictions: [
              { time: new Date().toISOString(), type: 'high', height: 9.8, unit: 'ft' },
            ],
            nextTide: { time: new Date().toISOString(), type: 'high', height: 9.8, unit: 'ft' },
            nextTideFormatted: 'High tide: 9.8 ft at 14:30',
            source: 'NOAA CO-OPS',
          },
          destination: {
            station: 'Portland Harbor',
            predictions: [
              { time: new Date().toISOString(), type: 'low', height: 0.2, unit: 'ft' },
            ],
            nextTide: { time: new Date().toISOString(), type: 'low', height: 0.2, unit: 'ft' },
            nextTideFormatted: 'Low tide: 0.2 ft at 08:15',
            source: 'NOAA CO-OPS',
          },
          summary: {
            departureStation: 'Boston Harbor',
            destinationStation: 'Portland Harbor',
            tidalDataAvailable: true,
            warnings: [],
          },
        },
        navigationWarnings: {
          count: 0,
          critical: 0,
          warnings: [],
          lastChecked: new Date().toISOString(),
        },
        safety: {
          safetyScore: 'Good',
          goNoGo: 'GO',
          overallRisk: 'low',
          riskFactors: [],
          safetyWarnings: [],
          recommendations: [
            'File a float plan with a trusted contact before departure',
            'Check all safety equipment is accessible and functional',
          ],
          hazards: [],
          emergencyContacts: {
            emergency: {
              coastGuard: { name: 'US Coast Guard', vhf: 'Channel 16', phone: '(855) 411-8727' },
            },
          },
          watchSchedule: null,
          timestamp: new Date().toISOString(),
          source: 'Helmwise Safety Agent',
          decision: {
            goNoGo: 'GO',
            overallRisk: 'low',
            safetyScore: 'Good',
            proceedWithPassage: true,
            requiresCaution: false,
            doNotProceed: false,
          },
          analysis: {
            riskFactors: [],
            hazardsDetected: 0,
            warningsActive: 0,
            crewExperienceConsidered: true,
            vesselDraftConsidered: true,
          },
        },
        port: {
          departure: { found: true, name: 'Boston Harbor', type: 'major', distance: '0.0 nm', facilities: { fuel: true, water: true, repair: true }, navigation: {}, contact: { vhf: '16' }, customs: {}, recommendations: [], rating: 4 },
          destination: { found: true, name: 'Portland Harbor', type: 'major', distance: '0.0 nm', facilities: { fuel: true, water: true, repair: true }, navigation: {}, contact: { vhf: '16' }, customs: {}, recommendations: [], rating: 4 },
          emergencyHarbors: [
            { name: 'Gloucester Harbor', distance: '28.5 nm', vhf: 'Ch 16', protection: 4, facilities: 3 },
          ],
          summary: { departurePortAvailable: true, destinationPortAvailable: true, emergencyOptions: 1, nearestEmergency: 'Gloucester Harbor' },
        },
        summary: {
          totalDistance: '98.5 nm',
          estimatedTime: '16h 25m',
          safetyDecision: 'GO',
          safetyScore: 'Good',
          overallRisk: 'low',
          suitableForPassage: true,
          warnings: [],
          recommendations: [
            'File a float plan with a trusted contact before departure',
            'Check all safety equipment is accessible and functional',
          ],
        },
      }),
    })
  })
}

/**
 * Select a port from the PortSelector dropdown
 */
export async function selectPort(
  page: Page,
  selectorId: string,
  portName: string,
): Promise<void> {
  const input = page.locator(`[data-testid="port-selector-${selectorId}-input"]`)
  await input.fill(portName.substring(0, 3)) // Type first 3 chars to trigger search
  await page.waitForSelector('[data-testid="port-selector-dropdown"]', { timeout: 5000 })
  await page.click(`[data-testid="port-selector-dropdown"] >> text=${portName}`)
}

// Stubs for test user management (demo mode based — no real Supabase needed)
export async function createTestUser(_email: string, _password?: string): Promise<void> {
  // No-op: tests use demo mode instead of real auth
}

export async function deleteTestUser(_email: string): Promise<void> {
  // No-op: tests use demo mode instead of real auth
}

export async function createAuthenticatedUser(_tier?: string): Promise<{ token: string }> {
  // Return dummy token — tests use demo mode
  return { token: 'demo-test-token' }
}
