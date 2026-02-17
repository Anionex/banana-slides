/**
 * E2E tests for Settings page env backfill behavior.
 *
 * Mock tests verify the frontend correctly renders backfilled values.
 * Integration tests verify the backend actually backfills None fields from Config.
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Settings backfill - Mock tests', () => {
  test('should display env-backfilled values on first load', async ({ page }) => {
    // Mock GET /api/settings to return data as if backend backfilled from env
    await page.route('**/api/settings', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 1,
              ai_provider_format: 'gemini',
              api_base_url: null,
              api_key_length: 39,
              image_resolution: '2K',
              image_aspect_ratio: '16:9',
              max_description_workers: 5,
              max_image_workers: 8,
              text_model: 'gemini-2.5-flash',
              image_model: 'gemini-2.0-flash-preview-image-generation',
              mineru_api_base: null,
              mineru_token_length: 0,
              image_caption_model: null,
              output_language: 'zh',
              enable_text_reasoning: false,
              text_thinking_budget: 1024,
              enable_image_reasoning: false,
              image_thinking_budget: 1024,
              baidu_ocr_api_key_length: 0,
              text_model_source: null,
              image_model_source: null,
              image_caption_model_source: null,
              lazyllm_api_keys_info: {},
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    // text_model should be populated from env
    const textModel = page.locator('input[value="gemini-2.5-flash"]')
    await expect(textModel).toBeVisible()

    // image_model should be populated from env
    const imageModel = page.locator('input[value="gemini-2.0-flash-preview-image-generation"]')
    await expect(imageModel).toBeVisible()

    // API key placeholder should show length > 0 (已设置（长度: 39）)
    const apiKeyInput = page.locator('input[type="password"]').first()
    const placeholder = await apiKeyInput.getAttribute('placeholder')
    expect(placeholder).toContain('39')
  })

  test('should show length 0 when api_key is not configured', async ({ page }) => {
    await page.route('**/api/settings', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 1,
              ai_provider_format: 'gemini',
              api_base_url: null,
              api_key_length: 0,
              image_resolution: '2K',
              image_aspect_ratio: '16:9',
              max_description_workers: 5,
              max_image_workers: 8,
              text_model: '',
              image_model: '',
              mineru_api_base: null,
              mineru_token_length: 0,
              image_caption_model: null,
              output_language: 'zh',
              enable_text_reasoning: false,
              text_thinking_budget: 1024,
              enable_image_reasoning: false,
              image_thinking_budget: 1024,
              baidu_ocr_api_key_length: 0,
              text_model_source: null,
              image_model_source: null,
              image_caption_model_source: null,
              lazyllm_api_keys_info: {},
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    // API key placeholder should NOT contain a non-zero length
    const apiKeyInput = page.locator('input[type="password"]').first()
    const placeholder = await apiKeyInput.getAttribute('placeholder')
    // After frontend fix: when length is 0, should show default placeholder, not "已设置（长度: 0）"
    expect(placeholder).not.toContain('已设置')
  })
})

test.describe('Settings backfill - Integration tests', () => {
  test('GET /api/settings should return backfilled env values', async ({ request }) => {
    // Reset then clear text_model — backend converts empty string to NULL in DB
    await request.post(`${BASE_URL}/api/settings/reset`)
    await request.put(`${BASE_URL}/api/settings`, {
      data: { text_model: '' },
    })

    // GET triggers backfill: NULL fields get re-populated from env Config
    const resp = await request.get(`${BASE_URL}/api/settings`)
    expect(resp.ok()).toBeTruthy()
    const data = (await resp.json()).data

    // text_model should be backfilled from env (non-empty if TEXT_MODEL is set)
    expect(data.text_model).not.toBe('')
    expect(data.text_model).not.toBeNull()
    expect(data).toHaveProperty('api_key_length')
    expect(typeof data.api_key_length).toBe('number')
    expect(data).toHaveProperty('image_model')
  })

  test('Settings page should load and display values from backend', async ({ page }) => {
    // Reset settings to ensure env values are loaded
    await page.request.post(`${BASE_URL}/api/settings/reset`)

    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    // The page should load without errors - check that the settings form is visible
    // Look for the save button as indicator the page loaded
    const saveButton = page.getByRole('button', { name: /保存|Save/ })
    await expect(saveButton).toBeVisible()

    // Verify the reset button exists
    const resetButton = page.getByRole('button', { name: /重置|Reset/ })
    await expect(resetButton).toBeVisible()
  })
})
