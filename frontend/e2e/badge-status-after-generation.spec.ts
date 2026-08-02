import { test, expect, Page, Route } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

const PROJECT_ID = 'badge-race-mock'
const PAGE_IDS = ['p-1', 'p-2', 'p-3']

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

test.describe('Badge status after image generation (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
  })

  test('all badges show COMPLETED when project pages are COMPLETED', async ({ page }) => {
    await mockCommonRoutes(page)

    const completedPages = PAGE_IDS.map((id, i) => makePage(id, i, 'COMPLETED', true))
    await page.route(`**/api/projects/${PROJECT_ID}`, (r) => {
      if (r.request().method() === 'GET') {
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projectJson(completedPages)) })
      }
      return r.continue()
    })

    await page.goto(`/project/${PROJECT_ID}/preview`)
    const badges = page.locator('[data-testid="status-badge"]')
    await expect(badges.first()).toBeVisible({ timeout: 10000 })

    const count = await badges.count()
    expect(count).toBe(3)
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toHaveAttribute('data-status', 'COMPLETED')
    }
  })

  test('badges transition from GENERATING to COMPLETED after sync', async ({ page }) => {
    await mockCommonRoutes(page)

    // Phase 1: pages are GENERATING
    let phase: 'generating' | 'completed' = 'generating'

    await page.route(`**/api/projects/${PROJECT_ID}`, (r) => {
      if (r.request().method() !== 'GET') return r.continue()
      if (phase === 'generating') {
        const pages = PAGE_IDS.map((id, i) => makePage(id, i, 'GENERATING', false))
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projectJson(pages, 'GENERATING_IMAGES')) })
      }
      const pages = PAGE_IDS.map((id, i) => makePage(id, i, 'COMPLETED', true))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projectJson(pages)) })
    })

    await page.goto(`/project/${PROJECT_ID}/preview`)
    const badges = page.locator('[data-testid="status-badge"]')
    await expect(badges.first()).toBeVisible({ timeout: 10000 })

    // Verify initial state: GENERATING
    for (let i = 0; i < 3; i++) {
      await expect(badges.nth(i)).toHaveAttribute('data-status', 'GENERATING')
    }

    // Switch to completed phase and trigger a re-sync via navigation
    phase = 'completed'
    await page.evaluate(() => location.reload())

    // Verify final state: COMPLETED
    await expect(badges.first()).toBeVisible({ timeout: 10000 })
    for (let i = 0; i < 3; i++) {
      await expect(badges.nth(i)).toHaveAttribute('data-status', 'COMPLETED')
    }
  })
})

// ─── Integration test (real backend) ───

test.describe('Badge status (integration)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
  })

  test('seeded project shows COMPLETED badges on preview page', async ({ page, baseURL }) => {
    const { projectId } = await seedProjectWithImages(baseURL!, 3)

    await page.goto(`/project/${projectId}/preview`)
    const badges = page.locator('[data-testid="status-badge"]')
    await expect(badges.first()).toBeVisible({ timeout: 10000 })

    const count = await badges.count()
    expect(count).toBe(3)
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toHaveAttribute('data-status', 'COMPLETED')
    }
  })
})
