/**
 * E2E: Deleting a template asset cascades to referencing pages (PRD §11).
 *
 * A multi-mode project has one template bound to 2 pages. Deleting it from the
 * TemplateSetupPage must: clear those pages back to "未确认", show a toast with
 * the affected page count, and persist the cleared state across a reload.
 */
import { test, expect } from '@playwright/test'
import {
  createProject,
  addPage,
  uploadAsset,
  bindPage,
  getProject,
} from './helpers/seed-template-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const BACKEND_URL = BASE_URL.replace(/:\d+$/, (m) => `:${parseInt(m.slice(1)) + 2000}`)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
})

test('deleting a referenced template clears its pages and persists', async ({ page }) => {
  const projectId = await createProject(BACKEND_URL, { multi: true })
  const p1 = await addPage(BACKEND_URL, projectId, 0, { title: 'Cover', description: 'cover desc' })
  const p2 = await addPage(BACKEND_URL, projectId, 1, { title: 'Body', description: 'body desc' })
  const { assetId } = await uploadAsset(BACKEND_URL, projectId, { label: 'Shared Tpl' })
  await bindPage(BACKEND_URL, projectId, p1, assetId)
  await bindPage(BACKEND_URL, projectId, p2, assetId)

  await page.goto(`${BASE_URL}/project/${projectId}/template-setup`)
  await page.waitForLoadState('networkidle')

  // Both pages bound -> no "未确认" placeholders yet.
  await expect(page.getByText(/模板配置|Template Setup/)).toBeVisible()
  await expect(page.getByText(/未确认|Unconfirmed/)).toHaveCount(0)

  // Delete the asset from the library and confirm.
  await page.getByRole('button', { name: /删除|Delete/ }).first().click()
  // Confirm dialog
  await page.getByRole('button', { name: /确定|确认|Confirm|OK/ }).last().click()

  // Toast reports the affected page count (2).
  await expect(page.getByText(/2 个页面|2 page/)).toBeVisible()

  // Both page rows now show the unconfirmed placeholder.
  await expect(page.getByText(/未确认|Unconfirmed/)).toHaveCount(2)

  // Backend persisted the cleared state.
  const proj = await getProject(BACKEND_URL, projectId)
  for (const pid of [p1, p2]) {
    const pg = proj.pages.find((p: any) => p.page_id === pid)
    expect(pg.template_asset_id).toBeNull()
    expect(pg.template_selection_source).toBeNull()
  }

  // Reload — still cleared.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/未确认|Unconfirmed/)).toHaveCount(2)
})
