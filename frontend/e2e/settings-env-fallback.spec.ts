/**
 * E2E tests for issue #289: _sync_settings_to_config should restore .env
 * defaults instead of popping config keys when DB fields are NULL.
 *
 * Mock test: verifies the settings save UI flow works when API key is not touched.
 * Integration test: verifies backend preserves config state after saving without api_key.
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Settings env fallback - Mock tests', () => {
  test('saving settings without touching API key should succeed', async ({ page }) => {
    // Mock GET /api/settings — DB has NULL api_key (relies on .env)
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
              baidu_api_key_length: 0,
              text_model_source: null,
              image_model_source: null,
              image_caption_model_source: null,
              lazyllm_api_keys_info: {},
              text_api_key_length: 0,
              text_api_base_url: null,
              image_api_key_length: 0,
              image_api_base_url: null,
              image_caption_api_key_length: 0,
              image_caption_api_base_url: null,
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    // Mock PUT /api/settings — capture payload to verify api_key is NOT sent
    let putPayload: Record<string, unknown> | null = null
    await page.route('**/api/settings', async (route) => {
      if (route.request().method() === 'PUT') {
        putPayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 1, image_resolution: '4K' },
          }),
        })
      } else {
        await route.fallback()
      }
    })

    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    // Change image resolution from 2K to 4K (a non-key field)
    const resolutionSelect = page.locator('select').filter({ has: page.locator('option[value="2K"]') })
    await resolutionSelect.selectOption('4K')

    // Click save
    const saveButton = page.getByRole('button', { name: /保存|Save/i })
    await saveButton.click()

    // Verify success toast appears (text is "设置保存成功" or "Settings saved successfully")
    await expect(page.getByText(/设置保存成功|Settings saved successfully/)).toBeVisible({ timeout: 5000 })

    // Verify PUT payload does NOT include api_key (frontend only sends it when user types a new value)
    expect(putPayload).not.toBeNull()
    expect(putPayload).not.toHaveProperty('api_key')
  })
})

test.describe('Settings env fallback - Integration tests', () => {
  test('saving without api_key should not corrupt backend config', async ({ request }) => {
    // 1. Get initial settings state
    const getRes1 = await request.get(`${BASE_URL}/api/settings`)
    expect(getRes1.ok()).toBeTruthy()
    const initial = (await getRes1.json()).data
    const initialKeyLen = initial.api_key_length

    // 2. Save settings with only image_resolution (no api_key in payload)
    //    This triggers _sync_settings_to_config with settings.api_key = NULL
    const putRes = await request.put(`${BASE_URL}/api/settings`, {
      data: { image_resolution: '4K' },
    })
    expect(putRes.ok()).toBeTruthy()

    // 3. Save again with a different field to trigger _sync_settings_to_config a second time
    //    Before the fix, the second save would find config keys already popped
    const putRes2 = await request.put(`${BASE_URL}/api/settings`, {
      data: { image_resolution: '2K' },
    })
    expect(putRes2.ok()).toBeTruthy()

    // 4. Verify settings are still consistent — api_key_length should be unchanged
    //    (to_dict backfills from Config, so this confirms no crash; the real fix
    //    is that app.config keys are preserved for services like _create_file_parser)
    const getRes2 = await request.get(`${BASE_URL}/api/settings`)
    expect(getRes2.ok()).toBeTruthy()
    const after = (await getRes2.json()).data
    expect(after.api_key_length).toBe(initialKeyLen)

    // Restore original resolution
    await request.put(`${BASE_URL}/api/settings`, {
      data: { image_resolution: initial.image_resolution },
    })
  })
})
