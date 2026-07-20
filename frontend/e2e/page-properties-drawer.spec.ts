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
        outline_content: { title: '第一页标题', points: ['大纲阶段的要点'] },
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
/** The description/extra fields are MarkdownTextarea (contentEditable), not <textarea>. */
const descriptionBox = (page: Page) =>
  page.getByTestId('drawer-description-field').locator('[contenteditable="true"]')
const extraFieldBox = (page: Page, name: string) =>
  page.getByTestId(`drawer-extra-field-${name}`).locator('[contenteditable="true"]')
async function clearAndType(editor: ReturnType<typeof descriptionBox>, text: string) {
  await editor.focus()
  await editor.press('ControlOrMeta+a')
  if (text) await editor.page().keyboard.insertText(text)
  else await editor.press('Backspace')
}
const drawerWidth = (page: Page) =>
  drawer(page).evaluate((el) => Math.round(el.getBoundingClientRect().width))

test.describe('Page properties drawer - UI (mock)', () => {
  test('stays closed until asked for, leaving no inputs behind', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await expect(page.getByTestId('toggle-page-properties')).toBeVisible()

    // Collapsed to zero width, and its fields are out of the DOM entirely so
    // they cannot collide with other selectors on the preview page.
    expect(await drawerWidth(page)).toBe(0)
    await expect(page.getByTestId('drawer-title-input')).toHaveCount(0)
    await expect(page.getByTestId('drawer-resize-handle')).toHaveCount(0)

    await page.getByTestId('toggle-page-properties').click()
    await expect(page.getByTestId('drawer-title-input')).toBeVisible()
  })

  test('toggles open/closed and remembers the choice across reloads', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    await expect(drawer(page)).toBeVisible()
    await expect(page.getByTestId('drawer-title-input')).toHaveValue('第一页标题')

    // Collapse it from the panel header — the aside stays mounted at zero width.
    await page.getByRole('button', { name: '收起属性面板' }).click()
    await expect.poll(() => drawerWidth(page)).toBe(0)
    expect(await page.evaluate(() => localStorage.getItem('previewDrawer.open'))).toBe('false')

    await page.reload()
    await expect.poll(() => drawerWidth(page)).toBe(0)

    // And re-opening from the edge grip sticks too.
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
    await expect(descriptionBox(page)).toHaveText('第一页的描述')
    // Key points belong to the outline stage — the drawer must not surface them.
    await expect(drawer(page)).not.toContainText('大纲阶段的要点')

    // Narration is collapsed by default, with a dot hinting it has content.
    await expect(page.getByTestId('drawer-narration-input')).toHaveCount(0)
    await expect(page.getByTestId('drawer-narration-dot')).toBeVisible()
    await page.getByTestId('drawer-narration-toggle').click()
    await expect(page.getByTestId('drawer-narration-input')).toHaveValue('第一页的旁白')

    await page.getByRole('button', { name: '下一页' }).click()

    await expect(page.getByTestId('drawer-title-input')).toHaveValue('第二页标题')
    await expect(page.getByTestId('drawer-part-input')).toHaveValue('')
    await expect(descriptionBox(page)).toHaveText('')
  })

  test('keeps outline points intact when the title is edited', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    let outlinePayload: any = null
    await page.route('**/pages/page-1/outline', async (route) => {
      outlinePayload = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      })
    })

    await page.getByTestId('drawer-title-input').fill('只改标题')
    await expect.poll(() => outlinePayload, { timeout: 8000 }).not.toBeNull()
    expect(outlinePayload.outline_content).toEqual({
      title: '只改标题',
      points: ['大纲阶段的要点'],
    })
  })

  test('picks up edits made outside the drawer without clobbering typing', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await expect(page.getByTestId('drawer-title-input')).toHaveValue('第一页标题')

    // The edit modal writes the same fields through the store; an open drawer
    // has to follow along instead of showing stale text.
    await page.getByRole('button', { name: '编辑' }).click()
    // Scope to the dialog: the modal and the drawer share input placeholders.
    const modal = page.getByRole('dialog')
    await modal.getByRole('button', { name: /页面大纲/ }).click() // section starts collapsed
    await modal.locator('input[placeholder="输入页面标题"]').fill('弹窗改的标题')
    await modal.getByRole('button', { name: '仅保存大纲/描述' }).click()
    await expect(modal).toBeHidden()

    await expect(page.getByTestId('drawer-title-input')).toHaveValue('弹窗改的标题')
  })

  test('does not let a background sync overwrite in-progress typing', async ({ page }) => {
    await mockPreview(page)
    await openDrawerByDefault(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    // Every project GET keeps returning the ORIGINAL title, mimicking a
    // syncProject() landing before the debounced save has flushed.
    await page.getByTestId('drawer-title-input').click()
    await page.getByTestId('drawer-title-input').fill('用户正在输入的标题')

    // Stays put while focused and while the save is still queued.
    await page.waitForTimeout(2500)
    await expect(page.getByTestId('drawer-title-input')).toHaveValue('用户正在输入的标题')
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
    await page.getByTestId('drawer-part-input').fill('新章节')
    await clearAndType(descriptionBox(page), '新描述')
    await page.getByTestId('drawer-narration-toggle').click()
    await page.getByTestId('drawer-narration-input').fill('新旁白')

    await expect.poll(() => calls.length, { timeout: 8000 }).toBeGreaterThanOrEqual(4)

    const outline = calls.find((c) => c.url.endsWith('/outline'))!
    expect(outline.body.outline_content.title).toBe('改过的标题')
    expect(calls.find((c) => c.url.endsWith('/description'))!.body.description_content.text).toBe(
      '新描述'
    )
    expect(calls.find((c) => c.url.endsWith('/narration'))!.body).toEqual({
      narration_text: '新旁白',
    })
    expect(calls.find((c) => c.url.endsWith('/pages/page-1'))!.body).toEqual({ part: '新章节' })
  })

  test('survives legacy rows whose extra fields are not strings', async ({ page }) => {
    // description_content is a JSON blob and the legacy layout_suggestion
    // fallback has no writer left in the backend, so old rows can hold values
    // that were never strings. Editing used to throw `value.trim is not a
    // function` out of buildDescriptionContent and blank the drawer.
    const legacy = mockProject()
    legacy.pages[0].description_content = {
      text: '旧数据描述',
      extra_fields: { 视觉元素: 42 as unknown as string, 视觉焦点: null as unknown as string },
    }
    await mockPreview(page, legacy)
    await openDrawerByDefault(page)

    let body: any = null
    await page.route('**/pages/page-1/description', async (route) => {
      body = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      })
    })

    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await clearAndType(descriptionBox(page), '编辑后的描述')

    await expect.poll(() => body, { timeout: 8000 }).not.toBeNull()
    expect(body.description_content.text).toBe('编辑后的描述')
    // Coerced, not crashed: the number survives as text, the null is dropped.
    expect(body.description_content.extra_fields).toEqual({ 视觉元素: '42' })
    await expect(drawer(page)).toBeVisible()
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
    await expect(page.getByTestId('drawer-change-template')).toHaveCount(0)
    await expect(page.getByTestId('drawer-template-style-input')).toHaveCount(0)

    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await mockPreview(page, mockProject({ template_mode: 'multi' }))
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await expect(drawer(page)).toContainText('跟随项目模板')
    await expect(page.getByTestId('drawer-change-template')).toBeVisible()
    await expect(page.getByTestId('drawer-template-style-input')).toBeVisible()
  })

  test('picks a template for the page straight from the drawer', async ({ page }) => {
    await mockPreview(page, mockProject({ template_mode: 'multi' }))
    await openDrawerByDefault(page)

    await page.route('**/template-assets', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            assets: [
              {
                id: 'asset-1',
                image_url: '/files/a.jpg',
                thumb_url: null,
                analysis_status: 'COMPLETED',
                analysis_json: null,
                analysis_notes: null,
                analysis_error: null,
                user_label: '深色封面',
                user_edited_analysis: false,
                source: 'upload',
                sort_order: 0,
              },
            ],
          },
        }),
      })
    )

    let patch: any = null
    await page.route('**/pages/page-1/template', async (route) => {
      patch = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { page: { page_id: 'page-1', template_asset_id: 'asset-1' } },
        }),
      })
    })

    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await page.getByTestId('drawer-change-template').click()
    await page.getByRole('dialog').getByText('深色封面').click()

    await expect.poll(() => patch, { timeout: 8000 }).not.toBeNull()
    expect(patch).toEqual({ template_asset_id: 'asset-1', selection_source: 'manual' })
  })

  test('saves the per-page template prompt as you type', async ({ page }) => {
    await mockPreview(page, mockProject({ template_mode: 'multi' }))
    await openDrawerByDefault(page)

    let patch: any = null
    await page.route('**/pages/page-1/template', async (route) => {
      patch = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { page: { page_id: 'page-1' } } }),
      })
    })

    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await page.getByTestId('drawer-template-style-input').fill('左图右文，深色底')

    await expect.poll(() => patch, { timeout: 8000 }).not.toBeNull()
    expect(patch).toEqual({ template_style_text: '左图右文，深色底', selection_source: 'manual' })
  })

  test('flushes a template prompt typed just before switching pages', async ({ page }) => {
    await mockPreview(page, mockProject({ template_mode: 'multi' }))
    await openDrawerByDefault(page)

    const patches: { pageId: string; body: any }[] = []
    await page.route('**/pages/*/template', async (route) => {
      const pageId = route.request().url().match(/pages\/([^/]+)\/template/)![1]
      patches.push({ pageId, body: route.request().postDataJSON() })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { page: { page_id: pageId } } }),
      })
    })

    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    // Type, then switch pages well inside the 800ms debounce window. The prompt
    // used to be dropped by the clearTimeout on unmount/page switch.
    await page.getByTestId('drawer-template-style-input').fill('切页前写的提示词')
    await page.getByRole('button', { name: '下一页' }).click()

    await expect.poll(() => patches.length, { timeout: 8000 }).toBeGreaterThan(0)
    // It must land on page-1 — the page it was typed on — not on page-2.
    expect(patches[0].pageId).toBe('page-1')
    expect(patches[0].body.template_style_text).toBe('切页前写的提示词')
  })

  test('still debounces while typing instead of firing per keystroke', async ({ page }) => {
    await mockPreview(page, mockProject({ template_mode: 'multi' }))
    await openDrawerByDefault(page)

    let calls = 0
    await page.route('**/pages/page-1/template', async (route) => {
      calls += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { page: { page_id: 'page-1' } } }),
      })
    })

    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    const input = page.getByTestId('drawer-template-style-input')
    await input.click()
    // Six keystrokes inside one debounce window must collapse into one request.
    // Guards the flush-on-page-switch fix above: reaching the flush callback
    // through an effect dependency would re-arm it every render and turn the
    // debounce into per-keystroke saves.
    await page.keyboard.type('深色底', { delay: 40 })
    await page.keyboard.type('，左图', { delay: 40 })

    await expect.poll(() => calls, { timeout: 8000 }).toBe(1)
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
    await clearAndType(descriptionBox(page), '集成描述内容')
    await clearAndType(extraFieldBox(page, '视觉元素'), '一张折线图')
    await page.getByTestId('drawer-narration-toggle').click()
    await page.getByTestId('drawer-narration-input').fill('集成旁白讲稿')

    await expect(page.getByTestId('drawer-save-state')).toContainText('已保存', { timeout: 10000 })

    // Persisted server-side, not just optimistically in the store.
    const resp = await request.get(`/api/projects/${projectId}`)
    const firstPage = (await resp.json()).data.pages[0]
    expect(firstPage.outline_content.title).toBe('集成标题')
    expect(firstPage.part).toBe('第一章')
    expect(firstPage.description_content.text).toBe('集成描述内容')
    expect(firstPage.description_content.extra_fields).toEqual({ 视觉元素: '一张折线图' })
    expect(firstPage.narration_text).toBe('集成旁白讲稿')

    // And the drawer rehydrates from the server after a reload.
    await page.reload()
    await expect(page.getByTestId('drawer-title-input')).toHaveValue('集成标题')
    await expect(page.getByTestId('drawer-part-input')).toHaveValue('第一章')
    await expect(descriptionBox(page)).toHaveText('集成描述内容')
    await expect(extraFieldBox(page, '视觉元素')).toHaveText('一张折线图')
    await page.getByTestId('drawer-narration-toggle').click()
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
    await page.getByTestId('drawer-narration-toggle').click()
    await page.getByTestId('drawer-title-input').fill('并发标题')
    await page.getByTestId('drawer-part-input').fill('并发章节')
    await clearAndType(descriptionBox(page), '并发描述')
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
