/**
 * E2E tests for the online slide player (presentation mode).
 *
 * The player opens as a near-fullscreen in-app overlay from the preview page
 * toolbar, shows the current slide scaled to fit, supports paging via toolbar
 * buttons / click zones / keyboard, and can switch into the browser-native
 * fullscreen via the Fullscreen API.
 *
 * 1. Mock UI tests: overlay open/close, paging, native fullscreen toggle,
 *    placeholder pages, index sync back to the main preview.
 * 2. Integration test: real backend with a seeded 3-page project.
 */

import { test, expect, type Page } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

const MOCK_PROJECT_ID = 'slide-player-mock'
const BASE = process.env.BASE_URL || 'http://localhost:3011'
const API = `http://localhost:${Number(new URL(BASE).port) + 2000}`

function mockProject(pagesOverride?: ReturnType<typeof mockProject>['pages']) {
  const page = (id: string, index: number, status: string, imagePath?: string) => ({
    id,
    page_id: id,
    order_index: index,
    status,
    ...(imagePath ? { generated_image_path: imagePath } : {}),
    outline_content: { title: `第 ${index + 1} 页`, points: [] },
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-01T10:00:00.000Z',
  })
  return {
    id: MOCK_PROJECT_ID,
    project_id: MOCK_PROJECT_ID,
    project_title: '播放测试项目',
    status: 'DRAFT',
    template_mode: 'single',
    image_aspect_ratio: '16:9',
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-01T10:00:00.000Z',
    pages: pagesOverride ?? [
      page('page-1', 0, 'COMPLETED', 'mock/slide-1.jpg'),
      page('page-2', 1, 'COMPLETED', 'mock/slide-2.jpg'),
      page('page-3', 2, 'DRAFT'),
    ],
  }
}

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

async function mockPreview(
  page: Page,
  pagesOverride?: ReturnType<typeof mockProject>['pages']
): Promise<{ imageVersionRequests: () => number }> {
  let imageVersionRequests = 0
  page.on('request', (req) => {
    if (req.url().includes('image-versions')) imageVersionRequests += 1
  })
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
      body: JSON.stringify({ success: true, data: { enable_image_quality_control: false } }),
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
      body: JSON.stringify({ success: true, data: mockProject(pagesOverride) }),
    })
  })
  await page.route('**/image-versions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { versions: [] } }),
    })
  )
  // Serve a real 1px PNG for mock slide images so the img load event fires
  await page.route('**/mock/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG })
  )
  return { imageVersionRequests: () => imageVersionRequests }
}

/** Replace the Fullscreen API with a deterministic stub that dispatches
 * fullscreenchange like a real browser would. */
async function stubFullscreenApi(page: Page, opts?: { gated?: boolean }) {
  await page.addInitScript(({ gated }) => {
    const w = window as unknown as {
      __fsCount: number
      __fsTarget: Element | null
      __fsResolve: (() => void) | null
    }
    w.__fsCount = 0
    w.__fsTarget = null
    w.__fsResolve = null
    Element.prototype.requestFullscreen = function (this: Element) {
      w.__fsCount += 1
      w.__fsTarget = this
      const enter = () => {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          value: this,
        })
        document.dispatchEvent(new Event('fullscreenchange'))
      }
      if (gated) {
        return new Promise<void>((resolve) => {
          w.__fsResolve = () => {
            enter()
            resolve()
          }
        })
      }
      enter()
      return Promise.resolve()
    }
    document.exitFullscreen = () => {
      // Real browsers steal focus when leaving native fullscreen (the element
      // that had it before fullscreen is gone by the time we close the player).
      // Model that so tests can tell deferred focus restore apart from a
      // naive synchronous restore.
      document.body.setAttribute('tabindex', '-1')
      document.body.focus()
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        value: null,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    }
    // Simulate the browser's native behaviour: Escape leaves fullscreen first;
    // the app itself does not receive that keydown while in native fullscreen.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.fullscreenElement) {
        e.stopImmediatePropagation()
        document.exitFullscreen()
      }
    })
  }, { gated: !!opts?.gated })
}

const player = (page: Page) => page.getByTestId('slide-player')
const playerToolbar = (page: Page) => page.getByTestId('player-toolbar')
const playerStage = (page: Page) => page.getByTestId('player-slide-stage')
const floatingToolbar = (page: Page) => page.getByTestId('preview-floating-toolbar')
const dockedToolbar = (page: Page) => page.getByTestId('preview-docked-toolbar')

async function openPlayer(page: Page) {
  await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
  await expect(floatingToolbar(page)).toBeVisible()
  await floatingToolbar(page).getByRole('button', { name: /播放|Play/ }).click()
  await expect(player(page)).toBeVisible()
}

test.describe('Slide player - near-fullscreen overlay (mock)', () => {
  test('opens from the floating toolbar and covers the app viewport', async ({ page }) => {
    await mockPreview(page)
    await openPlayer(page)

    await expect(playerToolbar(page)).toBeVisible()
    await expect(playerToolbar(page)).toContainText('1 / 3')
    // The overlay is viewport-filling, not a small dialog
    const box = (await player(page).boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(1000)
    expect(box.height).toBeGreaterThanOrEqual(600)
    // The stage renders the current slide image
    await expect(playerStage(page).locator('img')).toBeVisible()
    // ...and the image actually loaded (not a broken <img>)
    await expect(playerStage(page).locator('img')).toHaveJSProperty('naturalWidth', 1)
    // The overlay is announced as a modal dialog, so background content is
    // not reachable by screen readers
    await expect(player(page)).toHaveAttribute('role', 'dialog')
    await expect(player(page)).toHaveAttribute('aria-modal', 'true')
  })

  test('pages via toolbar buttons, click zones, and keyboard', async ({ page }) => {
    await mockPreview(page)
    await openPlayer(page)

    const toolbar = playerToolbar(page)
    const prevBtn = toolbar.getByRole('button', { name: /上一页|Previous/ })
    const nextBtn = toolbar.getByRole('button', { name: /下一页|Next/ })

    // Toolbar buttons
    await expect(prevBtn).toBeDisabled()
    await nextBtn.click()
    await expect(toolbar).toContainText('2 / 3')

    // Click zones: left third goes back, right two-thirds goes forward
    const stageBox = (await playerStage(page).boundingBox())!
    await page.mouse.click(stageBox.x + stageBox.width * 0.15, stageBox.y + stageBox.height / 2)
    await expect(toolbar).toContainText('1 / 3')
    await page.mouse.click(stageBox.x + stageBox.width * 0.85, stageBox.y + stageBox.height / 2)
    await expect(toolbar).toContainText('2 / 3')

    // Keyboard paging
    await page.keyboard.press('ArrowRight')
    await expect(toolbar).toContainText('3 / 3')
    await expect(nextBtn).toBeDisabled()
    await page.keyboard.press('ArrowLeft')
    await expect(toolbar).toContainText('2 / 3')
  })

  test('shows a placeholder page when the slide has no image', async ({ page }) => {
    await mockPreview(page)
    await openPlayer(page)

    const toolbar = playerToolbar(page)
    for (let i = 0; i < 2; i++) {
      await toolbar.getByRole('button', { name: /下一页|Next/ }).click()
    }
    await expect(toolbar).toContainText('3 / 3')
    await expect(playerStage(page).getByText(/尚未生成图片|Image not generated/)).toBeVisible()
  })

  test('shows generating/queued status text for in-flight pages', async ({ page }) => {
    const pages = mockProject().pages.map((p) => (p.page_id === 'page-3' ? { ...p, status: 'GENERATING' } : p))
    await mockPreview(page, pages)
    await openPlayer(page)

    const toolbar = playerToolbar(page)
    for (let i = 0; i < 2; i++) {
      await toolbar.getByRole('button', { name: /下一页|Next/ }).click()
    }
    await expect(playerStage(page).getByText(/正在生成中|Generating/)).toBeVisible()
  })

  test('reopening after paging and switching pages starts from the selected page (no index loop)', async ({ page }) => {
    const counters = await mockPreview(page)
    await openPlayer(page)

    // Play to page 3, exit, then pick page 1 in the sidebar
    const toolbar = playerToolbar(page)
    for (let i = 0; i < 2; i++) {
      await toolbar.getByRole('button', { name: /下一页|Next/ }).click()
    }
    await expect(toolbar).toContainText('3 / 3')
    await page.getByTestId('player-exit').click()
    await expect(player(page)).toBeHidden()

    await page.locator('aside').getByText('第 1 页').click()
    await expect(floatingToolbar(page)).toContainText('1 / 3')

    // Reopen: the player must start on the currently selected page and stay there
    const requestsBefore = counters.imageVersionRequests()
    await floatingToolbar(page).getByRole('button', { name: /播放|Play/ }).click()
    await expect(player(page)).toBeVisible()
    // Strict stability check: sample the page counter over ~1s; it must never
    // leave the starting page (an index sync loop would flicker 1/3 <-> 3/3)
    const samples = new Set<string>()
    for (let i = 0; i < 10; i++) {
      samples.add((await toolbar.textContent())!.replace(/\s+/g, ' ').trim())
      await page.waitForTimeout(100)
    }
    expect([...samples]).toEqual(['1 / 3'])
    // ...and no version-list request storm from the sync loop
    const requestsAfter = counters.imageVersionRequests()
    expect(requestsAfter - requestsBefore).toBeLessThanOrEqual(1)
  })

  test('native fullscreen toggle requests the Fullscreen API and follows browser state', async ({ page }) => {
    await mockPreview(page)
    await stubFullscreenApi(page)
    await openPlayer(page)

    const toggle = page.getByTestId('player-fullscreen-toggle')
    await expect(toggle).toHaveAttribute('aria-label', /全屏播放|Fullscreen/)

    await toggle.click()
    expect(await page.evaluate(() => (window as never as { __fsCount: number }).__fsCount)).toBe(1)
    // The element entering fullscreen is the player overlay itself
    expect(
      await page.evaluate(() => {
        const w = window as never as { __fsTarget: Element | null }
        return w.__fsTarget?.getAttribute('data-testid')
      })
    ).toBe('slide-player')
    await expect(toggle).toHaveAttribute('aria-label', /退出全屏|Exit fullscreen/)
    // PPT-style native fullscreen: chrome is hidden, the stage fills the whole
    // screen and the image covers it (no letterboxing)
    await expect(page.getByTestId('player-header')).toBeHidden()
    const stageBox = (await playerStage(page).boundingBox())!
    const playerBox = (await player(page).boundingBox())!
    expect(Math.abs(stageBox.width - playerBox.width)).toBeLessThan(2)
    expect(Math.abs(stageBox.height - playerBox.height)).toBeLessThan(2)
    await expect(playerStage(page).locator('img')).toHaveClass(/object-cover/)

    // Escape while in native fullscreen: browser exits fullscreen but the
    // overlay stays in near-fullscreen mode
    await page.keyboard.press('Escape')
    await expect(player(page)).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-label', /全屏播放|Fullscreen/)

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-label', /退出全屏|Exit fullscreen/)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-label', /全屏播放|Fullscreen/)
    expect(await page.evaluate(() => (window as never as { __fsCount: number }).__fsCount)).toBe(2)
  })

  test('native fullscreen auto-hides the toolbar and wakes on mouse move', async ({ page }) => {
    await mockPreview(page)
    await stubFullscreenApi(page)
    await openPlayer(page)

    const toolbar = playerToolbar(page)
    await page.getByTestId('player-fullscreen-toggle').click()
    // Visible on entering fullscreen (and after any mouse move)
    await expect(toolbar).toBeVisible()
    // Auto-hides after the idle delay
    await expect(toolbar).toBeHidden({ timeout: 6000 })
    // Moving the mouse wakes it again
    await page.mouse.move(640, 400)
    await expect(toolbar).toBeVisible()
    await expect(toolbar).toBeHidden({ timeout: 6000 })
  })

  test('exiting keeps the last played page selected in the main preview', async ({ page }) => {
    await mockPreview(page)
    await openPlayer(page)

    await playerToolbar(page).getByRole('button', { name: /下一页|Next/ }).click()
    await expect(playerToolbar(page)).toContainText('2 / 3')

    await page.getByTestId('player-exit').click()
    await expect(player(page)).toBeHidden()
    await expect(floatingToolbar(page)).toContainText('2 / 3')
  })

  test('closing restores focus to the play button that opened the player', async ({ page }) => {
    await mockPreview(page)
    await openPlayer(page)

    const playButton = floatingToolbar(page).getByRole('button', { name: /播放|Play/ })
    await page.getByTestId('player-exit').click()
    await expect(playButton).toBeFocused()
  })

  test('Escape restores focus to the play button', async ({ page }) => {
    await mockPreview(page)
    await openPlayer(page)

    const playButton = floatingToolbar(page).getByRole('button', { name: /播放|Play/ })
    await page.keyboard.press('Escape')
    await expect(playButton).toBeFocused()
  })

  test('focus restore falls back to the visible toolbar after a breakpoint crossing', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)
    await expect(floatingToolbar(page)).toBeVisible()

    // Open from the floating toolbar, shrink below lg while playing, close:
    // the floating trigger is display:none now, focus must land on the docked play button
    await floatingToolbar(page).getByRole('button', { name: /播放|Play/ }).click()
    await expect(player(page)).toBeVisible()
    await page.setViewportSize({ width: 800, height: 800 })
    await page.getByTestId('player-exit').click()
    await expect(dockedToolbar(page)).toBeVisible()
    await expect(dockedToolbar(page).getByRole('button', { name: /播放|Play/ })).toBeFocused()

    // Reverse: open from the docked toolbar, widen past lg, close:
    // focus must land on the floating play button
    await dockedToolbar(page).getByRole('button', { name: /播放|Play/ }).click()
    await expect(player(page)).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.getByTestId('player-exit').click()
    await expect(floatingToolbar(page)).toBeVisible()
    await expect(floatingToolbar(page).getByRole('button', { name: /播放|Play/ })).toBeFocused()
  })

  test('closing the player with X while in native fullscreen exits fullscreen first', async ({ page }) => {
    await mockPreview(page)
    await stubFullscreenApi(page)
    await openPlayer(page)

    await page.getByTestId('player-fullscreen-toggle').click()
    await expect(page.getByTestId('player-fullscreen-toggle')).toHaveAttribute('aria-label', /退出全屏|Exit fullscreen/)
    // The header exit button is hidden in native fullscreen; the toolbar one is used
    await page.getByTestId('player-exit-fs').click()

    await expect(player(page)).toBeHidden()
    expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false)
    expect(await page.evaluate(() => (window as never as { __fsCount: number }).__fsCount)).toBe(1)
    await expect(floatingToolbar(page).getByRole('button', { name: /播放|Play/ })).toBeFocused()
  })

  test('reopening after a resize uses the fresh viewport size', async ({ page }) => {
    await mockPreview(page)
    await openPlayer(page)
    await page.getByTestId('player-exit').click()

    await page.setViewportSize({ width: 1024, height: 768 })
    await floatingToolbar(page).getByRole('button', { name: /播放|Play/ }).click()
    await expect(player(page)).toBeVisible()

    const stage = (await playerStage(page).boundingBox())!
    expect(stage.width).toBeLessThanOrEqual(1024 - 64)
    expect(stage.height).toBeLessThanOrEqual(768 - 160)
  })

  test('Escape closes the near-fullscreen player', async ({ page }) => {
    await mockPreview(page)
    await openPlayer(page)

    await page.keyboard.press('Escape')
    await expect(player(page)).toBeHidden()
  })

  test('Tab and Shift+Tab stay inside the player (focus trap)', async ({ page }) => {
    await mockPreview(page)
    await openPlayer(page)

    // Forward tabs must never leave the overlay (it wraps around)
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() =>
        !!document.querySelector('[data-testid="slide-player"]')?.contains(document.activeElement)
      )
      expect(inside).toBe(true)
    }
    // Backward tabs wrap too
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+Tab')
      const inside = await page.evaluate(() =>
        !!document.querySelector('[data-testid="slide-player"]')?.contains(document.activeElement)
      )
      expect(inside).toBe(true)
    }
  })

  test('Tab from outside the overlay is pulled back inside (focus trap wrap-in)', async ({ page }) => {
    await mockPreview(page)
    await openPlayer(page)

    // Put focus on a background element (as browsers do when leaving native
    // fullscreen), then Tab must be pulled back into the player
    await page.locator('header').getByRole('button').first().focus()
    expect(
      await page.evaluate(() =>
        !!document.querySelector('[data-testid="slide-player"]')?.contains(document.activeElement)
      )
    ).toBe(false)
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() =>
        !!document.querySelector('[data-testid="slide-player"]')?.contains(document.activeElement)
      )
    ).toBe(true)
  })

  test('Tab cannot escape while the fullscreen button is disabled (pending)', async ({ page }) => {
    await mockPreview(page)
    await stubFullscreenApi(page, { gated: true })
    await openPlayer(page)

    const toggle = page.getByTestId('player-fullscreen-toggle')
    await toggle.click()
    await expect(toggle).toBeDisabled()
    // The button keeps focus while disabled; Tab must stay trapped
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() =>
        !!document.querySelector('[data-testid="slide-player"]')?.contains(document.activeElement)
      )
    ).toBe(true)
    await page.evaluate(() => (window as never as { __fsResolve: () => void }).__fsResolve())
  })

  test('shows an alert when the Fullscreen API is unavailable', async ({ page }) => {
    await mockPreview(page)
    await page.addInitScript(() => {
      (Element.prototype as { requestFullscreen?: unknown }).requestFullscreen = undefined
    })
    await openPlayer(page)

    await page.getByTestId('player-fullscreen-toggle').click()
    const error = page.getByTestId('player-fullscreen-error')
    await expect(error).toBeVisible()
    await expect(error).toHaveAttribute('role', 'alert')
  })

  test('fullscreen button stays disabled while the fullscreen request is pending', async ({ page }) => {
    await mockPreview(page)
    await stubFullscreenApi(page, { gated: true })
    await openPlayer(page)

    const toggle = page.getByTestId('player-fullscreen-toggle')
    await toggle.click()
    await expect(toggle).toBeDisabled()
    // Resolve the pending request → the browser enters fullscreen and the button re-enables
    await page.evaluate(() => (window as never as { __fsResolve: () => void }).__fsResolve())
    await expect(toggle).toBeEnabled()
    await expect(toggle).toHaveAttribute('aria-label', /退出全屏|Exit fullscreen/)
  })
})

test.describe('Slide player - narrow screen (mock)', () => {
  test('opens from the docked toolbar on small viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await mockPreview(page)
    await page.goto(`/project/${MOCK_PROJECT_ID}/preview`)

    await expect(dockedToolbar(page)).toBeVisible()
    await dockedToolbar(page).getByRole('button', { name: /播放|Play/ }).click()
    await expect(player(page)).toBeVisible()
    await expect(playerToolbar(page)).toContainText('1 / 3')
  })
})

test.describe('Slide player - integration (real backend)', () => {
  test.setTimeout(60_000)

  test('plays a seeded project end to end and syncs the page index back', async ({ page }) => {
    const seeded = await seedProjectWithImages(API, 3)

    await page.goto(`/project/${seeded.projectId}/preview`)
    await page.waitForLoadState('networkidle')
    await expect(floatingToolbar(page)).toBeVisible()

    await floatingToolbar(page).getByRole('button', { name: /播放|Play/ }).click()
    await expect(player(page)).toBeVisible()
    await expect(playerToolbar(page)).toContainText('1 / 3')
    // Real fixture image rendered inside the stage
    await expect(playerStage(page).locator('img')).toBeVisible()

    await playerToolbar(page).getByRole('button', { name: /下一页|Next/ }).click()
    await expect(playerToolbar(page)).toContainText('2 / 3')
    await page.keyboard.press('ArrowRight')
    await expect(playerToolbar(page)).toContainText('3 / 3')

    await page.getByTestId('player-exit').click()
    await expect(player(page)).toBeHidden()
    await expect(floatingToolbar(page)).toContainText('3 / 3')
  })
})
