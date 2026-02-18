import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Mock settings API to return deepseek as default provider
  await page.route('**/api/settings', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          data: {
            ai_provider_format: 'lazyllm',
            lazyllm_api_keys_info: { deepseek: 10 },
            api_base_url: '', api_key_length: 0,
            text_model: '', image_model: '', image_caption_model: '',
            text_model_source: '', image_model_source: '', image_caption_model_source: '',
            image_resolution: '2K', max_description_workers: 5, max_image_workers: 8,
            output_language: 'zh', mineru_api_base: '', mineru_token_length: 0,
            enable_text_reasoning: false, text_thinking_budget: 1024,
            enable_image_reasoning: false, image_thinking_budget: 1024,
            baidu_ocr_api_key_length: 0,
            text_api_key_length: 0, text_api_base_url: '',
            image_api_key_length: 0, image_api_base_url: '',
            image_caption_api_key_length: 0, image_caption_api_base_url: '',
          }
        }
      });
    } else {
      await route.continue();
    }
  });

  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
});

test('service test sends lazyllm format instead of raw vendor name', async ({ page }) => {
  // The dropdown should show DeepSeek (resolved from lazyllm + keys_info)
  const section = page.getByTestId('global-api-config-section');
  const providerSelect = section.locator('select').first();
  await expect(providerSelect).toHaveValue('deepseek');

  // Intercept the test API call to capture the payload
  let capturedPayload: any = null;
  await page.route('**/api/settings/tests/text-model', async (route) => {
    capturedPayload = route.request().postDataJSON();
    await route.fulfill({
      json: { data: { task_id: 'mock-task-123' } }
    });
  });

  // Click the text model test button
  const textModelTestBtn = page.locator('button', { hasText: /开始测试|Start Test/ }).nth(1);
  await textModelTestBtn.click();

  // Verify the payload sends 'lazyllm' not 'deepseek'
  expect(capturedPayload).toBeTruthy();
  expect(capturedPayload.ai_provider_format).toBe('lazyllm');
});
