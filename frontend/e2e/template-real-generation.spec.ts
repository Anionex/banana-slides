/**
 * E2E: real per-page generation chain (spec §8.4, CLAUDE.md mandates real AI).
 *
 * End to end with NO mocks:
 *   1. 3-page multi-mode project, each page described.
 *   2. Upload 2 templates -> real ANALYZE_TEMPLATE for each.
 *   3. One-click auto-match -> real AUTO_MATCH_TEMPLATES (LLM).
 *   4. Ensure every page is bound (auto match may leave some undecided; fill
 *      those manually) so each page generates against a per-page template.
 *   5. Generate all images -> real GENERATE_IMAGES task.
 *   6. Verify every page completed with an image, bound to a per-page template.
 *
 * Per-page style fidelity (step 5 of §8.4) is a human eyeball check; this test
 * proves the pipeline runs end to end with per-page bindings driving each
 * page's generation. The preview URLs are logged for manual inspection.
 */
import { test, expect } from '@playwright/test'
import {
  createProject,
  addPage,
  uploadAsset,
  bindPage,
  listAssets,
  autoMatchAll,
  pollTask,
  getProject,
} from './helpers/seed-template-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const BACKEND_URL = BASE_URL.replace(/:\d+$/, (m) => `:${parseInt(m.slice(1)) + 2000}`)

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
})

test('multi-mode project generates every page from its bound template', async ({ page }) => {
  test.setTimeout(900000) // real analyze + match + image gen

  // 1. 3 described pages, multi mode.
  const projectId = await createProject(BACKEND_URL, { multi: true })
  const pageIds = [
    await addPage(BACKEND_URL, projectId, 0, { title: 'Cover', description: 'A bold cover slide introducing an AI product, big title, minimal text.' }),
    await addPage(BACKEND_URL, projectId, 1, { title: 'Data', description: 'A data-heavy slide with charts and a comparison table of metrics.' }),
    await addPage(BACKEND_URL, projectId, 2, { title: 'Closing', description: 'A clean closing slide with a thank-you and contact line.' }),
  ]

  // 2. Two templates, real analysis.
  const { assetId: assetA } = await uploadAsset(BACKEND_URL, projectId, { fixture: 'slide_1.jpg', label: 'Tpl A' })
  await uploadAsset(BACKEND_URL, projectId, { fixture: 'slide_2.jpg', label: 'Tpl B' })
  await expect
    .poll(
      async () => (await listAssets(BACKEND_URL, projectId)).map((x: any) => x.analysis_status).sort(),
      { timeout: 240000, intervals: [3000] }
    )
    .toEqual(['completed', 'completed'])

  // 3. Real auto-match.
  const matchTaskId = await autoMatchAll(BACKEND_URL, projectId)
  const matchTask = await pollTask(BACKEND_URL, projectId, matchTaskId, { timeoutMs: 180000 })
  expect(matchTask.status).toBe('COMPLETED')

  // 4. Every page must end up bound. Fill any undecided page manually.
  let proj = await getProject(BACKEND_URL, projectId)
  for (const pid of pageIds) {
    const pg = proj.pages.find((p: any) => p.page_id === pid)
    if (!pg.template_asset_id) {
      await bindPage(BACKEND_URL, projectId, pid, assetA)
    }
  }
  proj = await getProject(BACKEND_URL, projectId)
  for (const pid of pageIds) {
    const pg = proj.pages.find((p: any) => p.page_id === pid)
    expect(pg.template_asset_id).toBeTruthy()
  }

  // 5. Real image generation for all pages.
  const genResp = await fetch(`${BACKEND_URL}/api/projects/${projectId}/generate/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ use_template: true, language: 'zh' }),
  })
  const genJson = await genResp.json()
  expect(genResp.status, JSON.stringify(genJson)).toBeLessThan(300)
  const genTaskId = genJson.data?.task_id || genJson.data?.id
  expect(genTaskId).toBeTruthy()
  const genTask = await pollTask(BACKEND_URL, projectId, genTaskId, { timeoutMs: 600000, intervalMs: 4000 })
  expect(genTask.status).toBe('COMPLETED')

  // 6. Every page completed with an image, still bound to a per-page template.
  const finalProj = await getProject(BACKEND_URL, projectId)
  for (const pid of pageIds) {
    const pg = finalProj.pages.find((p: any) => p.page_id === pid)
    expect(pg.status).toBe('COMPLETED')
    expect(pg.generated_image_url).toBeTruthy()
    expect(pg.template_asset_id).toBeTruthy()
  }

  // Preview renders the generated images; log the URL for manual fidelity check.
  await page.goto(`${BASE_URL}/project/${projectId}/preview`)
  await page.waitForLoadState('networkidle')
  await expect.poll(async () => await page.locator('img').count()).toBeGreaterThanOrEqual(3)
  console.log(`[G-7] Manual style check: ${BASE_URL}/project/${projectId}/preview`)
})
