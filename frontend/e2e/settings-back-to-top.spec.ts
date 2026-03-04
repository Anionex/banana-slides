import { test, expect } from '@playwright/test'

// Mock test: verify UI logic with mocked backend
test.describe('Settings back-to-top button (mock)', () => {
  test('shows button on scroll and scrolls to top on click', async ({ page }) => {
    await page.route('**/api/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { ai_provider_format: 'gemini', image_resolution: '2K', max_description_workers: 5, max_image_workers: 8, output_language: 'zh' }
        })
      })
    })

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const btn = page.getByTestId('back-to-top-button')
    await expect(btn).not.toBeVisible()

    await page.evaluate(() => window.scrollTo(0, 500))
    await expect(btn).toBeVisible({ timeout: 3000 })

    await btn.click()
    await page.waitForFunction(() => window.scrollY < 50, null, { timeout: 3000 })
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50)
  })
})

// Integration test: verify with real backend settings data
test.describe('Settings back-to-top button (integration)', () => {
  test('works with real backend settings loaded', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const btn = page.getByTestId('back-to-top-button')
    await expect(btn).not.toBeVisible()

    await page.evaluate(() => window.scrollTo(0, 500))
    await expect(btn).toBeVisible({ timeout: 3000 })

    await btn.click()
    await page.waitForFunction(() => window.scrollY < 50, null, { timeout: 3000 })
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50)
  })
})
