import { expect, test } from '@playwright/test';

const APIMART_BASE_URL = 'https://api.apimart.ai/v1';

const settingsData = {
  id: 1,
  ai_provider_format: 'gemini',
  api_base_url: '',
  api_key_length: 0,
  text_model: '',
  image_model: '',
  image_caption_model: '',
  image_resolution: '2K',
  max_description_workers: 5,
  max_image_workers: 8,
  output_language: 'zh',
  enable_text_reasoning: false,
  text_thinking_budget: 1024,
  enable_image_reasoning: false,
  image_thinking_budget: 1024,
  text_model_source: '',
  image_model_source: '',
  image_caption_model_source: '',
  lazyllm_api_keys_info: {},
  text_api_key_length: 0,
  text_api_base_url: '',
  image_api_key_length: 0,
  image_api_base_url: '',
  image_caption_api_key_length: 0,
  image_caption_api_base_url: '',
  openai_image_api_protocol: 'chat',
  openai_oauth_connected: false,
};

test.use({ locale: 'zh-CN' });
for (const existing of [false, true]) {
  test(existing ? 'legacy endpoint stays OpenAI-compatible without brand links' : 'removed sponsor is absent from provider choices', async ({ page }) => {
    const data = { ...settingsData, ...(existing ? { ai_provider_format: 'openai', api_base_url: APIMART_BASE_URL, api_key_length: 12, text_model: 'saved-text', image_model: 'saved-image' } : {}) };
    let savedPayload: Record<string, unknown> | undefined;
    await page.route('**/api/access-code/check', route => route.fulfill({ json: { success: true, data: { enabled: false } } }));
    await page.route(url => url.pathname === '/api/settings', async route => {
      if (route.request().method() === 'PUT') savedPayload = route.request().postDataJSON();
      await route.fulfill({ json: { success: true, data: { ...data, ...savedPayload } } });
    });
    await page.goto('/settings');
    await expect(page.getByTestId('global-provider-pills')).toBeVisible();
    await expect(page.locator('[data-provider="apimart"]')).toHaveCount(0);
    await expect(page.locator('a[href*="apimart"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/apimart/i);
    if (existing) {
      await expect(page.locator('[data-provider="openai"]')).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('global-api-config-section').locator('input').first()).toHaveValue(APIMART_BASE_URL);
      await page.getByRole('button', { name: '保存设置', exact: true }).click();
      await expect.poll(() => savedPayload?.api_base_url).toBe(APIMART_BASE_URL);
      expect(savedPayload?.ai_provider_format).toBe('openai');
      expect(savedPayload?.image_model).toBe('saved-image');
    }
  });
}
