/**
 * Integration E2E test for per-model provider configuration.
 * Hits the REAL backend — verifies save persistence, reload, and reset.
 */
import { test, expect, Page } from '@playwright/test'

/** Helper: get the nth model config group (0=text, 1=image, 2=caption) */
function getModelGroup(page: Page, index: number) {
  return page.locator('.space-y-4 > div').filter({ has: page.locator('select') }).nth(index)
}

// Clean up after all tests: reset settings to defaults
test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await page.goto('/settings')
  await page.getByRole('button', { name: /重置/ }).click()
  await page.getByRole('button', { name: /确定重置/ }).click()
  await page.waitForTimeout(1000)
  await page.close()
})

test.describe('Settings: Per-model provider integration (real backend)', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30_000)

  test('save per-model provider config persists to backend', async ({ page }) => {
    await page.goto('/settings')

    const textGroup = getModelGroup(page, 0)
    const textSelect = textGroup.locator('select')

    // Switch text model provider to OpenAI
    await textSelect.selectOption('openai')

    // Fill API Base URL
    const baseUrlInput = textGroup.locator('input[type="text"]').nth(1)
    await baseUrlInput.fill('https://integration-test.example.com/v1')

    // Fill API Key
    const apiKeyInput = textGroup.locator('input[type="password"]')
    await apiKeyInput.fill('sk-integration-test-key')

    // Click save
    await page.getByRole('button', { name: /保存/ }).click()
    await expect(page.locator('text=保存成功').or(page.locator('text=saved'))).toBeVisible({ timeout: 5000 })
  })

  test('reload page shows persisted per-model config', async ({ page }) => {
    await page.goto('/settings')

    const textGroup = getModelGroup(page, 0)
    const textSelect = textGroup.locator('select')

    // Verify provider selection persisted
    await expect(textSelect).toHaveValue('openai')

    // Verify API Base URL persisted
    const baseUrlInput = textGroup.locator('input[type="text"]').nth(1)
    await expect(baseUrlInput).toHaveValue('https://integration-test.example.com/v1')

    // Verify API Key shows "已设置" placeholder (length > 0)
    const apiKeyInput = textGroup.locator('input[type="password"]')
    const placeholder = await apiKeyInput.getAttribute('placeholder')
    expect(placeholder).toMatch(/长度|length/i)
  })

  test('reset clears per-model config from backend', async ({ page }) => {
    await page.goto('/settings')

    // Verify we start with per-model config
    const textGroup = getModelGroup(page, 0)
    await expect(textGroup.locator('select')).toHaveValue('openai')

    // Click reset
    await page.getByRole('button', { name: /重置/ }).click()
    await page.getByRole('button', { name: /确定重置/ }).click()

    // Wait for reset to complete
    await expect(page.locator('text=已重置').or(page.locator('text=reset'))).toBeVisible({ timeout: 5000 })

    // Verify provider reverted to env default
    await expect(textGroup.locator('select')).not.toHaveValue('openai')

    // Verify API Base URL field is hidden (lazyllm vendor or empty = no base URL)
    await expect(textGroup.locator('text=API Base URL')).toBeHidden()
  })
})
