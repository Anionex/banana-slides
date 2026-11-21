/**
 * E2E regression: OutlineEditor must not crash when a page's outline_content
 * exists but omits `points`.
 *
 * Real backend, no mocks. A page created with outline_content = { title } (no
 * `points` array) used to crash <OutlineCard> at render with
 * "Cannot read properties of undefined (reading 'join')", leaving a blank
 * page. OutlineCard now normalizes points to [].
 */
import { test, expect } from '@playwright/test'
import { createProject } from './helpers/seed-template-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const BACKEND_URL = BASE_URL.replace(/:\d+$/, (m) => `:${parseInt(m.slice(1)) + 2000}`)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
})

test('outline page renders when a page has no points field', async ({ page }) => {
  const projectId = await createProject(BACKEND_URL)

  // Create a page with outline_content lacking `points` (legacy/partial shape).
  const resp = await fetch(`${BACKEND_URL}/api/projects/${projectId}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_index: 0, outline_content: { title: 'Pointless Cover' } }),
  })
  expect(resp.status).toBeLessThan(300)

  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.goto(`${BASE_URL}/project/${projectId}/outline`)
  await page.waitForLoadState('networkidle')

  // The card must render its title (proves no blank-screen crash).
  await expect(page.getByText('Pointless Cover')).toBeVisible()
  expect(pageErrors, `unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([])
})
