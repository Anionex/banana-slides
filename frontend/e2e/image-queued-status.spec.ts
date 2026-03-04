import { test, expect, Page } from '@playwright/test'

const PROJECT_ID = 'queued-status-mock'
const PAGE_IDS = ['p-1', 'p-2', 'p-3', 'p-4']

function makePage(id: string, idx: number, status: string, hasImage: boolean) {
  return {
    page_id: id,
    order_index: idx,
    outline_content: { title: `Slide ${idx + 1}`, points: ['pt'] },
    description_content: { text: `Desc ${idx + 1}` },
    generated_image_url: hasImage ? `/files/${PROJECT_ID}/pages/${id}_v1.jpg` : null,
    status,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
  }
}

function projectJson(pages: ReturnType<typeof makePage>[], projectStatus = 'COMPLETED') {
  return {
    success: true,
    data: {
      id: PROJECT_ID,
      creation_type: 'idea',
      idea_prompt: 'test',
      status: projectStatus,
      template_style: 'default',
      image_aspect_ratio: '16:9',
      pages,
      created_at: '2026-01-01T00:00:00',
      updated_at: '2026-01-01T00:00:00',
    },
  }
}

async function mockCommonRoutes(page: Page) {
  await page.route('**/api/access-code/check', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":{"enabled":false}}' }))
  await page.route('**/api/user-templates', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":{"templates":[]}}' }))
  await page.route('**/api/projects/*/pages/*/image-versions', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":{"versions":[]}}' }))
  await page.route('**/files/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) }))
}

// ─── Mock tests ───

test.describe('QUEUED status during batch image generation (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
  })

  test('badges show QUEUED status for pages waiting in queue', async ({ page }) => {
    await mockCommonRoutes(page)

    // Mix of statuses: 1 generating, 3 queued (simulating batch generation with concurrency limit)
    const pages = [
      makePage('p-1', 0, 'GENERATING', false),
      makePage('p-2', 1, 'QUEUED', false),
      makePage('p-3', 2, 'QUEUED', false),
      makePage('p-4', 3, 'QUEUED', false),
    ]
    await page.route(`**/api/projects/${PROJECT_ID}`, (r) => {
      if (r.request().method() === 'GET') {
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projectJson(pages, 'GENERATING_IMAGES')) })
      }
      return r.continue()
    })

    await page.goto(`/project/${PROJECT_ID}/preview`)
    const badges = page.locator('[data-testid="status-badge"]')
    await expect(badges.first()).toBeVisible({ timeout: 10000 })

    // First page should be GENERATING
    await expect(badges.nth(0)).toHaveAttribute('data-status', 'GENERATING')
    // Remaining pages should be QUEUED
    for (let i = 1; i < 4; i++) {
      await expect(badges.nth(i)).toHaveAttribute('data-status', 'QUEUED')
    }
  })

  test('badges transition from QUEUED → GENERATING → COMPLETED', async ({ page }) => {
    await mockCommonRoutes(page)

    // Phase 1: all pages QUEUED
    // Phase 2: 2 generating, 2 queued
    // Phase 3: all completed
    let phase: 'queued' | 'partial' | 'completed' = 'queued'

    await page.route(`**/api/projects/${PROJECT_ID}`, (r) => {
      if (r.request().method() !== 'GET') return r.continue()
      if (phase === 'queued') {
        const pages = PAGE_IDS.map((id, i) => makePage(id, i, 'QUEUED', false))
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projectJson(pages, 'GENERATING_IMAGES')) })
      }
      if (phase === 'partial') {
        const pages = [
          makePage('p-1', 0, 'GENERATING', false),
          makePage('p-2', 1, 'GENERATING', false),
          makePage('p-3', 2, 'QUEUED', false),
          makePage('p-4', 3, 'QUEUED', false),
        ]
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projectJson(pages, 'GENERATING_IMAGES')) })
      }
      const pages = PAGE_IDS.map((id, i) => makePage(id, i, 'COMPLETED', true))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projectJson(pages)) })
    })

    await page.goto(`/project/${PROJECT_ID}/preview`)
    const badges = page.locator('[data-testid="status-badge"]')
    await expect(badges.first()).toBeVisible({ timeout: 10000 })

    // Phase 1: all QUEUED
    for (let i = 0; i < 4; i++) {
      await expect(badges.nth(i)).toHaveAttribute('data-status', 'QUEUED')
    }

    // Phase 2: partial progress
    phase = 'partial'
    await page.evaluate(() => location.reload())
    await expect(badges.first()).toBeVisible({ timeout: 10000 })
    await expect(badges.nth(0)).toHaveAttribute('data-status', 'GENERATING')
    await expect(badges.nth(1)).toHaveAttribute('data-status', 'GENERATING')
    await expect(badges.nth(2)).toHaveAttribute('data-status', 'QUEUED')
    await expect(badges.nth(3)).toHaveAttribute('data-status', 'QUEUED')

    // Phase 3: all completed
    phase = 'completed'
    await page.evaluate(() => location.reload())
    await expect(badges.first()).toBeVisible({ timeout: 10000 })
    for (let i = 0; i < 4; i++) {
      await expect(badges.nth(i)).toHaveAttribute('data-status', 'COMPLETED')
    }
  })

  test('QUEUED pages show skeleton in slide cards', async ({ page }) => {
    await mockCommonRoutes(page)

    const pages = [
      makePage('p-1', 0, 'QUEUED', false),
      makePage('p-2', 1, 'QUEUED', false),
    ]
    await page.route(`**/api/projects/${PROJECT_ID}`, (r) => {
      if (r.request().method() === 'GET') {
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projectJson(pages, 'GENERATING_IMAGES')) })
      }
      return r.continue()
    })

    await page.goto(`/project/${PROJECT_ID}/preview`)

    // Skeleton elements (animate-shimmer) should be visible for QUEUED pages
    const skeletons = page.locator('.animate-shimmer')
    await expect(skeletons.first()).toBeVisible({ timeout: 10000 })
    const count = await skeletons.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})

// ─── Integration test (real backend) ───

test.describe('QUEUED status (integration)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
  })

  test('batch generate sets pages to QUEUED status in backend', async ({ baseURL }) => {
    // Create a project with description content via API
    const createRes = await fetch(`${baseURL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea_prompt: 'QUEUED status integration test',
        creation_type: 'idea',
      }),
    })
    const createData = await createRes.json()
    const projectId = createData.data.project_id || createData.data.id

    // Add description content to pages so they can be generated
    const projectRes = await fetch(`${baseURL}/api/projects/${projectId}`)
    const projectData = await projectRes.json()
    const pages = projectData.data.pages || []

    for (const p of pages) {
      const pageId = p.page_id || p.id
      await fetch(`${baseURL}/api/projects/${projectId}/pages/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description_content: { text: `Test description for page ${pageId}` },
        }),
      })
    }

    // Trigger batch generation — this should set pages to QUEUED immediately
    // We use a template_style since we don't have a template image
    await fetch(`${baseURL}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_style: 'modern minimalist' }),
    })

    const genRes = await fetch(`${baseURL}/api/projects/${projectId}/generate/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_workers: 1 }), // Use 1 worker so most pages stay QUEUED
    })

    if (genRes.status !== 202) {
      // May fail if no AI key configured — skip gracefully
      test.skip(true, 'Image generation not available (missing API key or config)')
      return
    }

    // Immediately check page statuses — they should be QUEUED
    const checkRes = await fetch(`${baseURL}/api/projects/${projectId}`)
    const checkData = await checkRes.json()
    const checkPages = checkData.data.pages || []

    // At least some pages should be in QUEUED status
    const queuedPages = checkPages.filter((p: any) => p.status === 'QUEUED')
    const generatingPages = checkPages.filter((p: any) => p.status === 'GENERATING')

    // All pages should be either QUEUED or GENERATING (the task may have already started for 1 page)
    for (const p of checkPages) {
      expect(['QUEUED', 'GENERATING']).toContain(p.status)
    }
    // With max_workers=1, at most 1 page should be GENERATING
    expect(generatingPages.length).toBeLessThanOrEqual(1)
    // The rest should be QUEUED
    expect(queuedPages.length).toBeGreaterThanOrEqual(checkPages.length - 1)
  })
})
