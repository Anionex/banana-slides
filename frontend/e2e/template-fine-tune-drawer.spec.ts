/**
 * E2E: per-page template controls are gated by mode (spec §8.3).
 *
 * The project template library is multi-mode-only: it lives on
 * TemplateSetupPage, reachable from the SlidePreview header's "模板配置 /
 * Template Setup" entry. In single mode that entry (and the whole library
 * concept) is absent — the only template control is "转为每页独立模板 / Switch to
 * per-page". In multi mode the header exposes both the library entry and the
 * "转为统一模板 / Switch to unified" unifier.
 */
import { test, expect } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const BACKEND_URL = BASE_URL.replace(/:\d+$/, (m) => `:${parseInt(m.slice(1)) + 2000}`)

async function setMultiMode(projectId: string) {
  await fetch(`${BACKEND_URL}/api/projects/${projectId}/template-mode`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'multi' }),
  })
}

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
})

test('single mode hides the template library entry', async ({ page }) => {
  const { projectId } = await seedProjectWithImages(BACKEND_URL, 1)

  await page.goto(`${BASE_URL}/project/${projectId}/preview`)
  await page.waitForLoadState('networkidle')

  // No library access in single mode (check inside the template menu).
  await page.getByTestId('template-menu').click()
  await expect(page.getByRole('button', { name: /模板配置|Template Setup/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /转为统一模板|Switch to unified/ })).toHaveCount(0)
  // Only the upgrade entry is present.
  await expect(page.getByRole('button', { name: /转为每页独立模板|Switch to per-page/ })).toBeVisible()
})

test('multi mode exposes the full template library + unifier', async ({ page }) => {
  const { projectId } = await seedProjectWithImages(BACKEND_URL, 1)
  await setMultiMode(projectId)

  await page.goto(`${BASE_URL}/project/${projectId}/preview`)
  await page.waitForLoadState('networkidle')

  // Library entry + switch-to-single unifier both present (inside the template menu).
  await page.getByTestId('template-menu').click()
  await expect(page.getByRole('button', { name: /模板配置|Template Setup/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /转为统一模板|Switch to unified/ })).toBeVisible()
  // The single-mode upgrade entry is gone.
  await expect(page.getByRole('button', { name: /转为每页独立模板|Switch to per-page/ })).toHaveCount(0)

  // Following the library entry reaches the setup page with the library.
  await page.getByRole('button', { name: /模板配置|Template Setup/ }).click()
  await page.waitForURL(`**/project/${projectId}/template-setup`)
  await expect(page.getByText(/项目模板库|Project template library/)).toBeVisible()
})
