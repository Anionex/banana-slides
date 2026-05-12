import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3009';

async function getBaseSettings(): Promise<Record<string, unknown>> {
  const resp = await fetch(`${BASE_URL}/api/settings`);
  const json = await resp.json();
  return json.data;
}

async function expandAdvancedSettings(page: import('@playwright/test').Page) {
  const advancedBtn = page.locator('button', { hasText: /高级设置|Advanced/ });
  await advancedBtn.waitFor({ state: 'visible', timeout: 10000 });
  await advancedBtn.click();
  await page.waitForTimeout(500);
}

test.describe('OpenAI OAuth Settings Section', () => {
  test.describe('Mock tests — UI logic', () => {
    test('should show OAuth section with login button when not connected', async ({ page }) => {
      const base = await getBaseSettings();
      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            json: { success: true, data: { ...base, openai_oauth_connected: false, openai_oauth_account_id: null } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/settings`);
      await expandAdvancedSettings(page);
      await page.waitForSelector('text=Login with OpenAI');

      const loginBtn = page.locator('button', { hasText: 'Login with OpenAI' });
      await expect(loginBtn).toBeVisible();

      const disconnectBtn = page.locator('button', { hasText: /断开连接|Disconnect/ });
      await expect(disconnectBtn).not.toBeVisible();
    });

    test('should show connected state with account ID and disconnect button', async ({ page }) => {
      const base = await getBaseSettings();
      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            json: { success: true, data: { ...base, openai_oauth_connected: true, openai_oauth_account_id: 'user@example.com' } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/settings`);
      await expandAdvancedSettings(page);
      await page.waitForSelector('text=/Connected|已连接/');

      await expect(page.locator('text=user@example.com')).toBeVisible();

      const disconnectBtn = page.locator('button', { hasText: /Disconnect|断开连接/ });
      await expect(disconnectBtn).toBeVisible();

      const loginBtn = page.locator('button', { hasText: 'Login with OpenAI' });
      await expect(loginBtn).not.toBeVisible();
    });

    test('should call authorize endpoint when login button clicked', async ({ page }) => {
      const base = await getBaseSettings();
      let authorizeCalled = false;

      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            json: { success: true, data: { ...base, openai_oauth_connected: false, openai_oauth_account_id: null } },
          });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/settings/openai-oauth/authorize', async (route) => {
        authorizeCalled = true;
        await route.fulfill({
          json: { success: true, data: { auth_url: 'https://auth.openai.com/oauth/authorize?client_id=test' } },
        });
      });

      await page.goto(`${BASE_URL}/settings`);
      await expandAdvancedSettings(page);
      await page.waitForSelector('text=Login with OpenAI');

      await page.evaluate(() => {
        (window as any).__openedUrl = null;
        window.open = (url: any) => {
          (window as any).__openedUrl = url;
          return { closed: true } as Window;
        };
      });

      await page.click('button:has-text("Login with OpenAI")');
      await page.waitForTimeout(500);

      expect(authorizeCalled).toBe(true);

      const openedUrl = await page.evaluate(() => (window as any).__openedUrl);
      expect(openedUrl).toContain('auth.openai.com');
    });

    test('should call disconnect endpoint and update UI', async ({ page }) => {
      const base = await getBaseSettings();
      let disconnectCalled = false;

      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            json: { success: true, data: { ...base, openai_oauth_connected: true, openai_oauth_account_id: 'user@example.com' } },
          });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/settings/openai-oauth/disconnect', async (route) => {
        disconnectCalled = true;
        await route.fulfill({
          json: { success: true, data: { message: 'Disconnected' } },
        });
      });

      await page.goto(`${BASE_URL}/settings`);
      await expandAdvancedSettings(page);
      await page.waitForSelector('text=/Connected|已连接/');

      const disconnectBtn = page.locator('button', { hasText: /Disconnect|断开连接/ });
      await disconnectBtn.click();
      await page.waitForTimeout(500);

      expect(disconnectCalled).toBe(true);

      await expect(page.locator('button', { hasText: 'Login with OpenAI' })).toBeVisible();
    });
  });

  test.describe('Integration tests — real backend', () => {
    test('OAuth status endpoint returns valid response', async ({ request }) => {
      const resp = await request.get(`${BASE_URL}/api/settings/openai-oauth/status`);
      expect(resp.ok()).toBeTruthy();
      const data = await resp.json();
      expect(data.success).toBe(true);
      expect(typeof data.data.connected).toBe('boolean');
      if (data.data.connected) {
        expect(data.data.account_id).toBeTruthy();
      } else {
        expect(data.data.account_id).toBeNull();
      }
    });

    test('OAuth authorize endpoint returns valid auth URL', async ({ request }) => {
      const resp = await request.get(`${BASE_URL}/api/settings/openai-oauth/authorize`);
      expect(resp.ok()).toBeTruthy();
      const data = await resp.json();
      expect(data.success).toBe(true);
      expect(data.data.auth_url).toContain('https://auth.openai.com/oauth/authorize');
      expect(data.data.auth_url).toContain('client_id=app_EMoamEEZ73f0CkXaXp7hrann');
      expect(data.data.auth_url).toContain('code_challenge=');
      expect(data.data.auth_url).toContain('code_challenge_method=S256');
      expect(data.data.auth_url).toContain('originator=codex_cli_rs');
      expect(data.data.auth_url).toContain('localhost%3A1455');
    });

    test('OAuth disconnect endpoint works even when not connected', async ({ request }) => {
      const resp = await request.post(`${BASE_URL}/api/settings/openai-oauth/disconnect`);
      expect(resp.ok()).toBeTruthy();
      const data = await resp.json();
      expect(data.success).toBe(true);
    });

    test('Settings API includes OAuth fields', async ({ request }) => {
      const resp = await request.get(`${BASE_URL}/api/settings`);
      expect(resp.ok()).toBeTruthy();
      const data = await resp.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('openai_oauth_connected');
      expect(typeof data.data.openai_oauth_connected).toBe('boolean');
    });

    test('OAuth section renders correctly with real backend', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`);
      await expandAdvancedSettings(page);

      const loginBtn = page.locator('button', { hasText: 'Login with OpenAI' });
      const disconnectBtn = page.locator('button', { hasText: /Disconnect|断开连接/ });
      const hasLogin = await loginBtn.isVisible().catch(() => false);
      const hasDisconnect = await disconnectBtn.isVisible().catch(() => false);
      expect(hasLogin || hasDisconnect).toBeTruthy();
    });
  });
});
