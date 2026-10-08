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

const globalProviderPill = (page: Page, provider: string) =>
  page.getByTestId('global-provider-pills').locator(`[data-provider="${provider}"]`);

const modelProviderSelect = (page: Page, source: 'text' | 'image' | 'image_caption') =>
  page.getByTestId(`${source}_model_source-select`);

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

  test('shows exposed providers and the Volcengine benefits before the user selects it', async ({ page }) => {
    await page.goto('/settings');

    const pills = page.getByTestId('global-provider-pills').locator('[data-provider]');
    await expect(pills).toHaveCount(13);
    await expect(globalProviderPill(page, 'gemini')).toHaveAttribute('aria-checked', 'true');
    await expect(globalProviderPill(page, 'openai')).toBeVisible();
    await expect(globalProviderPill(page, 'ppio')).toHaveCount(0);
    await expect(globalProviderPill(page, 'aiping')).toHaveCount(0);
    await expect(globalProviderPill(page, 'volcengine')).toContainText('火山 Agent Plan');
    await expect(globalProviderPill(page, 'volcengine')).toContainText('国内直连');
    await expect(globalProviderPill(page, 'volcengine')).not.toContainText('高性价比');
    await expect(globalProviderPill(page, 'doubao')).toContainText('Doubao（豆包）');
    await expect(globalProviderPill(page, 'doubao')).not.toContainText('国内直连');

    await globalProviderPill(page, 'volcengine').click();
    await expect(globalProviderPill(page, 'volcengine')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('为什么选择火山 Agent Plan？')).toBeVisible();
    await expect(page.getByText(/相比海外主流官方 API，价格更低、性价比更高，生成效果接近/)).toBeVisible();
  });

  test('replaces AIHubMix promo with Volcengine AgentPlans promo when selected', async ({ page }) => {
    await page.goto('/settings');

    await globalProviderPill(page, 'volcengine').click();

    const globalApiSection = page.getByTestId('global-api-config-section');
    // Agent Plans 端点可编辑, 且未填过时自动预填专属 Base URL
    await expect(globalApiSection.getByText('API Base URL')).toBeVisible();
    await expect(globalApiSection.locator('input').first()).toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');
    await expect(globalApiSection.locator('input[type="password"]').first()).toBeVisible();

    await globalProviderPill(page, 'openai').click();
    await expect(globalApiSection.getByText('API Base URL')).toBeVisible();
    // 离开 Agent Plans 时过时的 plan/v3 端点必须清空, 否则会作为 openai 的 base 保存
    await expect(globalApiSection.locator('input').first()).toHaveValue('');

    await globalProviderPill(page, 'volcengine').click();
    await expect(globalApiSection.getByText('API Base URL')).toBeVisible();
    await expect(globalApiSection.locator('input').first()).toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');
    await modelProviderSelect(page, 'text').selectOption('volcengine');
    // per-model 的 Base URL 输入框同样可编辑（仅当前组 source=volcengine 时显示）,
    // 空默认值同样被替换为 Agent Plans 专属端点
    await expect(page.getByPlaceholder('留空使用默认 Base URL')).toHaveCount(1);
    await expect(page.getByPlaceholder('留空使用默认 Base URL'))
      .toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');

    const promo = page.getByTestId('volcengine-campaign-promo');
    await expect(promo.getByText('为什么选择火山 Agent Plan？')).toBeVisible();
    await expect(promo.getByText(/相比海外主流官方 API，价格更低、性价比更高，生成效果接近/)).toBeVisible();
    await expect(promo.getByText(/国内直连，无需特殊网络环境/)).toBeVisible();
    await expect(promo.getByText(/不局限于 Banana Slides/)).toBeVisible();
    await expect(promo.getByText(/Agent Plan \/ Coding Plan 限时折扣/)).toBeVisible();
    await expect(promo.getByText(/免费 Tokens/)).toBeVisible();
    await expect(promo.getByText('订阅并获取火山 AgentPlans API Key')).toBeVisible();
    await expect(promo.getByText('进入 Agent Plan 控制台')).toBeVisible();
    await expect(promo.getByText(/在 Agent Plan 控制台创建专属 API Key/)).toBeVisible();
    await expect(promo.getByRole('link', { name: 'API Key 控制台' })).toHaveAttribute(
      'href',
      'https://ai.volcengine.com/console/apikey'
    );
    await expect(page.getByText('点击顶栏「充值」')).not.toBeVisible();
    await expect(page.getByText(/感谢火山引擎赞助/)).not.toBeVisible();
    await expect(page.getByText('AIHubmix 申请 API key')).not.toBeVisible();
    await expect(page.locator('img[alt="火山引擎"]')).toBeVisible();

    const volcengineLink = page.getByRole('link', { name: '查看优惠并订阅' }).first();
    await expect(volcengineLink).toHaveAttribute('href', 'https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides');

    await page.getByRole('button', { name: '一键填写推荐模型' }).click();
    const inputs = modelInputs(page);
    await expect(inputs.nth(0)).toHaveValue('doubao-seed-2.1-turbo');
    await expect(inputs.nth(1)).toHaveValue('doubao-seedream-5.0-lite');
    await expect(inputs.nth(2)).toHaveValue('doubao-seed-2.1-turbo');
    await expect(modelProviderSelect(page, 'text')).toHaveValue('volcengine');
    await expect(modelProviderSelect(page, 'image')).toHaveValue('volcengine');
    await expect(page.getByTestId('openai-image-api-protocol-select')).toHaveValue('images');
    await expect(modelProviderSelect(page, 'image_caption')).toHaveValue('volcengine');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedSettingsPayload?.ai_provider_format).toBe('volcengine');
    expect(savedSettingsPayload?.text_model).toBe('doubao-seed-2.1-turbo');
    expect(savedSettingsPayload?.image_model).toBe('doubao-seedream-5.0-lite');
    expect(savedSettingsPayload?.image_caption_model).toBe('doubao-seed-2.1-turbo');
    expect(savedSettingsPayload?.text_model_source).toBe('volcengine');
    expect(savedSettingsPayload?.image_model_source).toBe('volcengine');
    expect(savedSettingsPayload?.image_caption_model_source).toBe('volcengine');
    expect(savedSettingsPayload?.openai_image_api_protocol).toBe('images');
    expect(savedSettingsPayload?.api_base_url).toBe('https://ark.cn-beijing.volces.com/api/plan/v3');
    // per-model base 必须显式指向 Agent Plans 端点: 空值会让保存前的服务测试
    // 以及同名环境变量继续命中过时的 {MODEL}_API_BASE
    expect(savedSettingsPayload?.text_api_base_url).toBe('https://ark.cn-beijing.volces.com/api/plan/v3');
    expect(savedSettingsPayload?.image_api_base_url).toBe('https://ark.cn-beijing.volces.com/api/plan/v3');
    expect(savedSettingsPayload?.image_caption_api_base_url).toBe('https://ark.cn-beijing.volces.com/api/plan/v3');
  });

  test('one-click setup replaces stale per-model base URLs with the Agent Plans endpoint', async ({ page }) => {
    await page.unroute('**/api/settings');
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

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'openai',
            api_base_url: 'https://api.openai.com/v1',
            text_model_source: 'openai',
            text_api_base_url: 'https://api.openai.com/v1',
            image_model_source: 'gemini',
            image_api_base_url: 'https://generativelanguage.googleapis.com',
            image_caption_model_source: 'openai',
            image_caption_api_base_url: 'https://api.openai.com/v1',
          },
        }),
      });
    });

    await page.goto('/settings');

    await globalProviderPill(page, 'volcengine').click();
    await page.getByRole('button', { name: '一键填写推荐模型' }).click();

    // 一键配置直接绕过了 handleFieldChange 的替换逻辑: 三个 per-model base
    // 必须从旧 provider 端点替换为 Agent Plans 端点, 而不是清空
    const baseInputs = page.getByPlaceholder('留空使用默认 Base URL');
    await expect(baseInputs).toHaveCount(3);
    await expect(baseInputs.nth(0)).toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');
    await expect(baseInputs.nth(1)).toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');
    await expect(baseInputs.nth(2)).toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedSettingsPayload?.text_api_base_url).toBe('https://ark.cn-beijing.volces.com/api/plan/v3');
    expect(savedSettingsPayload?.image_api_base_url).toBe('https://ark.cn-beijing.volces.com/api/plan/v3');
    expect(savedSettingsPayload?.image_caption_api_base_url).toBe('https://ark.cn-beijing.volces.com/api/plan/v3');
  });

  test('one-click setup preserves custom base URLs', async ({ page }) => {
    await page.unroute('**/api/settings');
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

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'volcengine',
            api_base_url: 'https://custom-proxy.example.com/v1',
            text_model_source: 'volcengine',
            text_api_base_url: 'https://custom-proxy.example.com/v1',
            image_model_source: 'volcengine',
            image_api_base_url: 'https://custom-proxy.example.com/v1',
            image_caption_model_source: 'volcengine',
            image_caption_api_base_url: 'https://custom-proxy.example.com/v1',
          },
        }),
      });
    });

    await page.goto('/settings');
    await page.getByRole('button', { name: '一键填写推荐模型' }).click();

    // 用户自定义端点不能被一键配置覆盖
    const baseInputs = page.getByPlaceholder('留空使用默认 Base URL');
    await expect(baseInputs).toHaveCount(3);
    await expect(baseInputs.nth(0)).toHaveValue('https://custom-proxy.example.com/v1');
    await expect(baseInputs.nth(1)).toHaveValue('https://custom-proxy.example.com/v1');
    await expect(baseInputs.nth(2)).toHaveValue('https://custom-proxy.example.com/v1');
    await expect(page.getByTestId('global-api-config-section').locator('input').first())
      .toHaveValue('https://custom-proxy.example.com/v1');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedSettingsPayload?.api_base_url).toBe('https://custom-proxy.example.com/v1');
    expect(savedSettingsPayload?.text_api_base_url).toBe('https://custom-proxy.example.com/v1');
    expect(savedSettingsPayload?.image_api_base_url).toBe('https://custom-proxy.example.com/v1');
    expect(savedSettingsPayload?.image_caption_api_base_url).toBe('https://custom-proxy.example.com/v1');
  });

  test('one-click setup inherits custom global base for empty per-model fields', async ({ page }) => {
    await page.unroute('**/api/settings');
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

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'volcengine',
            api_base_url: 'https://custom-proxy.example.com/v1',
            text_model_source: 'volcengine',
            image_model_source: 'volcengine',
            image_caption_model_source: 'volcengine',
          },
        }),
      });
    });

    await page.goto('/settings');
    await page.getByRole('button', { name: '一键填写推荐模型' }).click();

    // 空的 per-model base 必须继承全局自定义端点, 而不是被硬编码的 cn-beijing 端点替换
    const baseInputs = page.getByPlaceholder('留空使用默认 Base URL');
    await expect(baseInputs).toHaveCount(3);
    await expect(baseInputs.nth(0)).toHaveValue('https://custom-proxy.example.com/v1');
    await expect(baseInputs.nth(1)).toHaveValue('https://custom-proxy.example.com/v1');
    await expect(baseInputs.nth(2)).toHaveValue('https://custom-proxy.example.com/v1');

    await page.getByRole('button', { name: /保存设置/ }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    expect(savedSettingsPayload?.text_api_base_url).toBe('https://custom-proxy.example.com/v1');
    expect(savedSettingsPayload?.image_api_base_url).toBe('https://custom-proxy.example.com/v1');
    expect(savedSettingsPayload?.image_caption_api_base_url).toBe('https://custom-proxy.example.com/v1');
  });

  test('shows the Volcengine campaign prompt for Doubao without changing provider semantics', async ({ page }) => {
    await page.goto('/settings');

    await globalProviderPill(page, 'doubao').click();

    const globalApiSection = page.getByTestId('global-api-config-section');
    await expect(globalApiSection.locator('input[type="password"]').first()).toBeVisible();
    const promo = page.getByTestId('volcengine-campaign-promo');
    await expect(promo.getByText('为什么选择豆包 / 火山方舟？')).toBeVisible();
    await expect(promo.getByText(/国内直连，无需特殊网络环境/)).toBeVisible();
    await expect(promo.getByText(/日常开发和其他兼容工具/)).toBeVisible();
    await expect(promo.getByText(/豆包图像创作模型 5.0/)).toBeVisible();
    await expect(promo.getByText('免费 Tokens 额度领取流程')).not.toBeVisible();
    await expect(promo.getByText('领取额度并获取普通方舟 API Key')).toBeVisible();
    await expect(promo.getByText(/需要免费 Tokens 时，点击活动页的「立即领取」/)).toBeVisible();
    await expect(promo.getByText(/完成「开通服务」和「一键授权」/)).toBeVisible();
    await expect(promo.getByText(/API Key 管理页面创建普通方舟 API Key/)).toBeVisible();
    await expect(promo.getByText('回到本页填写普通方舟 API Key；Agent/Coding Plan 专属 Key 不适用')).toBeVisible();
    await expect(promo.getByText('点击顶栏「充值」')).not.toBeVisible();
    await expect(page.getByText('为什么选择火山 Agent Plan？')).not.toBeVisible();
    await expect(page.getByText('AIHubmix 申请 API key')).not.toBeVisible();

    const volcengineLink = page.getByRole('link', { name: '查看官方活动' }).first();
    await expect(volcengineLink).toHaveAttribute('href', 'https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides');

    await page.getByRole('button', { name: '一键填写推荐模型' }).click();
    const inputs = modelInputs(page);
    await expect(inputs.nth(0)).toHaveValue('doubao-seed-2-1-pro-260628');
    await expect(inputs.nth(1)).toHaveValue('doubao-seedream-5-0-260128');
    await expect(inputs.nth(2)).toHaveValue('doubao-seed-2-1-pro-260628');
    await expect(modelProviderSelect(page, 'text')).toHaveValue('doubao');
    await expect(modelProviderSelect(page, 'image')).toHaveValue('doubao');
    await expect(modelProviderSelect(page, 'image_caption')).toHaveValue('doubao');

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
    await expect(globalProviderPill(page, 'volcengine')).toHaveAttribute('aria-checked', 'true');
    await expect(modelProviderSelect(page, 'text')).toHaveValue('volcengine');
    // Volcengine 不再隐藏 Base URL 输入框 (Agent Plans 端点可编辑)
    await expect(globalApiSection.getByText('API Base URL')).toBeVisible();
    // 后端返回的 per-model base 同步显示到对应输入框
    await expect(page.getByPlaceholder('留空使用默认 Base URL').first()).toHaveValue('https://ark.cn-beijing.volces.com/api/v3');
  });

  test('replaces another provider default base URL when switching to Agent Plans', async ({ page }) => {
    await page.unroute('**/api/settings');
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'openai',
            api_base_url: 'https://api.inferera.com/v1',
          },
        }),
      })
    );

    await page.goto('/settings');

    await globalProviderPill(page, 'volcengine').click();

    // OpenAI 默认端点不应被带入 Agent Plans 保存/测试 payload
    await expect(page.getByTestId('global-api-config-section').locator('input').first())
      .toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');
  });

  test('replaces documented OpenAI base URL when switching to Agent Plans', async ({ page }) => {
    await page.unroute('**/api/settings');
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'openai',
            api_base_url: 'https://api.openai.com/v1',
          },
        }),
      })
    );

    await page.goto('/settings');

    await globalProviderPill(page, 'volcengine').click();

    // README 文档化的 OPENAI_API_BASE 默认值同样被识别为过时默认端点
    await expect(page.getByTestId('global-api-config-section').locator('input').first())
      .toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');
  });

  test('replaces stale per-model base URL when a model source switches to Agent Plans', async ({ page }) => {
    await page.unroute('**/api/settings');
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'openai',
            api_base_url: 'https://api.inferera.com/v1',
            text_model_source: 'openai',
            text_api_base_url: 'https://api.openai.com/v1',
          },
        }),
      })
    );

    await page.goto('/settings');

    const baseInput = page.getByPlaceholder('留空使用默认 Base URL').first();
    await expect(baseInput).toHaveValue('https://api.openai.com/v1');

    // 文本模型 source 从 openai 切到 volcengine: 过时的默认 base 必须被替换,
    // 否则 TEXT_API_BASE 会优先于 VOLCENGINE_API_BASE 命中错误端点
    await modelProviderSelect(page, 'text').selectOption('volcengine');
    await expect(baseInput).toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');

    // 自定义 per-model base 不应被破坏
    await baseInput.fill('https://custom.example.com/v1');
    await modelProviderSelect(page, 'text').selectOption('openai');
    await modelProviderSelect(page, 'text').selectOption('volcengine');
    await expect(baseInput).toHaveValue('https://custom.example.com/v1');
  });

  test('clears Agent Plans base when switching the global provider away', async ({ page }) => {
    await page.unroute('**/api/settings');
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'volcengine',
            api_base_url: 'https://ark.cn-beijing.volces.com/api/plan/v3',
          },
        }),
      })
    );

    await page.goto('/settings');

    const globalBase = page.getByTestId('global-api-config-section').locator('input').first();
    await expect(globalBase).toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');

    // 离开 Agent Plans: 过时的 plan/v3 端点必须清空, 不能作为 openai 的 base 保存
    await globalProviderPill(page, 'openai').click();
    await expect(globalBase).toHaveValue('');
  });

  test('clears Agent Plans per-model base when the model source switches away', async ({ page }) => {
    await page.unroute('**/api/settings');
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'volcengine',
            api_base_url: 'https://ark.cn-beijing.volces.com/api/plan/v3',
            text_model_source: 'volcengine',
            text_api_base_url: 'https://ark.cn-beijing.volces.com/api/plan/v3',
          },
        }),
      })
    );

    await page.goto('/settings');

    const baseInput = page.getByPlaceholder('留空使用默认 Base URL').first();
    await expect(baseInput).toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');

    // 单模型离开 Agent Plans: plan/v3 必须清空, 否则 TEXT_API_BASE 优先于新 provider 默认端点
    await modelProviderSelect(page, 'text').selectOption('openai');
    await expect(baseInput).toHaveValue('');
  });

  test('warns about a non-official global base and offers one-click restore', async ({ page }) => {
    await page.unroute('**/api/settings');
    await page.route('**/api/settings', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockSettings,
          data: {
            ...mockSettings.data,
            ai_provider_format: 'volcengine',
            api_base_url: 'https://aihubmix.com/v1',
          },
        }),
      })
    );

    await page.goto('/settings');

    const globalBaseInput = page.getByTestId('global-api-config-section').locator('input').first();
    await expect(globalBaseInput).toHaveValue('https://aihubmix.com/v1');

    // 自定义端点保留, 但必须提示非官方端点并提供一键恢复
    const hint = page.getByText(/不是火山 AgentPlans 官方端点/);
    await expect(hint).toBeVisible();
    await page.getByRole('button', { name: '使用官方端点' }).click();
    await expect(globalBaseInput).toHaveValue('https://ark.cn-beijing.volces.com/api/plan/v3');
    await expect(hint).not.toBeVisible();

    // 官方端点时提示消失; 手动改回自定义端点后提示再次出现
    await globalBaseInput.fill('https://another-proxy.example.com/v1');
    await expect(hint).toBeVisible();
  });
});
