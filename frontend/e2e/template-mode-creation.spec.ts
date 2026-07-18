/**
 * E2E: Template-mode creation flow (spec §8.3, two layers per CLAUDE.md).
 *
 * Mock layer — drive the real Home UI with a mocked backend and assert the
 * creation flow's mode wiring:
 *   - multi-mode toggle ON  -> after "Next", a PATCH /template-mode {mode:multi}
 *     fires (Home flips the freshly-created project to multi).
 *   - multi-mode toggle OFF -> no /template-mode PATCH (project stays single).
 *
 * Integration layer — hit the REAL backend and assert per-page binding data
 * survives a reload:
 *   - single: one template bound to every page; all pages share that asset.
 *   - multi:  two pages bound to two distinct templates; bindings persist after
 *     reload (spec §8.3 "刷新后绑定仍在").
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

// ---------------------------------------------------------------------------
// Mock layer
// ---------------------------------------------------------------------------

async function stubHomeBackend(page: any, modeCalls: string[]) {
  const PROJECT_ID = 'mock-proj-1'

  await page.route('**/api/access-code/check', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { required: false, enabled: false } }),
    })
  )
  await page.route('**/api/settings', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  )
  await page.route('**/api/user-templates', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { templates: [] } }),
    })
  )

  await page.route('**/api/projects', (route: any) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { project_id: PROJECT_ID } }),
      })
    }
    return route.continue()
  })

  // Full project fetch (single-mode shell) used by Home + OutlineEditor.
  await page.route(`**/api/projects/${PROJECT_ID}`, (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          project_id: PROJECT_ID,
          template_mode: 'single',
          status: 'CREATED',
          pages: [],
        },
      }),
    })
  )

  // Capture the mode-switch PATCH the Home flow fires for multi mode.
  await page.route(`**/api/projects/${PROJECT_ID}/template-mode`, (route: any) => {
    const body = route.request().postDataJSON?.() || {}
    modeCalls.push(body.mode)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { template_mode: body.mode } }),
    })
  })

  // Swallow any outline-generation traffic the destination page may kick off.
  await page.route('**/generate-outline**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
  )
}

test('mock: multi-mode toggle flips the new project to multi after Next', async ({ page }) => {
  const modeCalls: string[] = []
  await stubHomeBackend(page, modeCalls)

  await page.goto(BASE_URL)
  await page.getByRole('textbox').first().fill('一份关于多模板创建的演示')

  // Enable multi-template mode.
  await page.getByText(/多模板模式|Multi-template mode/).click()

  await page.getByRole('button', { name: /下一步|Next/ }).click()

  // Home must PATCH the project to multi mode before leaving.
  await expect.poll(() => modeCalls).toContain('multi')
})

test('mock: single-mode creation never PATCHes template-mode', async ({ page }) => {
  const modeCalls: string[] = []
  await stubHomeBackend(page, modeCalls)

  await page.goto(BASE_URL)
  await page.getByRole('textbox').first().fill('一份关于单模板创建的演示')

  // Leave the multi toggle OFF.
  await page.getByRole('button', { name: /下一步|Next/ }).click()

  // Allow navigation to settle, then assert no mode switch happened.
  await page.waitForURL(`**/project/mock-proj-1/**`)
  expect(modeCalls).toEqual([])
})

// ---------------------------------------------------------------------------
// Integration layer (real backend)
// ---------------------------------------------------------------------------

test('integration: single-mode pages all share one template', async ({ page }) => {
  const projectId = await createProject(BACKEND_URL, { multi: false })
  const p1 = await addPage(BACKEND_URL, projectId, 0, { title: 'Cover' })
  const p2 = await addPage(BACKEND_URL, projectId, 1, { title: 'Body' })
  const { assetId } = await uploadAsset(BACKEND_URL, projectId, { label: 'Unified' })
  await bindPage(BACKEND_URL, projectId, p1, assetId)
  await bindPage(BACKEND_URL, projectId, p2, assetId)

  await page.goto(`${BASE_URL}/project/${projectId}/preview`)
  await page.waitForLoadState('networkidle')
  await page.reload()
  await page.waitForLoadState('networkidle')

  const proj = await getProject(BACKEND_URL, projectId)
  expect(proj.template_mode).toBe('single')
  for (const pid of [p1, p2]) {
    const pg = proj.pages.find((p: any) => p.page_id === pid)
    expect(pg.template_asset_id).toBe(assetId)
  }
})

test('integration: multi-mode per-page bindings persist across reload', async ({ page }) => {
  const projectId = await createProject(BACKEND_URL, { multi: true })
  const p1 = await addPage(BACKEND_URL, projectId, 0, { title: 'Cover', description: 'cover desc' })
  const p2 = await addPage(BACKEND_URL, projectId, 1, { title: 'Body', description: 'body desc' })
  const { assetId: assetA } = await uploadAsset(BACKEND_URL, projectId, { label: 'Tpl A' })
  const { assetId: assetB } = await uploadAsset(BACKEND_URL, projectId, { label: 'Tpl B' })
  await bindPage(BACKEND_URL, projectId, p1, assetA)
  await bindPage(BACKEND_URL, projectId, p2, assetB)

  await page.goto(`${BASE_URL}/project/${projectId}/template-setup`)
  await page.waitForLoadState('networkidle')

  // No unconfirmed placeholders: both pages are bound.
  await expect(page.getByText(/未确认|Unconfirmed/)).toHaveCount(0)

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/未确认|Unconfirmed/)).toHaveCount(0)

  // Backend kept the two distinct bindings.
  const proj = await getProject(BACKEND_URL, projectId)
  expect(proj.template_mode).toBe('multi')
  const pg1 = proj.pages.find((p: any) => p.page_id === p1)
  const pg2 = proj.pages.find((p: any) => p.page_id === p2)
  expect(pg1.template_asset_id).toBe(assetA)
  expect(pg2.template_asset_id).toBe(assetB)
  expect(pg1.template_asset_id).not.toBe(pg2.template_asset_id)
})
