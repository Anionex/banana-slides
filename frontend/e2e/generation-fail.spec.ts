import { test, expect, Page } from '@playwright/test'

async function setupFailureMocks(page: Page, projectId: string, failUrl: string) {
  // Routes don't overlap in practice; order doesn't matter here
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
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto('/')
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

// --- Integration tests (real backend) ---

test.describe('Generation failure rollback (integration)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto('/')
  })

  test('outline: failed generation deletes project and stays on Home', async ({ page }) => {
    // Capture project_id from creation response (no mock — real backend)
    let projectId: string | null = null
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.status() === 201) {
        const body = await resp.json().catch(() => null)
        projectId = body?.data?.project_id ?? null
      }
    })

    await page.locator('button').filter({ hasText: /从大纲生成|From Outline/i }).click()
    const editor = page.locator('[role="textbox"][contenteditable="true"]').first()
    await editor.click()
    await editor.pressSequentially('Slide 1: Intro\nSlide 2: Body\nSlide 3: End', { delay: 10 })

    await page.locator('button').filter({ hasText: /下一步|Next/i }).click()

    // Wait for either error toast (failure) or navigation (success)
    const errorLocator = page.locator('[class*="error"], [class*="toast"], [role="alert"]').first()
    const navigated = page.waitForURL(/\/(outline|detail)/, { timeout: 60000 }).then(() => 'navigated' as const)
    const errored = errorLocator.waitFor({ timeout: 60000 }).then(() => 'errored' as const)
    const result = await Promise.race([navigated, errored])

    if (result === 'errored') {
      // Generation failed → should stay on Home
      expect(page.url()).not.toContain('/outline')
      expect(page.url()).not.toContain('/detail')

      // Verify project was rolled back (deleted) — fetch inside browser goes through Vite proxy
      if (projectId) {
        const status = await page.evaluate(async (id) => {
          const r = await fetch(`/api/projects/${id}`)
          return r.status
        }, projectId)
        expect(status).toBe(404)
      }
    } else {
      expect(page.url()).toMatch(/\/(outline|detail)/)
    }
  })

  test('description: failed generation deletes project and stays on Home', async ({ page }) => {
    let projectId: string | null = null
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.status() === 201) {
        const body = await resp.json().catch(() => null)
        projectId = body?.data?.project_id ?? null
      }
    })

    await page.locator('button').filter({ hasText: /从描述生成|From Description/i }).click()
    const editor = page.locator('[role="textbox"][contenteditable="true"]').first()
    await editor.click()
    await editor.pressSequentially('page1 intro page2 content page3 summary', { delay: 10 })

    await page.locator('button').filter({ hasText: /下一步|Next/i }).click()

    const errorLocator = page.locator('[class*="error"], [class*="toast"], [role="alert"]').first()
    const navigated = page.waitForURL(/\/(outline|detail)/, { timeout: 60000 }).then(() => 'navigated' as const)
    const errored = errorLocator.waitFor({ timeout: 60000 }).then(() => 'errored' as const)
    const result = await Promise.race([navigated, errored])

    if (result === 'errored') {
      expect(page.url()).not.toContain('/outline')
      expect(page.url()).not.toContain('/detail')

      if (projectId) {
        const status = await page.evaluate(async (id) => {
          const r = await fetch(`/api/projects/${id}`)
          return r.status
        }, projectId)
        expect(status).toBe(404)
      }
    } else {
      expect(page.url()).toMatch(/\/(outline|detail)/)
    }
  })
})
