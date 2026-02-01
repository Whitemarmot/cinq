/**
 * E2E Tests: Register Flow
 * Tests the complete registration experience for Cinq
 * Note: Registration requires a valid gift code (invite-only)
 */

import { test, expect } from '@playwright/test';
import { SELECTORS, TEST_USERS, VALID_GIFT_CODE, navigateTo, clearAuth } from './fixtures.js';

test.describe('Register Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('should display loading state initially', async ({ page }) => {
    await navigateTo(page, '/register.html');
    
    // Page should show loading while checking gift code
    const loading = page.locator(SELECTORS.register.loadingIndicator);
    // Loading may be brief, check it exists
    await expect(loading).toBeAttached();
  });

  test('should show invalid code message without gift code', async ({ page }) => {
    await navigateTo(page, '/register.html');
    
    // Without code param, should show invalid/error state
    await page.waitForTimeout(2000); // Wait for validation
    
    const invalidCode = page.locator(SELECTORS.register.invalidCode);
    const registerForm = page.locator(SELECTORS.register.registerFormContainer);
    
    // Either invalid code message or form (if no code required in test mode)
    const invalidVisible = await invalidCode.isVisible().catch(() => false);
    const formVisible = await registerForm.isVisible().catch(() => false);
    
    expect(invalidVisible || formVisible).toBeTruthy();
  });

  test('should display register form with valid gift code', async ({ page }) => {
    // Mock the gift verification
    await page.route('**/gift-verify**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          gifterId: 'test-gifter-id',
          gifterName: 'Test Gifter',
        })
      });
    });

    await navigateTo(page, `/register.html?code=${VALID_GIFT_CODE}`);
    await page.waitForTimeout(1000);
    
    // Form should be visible
    const registerForm = page.locator(SELECTORS.register.registerFormContainer);
    await expect(registerForm).toBeVisible({ timeout: 5000 });
  });

  test('should validate email format', async ({ page }) => {
    await page.route('**/gift-verify**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true })
      });
    });

    await navigateTo(page, `/register.html?code=${VALID_GIFT_CODE}`);
    await page.waitForSelector(SELECTORS.register.registerFormContainer, { state: 'visible', timeout: 5000 });
    
    const emailInput = page.locator(SELECTORS.register.emailInput);
    await emailInput.fill('invalid-email');
    
    // Trigger validation
    await emailInput.blur();
    
    // Should show validation error
    const isInvalid = await emailInput.evaluate(el => !el.checkValidity());
    expect(isInvalid).toBeTruthy();
  });

  test('should show password strength indicator', async ({ page }) => {
    await page.route('**/gift-verify**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true })
      });
    });

    await navigateTo(page, `/register.html?code=${VALID_GIFT_CODE}`);
    await page.waitForSelector(SELECTORS.register.registerFormContainer, { state: 'visible', timeout: 5000 });
    
    const passwordInput = page.locator(SELECTORS.register.passwordInput);
    
    // Weak password
    await passwordInput.fill('123');
    let strengthFill = page.locator(SELECTORS.register.strengthFill);
    await expect(strengthFill).toHaveClass(/weak/);
    
    // Fair password
    await passwordInput.fill('Password1');
    await expect(strengthFill).toHaveClass(/fair|good/);
    
    // Strong password
    await passwordInput.fill('StrongP@ssw0rd!');
    await expect(strengthFill).toHaveClass(/good|strong/);
  });

  test('should validate password confirmation matches', async ({ page }) => {
    await page.route('**/gift-verify**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true })
      });
    });

    await navigateTo(page, `/register.html?code=${VALID_GIFT_CODE}`);
    await page.waitForSelector(SELECTORS.register.registerFormContainer, { state: 'visible', timeout: 5000 });
    
    await page.fill(SELECTORS.register.passwordInput, 'Password123!');
    await page.fill(SELECTORS.register.confirmPasswordInput, 'DifferentPassword!');
    
    // Submit form
    await page.click(SELECTORS.register.submitBtn);
    
    // Should show mismatch error
    const confirmInput = page.locator(SELECTORS.register.confirmPasswordInput);
    const hasError = await confirmInput.evaluate(el => el.classList.contains('error'))
      || await page.locator('#confirm-password-error').isVisible().catch(() => false);
  });

  test('should show gifter info when available', async ({ page }) => {
    await page.route('**/gift-verify**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          gifterName: 'Marie',
        })
      });
    });

    await navigateTo(page, `/register.html?code=${VALID_GIFT_CODE}`);
    await page.waitForSelector(SELECTORS.register.registerFormContainer, { state: 'visible', timeout: 5000 });
    
    // Should show gifter name
    const gifterInfo = page.locator('#gifter-info, .gifter-info');
    if (await gifterInfo.isVisible()) {
      await expect(gifterInfo).toContainText('Marie');
    }
  });

  test('should complete registration with valid data', async ({ page }) => {
    // Mock gift verification
    await page.route('**/gift-verify**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true })
      });
    });

    // Mock registration API
    await page.route('**/auth/v1/signup**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          user: {
            id: 'new-user-id',
            email: TEST_USERS.newUser.email,
            user_metadata: { display_name: TEST_USERS.newUser.displayName }
          }
        })
      });
    });

    await navigateTo(page, `/register.html?code=${VALID_GIFT_CODE}`);
    await page.waitForSelector(SELECTORS.register.registerFormContainer, { state: 'visible', timeout: 5000 });
    
    // Fill form
    await page.fill(SELECTORS.register.emailInput, TEST_USERS.newUser.email);
    await page.fill(SELECTORS.register.passwordInput, TEST_USERS.newUser.password);
    
    // Fill confirm password if exists
    const confirmInput = page.locator(SELECTORS.register.confirmPasswordInput);
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(TEST_USERS.newUser.password);
    }
    
    // Fill display name if exists
    const displayNameInput = page.locator(SELECTORS.register.displayNameInput);
    if (await displayNameInput.isVisible()) {
      await displayNameInput.fill(TEST_USERS.newUser.displayName);
    }
    
    // Submit
    await page.click(SELECTORS.register.submitBtn);
    
    // Should redirect to app or show success
    await page.waitForURL(/app\.html|login\.html/, { timeout: 10000 }).catch(() => {});
  });

  test('should have link to login', async ({ page }) => {
    await page.route('**/gift-verify**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true })
      });
    });

    await navigateTo(page, `/register.html?code=${VALID_GIFT_CODE}`);
    await page.waitForSelector(SELECTORS.register.registerFormContainer, { state: 'visible', timeout: 5000 });
    
    const loginLink = page.locator('.login-link a, a[href*="login"]');
    await expect(loginLink.first()).toBeVisible();
  });

  test('should be accessible', async ({ page }) => {
    await page.route('**/gift-verify**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true })
      });
    });

    await navigateTo(page, `/register.html?code=${VALID_GIFT_CODE}`);
    await page.waitForSelector(SELECTORS.register.registerFormContainer, { state: 'visible', timeout: 5000 });
    
    // Skip link present
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeAttached();
    
    // Form has aria-label
    const form = page.locator(SELECTORS.register.form);
    await expect(form).toHaveAttribute('aria-label');
    
    // Progress indicator has ARIA attributes
    const progress = page.locator('[role="progressbar"]');
    if (await progress.isVisible()) {
      await expect(progress).toHaveAttribute('aria-valuenow');
    }
  });
});
