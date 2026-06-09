import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
)

async function setupHomeMocks(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))

  await page.route('**/api/access-code/check', route =>
    route.fulfill({ json: { success: true, data: { enabled: false } } })
  )
  await page.route('**/api/user-templates', route =>
    route.fulfill({ json: { success: true, data: { templates: [] } } })
  )
  await page.route('**/api/settings', route =>
    route.fulfill({ json: { success: true, data: {} } })
  )
  await page.route('**/api/output-language', route =>
    route.fulfill({ json: { success: true, data: { language: 'zh' } } })
  )
  await page.route('**/files/template-candidates/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 })
  )
}

test.describe('Home template candidates', () => {
  test('generates candidates with an async pollable task and selects one', async ({ page }) => {
    await setupHomeMocks(page)

    let createCalled = false
    let pollCount = 0
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      candidate_id: `candidate-${index + 1}`,
      image_url: `/files/template-candidates/task-1/candidate-${index + 1}.png`,
      thumb_url: `/files/template-candidates/task-1/candidate-${index + 1}.png`,
    }))

    await page.route('**/api/template-candidates', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }

      createCalled = true
      const payload = route.request().postDataJSON()
      expect(payload.style_prompt).toContain('森林绿')
      expect(payload.count).toBe(5)
      await route.fulfill({
        status: 202,
        json: {
          success: true,
          data: {
            status: 'PENDING',
            task_id: 'task-1',
            progress: { total: 5, completed: 0, failed: 0, candidates: [] },
            candidates: [],
          },
        },
      })
    })

    await page.route('**/api/template-candidates/task-1', async (route) => {
      pollCount += 1
      await route.fulfill({
        json: {
          success: true,
          data: pollCount === 1
            ? {
                status: 'PROCESSING',
                task_id: 'task-1',
                progress: { total: 5, completed: 2, failed: 0, candidates: candidates.slice(0, 2) },
                candidates: candidates.slice(0, 2),
              }
            : {
                status: 'COMPLETED',
                task_id: 'task-1',
                progress: { total: 5, completed: 5, failed: 0, candidates },
                candidates,
              },
        },
      })
    })

    await page.goto(BASE_URL)
    await page.getByText(/使用文字描述风格|Use text description for style/).click()
    await page.locator('textarea').last().fill('森林绿，自然清新，米色背景')
    await page.getByRole('button', { name: /生成 5 个模板候选|Generate 5 template candidates/ }).click()

    await expect(page.getByRole('button', { name: /正在生成候选 2\/5/ })).toBeVisible()
    await expect(page.getByText('candidate-5')).toBeVisible({ timeout: 6000 })

    await page.getByText('candidate-3').click()

    await expect(page.getByText('candidate-3').locator('..').locator('..')).toHaveClass(/border-banana-500/)
    expect(createCalled).toBe(true)
    expect(pollCount).toBeGreaterThanOrEqual(2)
  })
})
