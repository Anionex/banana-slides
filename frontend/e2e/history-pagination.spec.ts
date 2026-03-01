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

function makeProject(index: number) {
  const id = `proj-${String(index).padStart(3, '0')}`
  // Use padded numbering so text matching stays unambiguous (P-01, P-02 … P-32)
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
    // Only intercept GET requests for project listing
    if (req.method() !== 'GET' || req.url().includes('/api/projects/')) {
      await route.fallback()
      return
    }

    const url = new URL(req.url())
    const limit = parseInt(url.searchParams.get('limit') || '15')
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
    await setupMockRoutes(page, 5)
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()
    // Pagination nav should not be present
    await expect(page.locator('nav[aria-label="Pagination"]')).not.toBeVisible()
  })

  test('should show pagination when projects exceed one page', async ({
    page,
  }) => {
    await setupMockRoutes(page, 32) // 3 pages: 15 + 15 + 2
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()
    // Pagination should be visible
    const pagination = page.locator('nav[aria-label="Pagination"]')
    await expect(pagination).toBeVisible()
    // Should show page 1 as active
    await expect(
      pagination.locator('button[aria-current="page"]')
    ).toHaveText('1')
    // Should show page 3
    await expect(pagination.locator('button:text-is("3")')).toBeVisible()
  })

  test('should navigate to next page and load correct projects', async ({
    page,
  }) => {
    await setupMockRoutes(page, 32)
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()

    // Click page 2
    const pagination = page.locator('nav[aria-label="Pagination"]')
    await pagination.locator('button:text-is("2")').click()

    // Should now show projects from page 2 (P-16 to P-30)
    await expect(page.getByRole('heading', { name: 'P-16', exact: true })).toBeVisible()
    // P-01 should no longer be visible
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).not.toBeVisible()
    // Page 2 should be active
    await expect(
      pagination.locator('button[aria-current="page"]')
    ).toHaveText('2')
  })

  test('should navigate to last page with fewer items', async ({ page }) => {
    await setupMockRoutes(page, 32) // last page has 2 items
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()

    // Click page 3
    const pagination = page.locator('nav[aria-label="Pagination"]')
    await pagination.locator('button:text-is("3")').click()

    // Should show P-31 and P-32
    await expect(page.getByRole('heading', { name: 'P-31', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'P-32', exact: true })).toBeVisible()
    // Page 3 should be active
    await expect(
      pagination.locator('button[aria-current="page"]')
    ).toHaveText('3')
  })

  test('previous/next buttons should work correctly', async ({ page }) => {
    await setupMockRoutes(page, 45) // 3 pages
    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()

    const pagination = page.locator('nav[aria-label="Pagination"]')
    const prevButton = pagination.locator('button[aria-label="Previous page"]')
    const nextButton = pagination.locator('button[aria-label="Next page"]')

    // Previous should be disabled on first page
    await expect(prevButton).toBeDisabled()

    // Click next
    await nextButton.click()
    await expect(page.getByRole('heading', { name: 'P-16', exact: true })).toBeVisible()

    // Previous should now be enabled
    await expect(prevButton).not.toBeDisabled()

    // Click previous to go back
    await prevButton.click()
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()
  })

  test('should send correct limit and offset params in API request', async ({
    page,
  }) => {
    const requests: string[] = []
    await setupMockRoutes(page, 32)

    page.on('request', (req) => {
      if (req.url().includes('/api/projects')) {
        requests.push(req.url())
      }
    })

    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'P-01', exact: true })).toBeVisible()

    // First request should have limit=15&offset=0
    const firstReq = requests.find((r) => r.includes('limit='))
    expect(firstReq).toContain('limit=15')
    expect(firstReq).toContain('offset=0')

    // Navigate to page 2
    requests.length = 0
    const pagination = page.locator('nav[aria-label="Pagination"]')
    await pagination.locator('button:text-is("2")').click()
    await expect(page.getByRole('heading', { name: 'P-16', exact: true })).toBeVisible()

    // Second request should have offset=15
    const secondReq = requests.find((r) => r.includes('limit='))
    expect(secondReq).toContain('limit=15')
    expect(secondReq).toContain('offset=15')
  })
})

// ───────────────── Integration test ─────────────────

test.describe('History pagination — integration', () => {
  // Backend API URL — derive from BASE_URL (frontend port + 2000 = backend port)
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
    // Create 18 projects (enough for 2 pages with PAGE_SIZE=15)
    const projectIds: string[] = []
    for (let i = 0; i < 18; i++) {
      const id = await createSimpleProject(i + 1)
      if (id) projectIds.push(id)
    }
    expect(projectIds.length).toBe(18)

    try {
      await page.goto('/history')
      await page.waitForLoadState('networkidle')

      // Wait for the history page title to confirm we're on the right page
      await expect(page.locator('text=/历史项目|Project History/')).toBeVisible({ timeout: 10000 })

      // Pagination should be visible (18 projects > 15 per page)
      const pagination = page.locator('nav[aria-label="Pagination"]')
      await expect(pagination).toBeVisible({ timeout: 10000 })

      // Page 1 should be active
      await expect(
        pagination.locator('button[aria-current="page"]')
      ).toHaveText('1')

      // Navigate to page 2
      await pagination.locator('button:text-is("2")').click()
      await page.waitForLoadState('networkidle')

      // Page 2 should now be active
      await expect(
        pagination.locator('button[aria-current="page"]')
      ).toHaveText('2')
    } finally {
      // Cleanup: delete all created projects
      for (const id of projectIds) {
        await deleteProject(id)
      }
    }
  })
})
