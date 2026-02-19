import { test, expect } from '@playwright/test'

test.describe('Idea outline generation failure handling', () => {
  test('stays on Home and shows error when generateOutline fails', async ({ page }) => {
    // Mock: project creation succeeds
    await page.route('**/api/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { project_id: 'test-proj-idea-fail' } }),
        })
      } else {
        await route.continue()
      }
    })

    // Mock: generateOutline fails with 503
    await page.route('**/api/projects/*/generate/outline', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'AI service unavailable' } }),
      })
    })

    // Mock: deleteProject succeeds (cleanup after failure)
    await page.route('**/api/projects/test-proj-idea-fail', async (route) => {
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
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto(baseUrl)

    // Idea tab is the default, no need to click it
    const editor = page.locator('[role="textbox"][contenteditable="true"]').first()
    await editor.click()
    await editor.pressSequentially('Generate a presentation about AI history', { delay: 10 })

    // Submit
    await page.locator('button').filter({ hasText: /下一步|Next/i }).click()

    // Should show error toast
    await expect(page.getByText(/AI service unavailable/i)).toBeVisible({ timeout: 15000 })

    // Should stay on Home page
    expect(page.url()).not.toContain('/outline')
    expect(page.url()).not.toContain('/detail')
  })
})
