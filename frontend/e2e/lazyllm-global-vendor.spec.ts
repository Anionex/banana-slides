/**
 * E2E tests for lazyllm global vendor fix.
 *
 * Bug: selecting a lazyllm vendor (e.g., "doubao") as global provider converted
 * it to "lazyllm" on save, losing vendor info. The backend then defaulted to
 * hardcoded 'deepseek' for text source, causing API key lookup failures.
 *
 * Fix: vendor name is now stored directly in ai_provider_format (e.g., "doubao").
 */
import { test, expect } from '@playwright/test'

// ─── Mock tests ────────────────────────────────────────────────────

test.describe('Global lazyllm vendor — mock tests', () => {
  test.setTimeout(30_000)

  test('save sends vendor name directly, not "lazyllm"', async ({ page }) => {
    // Mock GET settings
    const mockSettings = {
      success: true, message: 'Success',
      data: {
        id: 1, ai_provider_format: 'gemini', api_base_url: '',
        api_key_length: 0, text_model: '', image_model: '',
        image_caption_model: '', image_resolution: '2K',
        image_aspect_ratio: '16:9', max_description_workers: 5,
        max_image_workers: 8, output_language: 'zh',
        enable_text_reasoning: false, text_thinking_budget: 1024,
        enable_image_reasoning: false, image_thinking_budget: 1024,
        mineru_api_base: '', mineru_token_length: 0,
        baidu_api_key_length: 0,
        text_model_source: '', text_api_key_length: 0, text_api_base_url: null,
        image_model_source: '', image_api_key_length: 0, image_api_base_url: null,
        image_caption_model_source: '', image_caption_api_key_length: 0,
        image_caption_api_base_url: null, lazyllm_api_keys_info: {},
      },
    }

    let capturedPayload: any = null

    await page.route('**/api/settings', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(mockSettings),
        })
      } else if (route.request().method() === 'PUT') {
        capturedPayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...mockSettings.data, ai_provider_format: 'doubao' },
          }),
        })
      }
    })

    await page.goto('/settings')

    // Select "doubao" as global provider
    const globalProviderSelect = page.locator('select').first()
    await globalProviderSelect.selectOption('doubao')

    // Fill doubao API key (vendor key input appears for lazyllm vendors)
    const vendorKeyInput = page.locator('input[type="password"]').first()
    await vendorKeyInput.fill('test-doubao-key-123')

    // Save
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('text=保存成功').or(page.locator('text=saved'))).toBeVisible({ timeout: 5000 })

    // Key assertion: payload should send "doubao", NOT "lazyllm"
    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload.ai_provider_format).toBe('doubao')
  })

  test('loading vendor name from backend displays correct dropdown value', async ({ page }) => {
    const mockSettings = {
      success: true, message: 'Success',
      data: {
        id: 1, ai_provider_format: 'qwen',
        api_base_url: '', api_key_length: 0,
        text_model: '', image_model: '',
        image_caption_model: '', image_resolution: '2K',
        image_aspect_ratio: '16:9', max_description_workers: 5,
        max_image_workers: 8, output_language: 'zh',
        enable_text_reasoning: false, text_thinking_budget: 1024,
        enable_image_reasoning: false, image_thinking_budget: 1024,
        mineru_api_base: '', mineru_token_length: 0,
        baidu_api_key_length: 0,
        text_model_source: '', text_api_key_length: 0, text_api_base_url: null,
        image_model_source: '', image_api_key_length: 0, image_api_base_url: null,
        image_caption_model_source: '', image_caption_api_key_length: 0,
        image_caption_api_base_url: null,
        lazyllm_api_keys_info: { qwen: 15 },
      },
    }

    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) })
    )

    await page.goto('/settings')

    // Global provider dropdown should show "qwen"
    const globalSelect = page.locator('select').first()
    await expect(globalSelect).toHaveValue('qwen')

    // Vendor key input should be visible (not Gemini/OpenAI base URL fields)
    await expect(page.locator('text=API Base URL').first()).toBeHidden()
  })

  test('backward compat: "lazyllm" format resolves to first configured vendor', async ({ page }) => {
    // Old data with generic "lazyllm" format
    const mockSettings = {
      success: true, message: 'Success',
      data: {
        id: 1, ai_provider_format: 'lazyllm',
        api_base_url: '', api_key_length: 0,
        text_model: '', image_model: '',
        image_caption_model: '', image_resolution: '2K',
        image_aspect_ratio: '16:9', max_description_workers: 5,
        max_image_workers: 8, output_language: 'zh',
        enable_text_reasoning: false, text_thinking_budget: 1024,
        enable_image_reasoning: false, image_thinking_budget: 1024,
        mineru_api_base: '', mineru_token_length: 0,
        baidu_api_key_length: 0,
        text_model_source: '', text_api_key_length: 0, text_api_base_url: null,
        image_model_source: '', image_api_key_length: 0, image_api_base_url: null,
        image_caption_model_source: '', image_caption_api_key_length: 0,
        image_caption_api_base_url: null,
        lazyllm_api_keys_info: { doubao: 20 },
      },
    }

    await page.route('**/api/settings', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings) })
    )

    await page.goto('/settings')

    // resolveLazyllmVendor should resolve "lazyllm" to "doubao" (first configured vendor)
    const globalSelect = page.locator('select').first()
    await expect(globalSelect).toHaveValue('doubao')
  })
})

// ─── Integration tests ─────────────────────────────────────────────

test.describe('Global lazyllm vendor — integration tests', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30_000)

  test('save doubao as global provider, reload shows doubao', async ({ page }) => {
    await page.goto('/settings')

    // Select doubao as global provider
    const globalSelect = page.locator('select').first()
    await globalSelect.selectOption('doubao')

    // Fill a test doubao API key
    const vendorKeyInput = page.locator('input[type="password"]').first()
    await vendorKeyInput.fill('test-doubao-integration-key')

    // Save
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('text=保存成功').or(page.locator('text=saved'))).toBeVisible({ timeout: 5000 })

    // Reload page
    await page.goto('/settings')

    // Should still show doubao (not fall back to generic lazyllm / deepseek)
    await expect(page.locator('select').first()).toHaveValue('doubao')
  })

  test('save qwen as global provider, verify backend stores vendor name', async ({ page }) => {
    await page.goto('/settings')

    // Select qwen
    const globalSelect = page.locator('select').first()
    await globalSelect.selectOption('qwen')

    // Fill qwen API key
    const vendorKeyInput = page.locator('input[type="password"]').first()
    await vendorKeyInput.fill('test-qwen-key')

    // Save
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('text=保存成功').or(page.locator('text=saved'))).toBeVisible({ timeout: 5000 })

    // Verify via API that backend stored "qwen", not "lazyllm"
    const response = await page.request.get('/api/settings')
    const data = await response.json()
    expect(data.data.ai_provider_format).toBe('qwen')
  })

  test('reset after vendor save restores default format', async ({ page }) => {
    await page.goto('/settings')

    // First save doubao
    const globalSelect = page.locator('select').first()
    await globalSelect.selectOption('doubao')
    const vendorKeyInput = page.locator('input[type="password"]').first()
    await vendorKeyInput.fill('test-key')
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('text=保存成功').or(page.locator('text=saved'))).toBeVisible({ timeout: 5000 })

    // Reset
    await page.getByRole('button', { name: /重置|Reset/ }).click()
    await page.getByRole('button', { name: /确定重置|Confirm/ }).click()
    await expect(page.locator('text=设置已重置').or(page.locator('text=reset successfully'))).toBeVisible({ timeout: 5000 })

    // After reset, format should revert to .env default (typically gemini)
    const response = await page.request.get('/api/settings')
    const data = await response.json()
    // Format should no longer be "doubao"
    expect(data.data.ai_provider_format).not.toBe('doubao')
  })
})
