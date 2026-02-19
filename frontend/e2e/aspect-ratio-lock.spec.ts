/**
 * Aspect Ratio Lock & Help Tooltip - Mock E2E Tests
 *
 * Covers:
 * 1. Aspect ratio buttons disabled when project has generated images
 * 2. Help icon (?) tooltip visible next to aspect ratio title
 * 3. Locked description text shown when images exist
 * 4. Buttons clickable when no images exist
 */
import { test, expect } from '@playwright/test'

const PROJECT_ID = 'mock-aspect-lock'

const baseMockProject = {
  project_id: PROJECT_ID,
  status: 'COMPLETED',
  idea_prompt: 'Test aspect ratio lock',
  image_aspect_ratio: '16:9',
  created_at: '2025-01-01T00:00:00',
  updated_at: '2025-01-01T00:00:00',
}

const pageWithImage = {
  page_id: 'page-1',
  order_index: 0,
  outline_content: { title: 'Page 1', points: ['Point'] },
  description_content: { text: 'desc' },
  generated_image_url: '/files/mock/pages/test.png',
  status: 'COMPLETED',
}

const pageWithoutImage = {
  page_id: 'page-1',
  order_index: 0,
  outline_content: { title: 'Page 1', points: ['Point'] },
  description_content: { text: 'desc' },
  generated_image_url: null,
  status: 'DRAFT',
}

function mockRoutes(page: any, pages: any[]) {
  return page.route('**/api/projects/' + PROJECT_ID, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { ...baseMockProject, pages },
      }),
    })
  })
}

test.describe('Aspect ratio lock (mock)', () => {
  test('buttons disabled & locked text when project has images', async ({ page }) => {
    await mockRoutes(page, [pageWithImage])
    await page.goto(`/project/${PROJECT_ID}/preview`)
    await page.waitForLoadState('networkidle')

    // Open project settings modal
    const settingsBtn = page.locator('button').filter({ hasText: /设置|Settings/ }).first()
    await settingsBtn.click()

    // Verify locked description text
    await expect(page.getByText(/已生成图片的项目无法调整|Cannot change aspect ratio/)).toBeVisible()

    // Verify buttons are disabled
    for (const ratio of ['16:9', '4:3', '1:1', '9:16', '3:2']) {
      await expect(page.locator(`button:has-text("${ratio}")`).first()).toBeDisabled()
    }

    // Save button should not be visible
    await expect(page.locator('button').filter({ hasText: /^保存$|^Save$/ }).first()).not.toBeVisible()
  })

  test('help icon tooltip visible', async ({ page }) => {
    await mockRoutes(page, [pageWithImage])
    await page.goto(`/project/${PROJECT_ID}/preview`)
    await page.waitForLoadState('networkidle')

    const settingsBtn = page.locator('button').filter({ hasText: /设置|Settings/ }).first()
    await settingsBtn.click()

    // Help icon should exist
    const helpIcon = page.locator('.lucide-help-circle').first()
    await expect(helpIcon).toBeVisible()

    // Hover to show tooltip
    await helpIcon.hover()
    await expect(page.getByText(/部分模型仅支持特定|Some models only support/)).toBeVisible()
  })

  test('buttons enabled when no images exist', async ({ page }) => {
    await mockRoutes(page, [pageWithoutImage])
    await page.goto(`/project/${PROJECT_ID}/preview`)
    await page.waitForLoadState('networkidle')

    const settingsBtn = page.locator('button').filter({ hasText: /设置|Settings/ }).first()
    await settingsBtn.click()

    // Normal description text
    await expect(page.getByText(/设置生成幻灯片|Set the aspect ratio/)).toBeVisible()

    // Buttons should be enabled
    const btn43 = page.locator('button:has-text("4:3")').first()
    await expect(btn43).toBeEnabled()
  })
})
