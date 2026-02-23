/**
 * E2E tests for admin transaction user search (name/email/ID)
 */
import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bananaslides.online'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/app')
}

test.describe('Admin Transactions - User Search', () => {
  test('sends user_search param, shows correct placeholder, no errors on search', async ({ page }) => {
    await loginAsAdmin(page)

    // Intercept transactions API to capture params
    let capturedParams: URLSearchParams | null = null
    await page.route('**/api/admin/transactions*', route => {
      capturedParams = new URL(route.request().url()).searchParams
      return route.continue()
    })

    await page.goto(`${BASE_URL}/admin/transactions`)
    const input = page.locator('input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 10000 })

    // Verify placeholder mentions email (zh or en)
    const placeholder = await input.getAttribute('placeholder')
    expect(placeholder).toMatch(/邮箱|email/i)

    // Type search and verify param name is user_search (not user_id)
    await input.fill('admin')
    await page.waitForResponse(resp => resp.url().includes('/api/admin/transactions'))

    expect(capturedParams).not.toBeNull()
    expect(capturedParams!.get('user_search')).toBe('admin')
    expect(capturedParams!.has('user_id')).toBe(false)

    // No error shown
    await expect(page.locator('text=Failed to load')).not.toBeVisible()
  })
})
