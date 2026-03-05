/**
 * E2E test for per-model provider configuration in Settings page.
 * Tests: load with saved config, provider switching, save, reload persistence, reset.
 */
import { test, expect, Page } from '@playwright/test'

// Mock settings data with per-model provider config
const mockSettingsWithPerModel = {
  success: true,
  message: 'Success',
  data: {
    id: 1,
    ai_provider_format: 'gemini',
    api_base_url: 'https://aihubmix.com/gemini',
    api_key_length: 51,
    text_model: 'glm-4.5',
    image_model: 'imagen-3.0-generate-001',
    image_caption_model: 'gemini-3-flash-preview',
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
    // Per-model provider config
    text_model_source: 'openai',
    text_api_key_length: 26,
    text_api_base_url: 'https://test-openai.example.com/v1',
    image_model_source: 'gemini',
    image_api_key_length: 30,
    image_api_base_url: 'https://test-gemini.example.com',
    image_caption_model_source: 'doubao',
    image_caption_api_key_length: 0,
    image_caption_api_base_url: null,
    lazyllm_api_keys_info: {},
  },
}

// Default settings (after reset)
const mockDefaultSettings = {
  success: true,
  message: 'Success',
  data: {
    ...mockSettingsWithPerModel.data,
    text_model_source: 'deepseek',
    text_api_key_length: 0,
    text_api_base_url: null,
    image_model_source: 'doubao',
    image_api_key_length: 0,
    image_api_base_url: null,
    image_caption_model_source: 'doubao',
    image_caption_api_key_length: 0,
    image_caption_api_base_url: null,
  },
}

/** Helper: get the nth model config group (0=text, 1=image, 2=caption) */
function getModelGroup(page: Page, index: number) {
  return page.locator('.space-y-4 > div').filter({ has: page.locator('select') }).nth(index)
}

test.describe('Settings: Per-model provider configuration', () => {
  test.setTimeout(30_000)

  test('loads saved per-model provider config correctly', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettingsWithPerModel) })
    )

    await page.goto('/settings')

    // Text model: OpenAI selected → should show API Base URL + API Key fields
    const textSelect = page.locator('select').nth(0)
    await expect(textSelect).toHaveValue('openai')

    const textGroup = getModelGroup(page, 0)
    const textBaseUrl = textGroup.locator('input[type="text"]').nth(1) // nth(0) is model name
    await expect(textBaseUrl).toHaveValue('https://test-openai.example.com/v1')

    // Image model: Gemini selected → should show API Base URL + API Key fields
    const imageSelect = page.locator('select').nth(1)
    await expect(imageSelect).toHaveValue('gemini')

    const imageGroup = getModelGroup(page, 1)
    const imageBaseUrl = imageGroup.locator('input[type="text"]').nth(1)
    await expect(imageBaseUrl).toHaveValue('https://test-gemini.example.com')

    // Image caption: Doubao (lazyllm vendor) → should show vendor API Key, NOT base URL
    const captionSelect = page.locator('select').nth(2)
    await expect(captionSelect).toHaveValue('doubao')

    // Doubao is lazyllm vendor → no API Base URL field, but has vendor API Key
    const captionGroup = getModelGroup(page, 2)
    await expect(captionGroup.locator('text=API Base URL')).toBeHidden()
    await expect(captionGroup.locator('text=API Key').first()).toBeVisible()
  })

  test('switching provider shows/hides conditional fields', async ({ page }) => {
    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDefaultSettings) })
    )

    await page.goto('/settings')

    const textGroup = getModelGroup(page, 0)
    const textSelect = textGroup.locator('select')

    // Default: deepseek (lazyllm) → vendor API Key shown, no Base URL
    await expect(textSelect).toHaveValue('deepseek')
    await expect(textGroup.locator('text=API Base URL')).toBeHidden()

    // Switch to OpenAI → API Base URL + API Key appear
    await textSelect.selectOption('openai')
    await expect(textGroup.locator('text=API Base URL')).toBeVisible()
    await expect(textGroup.locator('input[type="password"]')).toBeVisible()

    // Switch to Gemini → still shows API Base URL + API Key
    await textSelect.selectOption('gemini')
    await expect(textGroup.locator('text=API Base URL')).toBeVisible()

    // Switch to default → no extra fields
    await textSelect.selectOption('')
    await expect(textGroup.locator('text=API Base URL')).toBeHidden()
    await expect(textGroup.locator('input[type="password"]')).toBeHidden()
  })

  test('save sends correct per-model payload', async ({ page }) => {
    await page.route('**/api/settings', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDefaultSettings) })
      } else if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON()
        // Verify per-model fields in payload
        expect(body.text_model_source).toBe('openai')
        expect(body.text_api_base_url).toBe('https://new-openai.example.com')
        expect(body.text_api_key).toBe('sk-test-key-123')

        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...mockDefaultSettings.data, text_model_source: 'openai', text_api_base_url: 'https://new-openai.example.com', text_api_key_length: 15 },
          }),
        })
      }
    })

    await page.goto('/settings')

    // Switch text model to OpenAI and fill credentials
    const textGroup = getModelGroup(page, 0)
    await textGroup.locator('select').selectOption('openai')
    await textGroup.locator('input[type="text"]').nth(1).fill('https://new-openai.example.com')
    await textGroup.locator('input[type="password"]').fill('sk-test-key-123')

    // Save
    await page.getByRole('button', { name: /保存/ }).click()

    // Verify success toast
    await expect(page.locator('text=保存成功').or(page.locator('text=saved'))).toBeVisible({ timeout: 5000 })
  })

  test('reload persists saved per-model config', async ({ page }) => {
    let usePerModel = false
    await page.route('**/api/settings', route => {
      const data = usePerModel ? mockSettingsWithPerModel : mockDefaultSettings
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })

    // First load — default config
    await page.goto('/settings')
    await expect(page.locator('select').nth(0)).toHaveValue('deepseek')

    // Simulate reload with updated data
    usePerModel = true
    await page.goto('/settings')
    await expect(page.locator('select').nth(0)).toHaveValue('openai')

    const textGroup = getModelGroup(page, 0)
    const textBaseUrl = textGroup.locator('input[type="text"]').nth(1)
    await expect(textBaseUrl).toHaveValue('https://test-openai.example.com/v1')
  })

  test('reset clears per-model config', async ({ page }) => {
    let isReset = false
    await page.route('**/api/settings', route => {
      const data = isReset ? mockDefaultSettings : mockSettingsWithPerModel
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.route('**/api/settings/reset', async route => {
      isReset = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDefaultSettings) })
    })

    await page.goto('/settings')

    // Verify initial state has per-model config
    await expect(page.locator('select').nth(0)).toHaveValue('openai')

    // Click reset
    await page.getByRole('button', { name: /重置/ }).click()
    // Confirm dialog
    await page.getByRole('button', { name: /确定重置/ }).click()

    // After reset: sources revert to env defaults, no API base URL fields
    await expect(page.locator('select').nth(0)).toHaveValue('deepseek')

    const textGroup = getModelGroup(page, 0)
    await expect(textGroup.locator('text=API Base URL')).toBeHidden()
  })
})
