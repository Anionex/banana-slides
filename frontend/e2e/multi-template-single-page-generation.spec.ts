import { test, expect, errors } from '@playwright/test'

import {
  addPage,
  getProject,
  pollTask,
  uploadAsset,
} from './helpers/seed-template-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const BACKEND_URL = BASE_URL.replace(/:\d+$/, (port) => `:${Number(port.slice(1)) + 2000}`)

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
})

test('a bound multi-template page can be generated from the preview', async ({ page }) => {
  test.setTimeout(720000)

  const createResponse = await fetch(`${BACKEND_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_type: 'idea',
      idea_prompt: 'single-page multi-template regression',
    }),
  })
  const createJson = await createResponse.json()
  expect(createResponse.status, JSON.stringify(createJson)).toBe(201)
  const projectId = createJson.data.project_id as string

  const modeResponse = await fetch(`${BACKEND_URL}/api/projects/${projectId}/template-mode`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'multi' }),
  })
  expect(modeResponse.status).toBe(200)

  const pageId = await addPage(BACKEND_URL, projectId, 0, {
    title: 'Multi-template cover',
    description: 'A concise editorial cover with a large title and restrained decoration.',
  })
  const { assetId } = await uploadAsset(BACKEND_URL, projectId, {
    fixture: 'slide_1.jpg',
    label: 'Bound cover template',
  })
  const bindResponse = await fetch(
    `${BACKEND_URL}/api/projects/${projectId}/pages/${pageId}/template`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_asset_id: assetId,
        selection_source: 'auto',
      }),
    },
  )
  const bindJson = await bindResponse.json()
  expect(bindResponse.status, JSON.stringify(bindJson)).toBe(200)

  const before = await getProject(BACKEND_URL, projectId)
  expect(before.template_mode).toBe('multi')
  expect(before.template_image_url).toBeNull()
  expect(before.template_style).toBeNull()
  expect(before.pages[0].template_asset_id).toBe(assetId)
  expect(before.pages[0].template_selection_source).toBe('auto')

  await page.goto(`${BASE_URL}/project/${projectId}/preview`)
  const generateResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/api/projects/${projectId}/pages/${pageId}/generate/image`),
  )
  await page.getByRole('button', { name: /重新生成|Regenerate/i }).click()
  const generateAnyway = page.getByRole('button', { name: /仍然生成|Generate anyway/i })
  try {
    await generateAnyway.waitFor({ state: 'visible', timeout: 3000 })
    await generateAnyway.click()
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) {
      throw error
    }
  }

  const generateResponse = await generateResponsePromise
  const generateJson = await generateResponse.json()
  expect(generateResponse.status(), JSON.stringify(generateJson)).toBe(202)
  await expect(page.getByText(/已开始生成图片|Image generation started/i)).toBeVisible()

  const task = await pollTask(BACKEND_URL, projectId, generateJson.data.task_id, {
    timeoutMs: 600000,
    intervalMs: 4000,
  })
  expect(task.status, task.error_message || '').toBe('COMPLETED')

  const after = await getProject(BACKEND_URL, projectId)
  const generatedPage = after.pages.find((item: any) => item.page_id === pageId)
  expect(generatedPage.status).toBe('COMPLETED')
  expect(generatedPage.generated_image_url).toBeTruthy()
  expect(generatedPage.template_asset_id).toBe(assetId)
})
