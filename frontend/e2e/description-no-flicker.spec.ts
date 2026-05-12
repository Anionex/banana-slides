/**
 * Mock E2E test: Description cards should not flicker during batch generation.
 *
 * Simulates incremental description generation via polling.
 * Verifies that already-completed cards keep their content stable
 * while other pages are still generating.
 */
import { test, expect } from '@playwright/test'

const PROJECT_ID = 'mock-proj-flicker'

function makePage(id: string, index: number, title: string, description?: string) {
  return {
    id,
    page_id: id,
    title,
    sort_order: index,
    order_index: index,
    status: description ? 'COMPLETED' : 'DRAFT',
    outline_content: { title, points: [`Point for ${title}`] },
    description_content: description ? { text: description } : null,
    generated_image_path: null,
  }
}

test.describe('Description cards stability during generation', () => {
  test('already-completed cards stay stable while others generate', async ({ page }) => {
    // Flag: set to true after generation starts, controls which stage to return
    let generationStarted = false
    let syncCountAfterGen = 0

    // Mock GET project
    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return }

      let pages
      if (!generationStarted) {
        // Before generation: all pages have no description
        pages = [
          makePage('p1', 0, 'Page One'),
          makePage('p2', 1, 'Page Two'),
          makePage('p3', 2, 'Page Three'),
        ]
      } else {
        syncCountAfterGen++
        if (syncCountAfterGen <= 2) {
          // Stage 1: page 1 done
          pages = [
            makePage('p1', 0, 'Page One', '# Description for Page One\n\nThis is page one content.'),
            makePage('p2', 1, 'Page Two'),
            makePage('p3', 2, 'Page Three'),
          ]
        } else if (syncCountAfterGen <= 4) {
          // Stage 2: pages 1+2 done
          pages = [
            makePage('p1', 0, 'Page One', '# Description for Page One\n\nThis is page one content.'),
            makePage('p2', 1, 'Page Two', '# Description for Page Two\n\nThis is page two content.'),
            makePage('p3', 2, 'Page Three'),
          ]
        } else {
          // Stage 3: all done
          pages = [
            makePage('p1', 0, 'Page One', '# Description for Page One\n\nThis is page one content.'),
            makePage('p2', 1, 'Page Two', '# Description for Page Two\n\nThis is page two content.'),
            makePage('p3', 2, 'Page Three', '# Description for Page Three\n\nThis is page three content.'),
          ]
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            project_id: PROJECT_ID, id: PROJECT_ID,
            status: 'OUTLINE_GENERATED', creation_type: 'idea',
            pages,
          },
        }),
      })
    })

    // Mock POST generate descriptions
    await page.route('**/api/projects/*/generate/descriptions', async (route) => {
      generationStarted = true
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { task_id: 'mock-desc-task' } }),
      })
    })

    // Mock task polling
    let taskCallCount = 0
    await page.route(`**/api/projects/${PROJECT_ID}/tasks/*`, async (route) => {
      taskCallCount++
      const completed = taskCallCount >= 4
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            task_id: 'mock-desc-task',
            status: completed ? 'COMPLETED' : 'PROCESSING',
            progress: { total: 3, completed: Math.min(taskCallCount, 3) },
          },
        }),
      })
    })

    // Mock reference files
    await page.route('**/api/projects/*/files*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    })

    // Navigate to detail editor
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
    await page.goto(`${baseUrl}/project/${PROJECT_ID}/detail`)

    // Wait for page cards to appear (no descriptions yet)
    await expect(page.locator('text=第 1 页')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=第 3 页')).toBeVisible()

    // Click batch generate
    await page.locator('button:has-text("批量生成描述")').click()

    // Wait for page 1 description to appear
    await expect(page.locator('text=This is page one content')).toBeVisible({ timeout: 15000 })

    // Wait for page 2 description
    await expect(page.locator('text=This is page two content')).toBeVisible({ timeout: 15000 })

    // Verify page 1 is STILL visible (not flickered away)
    await expect(page.locator('text=This is page one content')).toBeVisible()

    // Wait for page 3 (all done)
    await expect(page.locator('text=This is page three content')).toBeVisible({ timeout: 15000 })

    // Final: all three descriptions visible simultaneously
    await expect(page.locator('text=This is page one content')).toBeVisible()
    await expect(page.locator('text=This is page two content')).toBeVisible()
    await expect(page.locator('text=This is page three content')).toBeVisible()
  })
})
