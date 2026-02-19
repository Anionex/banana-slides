/**
 * E2E tests for interleaved text+image prompt system (PR #219)
 *
 * This PR refactored generate_image to accept interleaved contents list.
 * Tests verify the image generation code path via Settings service test.
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Image generation service test (integration)', () => {
  test.setTimeout(90_000)

  test('backend returns structured response, not 500 crash', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true')
    })
    await page.goto(`${BASE}/settings`)
    await expect(page).toHaveTitle(/蕉幻|Banana/i)

    // Click Image Generation Model "Start Test" (5th test button)
    const imageTestBtn = page.locator('button:has-text("开始测试")').nth(4)
    await imageTestBtn.scrollIntoViewIfNeeded()
    await imageTestBtn.click()

    // Wait for result — green (success) or red (error) text appears
    const resultText = page.locator('.text-green-600, .text-red-600')
    await expect(resultText.first()).toBeVisible({ timeout: 70_000 })

    // No 500 crash
    await expect(page.locator('text=/Internal Server Error/')).toHaveCount(0)
  })
})

test.describe('Image generation service test (mocked)', () => {
  test.setTimeout(30_000)

  test('mocked service test shows success', async ({ page }) => {
    const testId = 'mock-test-id'

    // Mock: POST start test → return task ID
    await page.route('**/api/settings/tests/image-model', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { task_id: testId } })
      })
    })

    // Mock: GET poll status → return COMPLETED
    let polled = false
    await page.route(`**/api/settings/tests/${testId}/status`, async (route) => {
      polled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { status: 'COMPLETED', message: '测试成功', result: { success: true } }
        })
      })
    })

    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true')
    })
    await page.goto(`${BASE}/settings`)

    const imageTestBtn = page.locator('button:has-text("开始测试")').nth(4)
    await imageTestBtn.scrollIntoViewIfNeeded()
    await imageTestBtn.click()

    // Verify success result appears (green text)
    await expect(page.locator('.text-green-600')).toBeVisible({ timeout: 10_000 })
    expect(polled).toBe(true)
  })
})
