/**
 * E2E tests for the in-place edit mode on the Slide Preview page.
 *
 * Desktop (lg+): "编辑" no longer opens a modal. The slide moves up and shrinks,
 * the floating toolbar gives way to an instruction panel, and the user boxes a
 * region directly on the full-size canvas image. The properties drawer is left
 * however the user had it. Narrow screens (< lg) keep the old modal — there is
 * no room to split the viewport vertically at 375px.
 *
 * 1. Mock UI tests: enter/exit, drawer left untouched, region crop on the
 *    canvas image, page-switch behaviour, breakpoint routing.
 * 2. Integration tests: crop against a real seeded project, and the submitted
 *    payload carrying both the prompt and the cropped reference image.
 */

import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

const MOCK_PROJECT_ID = 'inline-edit-mock'

function mockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: MOCK_PROJECT_ID,
    project_id: MOCK_PROJECT_ID,
    project_title: '就地编辑测试项目',
    status: 'IMAGES_GENERATED',
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
        outline_content: { title: '第一页标题', points: ['要点一'] },
        description_content: { text: '第一页描述' },
        generated_image_path: 'inline/page-1.jpg',
        created_at: '2026-07-01T10:00:00.000Z',
        updated_at: '2026-07-01T10:00:00.000Z',
      },
      {
        id: 'page-2',
        page_id: 'page-2',
        order_index: 1,
        status: 'COMPLETED',
        outline_content: { title: '第二页标题', points: [] },
        description_content: { text: '第二页描述' },
        generated_image_path: 'inline/page-2.jpg',
        created_at: '2026-07-01T10:00:00.000Z',
        updated_at: '2026-07-01T10:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

/**
 * Serve a real 800x450 slide bitmap for the mocked pages. A hand-rolled tiny
 * PNG is not enough: the crop maps the on-screen rect back to natural pixels,
 * so a 64px-wide source collapses the selection to a few pixels and the canvas
 * yields nothing to attach.
 */
// same cwd-based resolution the seed helper uses — these specs run as ESM, so
// there is no __dirname
const FRONTEND_DIR = process.cwd().endsWith('frontend')
  ? process.cwd()
  : path.join(process.cwd(), 'frontend')
const SLIDE_FIXTURE = fs.readFileSync(path.join(FRONTEND_DIR, 'e2e', 'fixtures', 'slide_1.jpg'))

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
  // getImageUrl serves generated_image_path straight off the origin (no /files
  // prefix), and an unserved image leaves naturalWidth at 0, which makes the
  // crop silently do nothing
  await page.route('**/inline/*.jpg*', (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: SLIDE_FIXTURE })
  )
}

const pill = (page: Page) => page.getByTestId('preview-floating-toolbar')
const panel = (page: Page) => page.getByTestId('inline-edit-panel')
const drawer = (page: Page) => page.getByTestId('page-properties-drawer')
const promptBox = (page: Page) => panel(page).getByRole('textbox')
const canvasImage = (page: Page) => page.locator('main img[alt^="Slide"]')

async function openDrawerByDefault(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('previewDrawer.open') === null) {
      localStorage.setItem('previewDrawer.open', 'true')
    }
  })
}

/** Drag a box across the canvas image, in fractions of its rendered size. */
async function dragRegion(page: Page, from = 0.3, to = 0.6) {
  const box = (await canvasImage(page).boundingBox())!
  await page.mouse.move(box.x + box.width * from, box.y + box.height * from)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * to, box.y + box.height * to, { steps: 10 })
  await page.mouse.up()
  return box
}

test.describe('In-place edit - desktop (mock)', () => {
  test('replaces the toolbar with an instruction panel instead of opening a modal', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    await expect(pill(page)).toBeVisible()
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()

    await expect(panel(page)).toBeVisible()
    await expect(pill(page)).toHaveCount(0)
    // no modal, and no outline/description fields — those stay in the drawer
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(panel(page).getByText('页面大纲（可编辑）')).toHaveCount(0)
    await expect(panel(page).getByText('仅保存大纲/描述')).toHaveCount(0)
  })

  test('keeps the slide in place at full size when the command bar opens', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    const before = (await canvasImage(page).boundingBox())!
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await expect(panel(page)).toBeVisible()
    // let the command bar's slide-in animation settle before measuring
    await page.waitForTimeout(400)
    const after = (await canvasImage(page).boundingBox())!

    // The slim command bar replaces the pill in place, so the slide no longer
    // shrinks to 46vh to make room — it keeps its full size (a couple of px of
    // vertical re-centering under the taller bar is fine, the 240px jump isn't).
    expect(after.height).toBeCloseTo(before.height, 0)
    expect(Math.abs(after.y - before.y)).toBeLessThan(24)
  })

  test('leaves the properties drawer exactly as the user had it', async ({ page }) => {
    await openDrawerByDefault(page)
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await expect(drawer(page)).toBeVisible()

    const drawerWidth = () =>
      drawer(page).evaluate((el) => Math.round(el.getBoundingClientRect().width))
    const widthBefore = await drawerWidth()
    expect(widthBefore).toBeGreaterThan(0)

    // Entering edit mode used to force the drawer shut. The drawer is the
    // user's own choice, so edit mode must not touch it — and its fields stay
    // readable while writing the instruction.
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await expect(panel(page)).toBeVisible()
    await expect(page.getByTestId('drawer-title-input')).toBeVisible()
    // give the old collapse animation a window to run before asserting
    await page.waitForTimeout(500)
    expect(await drawerWidth()).toBe(widthBefore)

    await panel(page).getByRole('button', { name: /^取消$/ }).click()
    await expect(panel(page)).toHaveCount(0)
    expect(await drawerWidth()).toBe(widthBefore)
  })

  test('keeps the drawer closed when the user had it closed', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await expect(page.getByTestId('drawer-title-input')).toHaveCount(0)

    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await expect(panel(page)).toBeVisible()
    await expect(page.getByTestId('drawer-title-input')).toHaveCount(0)
  })

  test('Escape leaves edit mode', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await expect(panel(page)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(panel(page)).toHaveCount(0)
    await expect(pill(page)).toBeVisible()
  })

  test('boxes a region on the canvas image and attaches the crop', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await page.getByRole('button', { name: /区域选图/ }).click()

    const imageBox = await dragRegion(page)

    // The command bar never shows raw i18n keys, and capturing a region toasts
    // real copy (a mistyped namespace would surface "slidePreview.regionCrop…").
    await expect(panel(page)).not.toContainText(/preview\.|slidePreview\./)
    await expect(page.getByText(/添加为参考图|added as a reference/i)).toBeVisible()

    const selection = page.getByTestId('inline-edit-selection')
    await expect(selection).toBeVisible()
    const selBox = (await selection.boundingBox())!
    // the drawn rect tracks the drag, inside the image
    expect(selBox.x).toBeGreaterThanOrEqual(imageBox.x - 1)
    expect(selBox.y).toBeGreaterThanOrEqual(imageBox.y - 1)
    expect(Math.round(selBox.width)).toBeCloseTo(Math.round(imageBox.width * 0.3), -1)

    // the crop is added as a reference image for the generation request
    await expect(page.getByTestId('inline-edit-attachment-thumb')).toHaveCount(1)
  })

  test('keeps generate disabled until an instruction is typed', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()

    const generate = panel(page).getByRole('button', { name: /生成图片/ })
    await expect(generate).toBeDisabled()
    await promptBox(page).fill('把标题改成蓝色')
    await expect(generate).toBeEnabled()
  })

  test('shows a real thumbnail for each uploaded reference image', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await expect(page.getByTestId('inline-edit-attachments')).toHaveCount(0)

    const fixtures = path.join(FRONTEND_DIR, 'e2e', 'fixtures')
    // The upload input lives in the "+" attach menu, so open it first.
    await panel(page).getByRole('button', { name: /添加参考图|Add reference/ }).click()
    await panel(page)
      .locator('input[type="file"]')
      .setInputFiles([path.join(fixtures, 'slide_1.jpg'), path.join(fixtures, 'slide_2.jpg')])

    const thumbs = page.getByTestId('inline-edit-attachment-thumb')
    await expect(thumbs).toHaveCount(2)
    // Assert the blobs actually decoded rather than just counting <img> tags —
    // a dead object URL still renders an element.
    for (const thumb of await thumbs.all()) {
      await expect
        .poll(() => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0)
    }

    // Removing one drops its thumbnail and leaves the other decoded.
    await thumbs.first().hover()
    await page.getByRole('button', { name: /删除|Delete/ }).first().click()
    await expect(thumbs).toHaveCount(1)
    await expect
      .poll(() => thumbs.first().evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0)
  })

  test('leaves edit mode when the page changes, keeping the draft per page', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await promptBox(page).fill('把标题改成蓝色')
    await page.getByRole('button', { name: /区域选图/ }).click()
    await dragRegion(page)
    await expect(page.getByTestId('inline-edit-attachment-thumb')).toHaveCount(1)

    // switching slides would otherwise carry page 1's crop and prompt onto page 2
    await page.locator('aside').getByText('第二页标题').click()
    await expect(panel(page)).toHaveCount(0)
    await expect(pill(page)).toBeVisible()
    await expect(page.getByTestId('inline-edit-selection')).toHaveCount(0)

    // page 2 starts clean
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await expect(promptBox(page)).toHaveValue('')
    await expect(page.getByTestId('inline-edit-attachment-thumb')).toHaveCount(0)

    // and page 1's draft is still there when we come back
    await page.keyboard.press('Escape')
    await page.locator('aside').getByText('第一页标题').click()
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await expect(promptBox(page)).toHaveValue('把标题改成蓝色')
    await expect(page.getByTestId('inline-edit-attachment-thumb')).toHaveCount(1)
  })

  test('sends the prompt and the cropped reference to the edit endpoint', async ({ page }) => {
    await mockPreview(page)
    let contentType = ''
    let bodyLength = 0
    await page.route('**/pages/page-1/edit/image', async (route) => {
      contentType = route.request().headers()['content-type'] || ''
      bodyLength = (route.request().postData() || '').length
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { task_id: 'task-1' } }),
      })
    })
    await page.route('**/api/tasks/task-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { status: 'COMPLETED', progress: 100 } }),
      })
    )

    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await promptBox(page).fill('把标题改成蓝色')
    await page.getByRole('button', { name: /区域选图/ }).click()
    await dragRegion(page)
    await expect(page.getByTestId('inline-edit-attachment-thumb')).toHaveCount(1)

    await panel(page).getByRole('button', { name: /生成图片/ }).click()

    // multipart because the crop rides along as a file
    await expect.poll(() => contentType, { timeout: 8000 }).toContain('multipart/form-data')
    expect(bodyLength).toBeGreaterThan(200)
    // submitting returns to preview
    await expect(panel(page)).toHaveCount(0)
  })
})

test.describe('In-place edit - narrow screens (mock)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('still opens the modal, with no in-place panel', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    await page.getByTestId('preview-docked-toolbar').getByRole('button', { name: /^编辑$/ }).click()

    await expect(page.getByRole('heading', { name: /编辑页面/ })).toBeVisible()
    await expect(panel(page)).toHaveCount(0)
  })
})

test.describe('In-place edit - breakpoint changes (mock)', () => {
  test('drops out of edit mode when the window narrows past lg', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await expect(panel(page)).toBeVisible()

    // the split layout has no room below lg, so it should not survive the resize
    await page.setViewportSize({ width: 900, height: 720 })
    await expect(panel(page)).toHaveCount(0)
    await expect(page.getByTestId('preview-docked-toolbar')).toBeVisible()
  })
})

test.describe('In-place edit - integration', () => {
  test('crops a region from a real generated slide', async ({ page, baseURL }) => {
    const { projectId } = await seedProjectWithImages(baseURL!, 2)
    await page.goto(`/project/${projectId}/preview`)

    await pill(page).getByRole('button', { name: /^编辑$/ }).click()
    await expect(panel(page)).toBeVisible()
    await page.getByRole('button', { name: /区域选图/ }).click()
    await dragRegion(page)

    await expect(page.getByTestId('inline-edit-selection')).toBeVisible()
    await expect(page.getByTestId('inline-edit-attachment-thumb')).toHaveCount(1)
  })
})
