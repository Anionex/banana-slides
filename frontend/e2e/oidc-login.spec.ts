/**
 * E2E tests for OIDC login functionality
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('OIDC Login - Mock Tests', () => {
  test('should display Google login button on login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Check for Google login button
    const googleButton = page.locator('button:has-text("Google")');
    await expect(googleButton).toBeVisible();
  });

  test('should redirect to Google auth when clicking Google login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Mock the OIDC login endpoint
    await page.route('**/api/auth/oidc/login*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            auth_url: 'https://accounts.google.com/o/oauth2/v2/auth?mock=true',
            state: 'mock_state'
          }
        })
      });
    });

    // Click Google login button
    const googleButton = page.locator('button:has-text("Google")');
    await googleButton.click();

    // Should redirect to Google auth URL
    await page.waitForURL(/accounts\.google\.com/);
  });

  test('should handle OIDC callback and login successfully', async ({ page }) => {
    // Mock the callback endpoint
    await page.route('**/api/auth/oidc/callback*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              username: 'Test User',
              credits_balance: 50
            },
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            token_type: 'Bearer',
            expires_in: 3600
          }
        })
      });
    });

    // Set state in sessionStorage for CSRF validation
    await page.addInitScript(() => {
      sessionStorage.setItem('oidc_state', 'mock_state');
    });

    // Navigate to callback page with mock code and state
    await page.goto(`${BASE_URL}/auth/oidc/callback?code=mock_code&state=mock_state`);

    // Should redirect to app after successful login
    await page.waitForURL(`${BASE_URL}/app`);
  });

  test('should show error on callback failure', async ({ page }) => {
    // Mock callback endpoint with error
    await page.route('**/api/auth/oidc/callback*', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'LOGIN_FAILED',
            message: '该邮箱已使用密码注册，请使用密码登录'
          }
        })
      });
    });

    // Set state in sessionStorage for CSRF validation
    await page.addInitScript(() => {
      sessionStorage.setItem('oidc_state', 'mock_state');
    });

    await page.goto(`${BASE_URL}/auth/oidc/callback?code=mock_code&state=mock_state`);

    // Should show error message (wait for it to appear)
    await expect(page.locator('text=/该邮箱已使用密码注册|登录失败/')).toBeVisible({ timeout: 2000 });

    // Should redirect back to login
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 3000 });
  });

  test('should handle missing authorization code', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/oidc/callback`);

    // Should show error for missing code
    await expect(page.locator('text=授权失败')).toBeVisible();

    // Should redirect to login
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 3000 });
  });
});

test.describe('OIDC Login - Integration Tests', () => {
  test.skip('should show error when OIDC is not configured', async ({ page }) => {
    // This test requires OIDC to be NOT configured in the backend
    // Skip in CI/CD or when OIDC is configured
    await page.goto(`${BASE_URL}/login`);

    const googleButton = page.locator('button:has-text("Google")');
    await googleButton.click();

    // Without proper OIDC config, should get error
    await page.waitForTimeout(1000);

    // Check if error is displayed
    const hasError = await page.locator('text=/登录失败|Google 登录失败/').isVisible().catch(() => false);

    // This is expected when OIDC is not configured
    expect(hasError).toBeTruthy();
  });
});
