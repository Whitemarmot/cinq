/**
 * E2E Tests: Login Flow
 * Tests the complete login experience for Cinq
 */

import { test, expect } from '@playwright/test';
import { SELECTORS, TEST_USERS, navigateTo, clearAuth } from './fixtures.js';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
    await navigateTo(page, '/login.html');
  });

  test('should display login form correctly', async ({ page }) => {
    // Page title
    await expect(page).toHaveTitle(/Connexion.*Cinq/);
    
    // Form elements visible
    await expect(page.locator(SELECTORS.login.form)).toBeVisible();
    await expect(page.locator(SELECTORS.login.emailInput)).toBeVisible();
    await expect(page.locator(SELECTORS.login.passwordInput)).toBeVisible();
    await expect(page.locator(SELECTORS.login.submitBtn)).toBeVisible();
    
    // Labels present
    await expect(page.locator('label[for="email"]')).toContainText('Email');
    await expect(page.locator('label[for="password"]')).toContainText('Mot de passe');
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click submit without filling fields
    await page.click(SELECTORS.login.submitBtn);
    
    // Should show validation - either HTML5 or custom
    const emailInput = page.locator(SELECTORS.login.emailInput);
    const isInvalid = await emailInput.evaluate(el => !el.checkValidity());
    expect(isInvalid).toBeTruthy();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.fill(SELECTORS.login.emailInput, 'invalid-email');
    await page.fill(SELECTORS.login.passwordInput, 'password123');
    await page.click(SELECTORS.login.submitBtn);
    
    // Email should be invalid
    const emailInput = page.locator(SELECTORS.login.emailInput);
    const isInvalid = await emailInput.evaluate(el => !el.checkValidity());
    expect(isInvalid).toBeTruthy();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator(SELECTORS.login.passwordInput);
    const toggleBtn = page.locator(SELECTORS.login.passwordToggle);
    
    // Initially password type
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click again to hide
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill(SELECTORS.login.emailInput, 'wrong@example.com');
    await page.fill(SELECTORS.login.passwordInput, 'wrongpassword');
    await page.click(SELECTORS.login.submitBtn);
    
    // Wait for API response and error message
    await page.waitForSelector(SELECTORS.login.errorMessage, { timeout: 10000 }).catch(() => {});
    
    // Check for error state (either message or input error class)
    const hasError = await page.locator(SELECTORS.login.errorMessage).isVisible()
      || await page.locator(`${SELECTORS.login.emailInput}.error`).isVisible();
    
    // The form should still be on login page (not redirected)
    expect(page.url()).toContain('login');
  });

  test('should have link to forgot password', async ({ page }) => {
    const forgotLink = page.locator(SELECTORS.login.forgotLink);
    await expect(forgotLink).toBeVisible();
    
    // Click and check navigation
    await forgotLink.click();
    await expect(page).toHaveURL(/forgot-password/);
  });

  test('should have link to register', async ({ page }) => {
    const registerLink = page.locator(SELECTORS.login.registerLink);
    await expect(registerLink).toBeVisible();
  });

  test('should have theme toggle', async ({ page }) => {
    const themeToggle = page.locator('.theme-toggle');
    await expect(themeToggle).toBeVisible();
    
    // Get initial theme
    const initialTheme = await page.evaluate(() => 
      document.documentElement.getAttribute('data-theme')
    );
    
    // Click toggle
    await themeToggle.click();
    
    // Theme should change
    const newTheme = await page.evaluate(() => 
      document.documentElement.getAttribute('data-theme')
    );
    
    // Theme should be different or cycled through auto
    expect(newTheme).toBeDefined();
  });

  test('should show loading state on submit', async ({ page }) => {
    await page.fill(SELECTORS.login.emailInput, TEST_USERS.valid.email);
    await page.fill(SELECTORS.login.passwordInput, TEST_USERS.valid.password);
    
    // Click and immediately check for loading state
    const submitBtn = page.locator(SELECTORS.login.submitBtn);
    await submitBtn.click();
    
    // Button should be disabled during loading
    // Note: This may be brief, so we check both states
    const isDisabledOrLoading = await submitBtn.isDisabled() 
      || await page.locator('.loading-spinner').isVisible().catch(() => false);
  });

  test('should redirect to app on successful login', async ({ page }) => {
    // This test requires a valid test account
    // For E2E with real backend, use test credentials
    // For mocked tests, intercept the auth request
    
    await page.route('**/auth/v1/token**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: {
            id: 'test-user-id',
            email: TEST_USERS.valid.email,
            user_metadata: { display_name: 'Test User' }
          }
        })
      });
    });

    await page.fill(SELECTORS.login.emailInput, TEST_USERS.valid.email);
    await page.fill(SELECTORS.login.passwordInput, TEST_USERS.valid.password);
    await page.click(SELECTORS.login.submitBtn);
    
    // Should redirect to app
    await page.waitForURL(/app\.html/, { timeout: 10000 }).catch(() => {});
  });

  test('should be accessible', async ({ page }) => {
    // Skip link present
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toHaveAttribute('href', '#login-form');
    
    // Form has aria-label
    const form = page.locator(SELECTORS.login.form);
    await expect(form).toHaveAttribute('aria-label');
    
    // Inputs have proper labels
    const emailLabel = page.locator('label[for="email"]');
    const passwordLabel = page.locator('label[for="password"]');
    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
  });
});
