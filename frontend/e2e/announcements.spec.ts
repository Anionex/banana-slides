import { test, expect, Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3003'
const ADMIN_EMAIL = 'admin@bananaslides.online'
const ADMIN_PASSWORD = 'ydw20040928Z#admin'

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.evaluate(() => localStorage.setItem('hasSeenHelpModal', 'true'))
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app/)
}

/** Dismiss all announcements via localStorage so popup never appears */
async function dismissAllAnnouncements(page: Page) {
  await page.evaluate(async () => {
    const tokensJson = sessionStorage.getItem('banana-slides-auth-tokens')
      || localStorage.getItem('banana-slides-auth-tokens');
    const token = tokensJson ? JSON.parse(tokensJson).access_token : '';
    const res = await fetch('/api/announcements', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const ids = (json.data || []).map((a: { id: string }) => a.id);
    const prev = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
    localStorage.setItem('dismissed_announcements', JSON.stringify([...new Set([...prev, ...ids])]));
  });
  await page.reload();
  await page.waitForTimeout(500);
}

test.describe('Announcements - Mock UI Tests', () => {
  test('popup shows and "don\'t remind" persists to localStorage', async ({ page }) => {
    // Set up route mock BEFORE login
    await page.route('**/api/announcements', route => {
      if (route.request().url().includes('/all')) return route.fallback()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 'test-ann-1',
            title: 'Test Announcement',
            content: 'This is a test body.',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: null,
          }],
        }),
      })
    })

    // Clear dismissed list and suppress help modal before login
    await page.goto(`${BASE_URL}/login`)
    await page.evaluate(() => {
      localStorage.removeItem('dismissed_announcements')
      localStorage.setItem('hasSeenHelpModal', 'true')
    })

    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/app/)
    await page.waitForTimeout(1500)

    // Popup should be visible
    await expect(page.locator('text=Test Announcement')).toBeVisible()

    // Check "don't remind" and close
    const popup = page.locator('[data-testid="announcement-popup"]')
    await popup.locator('input[type="checkbox"]').check()
    await popup.locator('button:has(svg)').click()

    // Verify dismissed in localStorage
    const dismissed = await page.evaluate(() => localStorage.getItem('dismissed_announcements'))
    expect(dismissed).toContain('test-ann-1')
  })

  test('popup does not show for dismissed announcements', async ({ page }) => {
    await page.route('**/api/announcements', route => {
      if (route.request().url().includes('/all')) return route.fallback()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ id: 'test-ann-1', title: 'Hidden', content: 'Should not show.', is_active: true, created_at: new Date().toISOString(), updated_at: null }],
        }),
      })
    })

    await page.goto(`${BASE_URL}/login`)
    await page.evaluate(() => {
      localStorage.setItem('dismissed_announcements', JSON.stringify(['test-ann-1']))
      localStorage.setItem('hasSeenHelpModal', 'true')
    })

    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/app/)
    await page.waitForTimeout(1500)

    await expect(page.locator('text=Should not show.')).not.toBeVisible()
  })

  test('announcements page renders mocked list', async ({ page }) => {
    await page.route('**/api/announcements', route => {
      if (route.request().url().includes('/all')) return route.fallback()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'a1', title: 'First Ann', content: 'Content 1', is_active: true, created_at: '2026-01-01T00:00:00', updated_at: null },
            { id: 'a2', title: 'Second Ann', content: 'Content 2', is_active: true, created_at: '2026-01-02T00:00:00', updated_at: null },
          ],
        }),
      })
    })

    await loginAsAdmin(page)
    await dismissAllAnnouncements(page)
    await page.goto(`${BASE_URL}/announcements`)
    await page.waitForTimeout(500)

    await expect(page.locator('text=First Ann')).toBeVisible()
    await expect(page.locator('text=Second Ann')).toBeVisible()
  })

  test('admin page shows create form', async ({ page }) => {
    // Mock both endpoints to suppress popup and provide empty admin list
    await page.route('**/api/announcements/all**', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0 } }) })
    })
    await page.route('**/api/announcements', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    })

    await loginAsAdmin(page)
    await page.goto(`${BASE_URL}/admin/announcements`)
    await page.waitForTimeout(500)

    const createBtn = page.getByRole('button', { name: /New Announcement|发布公告/ })
    await expect(createBtn).toBeVisible()
    await createBtn.click()

    await expect(page.locator('textarea')).toBeVisible()
  })
})

test.describe('Announcements - Integration Tests', () => {
  test('admin CRUD: create, view on user page, toggle, delete', async ({ page }) => {
    await loginAsAdmin(page)
    await dismissAllAnnouncements(page)

    await page.goto(`${BASE_URL}/admin/announcements`)
    await page.waitForTimeout(500)

    // Create
    await page.getByRole('button', { name: /New Announcement|发布公告/ }).click()
    const uniqueTitle = `E2E ${Date.now()}`
    await page.locator('input').first().fill(uniqueTitle)
    await page.locator('textarea').fill('E2E body')
    await page.getByRole('button', { name: /Save|保存/ }).click()
    await page.waitForTimeout(1000)

    // Verify in admin list
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible()

    // Dismiss the newly created announcement popup
    await dismissAllAnnouncements(page)

    // Verify on user announcements page
    await page.goto(`${BASE_URL}/announcements`)
    await page.waitForTimeout(500)
    await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible()

    // Go back to admin, toggle off
    await page.goto(`${BASE_URL}/admin/announcements`)
    await page.waitForTimeout(500)
    const row = page.locator(`text=${uniqueTitle}`).locator('xpath=ancestor::div[contains(@class,"rounded-xl")]')
    await row.getByRole('button', { name: /Deactivate|下线/ }).click()
    await page.waitForTimeout(1000)

    // Verify inactive badge
    await expect(row.locator('text=/Inactive|已下线/')).toBeVisible()

    // Delete
    page.on('dialog', d => d.accept())
    await row.getByRole('button', { name: /Delete|删除/ }).click()
    await page.waitForTimeout(1000)
    await expect(page.locator(`text=${uniqueTitle}`)).not.toBeVisible()
  })
})
