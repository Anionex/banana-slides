/**
 * Aspect Ratio Lock - Integration E2E Test
 *
 * Uses real backend to verify aspect ratio lock when project has generated images.
 */
import { test, expect } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const API = `http://localhost:${Number(new URL(BASE).port) + 2000}`

test.describe('Aspect ratio lock (integration)', () => {
  test.setTimeout(30_000)

  let projectId: string

  test('aspect ratio locked after images generated', async ({ page }) => {
    // Seed project with 1 page that has a real image
    const seeded = await seedProjectWithImages(API, 1)
    projectId = seeded.projectId

    await page.goto(`/project/${projectId}/preview`)
    await page.waitForLoadState('networkidle')

    // Open project settings
    const settingsBtn = page.locator('button').filter({ hasText: /设置|Settings/ }).first()
    await settingsBtn.click()

    // Verify locked state
    await expect(page.getByText(/已生成图片的项目无法调整|Cannot change aspect ratio/)).toBeVisible()

    // All ratio buttons should be disabled
    for (const ratio of ['16:9', '4:3', '1:1', '9:16', '3:2']) {
      await expect(page.locator(`button:has-text("${ratio}")`).first()).toBeDisabled()
    }
  })
})
