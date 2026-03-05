/**
 * Mock E2E test: Skeleton stays visible during batch description RE-generation.
 *
 * When re-generating descriptions, the backend sets page.status to GENERATING_DESCRIPTION.
 * The skeleton must stay until the status changes to DESCRIPTION_GENERATED with new content.
 */
import { test, expect } from '@playwright/test'

const PROJECT_ID = 'mock-proj-regen-skeleton'

function makePage(id: string, index: number, title: string, opts?: { description?: string, status?: string }) {
  return {
    id,
    page_id: id,
    title,
    sort_order: index,
    order_index: index,
    status: opts?.status || (opts?.description ? 'DESCRIPTION_GENERATED' : 'DRAFT'),
    outline_content: { title, points: [`Point for ${title}`] },
    description_content: opts?.description ? { text: opts.description } : null,
    generated_image_path: null,
  }
}

const OLD_DESC_1 = 'Old description for page one'
const OLD_DESC_2 = 'Old description for page two'
const NEW_DESC_1 = 'Brand new description for page one'
const NEW_DESC_2 = 'Brand new description for page two'

test.describe('Skeleton during description re-generation', () => {
  test('skeleton stays visible until page status changes from GENERATING_DESCRIPTION', async ({ page }) => {
    let regenerationStarted = false
    let syncCountAfterRegen = 0

    // Mock GET project
    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return }

      let pages
      if (!regenerationStarted) {
        // Before re-generation: all pages already have descriptions
        pages = [
          makePage('p1', 0, 'Page One', { description: OLD_DESC_1 }),
          makePage('p2', 1, 'Page Two', { description: OLD_DESC_2 }),
        ]
      } else {
        syncCountAfterRegen++
        if (syncCountAfterRegen <= 2) {
          // Still processing: backend has set status to GENERATING_DESCRIPTION
          pages = [
            makePage('p1', 0, 'Page One', { description: OLD_DESC_1, status: 'GENERATING_DESCRIPTION' }),
            makePage('p2', 1, 'Page Two', { description: OLD_DESC_2, status: 'GENERATING_DESCRIPTION' }),
          ]
        } else if (syncCountAfterRegen <= 4) {
          // Page 1 done (status changed + new content), page 2 still generating
          pages = [
            makePage('p1', 0, 'Page One', { description: NEW_DESC_1 }),
            makePage('p2', 1, 'Page Two', { description: OLD_DESC_2, status: 'GENERATING_DESCRIPTION' }),
          ]
        } else {
          // All done
          pages = [
            makePage('p1', 0, 'Page One', { description: NEW_DESC_1 }),
            makePage('p2', 1, 'Page Two', { description: NEW_DESC_2 }),
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
            status: 'DESCRIPTIONS_GENERATED', creation_type: 'idea',
            pages,
          },
        }),
      })
    })

    // Mock POST generate descriptions
    await page.route('**/api/projects/*/generate/descriptions', async (route) => {
      regenerationStarted = true
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { task_id: 'mock-regen-task' } }),
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
            task_id: 'mock-regen-task',
            status: completed ? 'COMPLETED' : 'PROCESSING',
            progress: { total: 2, completed: Math.min(taskCallCount, 2) },
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

    // Verify old descriptions are visible before re-generation
    await expect(page.getByText(OLD_DESC_1)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(OLD_DESC_2)).toBeVisible()

    // Click batch generate (triggers re-generation confirmation dialog)
    await page.getByRole('button', { name: /批量生成描述|Batch Generate/i }).click()

    // Confirm the regeneration dialog (may or may not appear)
    try {
      await page.getByRole('button', { name: /确认|确定/ }).click({ timeout: 2000 })
    } catch {
      // Dialog may not appear, which is expected
    }

    // After clicking generate, skeleton should appear — old descriptions should NOT be visible
    await expect(page.getByText(/生成中|Generating/).first()).toBeVisible({ timeout: 5000 })

    // Old descriptions should be hidden while skeleton is showing
    await expect(page.getByText(OLD_DESC_1)).not.toBeVisible()
    await expect(page.getByText(OLD_DESC_2)).not.toBeVisible()

    // Wait for page 1 new description to appear (status changed to DESCRIPTION_GENERATED)
    await expect(page.getByText(NEW_DESC_1)).toBeVisible({ timeout: 15000 })

    // Wait for page 2 new description
    await expect(page.getByText(NEW_DESC_2)).toBeVisible({ timeout: 15000 })

    // Verify final state: both new descriptions visible, old ones gone
    await expect(page.getByText(OLD_DESC_1)).not.toBeVisible()
    await expect(page.getByText(OLD_DESC_2)).not.toBeVisible()
  })
})
