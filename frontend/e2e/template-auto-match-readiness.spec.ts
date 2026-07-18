/**
 * Regression coverage for starting multi-template auto-match before its
 * inputs are ready. The production bug accepted an empty project, completed a
 * zero-page task, then refreshed the project and replaced the in-flight local
 * page descriptions with the empty backend snapshot.
 */
import { test, expect } from '@playwright/test'
import { addPage, createProject } from './helpers/seed-template-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const BACKEND_URL = BASE_URL.replace(/:\d+$/, (m) => `:${parseInt(m.slice(1)) + 2000}`)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
})

test('real backend rejects incomplete inputs and the UI explains each blocked state', async ({ page }) => {
  const projectId = await createProject(BACKEND_URL, { multi: true })

  const response = await fetch(
    `${BACKEND_URL}/api/projects/${projectId}/template-assets/auto-match`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overwrite_existing: false, preserve_non_empty: true }),
    }
  )
  const body = await response.json()

  expect(response.status).toBe(400)
  expect(body.error.code).toBe('NO_PAGES')

  await page.goto(`${BASE_URL}/project/${projectId}/template-setup`)
  await page.waitForLoadState('networkidle')

  const autoMatch = page.getByRole('button', { name: /一键自动匹配|Auto-match all/ })
  await expect(autoMatch).toBeDisabled()
  await expect(page.getByTestId('auto-match-readiness')).toContainText(
    /页面仍在生成|Pages are still being generated/
  )

  await addPage(BACKEND_URL, projectId, 0, { title: 'Description pending' })
  const missingDescriptionResponse = await fetch(
    `${BACKEND_URL}/api/projects/${projectId}/template-assets/auto-match`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
  )
  expect(missingDescriptionResponse.status).toBe(400)
  expect((await missingDescriptionResponse.json()).error.code).toBe('MISSING_DESCRIPTIONS')

  await page.reload()
  await expect(autoMatch).toBeDisabled()
  await expect(page.getByTestId('auto-match-readiness')).toContainText(
    /先完成所有页面描述|Complete every page description/
  )

  const noTemplateProjectId = await createProject(BACKEND_URL, { multi: true })
  await addPage(BACKEND_URL, noTemplateProjectId, 0, {
    title: 'Ready page',
    description: 'Description is persisted.',
  })
  const noTemplateResponse = await fetch(
    `${BACKEND_URL}/api/projects/${noTemplateProjectId}/template-assets/auto-match`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
  )
  expect(noTemplateResponse.status).toBe(400)
  expect((await noTemplateResponse.json()).error.code).toBe('NO_ANALYZED_TEMPLATES')

  await page.goto(`${BASE_URL}/project/${noTemplateProjectId}/template-setup`)
  const noTemplateAutoMatch = page.getByRole('button', { name: /一键自动匹配|Auto-match all/ })
  await expect(noTemplateAutoMatch).toBeDisabled()
  await expect(page.getByTestId('auto-match-readiness')).toContainText(
    /至少需要一个解析成功的模板|At least one successfully analyzed template/
  )
})

test('mocked UI waits for template analysis, refreshes readiness, then allows matching', async ({
  page,
}) => {
  const projectId = 'auto-match-readiness-project'
  let assetListCalls = 0
  let concurrentPolls = 0
  let maxConcurrentPolls = 0
  let autoMatchCalls = 0

  const project = {
    project_id: projectId,
    idea_prompt: 'readiness regression',
    creation_type: 'idea',
    template_mode: 'multi',
    status: 'DESCRIPTIONS_GENERATED',
    pages: [
      {
        page_id: 'page-1',
        order_index: 0,
        outline_content: { title: 'Ready page', points: [] },
        description_content: { text: 'This description must be preserved.' },
        status: 'DESCRIPTION_GENERATED',
      },
    ],
    created_at: '2026-07-15T00:00:00Z',
    updated_at: '2026-07-15T00:00:00Z',
  }

  await page.route('**/api/access-code/check', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { required: false, enabled: false } }),
    })
  })

  await page.route(`**/api/projects/${projectId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: project }),
    })
  })

  await page.route(`**/api/projects/${projectId}/template-assets`, async (route) => {
    assetListCalls += 1
    // React StrictMode may load twice on mount; keep the mocked task pending
    // through those initial reads so only the 2-second readiness poll advances it.
    const analysisStatus = assetListCalls <= 3 ? 'processing' : 'completed'
    const isSlowPoll = assetListCalls > 3
    if (isSlowPoll) {
      concurrentPolls += 1
      maxConcurrentPolls = Math.max(maxConcurrentPolls, concurrentPolls)
      await new Promise((resolve) => setTimeout(resolve, 2500))
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          assets: [
            {
              id: 'asset-1',
              image_url: '/template.png',
              thumb_url: '/template.png',
              analysis_status: analysisStatus,
              analysis_json: analysisStatus === 'completed' ? { template_role: 'content' } : null,
              analysis_notes: null,
              analysis_error: null,
              user_label: 'Template 1',
              user_edited_analysis: false,
              source: 'upload',
              sort_order: 0,
            },
          ],
        },
      }),
    })
    if (isSlowPoll) concurrentPolls -= 1
  })

  await page.route(`**/api/projects/${projectId}/template-assets/auto-match`, async (route) => {
    autoMatchCalls += 1
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { task_id: 'match-task-1' } }),
    })
  })

  await page.route(`**/api/projects/${projectId}/tasks/match-task-1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { task_id: 'match-task-1', status: 'COMPLETED', progress: { total_pages: 1 } },
      }),
    })
  })

  await page.goto(`${BASE_URL}/project/${projectId}/template-setup`)

  const autoMatch = page.getByRole('button', { name: /一键自动匹配|Auto-match all/ })
  await expect(autoMatch).toBeDisabled()
  await expect(page.getByTestId('auto-match-readiness')).toContainText(
    /模板仍在解析|Templates are still being analyzed/
  )
  expect(autoMatchCalls).toBe(0)

  await expect(autoMatch).toBeEnabled({ timeout: 12000 })
  await expect(page.getByTestId('auto-match-readiness')).toHaveCount(0)
  expect(maxConcurrentPolls).toBe(1)

  await autoMatch.click()
  await expect.poll(() => autoMatchCalls).toBe(1)
  await expect(page.getByText(/自动匹配完成|Auto-match completed/)).toBeVisible()

  const progress = page.getByTestId('template-match-progress')
  await expect(progress).toBeVisible()
  await expect(progress).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(progress).toHaveCSS('border-top-width', '0px')
})
