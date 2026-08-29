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

test.describe('Settings APIMart provider pill', () => {
  test.use({ locale: 'zh-CN' });

  test('fills APIMart defaults while saving through the OpenAI-compatible provider', async ({ page }) => {
    let savedPayload: Record<string, unknown> | undefined;
    await page.route(url => url.pathname === '/api/settings', async route => {
      if (route.request().method() === 'PUT') {
        savedPayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...settingsData, ...savedPayload } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: settingsData }),
      });
    });

    await page.goto('/settings');
    const apimartPill = page.getByTestId('global-provider-pills').locator('[data-provider="apimart"]');
    await apimartPill.click();

    await expect(apimartPill).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('如何获取 APIMart API Key')).toBeVisible();
    await expect(page.getByRole('link', { name: '打开 APIMart →' }))
      .toHaveAttribute('href', 'https://go.apimart.ai/gh-banana-slides');
    await expect(apimartPill).toContainText('仅需 $0.006/张');

    const modelProviderOptions = page.locator('select').filter({ has: page.locator('option[value=""]') });
    await expect(modelProviderOptions.first().locator('option[value="apimart"]')).toHaveCount(0);

    const apiSection = page.getByTestId('global-api-config-section');
    await expect(apiSection.locator('input').first()).toHaveValue(APIMART_BASE_URL);
    const modelInputs = page.locator('input[placeholder^="留空使用环境变量配置"]');
    await expect(modelInputs.nth(0)).toHaveValue('gpt-5.6-sol');
    await expect(modelInputs.nth(1)).toHaveValue('gpt-image-2');
    await expect(modelInputs.nth(2)).toHaveValue('gpt-5.6-luna');

    await page.getByTestId('global-provider-pills').locator('[data-provider="openai"]').click();
    await expect(apiSection.locator('input').first()).toHaveValue('https://api.openai.com/v1');
    await apimartPill.click();

    await page.getByRole('button', { name: '保存设置' }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedPayload?.ai_provider_format).toBe('openai');
    expect(savedPayload?.api_base_url).toBe(APIMART_BASE_URL);
    expect(savedPayload?.text_model).toBe('gpt-5.6-sol');
    expect(savedPayload?.image_model).toBe('gpt-image-2');
    expect(savedPayload?.image_caption_model).toBe('gpt-5.6-luna');
    expect(savedPayload?.openai_image_api_protocol).toBe('images');
  });

  test('recognizes a saved APIMart endpoint as the APIMart pill', async ({ page }) => {
    await page.route(url => url.pathname === '/api/settings', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          ...settingsData,
          ai_provider_format: 'openai',
          api_base_url: APIMART_BASE_URL,
          text_model: 'gpt-5.6-sol',
          image_model: 'gpt-image-2',
          image_caption_model: 'gpt-5.6-luna',
          openai_image_api_protocol: 'images',
        },
      }),
    }));

    await page.goto('/settings');
    await expect(page.getByTestId('global-provider-pills').locator('[data-provider="apimart"]'))
      .toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('如何获取 APIMart API Key')).toBeVisible();
  });

  test('preserves models that use explicit per-model providers', async ({ page }) => {
    let savedPayload: Record<string, unknown> | undefined;
    const explicitModels = {
      text_model: 'gemini-custom-text',
      image_model: 'gemini-custom-image',
      image_caption_model: 'gemini-custom-caption',
      text_model_source: 'gemini',
      image_model_source: 'gemini',
      image_caption_model_source: 'gemini',
      openai_image_api_protocol: 'chat',
    };

    await page.route(url => url.pathname === '/api/settings', async route => {
      if (route.request().method() === 'PUT') {
        savedPayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...settingsData, ...savedPayload } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...settingsData, ...explicitModels } }),
      });
    });

    await page.goto('/settings');
    await page.getByTestId('global-provider-pills').locator('[data-provider="apimart"]').click();
    await page.getByRole('button', { name: '保存设置' }).click();

    for (const [key, value] of Object.entries(explicitModels)) {
      expect(savedPayload?.[key]).toBe(value);
    }
    expect(savedPayload?.ai_provider_format).toBe('openai');
    expect(savedPayload?.api_base_url).toBe(APIMART_BASE_URL);
  });
});
