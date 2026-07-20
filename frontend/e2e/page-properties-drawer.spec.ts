/**
 * E2E tests for the SlidePreview page-properties drawer.
 *
 * 1. Mock UI tests: open/close, width persistence, drag + keyboard resize,
 *    mobile overlay, request payload shape per field.
 * 2. Integration tests: every editable field round-trips through the real
 *    backend and survives a reload, including the two debounce races that the
 *    accumulating save queue fixes.
 */

import { test, expect, type Page } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

const MOCK_PROJECT_ID = 'drawer-mock-project'

/** Minimal project payload so SlidePreview renders without a backend. */
function mockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: MOCK_PROJECT_ID,
    project_id: MOCK_PROJECT_ID,
    project_title: '抽屉测试项目',
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
        part: '开场',
        outline_content: { title: '第一页标题', points: ['要点一', '要点二'] },
        description_content: { text: '第一页的描述' },
        narration_text: '第一页的旁白',
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
    ...overrides,
  }
}

async function mockPreview(page: Page, project = mockProject()) {
  await page.route('**/api/access-code/check', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { enabled: false } }),
    })
  )
  await page.route('**/api/settings', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  )
  await page.route(`**/api/projects/${MOCK_PROJECT_ID}`, (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: project }),
    })
  })
  await page.route('**/image-versions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { versions: [] } }),
    })
  )
}

/** Force the drawer open regardless of the viewport-based first-run default. */
async function openDrawerByDefault(page: Page, width?: number) {
  await page.addInitScript(
    ([w]) => {
      // Init scripts re-run on every navigation, so only seed the first load —
      // otherwise a reload would clobber whatever the test just changed.
      if (localStorage.getItem('previewDrawer.open') === null) {
        localStorage.setItem('previewDrawer.open', 'true')
      }
      if (w && localStorage.getItem('previewDrawer.width') === null) {
        localStorage.setItem('previewDrawer.width', String(w))
      }
    },
    [width]
  )
}

const drawer = (page: Page) => page.getByTestId('page-properties-drawer')
const drawerWidth = (page: Page) =>
  drawer(page).evaluate((el) => Math.round(el.getBoundingClientRect().width))

test.describe('Page properties drawer - UI (mock)', () => {
  test('toggles open/closed and remembers the choice across reloads', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    await expect(drawer(page)).toBeVisible()
    await expect(page.getByTestId('drawer-title-input')).toHaveValue('第一页标题')

    // Collapse it — the aside stays mounted but shrinks to zero width.
    await page.getByTestId('toggle-page-properties').click()
    await expect.poll(() => drawerWidth(page)).toBe(0)
    expect(await page.evaluate(() => localStorage.getItem('previewDrawer.open'))).toBe('false')

    await page.reload()
    await expect.poll(() => drawerWidth(page)).toBe(0)

    // And re-opening sticks too.
    await page.getByTestId('toggle-page-properties').click()
    await expect.poll(() => drawerWidth(page)).toBeGreaterThan(0)
    await page.reload()
    await expect.poll(() => drawerWidth(page)).toBeGreaterThan(0)
  })

  test('shows the selected page and follows page switches', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    await expect(page.getByTestId('drawer-title-input')).toHaveValue('第一页标题')
    await expect(page.getByTestId('drawer-part-input')).toHaveValue('开场')
    await expect(page.getByTestId('drawer-points-input')).toHaveValue('要点一\n要点二')
    await expect(page.getByTestId('drawer-description-input')).toHaveValue('第一页的描述')
    await expect(page.getByTestId('drawer-narration-input')).toHaveValue('第一页的旁白')

    await page.getByRole('button', { name: '下一页' }).click()

    await expect(page.getByTestId('drawer-title-input')).toHaveValue('第二页标题')
    await expect(page.getByTestId('drawer-part-input')).toHaveValue('')
    await expect(page.getByTestId('drawer-narration-input')).toHaveValue('')
  })

  test('resizes by dragging the handle and persists the width', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page, 380)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    expect(await drawerWidth(page)).toBe(380)

    const handle = page.getByTestId('drawer-resize-handle')
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + 200)
    await page.mouse.down()
    await page.mouse.move(box.x - 120, box.y + 200, { steps: 10 })
    await page.mouse.up()

    // ~500 rather than exactly 500: the handle centre lands on a half pixel.
    await expect.poll(() => drawerWidth(page)).toBeGreaterThan(495)
    const dragged = await drawerWidth(page)
    expect(dragged).toBeLessThan(505)
    expect(await page.evaluate(() => localStorage.getItem('previewDrawer.width'))).toBe(
      String(dragged)
    )

    await page.reload()
    await expect.poll(() => drawerWidth(page)).toBe(dragged)
  })

  test('clamps the width to the allowed range while dragging', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page, 380)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    const handle = page.getByTestId('drawer-resize-handle')
    const box = (await handle.boundingBox())!

    // Drag far past the maximum — 1440 viewport allows at most 640.
    await page.mouse.move(box.x + box.width / 2, box.y + 200)
    await page.mouse.down()
    await page.mouse.move(100, box.y + 200, { steps: 10 })
    await page.mouse.up()
    await expect.poll(() => drawerWidth(page)).toBe(640)

    // Drag far past the minimum.
    const box2 = (await handle.boundingBox())!
    await page.mouse.move(box2.x + box2.width / 2, box2.y + 200)
    await page.mouse.down()
    await page.mouse.move(1430, box2.y + 200, { steps: 10 })
    await page.mouse.up()
    await expect.poll(() => drawerWidth(page)).toBe(300)
  })

  test('resizes with the keyboard and resets on double click', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page, 400)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    const handle = page.getByTestId('drawer-resize-handle')
    await handle.focus()

    await handle.press('ArrowLeft')
    await expect.poll(() => drawerWidth(page)).toBe(416)
    await handle.press('ArrowRight')
    await expect.poll(() => drawerWidth(page)).toBe(400)
    await handle.press('Shift+ArrowLeft')
    await expect.poll(() => drawerWidth(page)).toBe(448)
    await handle.press('End')
    await expect.poll(() => drawerWidth(page)).toBe(300)
    await handle.press('Home')
    await expect.poll(() => drawerWidth(page)).toBe(640)

    await handle.dblclick()
    await expect.poll(() => drawerWidth(page)).toBe(380)
  })

  test('sends each field to its own endpoint with the right payload', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    const calls: { url: string; body: any }[] = []
    for (const suffix of ['outline', 'description', 'narration']) {
      await page.route(`**/pages/page-1/${suffix}`, async (route) => {
        calls.push({ url: route.request().url(), body: route.request().postDataJSON() })
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: {} }),
        })
      })
    }
    await page.route('**/pages/page-1', async (route) => {
      calls.push({ url: route.request().url(), body: route.request().postDataJSON() })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      })
    })

    await page.getByTestId('drawer-title-input').fill('改过的标题')
    await page.getByTestId('drawer-points-input').fill('新要点一\n\n新要点二')
    await page.getByTestId('drawer-part-input').fill('新章节')
    await page.getByTestId('drawer-description-input').fill('新描述')
    await page.getByTestId('drawer-narration-input').fill('新旁白')

    await expect.poll(() => calls.length, { timeout: 8000 }).toBeGreaterThanOrEqual(4)

    const outline = calls.find((c) => c.url.endsWith('/outline'))!
    expect(outline.body.outline_content).toEqual({
      title: '改过的标题',
      points: ['新要点一', '新要点二'], // blank lines dropped
    })
    expect(calls.find((c) => c.url.endsWith('/description'))!.body.description_content.text).toBe(
      '新描述'
    )
    expect(calls.find((c) => c.url.endsWith('/narration'))!.body).toEqual({
      narration_text: '新旁白',
    })
    expect(calls.find((c) => c.url.endsWith('/pages/page-1'))!.body).toEqual({ part: '新章节' })
  })

  test('shows the saving indicator then settles on saved', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    await page.route('**/pages/page-1/outline', async (route) => {
      await new Promise((r) => setTimeout(r, 600))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      })
    })

    const indicator = page.getByTestId('drawer-save-state')
    await page.getByTestId('drawer-title-input').fill('触发保存')

    await expect(indicator).toContainText('保存中')
    await expect(indicator).toContainText('已保存', { timeout: 8000 })
  })

  test('renders as an overlay with a dismissing scrim on mobile', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    // Floats above the preview instead of taking layout space.
    expect(await drawer(page).evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
    // The resize handle is desktop-only.
    await expect(page.getByTestId('drawer-resize-handle')).toBeHidden()

    await page.mouse.click(20, 400) // tap the scrim
    await expect.poll(() => drawerWidth(page)).toBe(0)
  })

  test('shows the per-page template section only in multi-template mode', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await expect(drawer(page)).not.toContainText('模板')

    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await mockPreview(page, mockProject({ template_mode: 'multi' }))
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await expect(drawer(page)).toContainText('跟随项目模板')
    await expect(drawer(page)).toContainText('前往模板配置')
  })
})

test.describe('Page properties drawer - integration', () => {
  test('every field round-trips through the backend and survives a reload', async ({
    page,
    request,
    baseURL,
  }) => {
    const { projectId } = await seedProjectWithImages(baseURL!, 2)
    await openDrawerByDefault(page)
    await page.goto(`/project/${projectId}/preview`)

    await expect(drawer(page)).toBeVisible()

    await page.getByTestId('drawer-title-input').fill('集成标题')
    await page.getByTestId('drawer-part-input').fill('第一章')
    await page.getByTestId('drawer-points-input').fill('要点 A\n要点 B')
    await page.getByTestId('drawer-description-input').fill('集成描述内容')
    await page.getByTestId('drawer-narration-input').fill('集成旁白讲稿')

    await expect(page.getByTestId('drawer-save-state')).toContainText('已保存', { timeout: 10000 })

    // Persisted server-side, not just optimistically in the store.
    const resp = await request.get(`/api/projects/${projectId}`)
    const firstPage = (await resp.json()).data.pages[0]
    expect(firstPage.outline_content).toEqual({ title: '集成标题', points: ['要点 A', '要点 B'] })
    expect(firstPage.part).toBe('第一章')
    expect(firstPage.description_content.text).toBe('集成描述内容')
    expect(firstPage.narration_text).toBe('集成旁白讲稿')

    // And the drawer rehydrates from the server after a reload.
    await page.reload()
    await expect(page.getByTestId('drawer-title-input')).toHaveValue('集成标题')
    await expect(page.getByTestId('drawer-part-input')).toHaveValue('第一章')
    await expect(page.getByTestId('drawer-points-input')).toHaveValue('要点 A\n要点 B')
    await expect(page.getByTestId('drawer-description-input')).toHaveValue('集成描述内容')
    await expect(page.getByTestId('drawer-narration-input')).toHaveValue('集成旁白讲稿')
  })

  test('keeps every field when several are edited inside one debounce window', async ({
    page,
    request,
    baseURL,
  }) => {
    const { projectId } = await seedProjectWithImages(baseURL!, 1)
    await openDrawerByDefault(page)
    await page.goto(`/project/${projectId}/preview`)
    await expect(drawer(page)).toBeVisible()

    // No awaits in between: all four land inside the same 1s debounce window,
    // which used to keep only the last one.
    await page.getByTestId('drawer-title-input').fill('并发标题')
    await page.getByTestId('drawer-part-input').fill('并发章节')
    await page.getByTestId('drawer-description-input').fill('并发描述')
    await page.getByTestId('drawer-narration-input').fill('并发旁白')

    await expect(page.getByTestId('drawer-save-state')).toContainText('已保存', { timeout: 10000 })

    const firstPage = (await (await request.get(`/api/projects/${projectId}`)).json()).data.pages[0]
    expect(firstPage.outline_content.title).toBe('并发标题')
    expect(firstPage.part).toBe('并发章节')
    expect(firstPage.description_content.text).toBe('并发描述')
    expect(firstPage.narration_text).toBe('并发旁白')
  })

  test('keeps an edit made just before switching pages', async ({ page, request, baseURL }) => {
    const { projectId } = await seedProjectWithImages(baseURL!, 2)
    await openDrawerByDefault(page)
    await page.goto(`/project/${projectId}/preview`)
    await expect(drawer(page)).toBeVisible()

    // Edit page 1, then jump to page 2 and edit it before the debounce fires.
    await page.getByTestId('drawer-title-input').fill('第一页新标题')
    await page.getByRole('button', { name: '下一页' }).click()
    await page.getByTestId('drawer-title-input').fill('第二页新标题')

    await expect(page.getByTestId('drawer-save-state')).toContainText('已保存', { timeout: 10000 })

    const pages = (await (await request.get(`/api/projects/${projectId}`)).json()).data.pages
    expect(pages[0].outline_content.title).toBe('第一页新标题')
    expect(pages[1].outline_content.title).toBe('第二页新标题')
  })
})
