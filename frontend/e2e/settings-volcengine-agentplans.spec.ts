import { test, expect, type Page } from '@playwright/test';

const mockSettings = {
  success: true,
  message: 'Success',
  data: {
    id: 1,
    ai_provider_format: 'gemini',
    api_base_url: '',
    api_key_length: 0,
    text_model: 'doubao-seed-2-0',
    image_model: 'doubao-seedream-4-0',
    image_caption_model: 'doubao-seed-2-0',
    image_resolution: '2K',
    image_aspect_ratio: '16:9',
    max_description_workers: 5,
    max_image_workers: 8,
    output_language: 'zh',
    description_generation_mode: 'streaming',
    description_extra_fields: ['配图与素材', '版式与重点', '演讲者备注'],
    image_prompt_extra_fields: ['配图与素材', '版式与重点'],
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

const modelInputs = (page: Page) =>
  page.locator('input[placeholder^="留空使用环境变量配置"]');

test.describe('Settings: Volcengine AgentPlans provider', () => {
  test.use({ locale: 'zh-CN' });

  let savedSettingsPayload: Record<string, unknown> | null;

  test.beforeEach(async ({ page }) => {
    savedSettingsPayload = null;

    await page.route('**/api/settings', async route => {
      if (route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON() as Record<string, unknown>;
        savedSettingsPayload = payload;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockSettings,
            data: { ...mockSettings.data, ...payload },
          }),
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) });
    });
  });

  test('shows promoted Volcengine and Doubao providers with asterisks at the top', async ({ page }) => {
    await page.goto('/settings');

    const providerSelect = page.getByTestId('global-api-config-section').locator('select').first();
    await expect(providerSelect).toBeVisible();
    const optionTexts = await providerSelect.locator('option').allTextContents();

    expect(optionTexts[0]).toBe('Gemini');
    expect(optionTexts[1]).toBe('OpenAI');
    expect(optionTexts[2]).toBe('* 火山 AgentPlans');
    expect(optionTexts[3]).toBe('* Doubao (豆包)');
  });

  test('replaces AIHubMix promo with Volcengine AgentPlans promo when selected', async ({ page }) => {
    await page.goto('/settings');

    const providerSelect = page.getByTestId('global-api-config-section').locator('select').first();
    await providerSelect.selectOption('volcengine');

    const globalApiSection = page.getByTestId('global-api-config-section');
    await expect(globalApiSection.getByText('API Base URL')).not.toBeVisible();
    await expect(globalApiSection.locator('input[type="password"]').first()).toBeVisible();

    await providerSelect.selectOption('openai');
    await expect(globalApiSection.getByText('API Base URL')).toBeVisible();
    await expect(globalApiSection.locator('input').first()).toHaveValue('');

    await providerSelect.selectOption('volcengine');
    await expect(globalApiSection.getByText('API Base URL')).not.toBeVisible();
    await page.locator('select').nth(1).selectOption('volcengine');
    await expect(page.getByText('API Base URL')).not.toBeVisible();

    await expect(page.getByText('火山 AgentPlans API Key 配置')).toBeVisible();
    await expect(page.getByText(/Agent Plan \/ Coding Plan 限时折扣/)).toBeVisible();
    await expect(page.getByText(/免费 Tokens 领取等活动/)).toBeVisible();
    await expect(page.getByText('订阅并获取火山 AgentPlans API Key')).toBeVisible();
    await expect(page.getByText('进入 Agent Plan 控制台')).toBeVisible();
    await expect(page.getByText('在 Agent Plan 控制台创建专属 API Key', { exact: true })).toBeVisible();
    await expect(page.getByText('点击顶栏「充值」')).not.toBeVisible();
    await expect(page.getByText(/感谢火山引擎赞助/)).not.toBeVisible();
    await expect(page.getByText('AIHubmix 申请 API key')).not.toBeVisible();
    await expect(page.locator('img[alt="火山引擎"]')).toBeVisible();

    const volcengineLink = page.getByRole('link', { name: '点击链接抢购' }).first();
    await expect(volcengineLink).toHaveAttribute('href', 'https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides');

    await page.getByRole('button', { name: '一键填写推荐模型' }).click();
    const inputs = modelInputs(page);
    await expect(inputs.nth(0)).toHaveValue('doubao-seed-2-1-pro-260628');
    await expect(inputs.nth(1)).toHaveValue('doubao-seedream-5-0-260128');
    await expect(inputs.nth(2)).toHaveValue('doubao-seed-2-1-pro-260628');
    await expect(page.locator('select').nth(1)).toHaveValue('volcengine');
    await expect(page.locator('select').nth(2)).toHaveValue('volcengine');
    await expect(page.locator('select').nth(3)).toHaveValue('images');
    await expect(page.locator('select').nth(4)).toHaveValue('volcengine');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedSettingsPayload?.ai_provider_format).toBe('volcengine');
    expect(savedSettingsPayload?.text_model).toBe('doubao-seed-2-1-pro-260628');
    expect(savedSettingsPayload?.image_model).toBe('doubao-seedream-5-0-260128');
    expect(savedSettingsPayload?.image_caption_model).toBe('doubao-seed-2-1-pro-260628');
    expect(savedSettingsPayload?.text_model_source).toBe('volcengine');
    expect(savedSettingsPayload?.image_model_source).toBe('volcengine');
    expect(savedSettingsPayload?.image_caption_model_source).toBe('volcengine');
    expect(savedSettingsPayload?.openai_image_api_protocol).toBe('images');
    expect(savedSettingsPayload?.api_base_url).toBe('');
    expect(savedSettingsPayload?.text_api_base_url).toBe('');
    expect(savedSettingsPayload?.image_api_base_url).toBe('');
    expect(savedSettingsPayload?.image_caption_api_base_url).toBe('');
  });

  test('shows the Volcengine campaign prompt for Doubao without changing provider semantics', async ({ page }) => {
    await page.goto('/settings');

    const providerSelect = page.getByTestId('global-api-config-section').locator('select').first();
    await providerSelect.selectOption('doubao');

    const globalApiSection = page.getByTestId('global-api-config-section');
    await expect(globalApiSection.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByText('豆包 / 火山方舟 API Key 配置')).toBeVisible();
    await expect(page.getByText(/豆包图像创作模型 5.0/)).toBeVisible();
    await expect(page.getByText('免费 Tokens 额度领取流程')).not.toBeVisible();
    await expect(page.getByText('领取额度并获取普通方舟 API Key')).toBeVisible();
    await expect(page.getByText(/需要免费 Tokens 时，点击活动页的「立即领取」/)).toBeVisible();
    await expect(page.getByText(/完成「开通服务」和「一键授权」/)).toBeVisible();
    await expect(page.getByText(/API Key 管理页面创建普通方舟 API Key/)).toBeVisible();
    await expect(page.getByText('回到本页填写普通方舟 API Key；Agent/Coding Plan 专属 Key 不适用')).toBeVisible();
    await expect(page.getByText('点击顶栏「充值」')).not.toBeVisible();
    await expect(page.getByText('火山 AgentPlans API Key 配置')).not.toBeVisible();
    await expect(page.getByText('AIHubmix 申请 API key')).not.toBeVisible();

    const volcengineLink = page.getByRole('link', { name: '点击链接抢购' }).first();
    await expect(volcengineLink).toHaveAttribute('href', 'https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides');

    await page.getByRole('button', { name: '一键填写推荐模型' }).click();
    const inputs = modelInputs(page);
    await expect(inputs.nth(0)).toHaveValue('doubao-seed-2-1-pro-260628');
    await expect(inputs.nth(1)).toHaveValue('doubao-seedream-5-0-260128');
    await expect(inputs.nth(2)).toHaveValue('doubao-seed-2-1-pro-260628');
    await expect(page.locator('select').nth(1)).toHaveValue('doubao');
    await expect(page.locator('select').nth(2)).toHaveValue('doubao');
    await expect(page.locator('select').nth(3)).toHaveValue('doubao');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedSettingsPayload?.text_model).toBe('doubao-seed-2-1-pro-260628');
    expect(savedSettingsPayload?.image_model).toBe('doubao-seedream-5-0-260128');
    expect(savedSettingsPayload?.image_caption_model).toBe('doubao-seed-2-1-pro-260628');
    expect(savedSettingsPayload?.text_model_source).toBe('doubao');
    expect(savedSettingsPayload?.image_model_source).toBe('doubao');
    expect(savedSettingsPayload?.image_caption_model_source).toBe('doubao');
    expect(savedSettingsPayload?.openai_image_api_protocol).toBe('images');
  });

  test('normalizes mixed-case provider values from settings', async ({ page }) => {
    await page.unroute('**/api/settings');
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'Volcengine',
            text_model_source: 'Volcengine',
            text_api_base_url: 'https://ark.cn-beijing.volces.com/api/v3',
          },
        }),
      })
    );

    await page.goto('/settings');

    const globalApiSection = page.getByTestId('global-api-config-section');
    await expect(globalApiSection.locator('select').first()).toHaveValue('volcengine');
    await expect(page.locator('select').nth(1)).toHaveValue('volcengine');
    await expect(globalApiSection.getByText('API Base URL')).not.toBeVisible();
  });
});
