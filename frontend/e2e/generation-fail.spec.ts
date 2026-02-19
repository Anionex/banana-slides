import { test, expect, Page } from '@playwright/test'

async function setupFailureMocks(page: Page, projectId: string, failUrl: string) {
  // Most specific first
  await page.route(`**/api/projects/${projectId}`, async (route) => {
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

  await page.route(failUrl, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'AI service unavailable' } }),
    })
  })

  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { project_id: projectId } }),
      })
    } else {
      await route.continue()
    }
  })
}

test.describe('Generation failure handling', () => {
  test.beforeEach(async ({ page }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173'
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto(baseUrl)
  })

  test('outline: stays on Home when generateOutline fails', async ({ page }) => {
    await setupFailureMocks(page, 'test-outline-fail', '**/api/projects/*/generate/outline')

    await page.locator('button').filter({ hasText: /从大纲生成|From Outline/i }).click()

    const editor = page.locator('[role="textbox"][contenteditable="true"]').first()
    await editor.click()
    await editor.pressSequentially('Slide 1: Intro\nSlide 2: Content\nSlide 3: Summary', { delay: 10 })

    await page.locator('button').filter({ hasText: /下一步|Next/i }).click()

    await expect(page.getByText(/AI service unavailable/i)).toBeVisible({ timeout: 15000 })
    expect(page.url()).not.toContain('/outline')
    expect(page.url()).not.toContain('/detail')
  })

  test('description: stays on Home when generateFromDescription fails', async ({ page }) => {
    await setupFailureMocks(page, 'test-desc-fail', '**/api/projects/*/generate/from-description')

    await page.locator('button').filter({ hasText: /从描述生成|From Description/i }).click()

    const editor = page.locator('[role="textbox"][contenteditable="true"]').first()
    await editor.click()
    await editor.pressSequentially('page1 intro page2 content page3 summary', { delay: 10 })

    await page.locator('button').filter({ hasText: /下一步|Next/i }).click()

    await expect(page.getByText(/AI service unavailable/i)).toBeVisible({ timeout: 15000 })
    expect(page.url()).not.toContain('/detail')
    expect(page.url()).not.toContain('/outline')
  })
})
