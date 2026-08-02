/**
 * E2E: PDF → per-page template assets (spec §8.3).
 *
 * Upload a 3-page PDF to a multi-mode project. The SPLIT_TEMPLATE_PDF task must
 * render 3 page images into 3 ProjectTemplateAsset rows, each of which then
 * fires a real ANALYZE_TEMPLATE task that advances analysis_status to
 * "completed". Finally the TemplateSetupPage library shows the 3 thumbnails.
 *
 * The analysis step hits the real LLM (CLAUDE.md mandates a real run), so the
 * timeouts are generous.
 */
import { test, expect } from '@playwright/test'
import {
  createProject,
  uploadPdf,
  listAssets,
  pollTask,
} from './helpers/seed-template-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const BACKEND_URL = BASE_URL.replace(/:\d+$/, (m) => `:${parseInt(m.slice(1)) + 2000}`)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
})

test('uploading a 3-page PDF yields 3 analyzed template assets', async ({ page }) => {
  test.setTimeout(300000)

  const projectId = await createProject(BACKEND_URL, { multi: true })

  // Split: deterministic, no AI.
  const splitTaskId = await uploadPdf(BACKEND_URL, projectId, 'test-3-page.pdf')
  const splitTask = await pollTask(BACKEND_URL, projectId, splitTaskId, { timeoutMs: 120000 })
  expect(splitTask.status).toBe('COMPLETED')

  // Library now holds exactly 3 assets.
  const assets = await listAssets(BACKEND_URL, projectId)
  expect(assets).toHaveLength(3)

  // Each asset's analysis must advance off "pending" to "completed" (real LLM).
  await expect
    .poll(
      async () => {
        const a = await listAssets(BACKEND_URL, projectId)
        return a.map((x: any) => x.analysis_status).sort()
      },
      { timeout: 240000, intervals: [3000] }
    )
    .toEqual(['completed', 'completed', 'completed'])

  // The setup page library renders all 3 thumbnails.
  await page.goto(`${BASE_URL}/project/${projectId}/template-setup`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/模板配置|Template Setup/)).toBeVisible()
  await expect.poll(async () => await page.locator('img[alt]').count()).toBeGreaterThanOrEqual(3)
})
