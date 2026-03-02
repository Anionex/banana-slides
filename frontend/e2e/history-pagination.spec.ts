/**
 * E2E tests for history page pagination.
 *
 * Mock tests: verify pagination UI renders correctly, page navigation works,
 * and correct API params are sent.
 *
 * Integration test: create enough projects to span multiple pages,
 * verify pagination controls appear and navigate correctly.
 */
import { test, expect } from '@playwright/test'

const PAGE_SIZE = 5

function makeProject(index: number) {
  const id = `proj-${String(index).padStart(3, '0')}`
  const label = `P-${String(index).padStart(2, '0')}`
  return {
    id,
    project_id: id,
    idea_prompt: label,
    status: 'DRAFT',
    created_at: new Date(Date.now() - index * 60000).toISOString(),
    updated_at: new Date(Date.now() - index * 60000).toISOString(),
    pages: [
      {
        id: `page-${id}`,
        page_id: `page-${id}`,
        title: label,
        order_index: 0,
        status: 'DRAFT',
        outline_content: { title: label, points: [] },
      },
    ],
  }
}

async function setupMockRoutes(
  page: import('@playwright/test').Page,
  totalProjects: number
) {
  // Mock access code check
  await page.route('**/api/access-code/check', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { enabled: false } }),
    })
  })

  // Mock projects list API — handles both with and without query string
  await page.route('**/api/projects**', async (route) => {
    const req = route.request()
    if (req.method() !== 'GET' || req.url().includes('/api/projects/')) {
      await route.fallback()
      return
    }

    const url = new URL(req.url())
    const limit = parseInt(url.searchParams.get('limit') || String(PAGE_SIZE))
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const allProjects = Array.from({ length: totalProjects }, (_, i) =>
      makeProject(i + 1)
    )
    const sliced = allProjects.slice(offset, offset + limit)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          projects: sliced,
          total: totalProjects,
          limit,
          offset,
        },
      }),
    })
  })
}

// ───────────────── Mock tests ─────────────────

test.describe('History pagination — mock', () => {
  test('should not show pagination when projects fit on one page', async ({
    page,
  }) => {
    await setupMockRoutes(page, 3) // 3 < PAGE_SIZE, no pagination
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()
    await expect(page.locator('nav[aria-label="Pagination"]')).not.toBeVisible()
  })

  test('should show pagination when projects exceed one page', async ({
    page,
  }) => {
    await setupMockRoutes(page, 12) // 3 pages: 5 + 5 + 2
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()
    const pagination = page.locator('nav[aria-label="Pagination"]')
    await expect(pagination).toBeVisible()
    await expect(
      pagination.locator('button[aria-current="page"]')
    ).toHaveText('1')
    await expect(pagination.locator('button:text-is("3")')).toBeVisible()
  })

  test('should navigate to next page and load correct projects', async ({
    page,
  }) => {
    await setupMockRoutes(page, 12)
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()

    const pagination = page.locator('nav[aria-label="Pagination"]')
    await pagination.locator('button:text-is("2")').click()

    // Page 2: P-06 to P-10
    await expect(page.getByRole('heading', { name: 'P-06', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).not.toBeVisible()
    await expect(
      pagination.locator('button[aria-current="page"]')
    ).toHaveText('2')
  })

  test('should navigate to last page with fewer items', async ({ page }) => {
    await setupMockRoutes(page, 12) // last page has 2 items (P-11, P-12)
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()

    const pagination = page.locator('nav[aria-label="Pagination"]')
    await pagination.locator('button:text-is("3")').click()

    await expect(page.getByRole('heading', { name: 'P-11', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'P-12', exact: true })).toBeVisible()
    await expect(
      pagination.locator('button[aria-current="page"]')
    ).toHaveText('3')
  })

  test('previous/next buttons should work correctly', async ({ page }) => {
    await setupMockRoutes(page, 15) // 3 pages
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()

    const pagination = page.locator('nav[aria-label="Pagination"]')
    const prevButton = pagination.locator('button[aria-label="Previous page"]')
    const nextButton = pagination.locator('button[aria-label="Next page"]')

    await expect(prevButton).toBeDisabled()

    await nextButton.click()
    await expect(page.getByRole('heading', { name: 'P-06', exact: true })).toBeVisible()

    await expect(prevButton).not.toBeDisabled()

    await prevButton.click()
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()
  })

  test('should send correct limit and offset params in API request', async ({
    page,
  }) => {
    const requests: string[] = []
    await setupMockRoutes(page, 12)

    page.on('request', (req) => {
      if (req.url().includes('/api/projects')) {
        requests.push(req.url())
      }
    })

    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()

    const firstReq = requests.find((r) => r.includes('limit='))
    expect(firstReq).toContain('limit=5')
    expect(firstReq).toContain('offset=0')

    requests.length = 0
    const pagination = page.locator('nav[aria-label="Pagination"]')
    await pagination.locator('button:text-is("2")').click()
    await expect(page.getByRole('heading', { name: 'P-06', exact: true })).toBeVisible()

    const secondReq = requests.find((r) => r.includes('limit='))
    expect(secondReq).toContain('limit=5')
    expect(secondReq).toContain('offset=5')
  })
})

// ───────────────── Integration test ─────────────────

test.describe('History pagination — integration', () => {
  const frontendUrl = process.env.BASE_URL || 'http://localhost:3000'
  const frontendPort = parseInt(new URL(frontendUrl).port || '3000')
  const BACKEND_URL = `http://localhost:${frontendPort + 2000}`

  async function createSimpleProject(index: number): Promise<string> {
    const resp = await fetch(`${BACKEND_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_type: 'idea', idea_prompt: `PagTest-${String(index).padStart(2, '0')}` }),
    })
    const json = await resp.json()
    return json.data?.project_id
  }

  async function deleteProject(projectId: string) {
    await fetch(`${BACKEND_URL}/api/projects/${projectId}`, { method: 'DELETE' })
  }

  test('pagination works with real backend data', async ({ page }) => {
    // Create 8 projects (enough for 2 pages with PAGE_SIZE=5)
    const projectIds: string[] = []
    for (let i = 0; i < 8; i++) {
      const id = await createSimpleProject(i + 1)
      if (id) projectIds.push(id)
    }
    expect(projectIds.length).toBe(8)

    try {
      await page.goto('/history')
      await page.waitForLoadState('networkidle')

      await expect(page.locator('text=/历史项目|Project History/')).toBeVisible({ timeout: 10000 })

      const pagination = page.locator('nav[aria-label="Pagination"]')
      await expect(pagination).toBeVisible({ timeout: 10000 })

      await expect(
        pagination.locator('button[aria-current="page"]')
      ).toHaveText('1')

      await pagination.locator('button:text-is("2")').click()
      await page.waitForLoadState('networkidle')

      await expect(
        pagination.locator('button[aria-current="page"]')
      ).toHaveText('2')
    } finally {
      await Promise.all(projectIds.map(id => deleteProject(id)))
    }
  })
})
