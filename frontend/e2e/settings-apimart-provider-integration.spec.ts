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
    await expect(page.getByText('如何获取 APIMart API Key')).toBeVisible();
    await expect(page.getByRole('link', { name: '打开 APIMart →' }))
      .toHaveAttribute('href', 'https://go.apimart.ai/gh-banana-slides');
    await expect(page.getByText('进入 APIMart 控制台并完成账户设置')).toBeVisible();

    const apiSection = page.getByTestId('global-api-config-section');
    await expect(apiSection.locator('input').first()).toHaveValue(APIMART_BASE_URL);
    const modelInputs = page.locator('input[placeholder^="留空使用环境变量配置"]');
    await expect(modelInputs.nth(0)).toHaveValue('gpt-5');
    await expect(modelInputs.nth(1)).toHaveValue('gpt-image-2');
    await expect(modelInputs.nth(2)).toHaveValue('gpt-4o');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedPayload?.api_key).toBeNull();
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
    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功').last()).toBeVisible();
    expect(savedPayload?.api_key).toBeNull();
  });

  test('preserves models owned by explicit per-model providers', async ({ page }) => {
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
      await route.fulfill({
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
      });
    });

    await page.goto('/settings');
    const apiSection = page.getByTestId('global-api-config-section');
    await apiSection.locator('input').first().fill('https://typed-gemini.example/v1beta');
    await apiSection.locator('input[type="password"]').fill('typed-gemini-key');
    await providerPill(page).click();

    const modelInputs = page.locator('input[placeholder^="留空使用环境变量配置"]');
    await expect(modelInputs.nth(0)).toHaveValue('gemini-text-model');
    await expect(modelInputs.nth(1)).toHaveValue('openai-image-model');
    await expect(modelInputs.nth(2)).toHaveValue('volcengine-caption-model');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedPayload?.text_api_key).toBe('typed-gemini-key');
    expect(savedPayload?.text_api_base_url).toBe('https://typed-gemini.example/v1beta');
  });

  test('passes explicit credential clears to unsaved service tests', async ({ page }) => {
    let testPayload: Record<string, unknown> | null = null;
    await page.route(url => url.pathname === '/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            api_key_length: 18,
            text_api_key_length: 16,
          },
        }),
      })
    );
    await page.route(url => url.pathname === '/api/settings/tests/text-model', async route => {
      testPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { task_id: 'apimart-test-task', status: 'PENDING' } }),
      });
    });
    await page.route(url => url.pathname === '/api/settings/tests/apimart-test-task/status', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { status: 'COMPLETED', result: { reply: 'ok' } } }),
      })
    );

    await page.goto('/settings');
    await providerPill(page).click();
    await page.getByTestId('text_model_source-select').selectOption('apimart');
    const textTestCard = page.getByText('文本生成模型', { exact: true }).locator('xpath=../..');
    await textTestCard.getByRole('button', { name: '开始测试' }).click();

    await expect.poll(() => testPayload).not.toBeNull();
    expect(testPayload?.api_key).toBeNull();
    expect(testPayload?.text_api_key).toBeNull();

    testPayload = null;
    await page.getByTestId('text_model_source-select').selectOption('');
    await page.getByTestId('global-provider-pills').locator('[data-provider="gemini"]').click();
    await textTestCard.getByRole('button', { name: '开始测试' }).click();
    await expect.poll(() => testPayload).not.toBeNull();
    expect(testPayload?.text_model).toBe('');
    expect(testPayload?.image_model).toBe('');
    expect(testPayload?.image_caption_model).toBe('');
  });

  test('fills APIMart models when a per-model source switches to APIMart', async ({ page }) => {
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
    await page.getByTestId('text_model_source-select').selectOption('apimart');
    await page.getByTestId('image_model_source-select').selectOption('apimart');
    await page.getByTestId('image_caption_model_source-select').selectOption('apimart');

    const modelInputs = page.locator('input[placeholder^="留空使用环境变量配置"]');
    await expect(modelInputs.nth(0)).toHaveValue('gpt-5');
    await expect(modelInputs.nth(1)).toHaveValue('gpt-image-2');
    await expect(modelInputs.nth(2)).toHaveValue('gpt-4o');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedPayload?.text_api_key).toBeNull();
    expect(savedPayload?.image_api_key).toBeNull();
    expect(savedPayload?.image_caption_api_key).toBeNull();

    await modelInputs.nth(0).fill('custom-text-model');
    await page.getByTestId('text_model_source-select').selectOption('gemini');
    await page.getByTestId('image_model_source-select').selectOption('openai');
    await page.getByTestId('image_caption_model_source-select').selectOption('gemini');

    await expect(modelInputs.nth(0)).toHaveValue('custom-text-model');
    await expect(modelInputs.nth(1)).toHaveValue('');
    await expect(modelInputs.nth(2)).toHaveValue('');
    await page.locator('input[type="password"]').nth(1).fill('replacement-text-key');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功').last()).toBeVisible();
    expect(savedPayload?.text_api_key).toBe('replacement-text-key');
    expect(savedPayload?.image_api_key).toBeNull();
    expect(savedPayload?.image_caption_api_key).toBeNull();
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

  test('choosing the AIHubMix card clears inherited APIMart settings', async ({ page }) => {
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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'apimart',
            api_base_url: APIMART_BASE_URL,
            api_key_length: 18,
            text_model: 'gpt-5',
            image_model: 'gpt-image-2',
            image_caption_model: 'gpt-4o',
          },
        }),
      });
    });

    await page.goto('/settings');
    await page.getByTestId('provider-plan-aihubmix').getByRole('button', { name: '使用此方案' }).click();

    await expect(page.getByTestId('global-provider-pills').locator('[data-provider="gemini"]'))
      .toHaveAttribute('aria-checked', 'true');
    const modelInputs = page.locator('input[placeholder^="留空使用环境变量配置"]');
    await expect(modelInputs.nth(0)).toHaveValue('');
    await expect(modelInputs.nth(1)).toHaveValue('');
    await expect(modelInputs.nth(2)).toHaveValue('');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedPayload?.api_key).toBeNull();
    expect(savedPayload?.text_model).toBe('');
    expect(savedPayload?.image_model).toBe('');
    expect(savedPayload?.image_caption_model).toBe('');
  });
});

test.describe('Settings: APIMart persistence (real backend)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(30_000);

  test.beforeEach(async ({ page }) => {
    const response = await page.request.post('/api/settings/reset');
    expect(response.ok()).toBe(true);
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/settings');
    await page.getByRole('button', { name: /重置|Reset/ }).click();
    await page.getByRole('button', { name: /确定重置|Confirm/ }).click();
    await expect(page.locator('text=设置已重置').or(page.locator('text=reset successfully')))
      .toBeVisible({ timeout: 5000 });
    await page.close();
  });

  test('preserves a previous global key for a retained explicit model source', async ({ page }) => {
    await page.goto('/settings');
    await page.getByTestId('text_model_source-select').selectOption('gemini');

    const apiSection = page.getByTestId('global-api-config-section');
    await apiSection.locator('input').first().fill('https://gemini-retained-proxy.example/v1beta');
    await apiSection.locator('input[type="password"]').fill('gemini-retained-source-key');
    await page.getByRole('button', { name: /保存设置|Save Settings/ }).click();
    await expect(page.locator('text=设置保存成功').or(page.locator('text=saved successfully')))
      .toBeVisible({ timeout: 5000 });

    await providerPill(page).click();
    await apiSection.locator('input[type="password"]').fill('apimart-new-global-key');
    await page.getByRole('button', { name: /保存设置|Save Settings/ }).click();
    await expect(page.locator('text=设置保存成功').or(page.locator('text=saved successfully')).last())
      .toBeVisible({ timeout: 5000 });

    const response = await page.request.get('/api/settings');
    const payload = await response.json();
    expect(payload.data.ai_provider_format).toBe('apimart');
    expect(payload.data.api_key_length).toBe('apimart-new-global-key'.length);
    expect(payload.data.text_model_source).toBe('gemini');
    expect(payload.data.text_api_key_length).toBe('gemini-retained-source-key'.length);
    expect(payload.data.text_api_base_url).toBe('https://gemini-retained-proxy.example/v1beta');
  });

  test('honors an explicit per-model Base URL clear during the provider switch', async ({ page }) => {
    const baselineResponse = await page.request.get('/api/settings');
    const baselinePayload = await baselineResponse.json();
    const geminiDefaultBaseUrl = baselinePayload.data.api_base_url;

    await page.goto('/settings');
    const textSource = page.getByTestId('text_model_source-select');
    await textSource.selectOption('gemini');

    const apiSection = page.getByTestId('global-api-config-section');
    await apiSection.locator('input').first().fill('https://gemini-global-proxy.example/v1beta');
    await apiSection.locator('input[type="password"]').fill('gemini-clear-base-key');

    const textModelGroup = textSource.locator('xpath=../..');
    const textModelBaseInput = textModelGroup.locator('input[type="text"]').nth(1);
    await textModelBaseInput.fill('https://dedicated-text.example/v1beta');
    await page.getByRole('button', { name: /保存设置|Save Settings/ }).click();
    await expect(page.locator('text=设置保存成功').or(page.locator('text=saved successfully')))
      .toBeVisible({ timeout: 5000 });

    await providerPill(page).click();
    await textModelBaseInput.fill('');
    await apiSection.locator('input[type="password"]').fill('apimart-clear-base-key');
    await page.getByRole('button', { name: /保存设置|Save Settings/ }).click();
    await expect(page.locator('text=设置保存成功').or(page.locator('text=saved successfully')).last())
      .toBeVisible({ timeout: 5000 });

    const response = await page.request.get('/api/settings');
    const payload = await response.json();
    expect(payload.data.ai_provider_format).toBe('apimart');
    expect(payload.data.text_model_source).toBe('gemini');
    expect(payload.data.text_api_base_url).toBe(geminiDefaultBaseUrl);
    expect(payload.data.text_api_base_url).not.toBe('https://gemini-global-proxy.example/v1beta');
    expect(payload.data.text_api_base_url).not.toBe('https://dedicated-text.example/v1beta');
  });

  test('saves and reloads APIMart configuration', async ({ page }) => {
    const baselineResponse = await page.request.get('/api/settings');
    const baselinePayload = await baselineResponse.json();
    const baselineKeyLength = baselinePayload.data.api_key_length;

    await page.goto('/settings');
    await providerPill(page).click();
    const textSource = page.getByTestId('text_model_source-select');
    await textSource.selectOption('apimart');
    const textModelBaseInput = textSource.locator('xpath=../..').locator('input[type="text"]').nth(1);
    await textModelBaseInput.fill('');

    const apiSection = page.getByTestId('global-api-config-section');
    const customApimartBaseUrl = 'https://apimart-integration-proxy.example/v1';
    await apiSection.locator('input').first().fill(customApimartBaseUrl);
    await apiSection.locator('input[type="password"]').fill('apimart-integration-test-key');
    await page.getByRole('button', { name: /保存设置|Save Settings/ }).click();
    await expect(page.locator('text=设置保存成功').or(page.locator('text=saved successfully')))
      .toBeVisible({ timeout: 5000 });

    const response = await page.request.get('/api/settings');
    const payload = await response.json();
    expect(payload.data.ai_provider_format).toBe('apimart');
    expect(payload.data.api_base_url).toBe(customApimartBaseUrl);
    expect(payload.data.text_api_base_url).toBe(customApimartBaseUrl);
    expect(payload.data.text_model).toBe('gpt-5');
    expect(payload.data.image_model).toBe('gpt-image-2');
    expect(payload.data.image_caption_model).toBe('gpt-4o');
    expect(payload.data.api_key_length).toBe('apimart-integration-test-key'.length);

    await page.reload();
    await expect(providerPill(page)).toHaveAttribute('aria-checked', 'true');
    await expect(apiSection.locator('input').first()).toHaveValue(customApimartBaseUrl);

    await expect(textModelBaseInput).toHaveValue(customApimartBaseUrl);
    await page.getByRole('button', { name: /保存设置|Save Settings/ }).click();
    await expect(page.locator('text=设置保存成功').or(page.locator('text=saved successfully')).last())
      .toBeVisible({ timeout: 5000 });

    const resavedResponse = await page.request.get('/api/settings');
    const resavedPayload = await resavedResponse.json();
    expect(resavedPayload.data.api_base_url).toBe(customApimartBaseUrl);
    expect(resavedPayload.data.text_api_base_url).toBe(customApimartBaseUrl);

    await page.getByTestId('global-provider-pills').locator('[data-provider="gemini"]').click();
    await page.getByRole('button', { name: /保存设置|Save Settings/ }).click();
    await expect(page.locator('text=设置保存成功').or(page.locator('text=saved successfully')).last())
      .toBeVisible({ timeout: 5000 });
    const switchedResponse = await page.request.get('/api/settings');
    const switchedPayload = await switchedResponse.json();
    expect(switchedPayload.data.ai_provider_format).toBe('gemini');
    expect(switchedPayload.data.api_key_length).toBe(baselineKeyLength);
    expect(switchedPayload.data.api_key_length).not.toBe('apimart-integration-test-key'.length);
    expect(switchedPayload.data.text_model_source).toBe('apimart');
    expect(switchedPayload.data.text_api_key_length).toBe('apimart-integration-test-key'.length);
  });
});
