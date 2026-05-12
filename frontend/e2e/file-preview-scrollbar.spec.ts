/**
 * E2E test: FilePreviewModal scrollbar fix
 *
 * Verifies that the PDF/file preview modal does not have nested scroll containers
 * (which caused double vertical scrollbars and a horizontal scrollbar).
 */

import { test, expect } from '@playwright/test'

test.use({ baseURL: process.env.BASE_URL || 'http://localhost:3000' })

const LONG_MARKDOWN = '# Test Document\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(200) +
  '\n\n```\n' + 'const x = 1; // a very long code line '.repeat(5) + '\n```\n'

const PROJECT_ID = 'mock-proj-001'
const FILE_ID = 'mock-file-001'

test.describe('FilePreviewModal scrollbar fix (mocked)', () => {
  test.setTimeout(60_000)

  test('modal should not have nested scroll containers', async ({ page }) => {
    // Mock settings API (prevents help modal from blocking)
    await page.route('**/api/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { ai_provider_format: 'gemini', google_api_key: 'fake' }
        })
      })
    })

    // Mock project API
    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: PROJECT_ID,
            project_id: PROJECT_ID,
            title: 'Test Project',
            status: 'OUTLINE_GENERATED',
            creation_type: 'idea',
            pages: [{ id: 'p1', page_id: 'p1', title: 'Page 1', order_index: 0, outline_content: { title: 'Page 1', points: ['point 1'] } }]
          }
        })
      })
    })

    // Mock pages API
    await page.route(`**/api/projects/${PROJECT_ID}/pages`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { pages: [{ id: 'p1', title: 'Page 1', order_index: 0 }] }
        })
      })
    })

    // Mock reference files list (actual endpoint: /api/reference-files/project/:id)
    await page.route(`**/api/reference-files/project/${PROJECT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            files: [{
              id: FILE_ID,
              filename: 'test-document.pdf',
              file_size: 12345,
              file_type: 'application/pdf',
              parse_status: 'completed',
            }]
          }
        })
      })
    })

    // Mock single file detail (for preview)
    await page.route(`**/api/reference-files/${FILE_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            file: {
              id: FILE_ID,
              filename: 'test-document.pdf',
              file_size: 12345,
              file_type: 'application/pdf',
              parse_status: 'completed',
              markdown_content: LONG_MARKDOWN,
            }
          }
        })
      })
    })

    // Navigate to outline editor (correct route: /project/:id/outline)
    await page.goto(`/project/${PROJECT_ID}/outline`)

    // Click the file card to open preview
    const fileCard = page.locator('text=test-document.pdf').first()
    await fileCard.waitFor({ state: 'visible', timeout: 10_000 })
    await fileCard.click()

    // Wait for the file preview modal (second dialog, after any help modal)
    const modal = page.locator('[role="dialog"]').last()
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // KEY ASSERTION: between the dialog and the prose, there should be only ONE
    // scrollable ancestor (the Modal's own content area), not two (which was the bug).
    const proseDiv = modal.locator('.prose')
    await expect(proseDiv).toBeVisible()

    const scrollableAncestorCount = await proseDiv.evaluate(el => {
      let count = 0
      let node = el.parentElement
      while (node && !node.hasAttribute('role')) {
        const ov = getComputedStyle(node).overflowY
        if (ov === 'auto' || ov === 'scroll') count++
        node = node.parentElement
      }
      return count
    })
    expect(scrollableAncestorCount).toBe(1)

    // Prose itself should hide horizontal overflow
    await expect(proseDiv).toHaveCSS('overflow-x', 'hidden')
  })
})
