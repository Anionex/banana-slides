import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Image API Protocol Setting', () => {
  test.describe('Mock tests - UI logic', () => {
    test('should show Image API Protocol dropdown when image model source is openai', async ({ page }) => {
      // Mock settings API to return openai as image_model_source
      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 1,
                ai_provider_format: 'gemini',
                image_model_source: 'openai',
                openai_image_api_protocol: 'auto',
                image_model: 'gpt-image-2',
                text_model: 'gemini-2.5-flash',
                image_resolution: '2K',
                image_aspect_ratio: '16:9',
                max_description_workers: 5,
                max_image_workers: 8,
                api_key_length: 10,
                mineru_token_length: 0,
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
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      // The Image API Protocol dropdown should be visible
      const protocolSelect = page.locator('select').filter({ has: page.locator('option[value="images"]') });
      await expect(protocolSelect).toBeVisible();

      // Should have 3 options: auto, images, chat
      const options = protocolSelect.locator('option');
      await expect(options).toHaveCount(3);

      // Default should be 'auto'
      await expect(protocolSelect).toHaveValue('auto');
    });

    test('should hide Image API Protocol dropdown when image model source is gemini', async ({ page }) => {
      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 1,
                ai_provider_format: 'gemini',
                image_model_source: 'gemini',
                openai_image_api_protocol: 'auto',
                image_model: 'imagen-3.0-generate-001',
                text_model: 'gemini-2.5-flash',
                image_resolution: '2K',
                image_aspect_ratio: '16:9',
                max_description_workers: 5,
                max_image_workers: 8,
                api_key_length: 10,
                mineru_token_length: 0,
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
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      // The Image API Protocol dropdown should NOT be visible
      const protocolSelect = page.locator('select').filter({ has: page.locator('option[value="images"]') });
      await expect(protocolSelect).not.toBeVisible();
    });

    test('should show Image API Protocol when global provider is openai and no image source set', async ({ page }) => {
      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 1,
                ai_provider_format: 'openai',
                image_model_source: '',
                openai_image_api_protocol: 'images',
                image_model: 'gpt-image-2',
                text_model: 'gpt-4o',
                image_resolution: '2K',
                image_aspect_ratio: '16:9',
                max_description_workers: 5,
                max_image_workers: 8,
                api_key_length: 10,
                mineru_token_length: 0,
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
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      const protocolSelect = page.locator('select').filter({ has: page.locator('option[value="images"]') });
      await expect(protocolSelect).toBeVisible();
      await expect(protocolSelect).toHaveValue('images');
    });

    test('should include openai_image_api_protocol in save payload', async ({ page }) => {
      let savedPayload: any = null;

      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 1,
                ai_provider_format: 'openai',
                image_model_source: 'openai',
                openai_image_api_protocol: 'auto',
                image_model: 'gpt-image-2',
                text_model: 'gpt-4o',
                image_resolution: '2K',
                image_aspect_ratio: '16:9',
                max_description_workers: 5,
                max_image_workers: 8,
                api_key_length: 10,
                mineru_token_length: 0,
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
              },
            }),
          });
        } else if (route.request().method() === 'PUT') {
          savedPayload = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: savedPayload }),
          });
        }
      });

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      // Change protocol to 'images'
      const protocolSelect = page.locator('select').filter({ has: page.locator('option[value="images"]') });
      await protocolSelect.selectOption('images');

      // Click save
      const saveBtn = page.getByRole('button', { name: /保存|Save/i });
      await saveBtn.click();

      // Wait for save request
      await page.waitForTimeout(1000);

      expect(savedPayload).toBeTruthy();
      expect(savedPayload.openai_image_api_protocol).toBe('images');
    });
  });

  test.describe.serial('Integration tests - real backend', () => {
    test('should persist and reload openai_image_api_protocol setting', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      // First, set image model source to openai to make the dropdown visible
      // Find the image model source dropdown
      const imageModelSection = page.locator('text=图像生成模型,Image Generation Model').first().locator('..').locator('..');

      // Use API to set image_model_source to openai first
      const apiBase = BASE_URL.replace(/:\d+$/, ':' + (parseInt(BASE_URL.split(':').pop()!) + 2000));
      await page.request.put(`${apiBase}/api/settings`, {
        data: { image_model_source: 'openai' },
      });

      // Reload to see the dropdown
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Now the Image API Protocol dropdown should be visible
      const protocolSelect = page.locator('select').filter({ has: page.locator('option[value="images"]') });

      // If not visible, the global provider might not be openai - skip gracefully
      if (!(await protocolSelect.isVisible())) {
        // Set global provider to openai
        await page.request.put(`${apiBase}/api/settings`, {
          data: { ai_provider_format: 'openai', image_model_source: 'openai' },
        });
        await page.reload();
        await page.waitForLoadState('networkidle');
      }

      // Change to 'chat'
      await protocolSelect.selectOption('chat');

      // Save
      const saveBtn = page.getByRole('button', { name: /保存|Save/i });
      await saveBtn.click();
      await page.waitForTimeout(2000);

      // Reload and verify persistence
      await page.reload();
      await page.waitForLoadState('networkidle');

      const reloadedSelect = page.locator('select').filter({ has: page.locator('option[value="images"]') });
      await expect(reloadedSelect).toHaveValue('chat');

      // Reset back to auto
      await reloadedSelect.selectOption('auto');
      await saveBtn.click();
      await page.waitForTimeout(1000);
    });

    test('should return openai_image_api_protocol in GET /api/settings', async ({ page }) => {
      const apiBase = BASE_URL.replace(/:\d+$/, ':' + (parseInt(BASE_URL.split(':').pop()!) + 2000));

      const response = await page.request.get(`${apiBase}/api/settings`);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('openai_image_api_protocol');
      expect(['auto', 'images', 'chat']).toContain(json.data.openai_image_api_protocol);
    });

    test('should validate openai_image_api_protocol values on save', async ({ page }) => {
      const apiBase = BASE_URL.replace(/:\d+$/, ':' + (parseInt(BASE_URL.split(':').pop()!) + 2000));

      // Valid value should succeed
      const validResponse = await page.request.put(`${apiBase}/api/settings`, {
        data: { openai_image_api_protocol: 'images' },
      });
      expect(validResponse.ok()).toBe(true);

      // Invalid value should fail
      const invalidResponse = await page.request.put(`${apiBase}/api/settings`, {
        data: { openai_image_api_protocol: 'invalid_value' },
      });
      expect(invalidResponse.ok()).toBe(false);

      // Reset
      await page.request.put(`${apiBase}/api/settings`, {
        data: { openai_image_api_protocol: 'auto' },
      });
    });

    test('should reset openai_image_api_protocol on settings reset', async ({ page }) => {
      const apiBase = BASE_URL.replace(/:\d+$/, ':' + (parseInt(BASE_URL.split(':').pop()!) + 2000));

      // Set to non-default value and verify it took
      const setResponse = await page.request.put(`${apiBase}/api/settings`, {
        data: { openai_image_api_protocol: 'chat' },
      });
      expect(setResponse.ok()).toBe(true);

      const beforeReset = await page.request.get(`${apiBase}/api/settings`);
      const beforeJson = await beforeReset.json();
      expect(beforeJson.data.openai_image_api_protocol).toBe('chat');

      // Reset
      const resetResponse = await page.request.post(`${apiBase}/api/settings/reset`);
      expect(resetResponse.ok()).toBe(true);

      // Verify it's back to auto
      const getResponse = await page.request.get(`${apiBase}/api/settings`);
      const json = await getResponse.json();
      expect(json.data.openai_image_api_protocol).toBe('auto');
    });
  });
});
