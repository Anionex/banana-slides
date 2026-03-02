/**
 * E2E tests for lazyllm provider selection on the Settings page.
 *
 * Covers the bug fix: when user selects a specific lazyllm vendor (e.g. doubao)
 * as the global provider, the correct vendor key must be inferred on the backend
 * instead of defaulting to 'deepseek'.
 */
import { test, expect } from '@playwright/test';

const BASE_SETTINGS = {
  ai_provider_format: 'gemini',
  api_base_url: '',
  api_key_length: 0,
  text_model: '',
  image_model: '',
  image_caption_model: '',
  mineru_api_base: '',
  mineru_token_length: 0,
  image_resolution: '2K',
  max_description_workers: 5,
  max_image_workers: 8,
  output_language: 'zh',
  enable_text_reasoning: false,
  text_thinking_budget: 1024,
  enable_image_reasoning: false,
  image_thinking_budget: 1024,
  baidu_api_key_length: 0,
  text_model_source: '',
  image_model_source: '',
  image_caption_model_source: '',
  lazyllm_api_keys_info: {} as Record<string, number>,
  text_api_key_length: 0,
  text_api_base_url: '',
  image_api_key_length: 0,
  image_api_base_url: '',
  image_caption_api_key_length: 0,
  image_caption_api_base_url: '',
};

test.describe('Settings - LazyLLM provider selection', () => {
  test('selecting doubao as global provider saves as lazyllm format', async ({ page }) => {
    let getCallCount = 0;
    // Mock GET settings — fresh state, no prior config
    await page.route('**/api/settings', async (route, request) => {
      if (request.method() === 'GET') {
        getCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: BASE_SETTINGS })
        });
      } else {
        await route.continue();
      }
    });

    let savedPayload: any = null;
    // Mock PUT settings to capture what the frontend sends
    await page.route('**/api/settings', async (route, request) => {
      if (request.method() === 'PUT') {
        savedPayload = request.postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...BASE_SETTINGS, ai_provider_format: 'lazyllm', lazyllm_api_keys_info: { doubao: 15 } }
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/settings');
    await page.waitForSelector('text=系统设置', { timeout: 10000 });

    // Find the global provider select element — it's inside the "默认 API 配置" section
    const providerSelect = page.locator('[data-testid="global-api-config-section"] select').first();
    await expect(providerSelect).toBeVisible({ timeout: 5000 });

    // Select doubao from the dropdown
    await providerSelect.selectOption('doubao');

    // A doubao API key input should appear (GlobalVendorKeyInput renders for lazyllm vendors)
    const doubaoKeyInput = page.locator('[data-testid="global-api-config-section"] input[type="password"]').first();
    await expect(doubaoKeyInput).toBeVisible({ timeout: 3000 });
    await doubaoKeyInput.fill('test-doubao-api-key-12345');

    // Save settings
    const saveBtn = page.getByRole('button', { name: /保存设置/i });
    await saveBtn.click();

    // Verify the payload sent to backend maps doubao → lazyllm
    await page.waitForTimeout(1000);
    expect(savedPayload).not.toBeNull();
    expect(savedPayload.ai_provider_format).toBe('lazyllm');
    expect(savedPayload.lazyllm_api_keys).toMatchObject({ doubao: 'test-doubao-api-key-12345' });
  });

  test('settings page shows doubao vendor selected when lazyllm+doubao key is configured', async ({ page }) => {
    // Mock GET settings — lazyllm with doubao key configured
    await page.route('**/api/settings', async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ...BASE_SETTINGS,
              ai_provider_format: 'lazyllm',
              // doubao key is configured — frontend will resolve 'lazyllm' → 'doubao'
              lazyllm_api_keys_info: { doubao: 20 },
            }
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/settings');
    await page.waitForSelector('text=系统设置', { timeout: 10000 });

    // The provider select should show doubao as selected value
    const providerSelect = page.locator('[data-testid="global-api-config-section"] select').first();
    await expect(providerSelect).toBeVisible({ timeout: 5000 });
    await expect(providerSelect).toHaveValue('doubao');

    // The doubao API key field should show "already set" as placeholder (length 20)
    const doubaoKeyInput = page.locator('[data-testid="global-api-config-section"] input[type="password"]').first();
    await expect(doubaoKeyInput).toBeVisible({ timeout: 3000 });
    const placeholder = await doubaoKeyInput.getAttribute('placeholder');
    expect(placeholder).toMatch(/已设置.*20/);
  });
});
