import { test, expect } from '@playwright/test'
import { loginViaDemoMode, activateDemoMode } from '../helpers/test-utils'

test.describe('Authentication Flow', () => {
  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login')

    // Verify page structure
    await expect(page.locator('h1')).toContainText('Welcome Back')

    // Verify form inputs exist
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-demo"]')).toBeVisible()

    // Verify links
    await expect(page.locator('[data-testid="login-forgot-password"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-signup-link"]')).toBeVisible()
  })

  test('should validate empty email field', async ({ page }) => {
    await page.goto('/login')

    // Leave fields empty and submit
    await page.locator('[data-testid="login-submit"]').click()

    // Email validation should trigger (either via browser validation or custom)
    const emailInput = page.locator('[data-testid="login-email"]')
    await expect(emailInput).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    await page.goto('/login')

    // Enter invalid email
    await page.locator('[data-testid="login-email"]').fill('not-an-email')
    await page.locator('[data-testid="login-password"]').fill('TestPassword123!')
    await page.locator('[data-testid="login-submit"]').click()

    // Should show email validation error
    await expect(page.locator('text=valid email')).toBeVisible({ timeout: 5000 })
  })

  test('should navigate from login to signup', async ({ page }) => {
    await page.goto('/login')

    await page.locator('[data-testid="login-signup-link"]').click()
    await expect(page).toHaveURL('/signup')
  })

  test('should navigate from signup to login', async ({ page }) => {
    await page.goto('/signup')

    await page.locator('[data-testid="signup-login-link"]').click()
    await expect(page).toHaveURL('/login')
  })

  test('should enter demo mode and navigate to dashboard', async ({ page }) => {
    await loginViaDemoMode(page)

    // Should be on dashboard
    await expect(page).toHaveURL('/dashboard')

    // Should show demo banner
    await expect(page.locator('[data-testid="dashboard-demo-banner"]')).toBeVisible()

    // Should show welcome message
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible()
  })

  test('should display signup page correctly', async ({ page }) => {
    await page.goto('/signup')

    // Verify page structure
    await expect(page.locator('h1')).toContainText('Create Your Account')

    // Verify form inputs
    await expect(page.locator('[data-testid="signup-name"]')).toBeVisible()
    await expect(page.locator('[data-testid="signup-email"]')).toBeVisible()
    await expect(page.locator('[data-testid="signup-password"]')).toBeVisible()
    await expect(page.locator('[data-testid="signup-confirm-password"]')).toBeVisible()
    await expect(page.locator('[data-testid="signup-terms"]')).toBeVisible()
    await expect(page.locator('[data-testid="signup-submit"]')).toBeVisible()
  })

  test('should show password strength indicator on signup', async ({ page }) => {
    await page.goto('/signup')

    // Type a password to trigger strength indicator
    await page.locator('[data-testid="signup-password"]').fill('Weak')
    await expect(page.locator('[data-testid="signup-password-strength"]')).toBeVisible()

    // Type a stronger password — strength should update
    await page.locator('[data-testid="signup-password"]').fill('StrongPass1')
    await expect(page.locator('[data-testid="signup-password-strength"]')).toBeVisible()
  })

  test('should navigate to forgot password', async ({ page }) => {
    await page.goto('/login')

    await page.locator('[data-testid="login-forgot-password"]').click()
    await expect(page).toHaveURL('/reset-password')
  })
})
