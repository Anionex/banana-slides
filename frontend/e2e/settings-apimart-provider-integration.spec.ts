import { test, expect, type Page } from '@playwright/test';

const APIMART_BASE_URL = 'https://api.apimart.ai/v1';

const providerPill = (page: Page) =>
  page.getByTestId('global-provider-pills').locator('[data-provider="apimart"]');

const mockSettings = {
  success: true,
  message: 'Success',
  data: {
    id: 1,
    ai_provider_format: 'gemini',
    api_base_url: '',
    api_key_length: 0,
    text_model: '',
    image_model: '',
    image_caption_model: '',
    image_resolution: '2K',
    image_aspect_ratio: '16:9',
    max_description_workers: 5,
    max_image_workers: 8,
    output_language: 'zh',
    description_generation_mode: 'streaming',
    description_extra_fields: [],
    image_prompt_extra_fields: [],
    enable_text_reasoning: false,
    text_thinking_budget: 1024,
    enable_image_reasoning: false,
    image_thinking_budget: 1024,
    mineru_api_base: '',
    mineru_token_length: 0,
    baidu_api_key_length: 0,
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
    openai_image_api_protocol: 'auto',
    openai_oauth_connected: false,
    openai_oauth_account_id: null,
    elevenlabs_enabled: false,
    elevenlabs_api_key_length: 0,
    elevenlabs_voice_id: '',
  },
};

test.describe('Settings: APIMart provider pill', () => {
  test.use({ locale: 'zh-CN' });

  test('selects APIMart and fills only its required defaults', async ({ page }) => {
    let savedPayload: Record<string, unknown> | null = null;
    await page.route(url => url.pathname === '/api/settings', async route => {
      if (route.request().method() === 'PUT') {
        savedPayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...mockSettings, data: { ...mockSettings.data, ...savedPayload } }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) });
    });

    await page.goto('/settings');
    await providerPill(page).click();

    await expect(providerPill(page)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('provider-plan-comparison').getByText('不知道怎么选？两个推荐方案对比'))
      .toBeVisible();
    await expect(page.getByTestId('provider-plan-comparison').getByText('APIMart', { exact: true }))
      .not.toBeVisible();

    const apiSection = page.getByTestId('global-api-config-section');
    await expect(apiSection.locator('input').first()).toHaveValue(APIMART_BASE_URL);
    const modelInputs = page.locator('input[placeholder^="留空使用环境变量配置"]');
    await expect(modelInputs.nth(0)).toHaveValue('gpt-5');
    await expect(modelInputs.nth(1)).toHaveValue('gpt-image-2');
    await expect(modelInputs.nth(2)).toHaveValue('gpt-4o');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedPayload?.ai_provider_format).toBe('apimart');
    expect(savedPayload?.api_base_url).toBe(APIMART_BASE_URL);
    expect(savedPayload?.text_model).toBe('gpt-5');
    expect(savedPayload?.image_model).toBe('gpt-image-2');
    expect(savedPayload?.image_caption_model).toBe('gpt-4o');

    await page.getByTestId('global-provider-pills').locator('[data-provider="gemini"]').click();
    await expect(apiSection.locator('input').first()).toHaveValue('');
    await expect(modelInputs.nth(0)).toHaveValue('');
    await expect(modelInputs.nth(1)).toHaveValue('');
    await expect(modelInputs.nth(2)).toHaveValue('');
  });

  test('preserves models owned by explicit per-model providers', async ({ page }) => {
    await page.route(url => url.pathname === '/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            text_model: 'gemini-text-model',
            text_model_source: 'gemini',
            image_model: 'openai-image-model',
            image_model_source: 'openai',
            image_caption_model: 'volcengine-caption-model',
            image_caption_model_source: 'volcengine',
          },
        }),
      })
    );

    await page.goto('/settings');
    await providerPill(page).click();

    const modelInputs = page.locator('input[placeholder^="留空使用环境变量配置"]');
    await expect(modelInputs.nth(0)).toHaveValue('gemini-text-model');
    await expect(modelInputs.nth(1)).toHaveValue('openai-image-model');
    await expect(modelInputs.nth(2)).toHaveValue('volcengine-caption-model');
  });

  test('fills APIMart models when a per-model source switches to APIMart', async ({ page }) => {
    await page.route(url => url.pathname === '/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) })
    );

    await page.goto('/settings');
    await page.getByTestId('text_model_source-select').selectOption('apimart');
    await page.getByTestId('image_model_source-select').selectOption('apimart');
    await page.getByTestId('image_caption_model_source-select').selectOption('apimart');

    const modelInputs = page.locator('input[placeholder^="留空使用环境变量配置"]');
    await expect(modelInputs.nth(0)).toHaveValue('gpt-5');
    await expect(modelInputs.nth(1)).toHaveValue('gpt-image-2');
    await expect(modelInputs.nth(2)).toHaveValue('gpt-4o');
  });

  test('reselecting APIMart preserves custom endpoint and models', async ({ page }) => {
    await page.route(url => url.pathname === '/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'apimart',
            api_base_url: 'https://apimart-proxy.example/v1',
            text_model: 'custom-text-model',
            image_model: 'custom-image-model',
            image_caption_model: 'custom-caption-model',
          },
        }),
      })
    );

    await page.goto('/settings');
    await providerPill(page).click();

    const apiSection = page.getByTestId('global-api-config-section');
    await expect(apiSection.locator('input').first()).toHaveValue('https://apimart-proxy.example/v1');
    const modelInputs = page.locator('input[placeholder^="留空使用环境变量配置"]');
    await expect(modelInputs.nth(0)).toHaveValue('custom-text-model');
    await expect(modelInputs.nth(1)).toHaveValue('custom-image-model');
    await expect(modelInputs.nth(2)).toHaveValue('custom-caption-model');
  });
});

test.describe('Settings: APIMart persistence (real backend)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(30_000);

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/settings');
    await page.getByRole('button', { name: /重置|Reset/ }).click();
    await page.getByRole('button', { name: /确定重置|Confirm/ }).click();
    await expect(page.locator('text=设置已重置').or(page.locator('text=reset successfully')))
      .toBeVisible({ timeout: 5000 });
    await page.close();
  });

  test('saves and reloads APIMart configuration', async ({ page }) => {
    await page.goto('/settings');
    await providerPill(page).click();

    const apiSection = page.getByTestId('global-api-config-section');
    await apiSection.locator('input[type="password"]').fill('apimart-integration-test-key');
    await page.getByRole('button', { name: /保存设置|Save Settings/ }).click();
    await expect(page.locator('text=设置保存成功').or(page.locator('text=saved successfully')))
      .toBeVisible({ timeout: 5000 });

    const response = await page.request.get('/api/settings');
    const payload = await response.json();
    expect(payload.data.ai_provider_format).toBe('apimart');
    expect(payload.data.api_base_url).toBe(APIMART_BASE_URL);
    expect(payload.data.text_model).toBe('gpt-5');
    expect(payload.data.image_model).toBe('gpt-image-2');
    expect(payload.data.image_caption_model).toBe('gpt-4o');
    expect(payload.data.api_key_length).toBe('apimart-integration-test-key'.length);

    await page.reload();
    await expect(providerPill(page)).toHaveAttribute('aria-checked', 'true');
    await expect(apiSection.locator('input').first()).toHaveValue(APIMART_BASE_URL);
  });
});
