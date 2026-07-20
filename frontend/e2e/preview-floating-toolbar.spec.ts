/**
 * E2E tests for the SlidePreview floating toolbar redesign.
 *
 * Desktop (lg+): per-page actions live in a floating rounded toolbar anchored
 * to the bottom-center of the canvas; the quality-control switch (a
 * project-level generation setting) moves next to the batch-generate button
 * in the left sidebar; the old full-width docked bar is hidden.
 * Narrow screens (< lg): the docked bar keeps every control, the floating
 * toolbar and the sidebar switch are hidden.
 *
 * 1. Mock UI tests: visibility swap per viewport, pill navigation, edit modal.
 * 2. Integration tests: pill navigation against the real backend, and the
 *    sidebar quality-control switch persisting through a reload.
 */

import { test, expect, type Page } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

const MOCK_PROJECT_ID = 'floating-toolbar-mock'

function mockProject() {
  return {
    id: MOCK_PROJECT_ID,
    project_id: MOCK_PROJECT_ID,
    project_title: '悬浮工具栏测试项目',
    status: 'DRAFT',
    template_mode: 'single',
    image_aspect_ratio: '16:9',
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-01T10:00:00.000Z',
    pages: [
      {
        id: 'page-1',
        page_id: 'page-1',
        order_index: 0,
        status: 'COMPLETED',
        outline_content: { title: '第一页标题', points: [] },
        created_at: '2026-07-01T10:00:00.000Z',
        updated_at: '2026-07-01T10:00:00.000Z',
      },
      {
        id: 'page-2',
        page_id: 'page-2',
        order_index: 1,
        status: 'DRAFT',
        outline_content: { title: '第二页标题', points: [] },
        created_at: '2026-07-01T10:00:00.000Z',
        updated_at: '2026-07-01T10:00:00.000Z',
      },
    ],
  }
}

const TWO_VERSIONS = [
  {
    version_id: 'v2',
    version_number: 2,
    is_current: true,
    image_path: 'a.jpg',
    created_at: '2026-07-01T12:00:00',
  },
  {
    version_id: 'v1',
    version_number: 1,
    is_current: false,
    image_path: 'b.jpg',
    created_at: '2026-07-01T11:00:00',
  },
]

async function mockPreview(
  page: Page,
  onSettingsPut?: (payload: Record<string, unknown>) => void,
  versions: unknown[] = []
) {
  await page.route('**/api/access-code/check', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { enabled: false } }),
    })
  )
  await page.route('**/api/settings', async (route) => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON()
      onSettingsPut?.(payload)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: payload }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { enable_image_quality_control: false } }),
    })
  })
  await page.route('**/api/user-templates', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { templates: [] } }),
    })
  )
  await page.route(`**/api/projects/${MOCK_PROJECT_ID}`, (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockProject() }),
    })
  })
  await page.route('**/image-versions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { versions } }),
    })
  )
}

const floatingToolbar = (page: Page) => page.getByTestId('preview-floating-toolbar')
const dockedToolbar = (page: Page) => page.getByTestId('preview-docked-toolbar')
const sidebarQcSwitch = (page: Page) =>
  page.locator('aside').getByRole('switch', { name: /质量控制|Quality Control/ })

test.describe('Floating toolbar - desktop (mock)', () => {
  test('shows the floating toolbar and hides the docked bar', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    await expect(floatingToolbar(page)).toBeVisible()
    await expect(dockedToolbar(page)).toBeHidden()

    // Quality control lives in the sidebar next to batch generate, not in the pill
    await expect(sidebarQcSwitch(page)).toBeVisible()
    await expect(floatingToolbar(page).getByRole('switch')).toHaveCount(0)
  })

  test('pill navigation switches pages and disables at both ends', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    const pill = floatingToolbar(page)
    const prev = pill.getByRole('button', { name: /上一页|Previous/ })
    const next = pill.getByRole('button', { name: /下一页|Next/ })

    await expect(pill).toContainText('1 / 2')
    await expect(prev).toBeDisabled()

    await next.click()
    await expect(pill).toContainText('2 / 2')
    await expect(next).toBeDisabled()
    await expect(prev).toBeEnabled()

    await prev.click()
    await expect(pill).toContainText('1 / 2')
  })

  test('pill edit button opens the page edit dialog', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    await floatingToolbar(page).getByRole('button', { name: /^编辑$|^Edit$/ }).click()
    await expect(page.getByRole('heading', { name: /编辑页面|Edit Page/ })).toBeVisible()
  })

  test('pill opens the version history menu when the page has several versions', async ({ page }) => {
    await mockPreview(page, undefined, TWO_VERSIONS)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    const pill = floatingToolbar(page)
    const historyButton = pill.getByRole('button', { name: /历史版本|History/ })
    await expect(historyButton).toBeVisible()
    await expect(historyButton).toContainText('2')

    await historyButton.click()
    // The menu pops upward out of the pill, so both entries must be on screen.
    const currentEntry = page.getByRole('button', { name: /版本 2|Version 2/ })
    await expect(currentEntry).toBeInViewport()
    await expect(currentEntry).toContainText(/当前|Current/)
    await expect(page.getByRole('button', { name: /版本 1|Version 1/ })).toBeInViewport()
  })

  test('sidebar quality-control switch saves the setting', async ({ page }) => {
    const payloads: Record<string, unknown>[] = []
    await mockPreview(page, (payload) => payloads.push(payload))
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    const qcSwitch = sidebarQcSwitch(page)
    await expect(qcSwitch).toHaveAttribute('aria-checked', 'false')
    await qcSwitch.click()

    await expect.poll(() => payloads.at(-1)?.enable_image_quality_control).toBe(true)
    await expect(qcSwitch).toHaveAttribute('aria-checked', 'true')
  })
})

test.describe('Floating toolbar - narrow screens (mock)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps the docked bar with every control and hides the pill', async ({ page }) => {
    const payloads: Record<string, unknown>[] = []
    await mockPreview(page, (payload) => payloads.push(payload))
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    await expect(dockedToolbar(page)).toBeVisible()
    await expect(floatingToolbar(page)).toBeHidden()
    await expect(sidebarQcSwitch(page)).toBeHidden()

    // Docked navigation still works
    await expect(dockedToolbar(page)).toContainText('1 / 2')
    await dockedToolbar(page).getByRole('button', { name: /下一页|Next/ }).click()
    await expect(dockedToolbar(page)).toContainText('2 / 2')

    // Docked quality-control switch still saves the setting
    const qcSwitch = dockedToolbar(page).getByRole('switch', { name: /质量控制|Quality Control/ })
    await qcSwitch.click()
    await expect.poll(() => payloads.at(-1)?.enable_image_quality_control).toBe(true)
  })
})

test.describe('Floating toolbar - integration', () => {
  test('pill navigates seeded pages and switches the previewed image', async ({ page, baseURL }) => {
    const { projectId } = await seedProjectWithImages(baseURL!, 2)
    await page.goto(`/project/${projectId}/preview`)

    const pill = floatingToolbar(page)
    await expect(pill).toBeVisible()
    await expect(pill).toContainText('1 / 2')
    await expect(page.locator('main img[alt="Slide 1"]')).toBeVisible()

    await pill.getByRole('button', { name: /下一页|Next/ }).click()
    await expect(pill).toContainText('2 / 2')
    await expect(page.locator('main img[alt="Slide 2"]')).toBeVisible()
  })

  test('sidebar quality-control switch persists through a reload', async ({ page, request, baseURL }) => {
    const settingsUrl = `${baseURL}/api/settings`
    const initial = (await (await request.get(settingsUrl)).json()).data
      ?.enable_image_quality_control as boolean

    const { projectId } = await seedProjectWithImages(baseURL!, 1)
    try {
      await page.goto(`/project/${projectId}/preview`)

      const qcSwitch = sidebarQcSwitch(page)
      await expect(qcSwitch).toHaveAttribute('aria-checked', String(initial))
      await qcSwitch.click()
      await expect(qcSwitch).toHaveAttribute('aria-checked', String(!initial))
      await expect
        .poll(async () => (await (await request.get(settingsUrl)).json()).data?.enable_image_quality_control)
        .toBe(!initial)

      await page.reload()
      await expect(sidebarQcSwitch(page)).toHaveAttribute('aria-checked', String(!initial))
    } finally {
      await request.put(settingsUrl, { data: { enable_image_quality_control: initial } })
    }
  })
})
