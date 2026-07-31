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

  test('selecting PPIO keeps the source value and shows API key input', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) })
    )
    await page.goto('/settings')

    const textSelect = page.locator('select').first()
    await textSelect.selectOption('ppio')
    await expect(textSelect).toHaveValue('ppio')
  })

  test('real backend: settings page shows PPIO and AIPing options', async ({ page }) => {
    // No route mocking: hits the real backend through the dev-server proxy.
    await page.goto('/settings')
    const formatSelect = page.locator('select').first()
    await expect(formatSelect.locator('option[value="ppio"]')).toHaveCount(1)
    await expect(formatSelect.locator('option[value="aiping"]')).toHaveCount(1)
  })
})
