import { test, expect } from '@playwright/test'

type ProjectPayload = Record<string, any>

const projects: Record<string, ProjectPayload> = {}

const ssePage = (page: { index: number; title: string; points: string[]; description_text?: string; extra_fields?: Record<string, string> }) =>
  `event: page\ndata: ${JSON.stringify(page)}\n\n`

const sseDone = (projectId: string, pages: any[]) =>
  `event: done\ndata: ${JSON.stringify({
    total: pages.length,
    complete: true,
    pages: pages.map((page, index) => ({
      id: `page-${index + 1}`,
      page_id: `page-${index + 1}`,
      order_index: index,
      outline_content: { title: page.title, points: page.points },
      description_content: page.description_text
        ? { text: page.description_text, ...(page.extra_fields ? { extra_fields: page.extra_fields } : {}) }
        : undefined,
      status: page.description_text ? 'DESCRIPTION_GENERATED' : 'DRAFT',
      project_id: projectId,
    })),
  })}\n\n`

async function setupHomeSseMocks(page: import('@playwright/test').Page) {
  for (const key of Object.keys(projects)) delete projects[key]

  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))

  await page.route('**/api/user-templates', route =>
    route.fulfill({ json: { success: true, data: { templates: [] } } })
  )
  await page.route('**/api/settings', route =>
    route.fulfill({ json: { success: true, data: {} } })
  )
  await page.route('**/api/output-language', route =>
    route.fulfill({ json: { success: true, data: { language: 'zh' } } })
  )

  await page.route('**/api/projects', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }

    const payload = route.request().postDataJSON()
    const projectId = `project-${Object.keys(projects).length + 1}`
    projects[projectId] = {
      id: projectId,
      project_id: projectId,
      creation_type: payload.creation_type,
      idea_prompt: payload.idea_prompt || '',
      outline_text: payload.outline_text,
      description_text: payload.description_text,
      status: 'DRAFT',
      pages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await route.fulfill({
      status: 201,
      json: { success: true, data: { project_id: projectId, status: 'DRAFT', pages: [] } },
    })
  })

  await page.route((url) => /^\/api\/projects\/project-\d+$/.test(new URL(url).pathname), async (route) => {
    const url = new URL(route.request().url())
    const parts = url.pathname.split('/')
    const projectId = parts[3]

    if (route.request().method() === 'GET' && projects[projectId]) {
      await route.fulfill({ json: { success: true, data: projects[projectId] } })
      return
    }

    await route.continue()
  })
}

test.describe('Home outline SSE handoff', () => {
  test.beforeEach(async ({ page }) => {
    await setupHomeSseMocks(page)
  })

  test('from outline navigates to outline editor and streams skeleton instead of calling sync generation', async ({ page }) => {
    let streamCalled = false
    let syncCalled = false

    await page.route('**/api/projects/*/generate/outline/stream', async (route) => {
      streamCalled = true
      const projectId = new URL(route.request().url()).pathname.split('/')[3]
      const pages = [{ index: 0, title: 'SSE 大纲页', points: ['进入大纲页后生成'] }]

      await new Promise(resolve => setTimeout(resolve, 300))
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ssePage(pages[0]) + sseDone(projectId, pages),
      })
    })

    await page.route('**/api/projects/*/generate/outline', async (route) => {
      syncCalled = true
      await route.abort()
    })

    await page.goto('/')
    await page.getByRole('button', { name: /从大纲生成|From Outline/ }).click()
    await page.getByRole('textbox').fill('第一页\n- 进入大纲页后生成')
    await page.getByRole('button', { name: /下一步|Next/ }).click()

    await expect(page).toHaveURL(/\/project\/project-1\/outline/)
    await expect(page.locator('.animate-pulse').first()).toBeVisible()
    await expect(page.getByText('SSE 大纲页')).toBeVisible({ timeout: 5000 })
    expect(streamCalled).toBe(true)
    expect(syncCalled).toBe(false)
  })

  test('from description streams outline and bound page description on the outline editor', async ({ page }) => {
    let streamCalled = false
    let syncDescriptionCalled = false

    await page.route('**/api/projects/*/generate/outline/stream', async (route) => {
      streamCalled = true
      const projectId = new URL(route.request().url()).pathname.split('/')[3]
      const pages = [{
        index: 0,
        title: '描述拆分页',
        points: ['同一页的大纲'],
        description_text: '--- 页面文字 ---\n- 同一页的描述\n\n--- 页面文字结束 ---',
        extra_fields: { '视觉元素': '关键指标卡片' },
      }]

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ssePage(pages[0]) + sseDone(projectId, pages),
      })
    })

    await page.route('**/api/projects/*/generate/from-description', async (route) => {
      syncDescriptionCalled = true
      await route.abort()
    })

    await page.goto('/')
    await page.getByRole('button', { name: /从描述生成|From Description/ }).click()
    await page.getByRole('textbox').fill('第一页：同一页的大纲和描述')
    await page.getByRole('button', { name: /下一步|Next/ }).click()

    await expect(page).toHaveURL(/\/project\/project-1\/outline/)
    await expect(page.getByText('描述拆分页')).toBeVisible({ timeout: 5000 })
    expect(streamCalled).toBe(true)
    expect(syncDescriptionCalled).toBe(false)
  })
})
