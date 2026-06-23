/**
 * E2E: Template mode switching (Decision 7).
 *
 * - multi -> single: pick a unifier template in the dialog; ALL pages adopt it,
 *   the change persists across reload, and already-generated page images are
 *   left untouched.
 * - single -> multi: flips the project to multi mode and reveals the
 *   template-setup entry in the SlidePreview header.
 */
import { test, expect } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'
import {
  uploadAsset,
  bindPage,
  getProject,
} from './helpers/seed-template-project'

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

test('multi -> single unifies all pages, keeps generated images, persists', async ({ page }) => {
  // Two pages each with a real generated image, two distinct templates.
  const { projectId, pageIds } = await seedProjectWithImages(BACKEND_URL, 2)
  await setMultiMode(projectId)
  const { assetId: assetA } = await uploadAsset(BACKEND_URL, projectId, { label: 'Tpl A' })
  const { assetId: assetB } = await uploadAsset(BACKEND_URL, projectId, { label: 'Tpl B' })
  await bindPage(BACKEND_URL, projectId, pageIds[0], assetA)
  await bindPage(BACKEND_URL, projectId, pageIds[1], assetB)

  await page.goto(`${BASE_URL}/project/${projectId}/preview`)
  await page.waitForLoadState('networkidle')

  // Open the switch-to-single dialog from the header.
  await page.getByRole('button', { name: /转为单模板|Switch to single/ }).click()

  // Dialog lists templates; pick "Tpl A" then confirm.
  await page.getByAltText('Tpl A').click()
  await page.getByRole('button', { name: /确认转换|Confirm switch/ }).click()

  // Backend: all pages now reference assetA, mode is single, images intact.
  await expect.poll(async () => {
    const proj = await getProject(BACKEND_URL, projectId)
    return proj.template_mode
  }).toBe('single')

  const proj = await getProject(BACKEND_URL, projectId)
  for (const pid of pageIds) {
    const pg = proj.pages.find((p: any) => p.page_id === pid)
    expect(pg.template_asset_id).toBe(assetA)
    // Decision 7: switching does not wipe already-generated images.
    expect(pg.generated_image_url).toBeTruthy()
    expect(pg.status).toBe('COMPLETED')
  }

  // UI now reflects single mode: the "switch to multi" entry is present.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: /转为多模板|Switch to multi/ })).toBeVisible()
})

test('single -> multi flips mode and reveals template-setup entry', async ({ page }) => {
  const { projectId } = await seedProjectWithImages(BACKEND_URL, 1)

  await page.goto(`${BASE_URL}/project/${projectId}/preview`)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: /转为多模板|Switch to multi/ }).click()

  await expect.poll(async () => {
    const proj = await getProject(BACKEND_URL, projectId)
    return proj.template_mode
  }).toBe('multi')

  // Multi-mode header exposes the template-setup link.
  await expect(page.getByRole('button', { name: /模板配置|Template Setup/ })).toBeVisible()
})
