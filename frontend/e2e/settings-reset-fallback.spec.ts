/**
 * E2E tests for settings reset fallback behavior.
 *
 * Verifies that after saving custom model/format values then resetting,
 * both the API response (via to_dict) AND the internal app.config
 * correctly fall back to .env defaults.
 *
 * This covers the regression where _sync_settings_to_config skipped
 * restoring text_model, image_model, and ai_provider_format to .env
 * defaults when DB fields were NULL after reset.
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'

test.describe.configure({ mode: 'serial' })

test.describe('Settings reset fallback - Integration tests', () => {
  // Capture .env defaults from initial state
  let envDefaults: {
    text_model: string
    image_model: string
    ai_provider_format: string
    output_language: string
  }

  test.beforeAll(async ({ request }) => {
    // Reset first to ensure clean state, then read .env defaults
    const resetRes = await request.post(`${BASE}/api/settings/reset`)
    expect(resetRes.ok()).toBeTruthy()

    const configRes = await request.get(`${BASE}/api/settings/active-config`)
    expect(configRes.ok()).toBeTruthy()
    envDefaults = (await configRes.json()).data
    expect(envDefaults.text_model).toBeTruthy()
    expect(envDefaults.image_model).toBeTruthy()
    expect(envDefaults.ai_provider_format).toBeTruthy()
  })

  test('reset after custom save restores app.config to .env defaults', async ({ request }) => {
    // 1. Save custom values
    const putRes = await request.put(`${BASE}/api/settings`, {
      data: {
        text_model: 'custom-test-model',
        image_model: 'custom-image-model',
        ai_provider_format: 'openai',
        output_language: 'en',
      },
    })
    expect(putRes.ok()).toBeTruthy()

    // 2. Verify app.config picked up the custom values
    const configAfterSave = await request.get(`${BASE}/api/settings/active-config`)
    expect(configAfterSave.ok()).toBeTruthy()
    const savedConfig = (await configAfterSave.json()).data
    expect(savedConfig.text_model).toBe('custom-test-model')
    expect(savedConfig.image_model).toBe('custom-image-model')
    expect(savedConfig.ai_provider_format).toBe('openai')
    expect(savedConfig.output_language).toBe('en')

    // 3. Reset settings
    const resetRes = await request.post(`${BASE}/api/settings/reset`)
    expect(resetRes.ok()).toBeTruthy()

    // 4. Verify app.config has .env defaults (not stale custom values)
    const configAfterReset = await request.get(`${BASE}/api/settings/active-config`)
    expect(configAfterReset.ok()).toBeTruthy()
    const resetConfig = (await configAfterReset.json()).data
    expect(resetConfig.text_model).toBe(envDefaults.text_model)
    expect(resetConfig.image_model).toBe(envDefaults.image_model)
    expect(resetConfig.ai_provider_format).toBe(envDefaults.ai_provider_format)
    expect(resetConfig.output_language).toBe(envDefaults.output_language)
  })

  test('save after reset still uses .env defaults in app.config', async ({ request }) => {
    // This tests the double-save scenario: reset → save unrelated field →
    // verify model fields in app.config are still .env defaults (not missing)

    // 1. Save custom text_model
    await request.put(`${BASE}/api/settings`, {
      data: { text_model: 'will-be-reset' },
    })

    // 2. Reset
    const resetRes = await request.post(`${BASE}/api/settings/reset`)
    expect(resetRes.ok()).toBeTruthy()

    // 3. Save an unrelated field (triggers _sync_settings_to_config with NULL text_model)
    const putRes = await request.put(`${BASE}/api/settings`, {
      data: { image_resolution: '4K' },
    })
    expect(putRes.ok()).toBeTruthy()

    // 4. app.config should still have .env defaults
    const configRes = await request.get(`${BASE}/api/settings/active-config`)
    expect(configRes.ok()).toBeTruthy()
    const config = (await configRes.json()).data
    expect(config.text_model).toBe(envDefaults.text_model)
    expect(config.image_model).toBe(envDefaults.image_model)
    expect(config.ai_provider_format).toBe(envDefaults.ai_provider_format)

    // Cleanup
    await request.put(`${BASE}/api/settings`, {
      data: { image_resolution: null },
    })
  })

  test('API response and app.config agree after reset', async ({ request }) => {
    // Save custom values then reset — both to_dict() and app.config should return .env defaults
    await request.put(`${BASE}/api/settings`, {
      data: {
        text_model: 'mismatch-test-model',
        image_model: 'mismatch-test-image',
      },
    })

    await request.post(`${BASE}/api/settings/reset`)

    // Get both API response and active config
    const [settingsRes, configRes] = await Promise.all([
      request.get(`${BASE}/api/settings`),
      request.get(`${BASE}/api/settings/active-config`),
    ])
    expect(settingsRes.ok()).toBeTruthy()
    expect(configRes.ok()).toBeTruthy()

    const apiData = (await settingsRes.json()).data
    const configData = (await configRes.json()).data

    // API response and app.config must agree
    expect(apiData.text_model).toBe(configData.text_model)
    expect(apiData.image_model).toBe(configData.image_model)
    expect(apiData.ai_provider_format).toBe(configData.ai_provider_format)
    expect(apiData.output_language).toBe(configData.output_language)
  })
})
