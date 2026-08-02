/**
 * E2E: Template route guard (Decision 6).
 *
 * Single-mode projects must NOT be able to sit on /template-setup — the page
 * redirects (replace) to /preview, and the redirect must not leave a
 * template-setup entry in browser history. Multi-mode projects render the
 * template-setup page normally.
 */
import { test, expect } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'
import { createProject, addPage } from './helpers/seed-template-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const BACKEND_URL = BASE_URL.replace(/:\d+$/, (m) => `:${parseInt(m.slice(1)) + 2000}`)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
})

test('single-mode project redirects template-setup -> preview (replace)', async ({ page }) => {
  const { projectId } = await seedProjectWithImages(BACKEND_URL, 1)

  // Land on preview first so there is a real prior history entry.
  await page.goto(`${BASE_URL}/project/${projectId}/preview`)
  await page.waitForLoadState('networkidle')

  await page.goto(`${BASE_URL}/project/${projectId}/template-setup`)
  await page.waitForURL(`**/project/${projectId}/preview`)
  expect(page.url()).toContain('/preview')
  expect(page.url()).not.toContain('/template-setup')

  // The redirect used { replace: true }: going back must not resurface
  // template-setup.
  await page.goBack()
  expect(page.url()).not.toContain('/template-setup')
})

test('multi-mode project renders template-setup without redirect', async ({ page }) => {
  const projectId = await createProject(BACKEND_URL, { multi: true })
  await addPage(BACKEND_URL, projectId, 0, { title: 'Cover' })

  await page.goto(`${BASE_URL}/project/${projectId}/template-setup`)
  await page.waitForLoadState('networkidle')

  expect(page.url()).toContain('/template-setup')
  await expect(page.getByText(/模板配置|Template Setup/)).toBeVisible()
})
