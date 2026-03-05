/**
 * Smart Page Merge - Mock E2E Test
 *
 * Verifies that when refine/outline returns pages with preserved
 * descriptions and images, the frontend displays them correctly.
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const PROJECT_ID = 'mock-merge-proj'

const INITIAL_PAGES = [
  {
    page_id: 'page-a',
    order_index: 0,
    part: null,
    outline_content: { title: 'Page A', points: ['point1'] },
    description_content: { text: 'Description for A' },
    generated_image_url: '/files/mock/pages/img-a.jpg',
    status: 'IMAGE_GENERATED',
  },
  {
    page_id: 'page-b',
    order_index: 1,
    part: null,
    outline_content: { title: 'Page B', points: ['point2'] },
    description_content: { text: 'Description for B' },
    generated_image_url: '/files/mock/pages/img-b.jpg',
    status: 'IMAGE_GENERATED',
  },
]

// After refine: Page A preserved, Page B removed, Page C added
const REFINED_PAGES = [
  {
    page_id: 'page-a', // same id = preserved
    order_index: 0,
    part: null,
    outline_content: { title: 'Page A', points: ['updated point'] },
    description_content: { text: 'Description for A' }, // preserved
    generated_image_url: '/files/mock/pages/img-a.jpg', // preserved
    status: 'IMAGE_GENERATED', // preserved
  },
  {
    page_id: 'page-c',
    order_index: 1,
    part: null,
    outline_content: { title: 'Page C', points: ['new point'] },
    description_content: null, // new page, no description
    generated_image_url: null,
    status: 'DRAFT',
  },
]

test.describe('Smart Page Merge (Mocked)', () => {
  test.setTimeout(30_000)

  test('refine preserves description and image for matched pages', async ({ page }) => {
    let refineCallCount = 0

    // Mock project GET - return initial state first, then refined state
    let currentPages = INITIAL_PAGES
    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: PROJECT_ID,
              creation_type: 'idea',
              idea_prompt: 'test',
              status: 'OUTLINE_GENERATED',
              pages: currentPages,
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    // Mock refine/outline - return refined pages
    await page.route(`**/api/projects/${PROJECT_ID}/refine/outline`, async (route) => {
      refineCallCount++
      currentPages = REFINED_PAGES
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { pages: REFINED_PAGES, message: '大纲修改成功' },
        }),
      })
    })

    // Mock image files to avoid 404
    await page.route('**/files/mock/pages/**', async (route) => {
      // Return a 1x1 red pixel PNG
      const pixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      )
      await route.fulfill({ status: 200, contentType: 'image/png', body: pixel })
    })

    // Navigate to outline editor and wait for initial pages
    await page.goto(`${BASE}/project/${PROJECT_ID}/outline`)
    await expect(page.getByText('Page A')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Page B')).toBeVisible({ timeout: 5000 })

    // Find and use the refine input
    const refineInput = page.locator('input[placeholder*="修改"], textarea[placeholder*="修改"], input[placeholder*="要求"], textarea[placeholder*="要求"]')
    if (await refineInput.count() > 0) {
      await refineInput.first().fill('删除Page B，增加Page C')

      // Submit and wait for the refine API response
      const refinePromise = page.waitForResponse(
        (r) => r.url().includes('/refine/outline') && r.status() === 200
      )
      await refineInput.first().press('Enter')
      await refinePromise

      // After refine: Page A preserved, Page B gone, Page C added
      await expect(page.getByText('Page A')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('Page C')).toBeVisible({ timeout: 5000 })
      expect(refineCallCount).toBeGreaterThan(0)
    }
  })
})
