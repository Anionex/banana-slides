import { test, expect } from '@playwright/test'

const mockUsers = [
  {
    id: 'usr-abc-123',
    email: 'test@example.com',
    username: 'testuser',
    subscription_plan: 'free',
    credits_balance: 100,
    is_active: true,
    email_verified: true,
    created_at: '2025-01-01T00:00:00Z',
    last_login_at: '2025-06-01T00:00:00Z',
    is_admin: false,
  },
]

test.describe('Admin Users - ID column', () => {
  test('should display user ID column in the table', async ({ page }) => {
    // Mock auth storage
    await page.addInitScript(() => {
      localStorage.setItem('banana-slides-remember-me', 'true')
      localStorage.setItem('banana-slides-auth-tokens', JSON.stringify({
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
      }))
    })

    const adminUser = { id: 'admin-1', email: 'admin@test.com', is_admin: true, credits_balance: 999 }

    // Mock /api/auth/me
    await page.route('**/api/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { user: adminUser } }),
      }),
    )

    // Mock admin users API
    await page.route('**/api/admin/users*', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { users: mockUsers, total: 1, has_more: false },
        }),
      }),
    )

    await page.goto('/admin/users')

    // Verify ID header exists
    const headers = page.locator('thead th')
    await expect(headers.first()).toHaveText('ID')

    // Verify user ID is displayed in the row
    await expect(page.getByText('usr-abc-123')).toBeVisible()
  })
})
