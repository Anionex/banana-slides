import { test, expect, Page } from '@playwright/test'

const PROJECT_ID = 'single-regenerate-mock'
const PAGE_ID = 'page-1'

const PROJECT_RESPONSE = {
  success: true,
  data: {
    project_id: PROJECT_ID,
    creation_type: 'idea',
    idea_prompt: 'single page regenerate test',
    status: 'COMPLETED',
    template_style: 'clean editorial',
    image_aspect_ratio: '16:9',
    pages: [
      {
        page_id: PAGE_ID,
        order_index: 0,
        outline_content: { title: 'Page 1', points: ['Point 1'] },
        description_content: { text: 'Description 1' },
        generated_image_url: '/files/mock/page-1.jpg',
        status: 'COMPLETED',
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-01T00:00:00',
      },
    ],
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
  },
}

async function mockCommonRoutes(page: Page) {
  await page.addInitScript((projectId) => {
    localStorage.setItem('hasSeenHelpModal', 'true')
    localStorage.setItem('currentProjectId', projectId)
  }, PROJECT_ID)

  await page.route('**/api/access-code/check', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { enabled: false } }),
    })
  )

  await page.route('**/api/user-templates', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { templates: [] } }),
    })
  )

  await page.route(`**/api/projects/${PROJECT_ID}/pages/${PAGE_ID}/image-versions`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { versions: [] } }),
    })
  )

  await page.route(`**/api/projects/${PROJECT_ID}`, (route) => {
    if (route.request().method() !== 'GET') {
      return route.fallback()
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PROJECT_RESPONSE),
    })
  })

  await page.route('**/files/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      ),
    })
  )
}

test.describe('Single-page regenerate', () => {
  test('preview regenerate button uses the single-page endpoint instead of batch generation', async ({ page }) => {
    await mockCommonRoutes(page)

    let batchGenerateCalled = false
    let singleGenerateCalled = false

    await page.route(`**/api/projects/${PROJECT_ID}/generate/images`, async (route) => {
      batchGenerateCalled = true
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { task_id: 'batch-task' } }),
      })
    })

    await page.route(`**/api/projects/${PROJECT_ID}/pages/${PAGE_ID}/generate/image`, async (route) => {
      singleGenerateCalled = true
      const payload = route.request().postDataJSON()
      expect(payload.force_regenerate).toBe(true)

      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { task_id: 'single-task', page_id: PAGE_ID, status: 'PENDING' },
        }),
      })
    })

    await page.route(`**/api/projects/${PROJECT_ID}/tasks/single-task`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            task_id: 'single-task',
            status: 'PROCESSING',
            progress: { total: 1, completed: 0, failed: 0 },
          },
        }),
      })
    })

    await page.goto(`/project/${PROJECT_ID}/preview`)
    await expect(page.getByRole('button', { name: /重新生成|Regenerate/i })).toBeVisible()

    await page.getByRole('button', { name: /重新生成|Regenerate/i }).click()

    await expect
      .poll(() => ({ batchGenerateCalled, singleGenerateCalled }))
      .toEqual({ batchGenerateCalled: false, singleGenerateCalled: true })
  })
})
