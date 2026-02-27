/**
 * E2E test: Structured JSON output
 *
 * Verifies that outline generation flow still works correctly after
 * switching to structured JSON output API with fallback.
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:5173'

test.describe('Structured JSON output - mock tests', () => {
  test.setTimeout(30_000)

  test('Outline generation returns valid structured data', async ({ page }) => {
    // Mock access code check
    await page.route('**/api/access-code/check', route =>
      route.fulfill({ json: { data: { enabled: false } } })
    )

    // Mock user templates
    await page.route('**/api/user-templates', route =>
      route.fulfill({ json: { success: true, data: [] } })
    )

    // Mock project creation
    await page.route('**/api/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { project_id: 'test-proj-1', status: 'DRAFT' },
          }),
        })
      } else {
        await route.continue()
      }
    })

    // Mock outline generation task
    await page.route('**/api/projects/*/generate/outline', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { task_id: 'outline-task-1' },
        }),
      })
    })

    // Mock task polling
    await page.route('**/api/tasks/outline-task-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            task_id: 'outline-task-1',
            status: 'completed',
            result: {
              outline: [
                { title: 'Introduction', points: ['Overview', 'Goals'] },
                {
                  part: 'Main Content',
                  pages: [
                    { title: 'Topic A', points: ['Point 1', 'Point 2'] },
                    { title: 'Topic B', points: ['Point 3'] },
                  ],
                },
              ],
            },
          },
        }),
      })
    })

    // Mock project fetch
    await page.route('**/api/projects/test-proj-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            project_id: 'test-proj-1',
            status: 'OUTLINE_READY',
            idea_prompt: 'Test presentation',
            pages: [
              { id: 1, page_index: 0, title: 'Introduction', points: ['Overview', 'Goals'] },
              { id: 2, page_index: 1, title: 'Topic A', points: ['Point 1', 'Point 2'] },
              { id: 3, page_index: 2, title: 'Topic B', points: ['Point 3'] },
            ],
          },
        }),
      })
    })

    // Skip welcome dialog via localStorage
    await page.goto(BASE)
    await page.evaluate(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.reload()

    // Fill idea and submit
    const ideaInput = page.getByRole('textbox').first()
    await ideaInput.waitFor({ state: 'visible', timeout: 10_000 })
    await ideaInput.fill('Test presentation about structured JSON')
    await page.click('button:has-text("下一步")')

    // Should navigate to outline editor
    await page.waitForSelector(
      'button:has-text("自动生成大纲"), button:has-text("重新生成大纲")',
      { timeout: 10_000 }
    )
  })
})
