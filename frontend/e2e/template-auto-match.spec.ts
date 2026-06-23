/**
 * E2E: one-click auto-match (spec §8.3, real LLM).
 *
 * A multi-mode project with 3 described pages and a library of 2 analyzed
 * templates. Triggering auto-match runs a real AUTO_MATCH_TEMPLATES task that
 * must, for every page, either bind a template (status matched ->
 * template_asset_id set, selection_source 'auto') or mark it undecided
 * (template_asset_id null). Matched pages carry a reason + confidence.
 */
import { test, expect } from '@playwright/test'
import {
  createProject,
  addPage,
  uploadAsset,
  listAssets,
  autoMatchAll,
  pollTask,
  getProject,
} from './helpers/seed-template-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const BACKEND_URL = BASE_URL.replace(/:\d+$/, (m) => `:${parseInt(m.slice(1)) + 2000}`)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
})

test('auto-match assigns or marks-undecided every page with reason+confidence', async () => {
  test.setTimeout(300000)

  const projectId = await createProject(BACKEND_URL, { multi: true })
  const pageIds = [
    await addPage(BACKEND_URL, projectId, 0, { title: 'Cover', description: 'A bold title cover slide introducing the topic.' }),
    await addPage(BACKEND_URL, projectId, 1, { title: 'Data', description: 'A dense slide full of charts, tables and numbers.' }),
    await addPage(BACKEND_URL, projectId, 2, { title: 'Closing', description: 'A simple thank-you closing slide.' }),
  ]

  await uploadAsset(BACKEND_URL, projectId, { fixture: 'slide_1.jpg', label: 'Tpl A' })
  await uploadAsset(BACKEND_URL, projectId, { fixture: 'slide_2.jpg', label: 'Tpl B' })

  // Auto-match consumes analysis_json, so wait for both templates to analyze.
  await expect
    .poll(
      async () => {
        const a = await listAssets(BACKEND_URL, projectId)
        return a.map((x: any) => x.analysis_status).sort()
      },
      { timeout: 240000, intervals: [3000] }
    )
    .toEqual(['completed', 'completed'])

  // Run the real LLM match.
  const taskId = await autoMatchAll(BACKEND_URL, projectId)
  const task = await pollTask(BACKEND_URL, projectId, taskId, { timeoutMs: 180000 })
  expect(task.status).toBe('COMPLETED')

  const assetIds = (await listAssets(BACKEND_URL, projectId)).map((a: any) => a.id)
  const proj = await getProject(BACKEND_URL, projectId)

  for (const pid of pageIds) {
    const pg = proj.pages.find((p: any) => p.page_id === pid)
    expect(pg).toBeTruthy()

    if (pg.template_asset_id) {
      // Matched: bound to a real library asset via auto selection.
      expect(assetIds).toContain(pg.template_asset_id)
      expect(pg.template_selection_source).toBe('auto')
      expect(typeof pg.template_match_reason).toBe('string')
      expect(pg.template_match_reason.length).toBeGreaterThan(0)
      expect(typeof pg.template_match_confidence).toBe('number')
    } else {
      // Undecided: no binding, source stays auto with no asset.
      expect(pg.template_asset_id).toBeNull()
    }
  }

  // At least one page should have actually matched (sanity on the LLM run).
  const matchedCount = pageIds.filter((pid) => {
    const pg = proj.pages.find((p: any) => p.page_id === pid)
    return !!pg.template_asset_id
  }).length
  expect(matchedCount).toBeGreaterThan(0)
})
