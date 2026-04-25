import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3009';

test.describe('OpenAI OAuth Settings Section', () => {
  test.describe('Mock tests — UI logic', () => {
    test('should show OAuth section with login button when not connected', async ({ page }) => {
      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            json: {
              success: true,
              data: {
                id: 1,
                ai_provider_format: 'openai',
                api_key_length: 0,
                image_resolution: '1024x1024',
                image_aspect_ratio: '16:9',
                max_description_workers: 3,
                max_image_workers: 3,
                output_language: 'zh',
                description_generation_mode: 'streaming',
                enable_text_reasoning: false,
                text_thinking_budget: 1024,
                enable_image_reasoning: false,
                image_thinking_budget: 1024,
                baidu_api_key_length: 0,
                text_api_key_length: 0,
                image_api_key_length: 0,
                image_caption_api_key_length: 0,
                openai_oauth_connected: false,
                openai_oauth_account_id: null,
              },
            },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForSelector('text=Login with OpenAI');

      const loginBtn = page.locator('button', { hasText: 'Login with OpenAI' });
      await expect(loginBtn).toBeVisible();

      // Should not show disconnect button
      const disconnectBtn = page.locator('button', { hasText: /断开连接|Disconnect/ });
      await expect(disconnectBtn).not.toBeVisible();
    });

    test('should show connected state with account ID and disconnect button', async ({ page }) => {
      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            json: {
              success: true,
              data: {
                id: 1,
                ai_provider_format: 'openai',
                api_key_length: 0,
                image_resolution: '1024x1024',
                image_aspect_ratio: '16:9',
                max_description_workers: 3,
                max_image_workers: 3,
                output_language: 'en',
                description_generation_mode: 'streaming',
                enable_text_reasoning: false,
                text_thinking_budget: 1024,
                enable_image_reasoning: false,
                image_thinking_budget: 1024,
                baidu_api_key_length: 0,
                text_api_key_length: 0,
                image_api_key_length: 0,
                image_caption_api_key_length: 0,
                openai_oauth_connected: true,
                openai_oauth_account_id: 'user@example.com',
              },
            },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForSelector('text=/Connected|已连接/');

      // Should show account ID
      await expect(page.locator('text=user@example.com')).toBeVisible();

      // Should show disconnect button
      const disconnectBtn = page.locator('button', { hasText: /Disconnect|断开连接/ });
      await expect(disconnectBtn).toBeVisible();

      // Should NOT show login button
      const loginBtn = page.locator('button', { hasText: 'Login with OpenAI' });
      await expect(loginBtn).not.toBeVisible();
    });

    test('should call authorize endpoint when login button clicked', async ({ page }) => {
      let authorizeCalled = false;

      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            json: {
              success: true,
              data: {
                id: 1,
                ai_provider_format: 'openai',
                api_key_length: 0,
                image_resolution: '1024x1024',
                image_aspect_ratio: '16:9',
                max_description_workers: 3,
                max_image_workers: 3,
                output_language: 'en',
                description_generation_mode: 'streaming',
                enable_text_reasoning: false,
                text_thinking_budget: 1024,
                enable_image_reasoning: false,
                image_thinking_budget: 1024,
                baidu_api_key_length: 0,
                text_api_key_length: 0,
                image_api_key_length: 0,
                image_caption_api_key_length: 0,
                openai_oauth_connected: false,
                openai_oauth_account_id: null,
              },
            },
          });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/settings/openai-oauth/authorize', async (route) => {
        authorizeCalled = true;
        await route.fulfill({
          json: {
            success: true,
            data: { auth_url: 'https://auth.openai.com/oauth/authorize?client_id=test' },
          },
        });
      });

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForSelector('text=Login with OpenAI');

      // Mock window.open to prevent actual popup
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
      let disconnectCalled = false;

      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            json: {
              success: true,
              data: {
                id: 1,
                ai_provider_format: 'openai',
                api_key_length: 0,
                image_resolution: '1024x1024',
                image_aspect_ratio: '16:9',
                max_description_workers: 3,
                max_image_workers: 3,
                output_language: 'en',
                description_generation_mode: 'streaming',
                enable_text_reasoning: false,
                text_thinking_budget: 1024,
                enable_image_reasoning: false,
                image_thinking_budget: 1024,
                baidu_api_key_length: 0,
                text_api_key_length: 0,
                image_api_key_length: 0,
                image_caption_api_key_length: 0,
                openai_oauth_connected: true,
                openai_oauth_account_id: 'user@example.com',
              },
            },
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
      await page.waitForSelector('text=/Connected|已连接/');

      const disconnectBtn = page.locator('button', { hasText: /Disconnect|断开连接/ });
      await disconnectBtn.click();
      await page.waitForTimeout(500);

      expect(disconnectCalled).toBe(true);

      // After disconnect, should show login button
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
      expect(data.data.auth_url).toContain('response_type=code');
      expect(data.data.auth_url).toContain('scope=');
      expect(data.data.auth_url).toContain('api.connectors.read');
      expect(data.data.auth_url).toContain('codex_cli_simplified_flow=true');
      expect(data.data.auth_url).toContain('originator=codex_cli_rs');
      // redirect_uri must use port 1455 (OpenAI's registered callback port)
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

      // OAuth section should be visible
      const oauthSection = page.locator('text=OpenAI');
      await expect(oauthSection.first()).toBeVisible();

      // Login button should be visible (not connected by default)
      const loginBtn = page.locator('button', { hasText: 'Login with OpenAI' });
      await expect(loginBtn).toBeVisible();
    });
  });
});