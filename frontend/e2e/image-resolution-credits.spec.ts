import { test, expect, Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3008'
const ADMIN_EMAIL = 'admin@bananaslides.online'
const ADMIN_PASSWORD = 'ydw20040928Z#admin'

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app/)
}

test.describe('Image Resolution Credits', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('admin config shows per-resolution image cost fields (1K/2K/4K)', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/config`)
    await page.waitForSelector('label')

    // Verify 3 resolution-specific labels exist
    await expect(page.locator('label').filter({ hasText: '1K' })).toBeVisible()
    await expect(page.locator('label').filter({ hasText: '2K' })).toBeVisible()
    await expect(page.locator('label').filter({ hasText: '4K' })).toBeVisible()

    // Old single "Generate Image (per page)" / "生成图片（每页）" label should NOT exist
    const oldLabel = page.locator('label').filter({ hasText: /^生成图片（每页）$|^Generate Image \(per page\)$/ })
    await expect(oldLabel).toHaveCount(0)
  })

  test('per-resolution costs persist after save and reload', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/config`)
    await page.waitForSelector('label')

    // Find the 4K input and set a distinctive value
    const label4k = page.locator('label').filter({ hasText: '4K' })
    const input4k = label4k.locator('..').locator('input[type="number"]')
    const originalValue = await input4k.inputValue()

    await input4k.fill('25')

    // Save
    await page.getByRole('button', { name: /Save/ }).click()
    await page.waitForTimeout(1500)

    // Reload and verify persistence
    await page.reload()
    await page.waitForSelector('label')

    const reloaded4k = page.locator('label').filter({ hasText: '4K' }).locator('..').locator('input[type="number"]')
    await expect(reloaded4k).toHaveValue('25')

    // Restore original value
    await reloaded4k.fill(originalValue || '16')
    await page.getByRole('button', { name: /Save/ }).click()
    await page.waitForTimeout(1000)
  })
})
