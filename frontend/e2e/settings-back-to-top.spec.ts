import { test, expect } from '@playwright/test'

test.describe('Settings page back-to-top button', () => {
  test('shows button on scroll and scrolls to top on click', async ({ page }) => {
    // Mock settings API
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

    // Button should not be visible initially
    const btn = page.getByTestId('back-to-top-button')
    await expect(btn).not.toBeVisible()

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500))
    await expect(btn).toBeVisible({ timeout: 3000 })

    // Click and verify scroll back to top
    await btn.click()
    await page.waitForFunction(() => window.scrollY < 50, null, { timeout: 3000 })
    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY).toBeLessThan(50)
  })
})
