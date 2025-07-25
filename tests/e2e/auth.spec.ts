import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser } from '../helpers/test-utils'

test.describe('Authentication Flow', () => {
  let testEmail: string
  let testPassword: string

  test.beforeEach(async () => {
    testEmail = `test-${Date.now()}@example.com`
    testPassword = 'TestPassword123!'
  })

  test.afterEach(async () => {
    // Cleanup
    await deleteTestUser(testEmail)
  })

  test('should complete full signup flow', async ({ page }) => {
    await page.goto('/signup')
    
    // Fill signup form
    await page.fill('[data-testid="email-input"]', testEmail)
    await page.fill('[data-testid="password-input"]', testPassword)
    await page.fill('[data-testid="confirm-password-input"]', testPassword)
    
    // Accept terms
    await page.check('[data-testid="terms-checkbox"]')
    
    // Submit
    await page.click('[data-testid="signup-button"]')
    
    // Should redirect to onboarding
    await expect(page).toHaveURL('/onboarding')
    
    // Verify welcome message
    await expect(page.locator('text=Welcome aboard!')).toBeVisible()
  })

  test('should handle login with various scenarios', async ({ page }) => {
    // Create user first
    await createTestUser(testEmail, testPassword)
    
    await page.goto('/login')
    
    // Test empty fields
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('text=Email is required')).toBeVisible()
    
    // Test invalid email
    await page.fill('[data-testid="email-input"]', 'invalid-email')
    await page.fill('[data-testid="password-input"]', testPassword)
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('text=Invalid email format')).toBeVisible()
    
    // Test wrong password
    await page.fill('[data-testid="email-input"]', testEmail)
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
    
    // Test successful login
    await page.fill('[data-testid="password-input"]', testPassword)
    await page.click('[data-testid="login-button"]')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    
    // Verify user menu is visible
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  })

  test('should handle password reset flow', async ({ page }) => {
    await createTestUser(testEmail, testPassword)
    
    await page.goto('/login')
    await page.click('text=Forgot password?')
    
    // Should be on reset password page
    await expect(page).toHaveURL('/reset-password')
    
    // Request reset
    await page.fill('[data-testid="email-input"]', testEmail)
    await page.click('[data-testid="reset-button"]')
    
    // Should show success message
    await expect(page.locator('text=Check your email')).toBeVisible()
    
    // In real test, would check email and follow reset link
  })

  test('should enforce password requirements', async ({ page }) => {
    await page.goto('/signup')
    
    // Test weak password
    await page.fill('[data-testid="password-input"]', 'weak')
    await page.locator('[data-testid="password-input"]').blur()
    
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible()
    
    // Test password without uppercase
    await page.fill('[data-testid="password-input"]', 'password123!')
    await page.locator('[data-testid="password-input"]').blur()
    
    await expect(page.locator('text=Password must contain an uppercase letter')).toBeVisible()
    
    // Test password without special character
    await page.fill('[data-testid="password-input"]', 'Password123')
    await page.locator('[data-testid="password-input"]').blur()
    
    await expect(page.locator('text=Password must contain a special character')).toBeVisible()
  })

  test('should handle session expiry', async ({ page, context }) => {
    await createTestUser(testEmail, testPassword)
    
    // Login
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', testEmail)
    await page.fill('[data-testid="password-input"]', testPassword)
    await page.click('[data-testid="login-button"]')
    
    await expect(page).toHaveURL('/dashboard')
    
    // Clear auth token to simulate expiry
    await context.clearCookies()
    
    // Try to access protected route
    await page.goto('/planner')
    
    // Should redirect to login with message
    await expect(page).toHaveURL('/login?expired=true')
    await expect(page.locator('text=Session expired')).toBeVisible()
  })

  test('should handle concurrent sessions', async ({ browser }) => {
    await createTestUser(testEmail, testPassword)
    
    // Login in first browser context
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    
    await page1.goto('/login')
    await page1.fill('[data-testid="email-input"]', testEmail)
    await page1.fill('[data-testid="password-input"]', testPassword)
    await page1.click('[data-testid="login-button"]')
    
    await expect(page1).toHaveURL('/dashboard')
    
    // Login in second browser context
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    
    await page2.goto('/login')
    await page2.fill('[data-testid="email-input"]', testEmail)
    await page2.fill('[data-testid="password-input"]', testPassword)
    await page2.click('[data-testid="login-button"]')
    
    await expect(page2).toHaveURL('/dashboard')
    
    // Both sessions should work
    await page1.reload()
    await expect(page1.locator('[data-testid="user-menu"]')).toBeVisible()
    
    await page2.reload()
    await expect(page2.locator('[data-testid="user-menu"]')).toBeVisible()
    
    // Cleanup
    await context1.close()
    await context2.close()
  })
}) 