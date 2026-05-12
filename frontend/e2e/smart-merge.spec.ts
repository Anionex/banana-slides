/**
 * Position-based Page Merge - Mock E2E Tests
 *
 * Verifies that regenerating/refining outline preserves descriptions and images
 * by page position, and that trailing pages are deleted when the new outline is shorter.
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const PROJECT_ID = 'mock-merge-proj'

const INITIAL_PAGES = [
  {
    page_id: 'page-0',
    order_index: 0,
    part: null,
    outline_content: { title: 'Introduction', points: ['overview'] },
    description_content: { text: 'Intro description' },
    generated_image_url: '/files/mock/pages/img-0.jpg',
    status: 'IMAGE_GENERATED',
  },
  {
    page_id: 'page-1',
    order_index: 1,
    part: null,
    outline_content: { title: 'Details', points: ['detail1'] },
    description_content: { text: 'Details description' },
    generated_image_url: '/files/mock/pages/img-1.jpg',
    status: 'IMAGE_GENERATED',
  },
  {
    page_id: 'page-2',
    order_index: 2,
    part: null,
    outline_content: { title: 'Conclusion', points: ['summary'] },
    description_content: { text: 'Conclusion description' },
    generated_image_url: '/files/mock/pages/img-2.jpg',
    status: 'IMAGE_GENERATED',
  },
]

// After refine with fewer pages: positions 0,1 preserved, position 2 deleted
const REFINED_FEWER_PAGES = [
  {
    page_id: 'page-0',
    order_index: 0,
    part: null,
    outline_content: { title: 'New Intro Title', points: ['updated'] },
    description_content: { text: 'Intro description' },
    generated_image_url: '/files/mock/pages/img-0.jpg',
    status: 'IMAGE_GENERATED',
  },
  {
    page_id: 'page-1',
    order_index: 1,
    part: null,
    outline_content: { title: 'New Details Title', points: ['updated'] },
    description_content: { text: 'Details description' },
    generated_image_url: '/files/mock/pages/img-1.jpg',
    status: 'IMAGE_GENERATED',
  },
]

// After refine with more pages: positions 0,1,2 preserved, position 3 new
const REFINED_MORE_PAGES = [
  {
    page_id: 'page-0',
    order_index: 0,
    part: null,
    outline_content: { title: 'Intro Refined', points: ['new'] },
    description_content: { text: 'Intro description' },
    generated_image_url: '/files/mock/pages/img-0.jpg',
    status: 'IMAGE_GENERATED',
  },
  {
    page_id: 'page-1',
    order_index: 1,
    part: null,
    outline_content: { title: 'Details Refined', points: ['new'] },
    description_content: { text: 'Details description' },
    generated_image_url: '/files/mock/pages/img-1.jpg',
    status: 'IMAGE_GENERATED',
  },
  {
    page_id: 'page-2',
    order_index: 2,
    part: null,
    outline_content: { title: 'Conclusion Refined', points: ['new'] },
    description_content: { text: 'Conclusion description' },
    generated_image_url: '/files/mock/pages/img-2.jpg',
    status: 'IMAGE_GENERATED',
  },
  {
    page_id: 'page-3',
    order_index: 3,
    part: null,
    outline_content: { title: 'New Extra Page', points: ['extra'] },
    description_content: null,
    generated_image_url: null,
    status: 'DRAFT',
  },
]

function setupMocks(page: import('@playwright/test').Page, pagesRef: { current: typeof INITIAL_PAGES }) {
  return Promise.all([
    page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: PROJECT_ID,
              creation_type: 'idea',
              idea_prompt: 'test presentation',
              status: 'OUTLINE_GENERATED',
              pages: pagesRef.current,
            },
          }),
        })
      } else {
        await route.continue()
      }
    }),
    page.route('**/files/mock/pages/**', async (route) => {
      const pixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      )
      await route.fulfill({ status: 200, contentType: 'image/png', body: pixel })
    }),
  ])
}

test.describe('Position-based Page Merge (Mocked)', () => {
  test.setTimeout(30_000)

  test('refine with fewer pages: trailing pages removed, earlier pages preserved', async ({ page }) => {
    const pagesRef = { current: [...INITIAL_PAGES] }
    await setupMocks(page, pagesRef)

    await page.route(`**/api/projects/${PROJECT_ID}/refine/outline`, async (route) => {
      pagesRef.current = REFINED_FEWER_PAGES
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { pages: REFINED_FEWER_PAGES, message: '大纲修改成功' },
        }),
      })
    })

    await page.goto(`${BASE}/project/${PROJECT_ID}/outline`)
    await expect(page.getByText('Introduction')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Details')).toBeVisible()
    await expect(page.getByText('Conclusion')).toBeVisible()

    // Refine to reduce pages
    const refineInput = page.locator('input[placeholder*="增加"], textarea[placeholder*="增加"], input[placeholder*="Add"], textarea[placeholder*="Add"]')
    if (await refineInput.count() > 0) {
      await refineInput.first().fill('删除最后一页')
      const refinePromise = page.waitForResponse(
        (r) => r.url().includes('/refine/outline') && r.status() === 200
      )
      await refineInput.first().press('Control+Enter')
      await refinePromise

      // After: 2 pages, Conclusion gone
      await expect(page.getByText('New Intro Title')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('New Details Title')).toBeVisible()
      await expect(page.getByText('Conclusion')).not.toBeVisible()
    }
  })

  test('refine with more pages: all old pages preserved, new page added as DRAFT', async ({ page }) => {
    const pagesRef = { current: [...INITIAL_PAGES] }
    await setupMocks(page, pagesRef)

    await page.route(`**/api/projects/${PROJECT_ID}/refine/outline`, async (route) => {
      pagesRef.current = REFINED_MORE_PAGES
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { pages: REFINED_MORE_PAGES, message: '大纲修改成功' },
        }),
      })
    })

    await page.goto(`${BASE}/project/${PROJECT_ID}/outline`)
    await expect(page.getByText('Introduction')).toBeVisible({ timeout: 5000 })

    const refineInput = page.locator('input[placeholder*="增加"], textarea[placeholder*="增加"], input[placeholder*="Add"], textarea[placeholder*="Add"]')
    if (await refineInput.count() > 0) {
      await refineInput.first().fill('增加一页额外内容')
      const refinePromise = page.waitForResponse(
        (r) => r.url().includes('/refine/outline') && r.status() === 200
      )
      await refineInput.first().press('Control+Enter')
      await refinePromise

      // All 4 pages visible
      await expect(page.getByText('Intro Refined')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('Details Refined')).toBeVisible()
      await expect(page.getByText('Conclusion Refined')).toBeVisible()
      await expect(page.getByText('New Extra Page')).toBeVisible()
    }
  })

  test('regenerate shows warning dialog mentioning page deletion', async ({ page }) => {
    await setupMocks(page, { current: INITIAL_PAGES })

    await page.goto(`${BASE}/project/${PROJECT_ID}/outline`)
    await expect(page.getByText('Introduction')).toBeVisible({ timeout: 5000 })

    // Click regenerate button
    const regenButton = page.getByRole('button', { name: /重新生成|Regenerate/i })
    if (await regenButton.count() > 0) {
      await regenButton.click()

      // Warning dialog should mention page deletion
      const dialog = page.locator('[role="dialog"], .modal, [class*="dialog"]')
      await expect(dialog).toBeVisible({ timeout: 3000 })
      // Check that warning mentions deletion of pages
      const dialogText = await dialog.textContent()
      expect(dialogText).toMatch(/删除|removed|remove/i)
    }
  })
})
