/**
 * E2E tests for the LazyLLM vendor list in the Settings page.
 * Verifies every supported domestic vendor (including the newly added
 * PPIO and AIPing) is selectable for text/image/caption model sources.
 */
import { test, expect } from '@playwright/test'

const LAZYLLM_SOURCE_LABELS = [
  'Qwen (通义千问)',
  'DeepSeek',
  'GLM (智谱)',
  'SiliconFlow',
  'SenseNova (商汤)',
  'MiniMax',
  'Kimi',
  'PPIO (派欧云)',
  'AIPing (爱拼)',
]

const ALL_SOURCE_LABELS = [
  'Gemini',
  'OpenAI',
  '* 火山 AgentPlans',
  '* Doubao (豆包)',
  'Codex (OpenAI OAuth)',
  ...LAZYLLM_SOURCE_LABELS,
]

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
    enable_text_reasoning: false,
    text_thinking_budget: 1024,
    enable_image_reasoning: false,
    image_thinking_budget: 1024,
    mineru_api_base: '',
    mineru_token_length: 0,
    baidu_api_key_length: 0,
    text_model_source: 'qwen',
    text_api_key_length: 0,
    text_api_base_url: null,
    image_model_source: 'doubao',
    image_api_key_length: 0,
    image_api_base_url: null,
    image_caption_model_source: 'qwen',
    image_caption_api_key_length: 0,
    image_caption_api_base_url: null,
    lazyllm_api_keys_info: {},
  },
}

test.describe('Settings: LazyLLM vendor sources', () => {
  test('lists all domestic vendors including PPIO and AIPing', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) })
    )
    await page.goto('/settings')

    // The provider-format select renders all LazyLLM vendors (PPIO/AIPing added).
    const textSelect = page.locator('select').first()
    await expect(textSelect.locator('option[value="ppio"]')).toHaveCount(1)
    await expect(textSelect.locator('option[value="aiping"]')).toHaveCount(1)
    const optionTexts = await textSelect.locator('option').allTextContents()
    for (const label of ALL_SOURCE_LABELS) {
      expect(optionTexts.join('\n')).toContain(label)
    }
    await expect(textSelect).toHaveValue('gemini')
  })

  test('image-model source omits vendors without image capability', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) })
    )
    await page.goto('/settings')

    // Third select is the image-model source (text/caption keep every vendor).
    const imageSelect = page.locator('select').nth(2)
    await expect(imageSelect.locator('option[value="qwen"]')).toHaveCount(1)
    const imageOptions = await imageSelect.locator('option').allTextContents()
    const imageText = imageOptions.join('\n')
    expect(imageText).toContain('Qwen (通义千问)')
    expect(imageText).toContain('* Doubao (豆包)')
    expect(imageText).toContain('AIPing (爱拼)')
    // Real OpenAI provider stays selectable for image generation.
    expect(imageText).toContain('OpenAI')
    for (const label of ['PPIO (派欧云)', 'DeepSeek', 'Kimi', 'SenseNova (商汤)']) {
      expect(imageText).not.toContain(label)
    }

    const captionSelect = page.locator('select').nth(3)
    await expect(captionSelect.locator('option[value="ppio"]')).toHaveCount(1)
    const captionText = (await captionSelect.locator('option').allTextContents()).join('\n')
    expect(captionText).toContain('PPIO (派欧云)')
  })

  test('stale image source without image capability stays visible with a hint', async ({ page }) => {
    const staleSettings = {
      ...mockSettings,
      data: { ...mockSettings.data, image_model_source: 'deepseek' },
    }
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(staleSettings) })
    )
    await page.goto('/settings')

    // deepseek has no image-generation supplier, but the saved value must not
    // silently disappear: keep it selectable with an unavailable hint.
    const imageSelect = page.locator('select').nth(2)
    await expect(imageSelect).toHaveValue('deepseek')
    const imageText = (await imageSelect.locator('option').allTextContents()).join('\n')
    expect(imageText).toContain('deepseek')
    expect(imageText).toContain('不支持图片生成')
    // Capable options remain listed next to the stale value.
    expect(imageText).toContain('Qwen (通义千问)')
    expect(imageText).toContain('OpenAI')
  })

  test('selecting PPIO keeps the source value and shows API key input', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) })
    )
    await page.goto('/settings')

    const textSelect = page.locator('select').nth(1)
    await textSelect.selectOption('ppio')
    await expect(textSelect).toHaveValue('ppio')
    await expect(page.getByPlaceholder('输入 PPIO (派欧云) API Key')).toBeVisible()
  })

  test('real backend: save and reload keeps a lazyllm vendor selection', async ({ page }) => {
    // No route mocking: hits the real backend through the dev-server proxy.
    await page.goto('/settings')
    const formatSelect = page.locator('select').first()
    await expect(formatSelect.locator('option[value="ppio"]')).toHaveCount(1)

    const textSelect = page.locator('select').nth(1)
    const previousValue = await textSelect.inputValue()
    await textSelect.selectOption('ppio')
    await expect(textSelect).toHaveValue('ppio')
    await page.getByRole('button', { name: '保存设置' }).click()
    await expect(page.getByText('设置保存成功')).toBeVisible()

    await page.reload()
    await expect(page.locator('select').nth(1)).toHaveValue('ppio')

    // Restore the previous value so the shared dev database stays unchanged.
    await page.locator('select').nth(1).selectOption(previousValue || 'deepseek')
    await page.getByRole('button', { name: '保存设置' }).click()
    await expect(page.getByText('设置保存成功')).toBeVisible()
  })
})
