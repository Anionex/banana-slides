import { test, expect } from '@playwright/test';

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

test.describe('Settings: promoted provider pills', () => {
  test.use({ locale: 'zh-CN' });

  test.beforeEach(async ({ page }) => {
    await page.route(url => url.pathname === '/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) })
    );
    await page.goto('/settings');
  });

  test('shows compact promotion cues and reveals details only on hover', async ({ page }) => {
    await expect(page.getByTestId('provider-plan-comparison')).toHaveCount(0);

    const pills = page.getByTestId('global-provider-pills').locator('[data-provider]');
    await expect.poll(async () => pills.evaluateAll(elements =>
      elements.slice(0, 4).map(element => element.getAttribute('data-provider'))
    )).toEqual(['gemini', 'apimart', 'volcengine', 'openai']);

    const gemini = page.locator('[data-provider="gemini"]');
    const apimart = page.locator('[data-provider="apimart"]');
    const volcengine = page.locator('[data-provider="volcengine"]');
    const doubao = page.locator('[data-provider="doubao"]');

    await expect(gemini).not.toHaveAttribute('aria-describedby', /.+/);
    await expect(apimart).toContainText('仅需 $0.006/张');
    await expect(volcengine).toContainText('国内直连');
    await expect(volcengine).not.toContainText('高性价比');
    await expect(doubao).not.toContainText('国内直连');
    await expect(page.locator('[data-provider="ppio"]')).toHaveCount(0);
    await expect(page.locator('[data-provider="aiping"]')).toHaveCount(0);

    const apimartPromo = page.getByTestId('provider-plan-apimart');
    const volcenginePromo = page.getByTestId('provider-plan-volcengine');
    await expect(apimartPromo).not.toBeVisible();
    await expect(volcenginePromo).not.toBeVisible();

    await apimart.hover();
    await expect(apimartPromo).toBeVisible();
    await expect(apimartPromo.getByText('GPT-Image-2 低至 $0.006/张')).toBeVisible();
    await expect(apimartPromo.getByText('1 美元可生成 160+ 张图片')).toBeVisible();
    await expect(apimartPromo.getByRole('link', { name: '注册并获取 API Key →' }))
      .toHaveAttribute('href', 'https://go.apimart.ai/gh-banana-slides');

    await volcengine.hover();
    await expect(apimartPromo).not.toBeVisible();
    await expect(volcenginePromo).toBeVisible();
    await expect(volcenginePromo.getByText('火山 Agent Plan', { exact: true })).toBeVisible();
    await expect(volcenginePromo.getByText('国内直连，无需特殊网络环境')).toBeVisible();
  });

  test('applies APIMart from its hover panel', async ({ page }) => {
    const apimart = page.locator('[data-provider="apimart"]');
    await apimart.hover();
    await page.getByTestId('provider-plan-apimart').getByRole('button', { name: '使用 APIMart' }).click();

    await expect(apimart).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('global-api-config-section').locator('input').first())
      .toHaveValue('https://api.apimart.ai/v1');
  });

  test('applies Volcengine Agent Plan from its hover panel', async ({ page }) => {
    const volcengine = page.locator('[data-provider="volcengine"]');
    await volcengine.hover();
    await page.getByTestId('provider-plan-volcengine').getByRole('button', { name: '选择此方案' }).click();

    await expect(volcengine).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('global-api-config-section').locator('input').first())
      .toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');
    await expect(page.getByText('为什么选择火山 Agent Plan？')).toBeVisible();
  });
});
