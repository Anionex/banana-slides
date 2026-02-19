import { test, expect } from '@playwright/test'

test.describe('Description generation failure handling', () => {
  test('stays on Home and shows error when generateFromDescription fails', async ({ page }) => {
    // Mock: project creation succeeds
    await page.route('**/api/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { project_id: 'test-proj-fail' } }),
        })
      } else {
        await route.continue()
      }
    })

    // Mock: generateFromDescription fails with 503
    await page.route('**/api/projects/*/generate/from-description', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'AI service unavailable' } }),
      })
    })

    // Mock: deleteProject succeeds (cleanup after failure)
    await page.route('**/api/projects/test-proj-fail', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      } else {
        await route.continue()
      }
    })

    const baseUrl = process.env.BASE_URL || 'http://localhost:5173'
    // Skip help modal by pre-setting localStorage
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto(baseUrl)

    // Click "从描述生成" tab
    await page.locator('button').filter({ hasText: /从描述生成|From Description/i }).click()

    // Enter description text in contenteditable MarkdownTextarea
    const editor = page.locator('[role="textbox"][contenteditable="true"]').first()
    await editor.click()
    await editor.pressSequentially('page1 intro page2 content page3 summary', { delay: 10 })

    // Submit
    await page.locator('button').filter({ hasText: /下一步|Next/i }).click()

    // Should show error toast with the error message
    await expect(page.getByText(/AI service unavailable/i)).toBeVisible({ timeout: 15000 })

    // Should stay on Home page
    expect(page.url()).not.toContain('/detail')
    expect(page.url()).not.toContain('/outline')
  })
})
