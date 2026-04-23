import { test, expect, Page } from '@playwright/test'

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  is_admin: true,
  credits_balance: 999,
}

/** Inject fake auth tokens + mock /api/auth/me so the app treats us as admin */
async function mockAdminAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('banana-slides-remember-me', 'true')
    localStorage.setItem('banana-slides-auth-tokens', JSON.stringify({
      access_token: 'fake-token',
      refresh_token: 'fake-refresh',
    }))
    localStorage.setItem('hasSeenHelpModal', 'true')
  })

  await page.route('**/api/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { user: adminUser } }),
    }),
  )

  // Mock token refresh to keep auth alive
  await page.route('**/api/auth/refresh', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { access_token: 'fake-token-refreshed', refresh_token: 'fake-refresh' },
      }),
    }),
  )

  // Suppress announcement popup
  await page.route('**/api/announcements', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
}

/** Mock the admin config API so /admin/config can render */
async function mockAdminConfigApi(page: Page) {
  await page.route('**/api/admin/config', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user_editable_fields: [],
            registration_bonus: 50,
            invitation_bonus: 50,
            max_invitation_codes: 3,
            cost_generate_outline: 5,
            cost_generate_description: 1,
            cost_generate_image_1k: 4,
            cost_generate_image_2k: 8,
            cost_generate_image_4k: 16,
            cost_edit_image: 8,
            cost_generate_material: 10,
            cost_refine_outline: 2,
            cost_refine_description: 1,
            cost_parse_file: 5,
            cost_export_editable: 15,
            enable_credits_purchase: true,
            enable_invitation: true,
            credit_packages: null,
            image_provider_pool: null,
            cdn_base_url: '',
            storage_backend: 'local',
            oss_bucket: '',
            oss_endpoint: '',
          },
        }),
      })
    }
    return route.fallback()
  })

  // Mock packages API
  await page.route('**/api/payment/packages', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { packages: [] } }),
    }),
  )
}

/** Mock dashboard stats endpoint */
async function mockDashboardApi(page: Page) {
  await page.route('**/api/admin/stats*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { total_users: 10, total_projects: 5, credits_consumed: 1000, active_today: 3 } }),
    }),
  )
}

/** Mock admin users API */
async function mockUsersApi(page: Page) {
  await page.route('**/api/admin/users*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { users: [], total: 0, has_more: false } }),
    }),
  )
}

test.describe('Admin Sidebar Layout', () => {
  test('sidebar renders with all nav items visible', async ({ page }) => {
    await mockAdminAuth(page)
    await mockDashboardApi(page)

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Sidebar should be visible (as an <aside>)
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()

    // Brand title "Admin"
    await expect(sidebar.locator('text=Admin')).toBeVisible()

    // All 7 navigation items should be present (zh locale)
    const navLabels = ['仪表盘', '用户管理', '积分明细', '订单审计', '系统配置', '公告管理', '后端日志']
    for (const label of navLabels) {
      await expect(sidebar.getByText(label, { exact: true })).toBeVisible()
    }

    // "返回首页" link at the bottom
    await expect(sidebar.getByText('返回首页')).toBeVisible()
  })

  test('dashboard nav item is active on /admin', async ({ page }) => {
    await mockAdminAuth(page)
    await mockDashboardApi(page)

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside')

    // Dashboard link should have the active style class (banana-50 bg)
    const dashboardLink = sidebar.locator('a[href="/admin"]')
    await expect(dashboardLink).toHaveClass(/bg-banana-50|text-banana/)
  })

  test('navigate between admin pages via sidebar', async ({ page }) => {
    await mockAdminAuth(page)
    await mockDashboardApi(page)
    await mockUsersApi(page)

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside')

    // Click "用户管理"
    await sidebar.getByText('用户管理', { exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/users/)

    // Users link should now be active
    const usersLink = sidebar.locator('a[href="/admin/users"]')
    await expect(usersLink).toHaveClass(/bg-banana-50|text-banana/)
  })

  test('sidebar collapse and expand', async ({ page }) => {
    await mockAdminAuth(page)
    await mockDashboardApi(page)

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside')

    // Initially expanded — nav text labels should be visible
    await expect(sidebar.getByText('仪表盘', { exact: true })).toBeVisible()

    // Click collapse button (the chevron button in the header area)
    const collapseBtn = sidebar.locator('button').first()
    await collapseBtn.click()

    // After collapse, sidebar should be narrower (w-16 = 64px)
    await expect(sidebar).toHaveCSS('width', '64px')

    // "Admin" brand text should be hidden
    await expect(sidebar.locator('span:has-text("Admin")')).not.toBeVisible()

    // Nav text labels should be hidden
    await expect(sidebar.getByText('仪表盘', { exact: true })).not.toBeVisible()

    // But nav links are still present (icon-only)
    const navLinks = sidebar.locator('nav a')
    await expect(navLinks).toHaveCount(7)

    // Click expand button
    await collapseBtn.click()

    // Labels should be visible again
    await expect(sidebar.getByText('仪表盘', { exact: true })).toBeVisible()
  })

  test('back-to-home link navigates to /app', async ({ page }) => {
    await mockAdminAuth(page)
    await mockDashboardApi(page)

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside')
    const homeLink = sidebar.locator('a[href="/app"]')
    await expect(homeLink).toBeVisible()
    await expect(homeLink).toContainText('返回首页')
  })

  test('sidebar is present on all admin sub-pages', async ({ page }) => {
    await mockAdminAuth(page)
    await mockAdminConfigApi(page)
    await mockUsersApi(page)

    await page.goto('/admin/config')
    await page.waitForLoadState('networkidle')

    // Sidebar should be visible even on config page
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()

    // Config link should be active
    const configLink = sidebar.locator('a[href="/admin/config"]')
    await expect(configLink).toHaveClass(/bg-banana-50|text-banana/)
  })
})
