import { test, expect, type Page } from '@playwright/test';

const modelGroup = (page: Page, sourceTestId: string) =>
  page.getByTestId(sourceTestId).locator('xpath=ancestor::div[contains(@class,"pb-6")][1]');

const mockSettings = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  message: 'Success',
  data: {
    id: 1,
    ai_provider_format: 'gemini',
    api_base_url: 'https://api.inferera.com/gemini',
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
    ...overrides,
  },
});

test.describe('Settings: provider plan comparison', () => {
  test.use({ locale: 'zh-CN' });

  test('shows an analysis-style comparison with AIHubMix, Volcengine, and APIMart', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) })
    );
    await page.goto('/settings');

    const comparison = page.getByTestId('provider-plan-comparison');
    await expect(comparison).toBeVisible();
    await expect(comparison.getByText('不知道怎么选？三个推荐方案对比')).toBeVisible();

    const aihubmix = page.getByTestId('provider-plan-aihubmix');
    await expect(aihubmix.getByText('AIHubMix 聚合 API', { exact: true })).toBeVisible();
    await expect(aihubmix.getByText('海外 SOTA · 高并发稳定')).toBeVisible();
    await expect(aihubmix.getByText('可用海外 SOTA 模型：GPT、Claude、Gemini 等')).toBeVisible();
    await expect(aihubmix.getByText('高并发、稳定、可用性高')).toBeVisible();
    await expect(aihubmix.getByRole('button', { name: '当前方案' })).toBeDisabled();

    const volcengine = page.getByTestId('provider-plan-volcengine');
    await expect(volcengine.getByText('火山 Agent Plan', { exact: true })).toBeVisible();
    await expect(volcengine.getByText('国内直连 · 高性价比')).toBeVisible();
    await expect(volcengine.getByText('国内直连，无需特殊网络环境')).toBeVisible();
    await expect(volcengine.getByText('效果接近海外主流，价格更低')).toBeVisible();
    await expect(volcengine.getByText('订阅后可日常使用，不局限于 Banana Slides')).toBeVisible();
    await expect(volcengine.getByRole('button', { name: '选择此方案' })).toBeEnabled();

    const apimart = page.getByTestId('provider-plan-apimart');
    await expect(apimart.getByText('APIMart', { exact: true })).toBeVisible();
    await expect(apimart.getByText('低价图片 · 异步稳定')).toBeVisible();
    await expect(apimart.getByText('异步任务轮询，长时间生图不易超时')).toBeVisible();
    await expect(apimart.getByRole('button', { name: '使用此方案' })).toBeEnabled();
  });

  test('choosing APIMart applies its endpoint and recommended models', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) })
    );
    await page.goto('/settings');

    await page.getByTestId('provider-plan-apimart').getByRole('button', { name: '使用此方案' }).click();

    await expect(page.getByTestId('global-provider-pills').locator('[data-provider="apimart"]'))
      .toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('global-api-config-section').locator('input').first())
      .toHaveValue('https://api.apimart.ai/v1');
    await expect(page.getByTestId('global-api-config-section').locator('input[type="password"]'))
      .toHaveAttribute('placeholder', '输入新的 API Key');
    await expect(modelGroup(page, 'text_model_source-select').locator('input[type="text"]').first())
      .toHaveValue('gpt-5');
    await expect(modelGroup(page, 'image_model_source-select').locator('input[type="text"]').first())
      .toHaveValue('gpt-image-2');
    await expect(modelGroup(page, 'image_caption_model_source-select').locator('input[type="text"]').first())
      .toHaveValue('gpt-4o');
    await expect(page.getByTestId('text_model_source-select')).toHaveValue('');
    await expect(page.getByTestId('image_model_source-select')).toHaveValue('');
    await expect(page.getByTestId('image_caption_model_source-select')).toHaveValue('');
  });

  test('switching from APIMart to Volcengine clears APIMart per-model overrides first', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSettings({
          ai_provider_format: 'apimart',
          api_base_url: 'https://api.apimart.ai/v1',
          text_model_source: 'apimart',
          image_model_source: 'apimart',
          image_caption_model_source: 'apimart',
          text_api_base_url: 'https://api.apimart.ai/v1',
          image_api_base_url: 'https://api.apimart.ai/v1',
          image_caption_api_base_url: 'https://api.apimart.ai/v1',
        })),
      })
    );
    await page.goto('/settings');

    await page.getByTestId('global-provider-pills').locator('[data-provider="volcengine"]').click();

    await expect(page.getByTestId('global-api-config-section').locator('input').first())
      .toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');
    await expect(page.getByTestId('text_model_source-select')).toHaveValue('');
    await expect(page.getByTestId('image_model_source-select')).toHaveValue('');
    await expect(page.getByTestId('image_caption_model_source-select')).toHaveValue('');
  });

  test('choosing Volcengine from the comparison applies the Agent Plan config', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) })
    );
    await page.goto('/settings');

    await page.getByTestId('provider-plan-volcengine').getByRole('button', { name: '选择此方案' }).click();

    const volcenginePill = page.getByTestId('global-provider-pills').locator('[data-provider="volcengine"]');
    await expect(volcenginePill).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('global-api-config-section').locator('input').first())
      .toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');
    await expect(page.getByText('为什么选择火山 Agent Plan？')).toBeVisible();
  });

  test('choosing AIHubMix from the comparison restores the default AIHubMix endpoint', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSettings({
          ai_provider_format: 'volcengine',
          api_base_url: 'https://ark.cn-beijing.volces.com/api/plan/v3',
        })),
      })
    );
    await page.goto('/settings');

    await page.getByTestId('provider-plan-aihubmix').getByRole('button', { name: '使用此方案' }).click();

    const geminiPill = page.getByTestId('global-provider-pills').locator('[data-provider="gemini"]');
    await expect(geminiPill).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('global-api-config-section').locator('input').first())
      .toHaveValue('https://api.inferera.com/gemini');
    await expect(page.getByTestId('provider-plan-aihubmix').getByRole('button', { name: '当前方案' })).toBeVisible();
    await expect(page.getByText('为什么选择火山 Agent Plan？')).not.toBeVisible();
  });

  test('choosing AIHubMix from OpenAI keeps the OpenAI-compatible endpoint', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSettings({
          ai_provider_format: 'openai',
          api_base_url: 'https://api.openai.com/v1',
        })),
      })
    );
    await page.goto('/settings');

    await page.getByTestId('provider-plan-aihubmix').getByRole('button', { name: '使用此方案' }).click();

    await expect(page.getByTestId('global-provider-pills').locator('[data-provider="openai"]'))
      .toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('global-api-config-section').locator('input').first())
      .toHaveValue('https://api.inferera.com/v1');
  });
});
