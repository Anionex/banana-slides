import { test, expect, Page } from '@playwright/test'

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  is_admin: true,
  credits_balance: 999,
}

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

  await page.route('**/api/announcements', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
}

function buildConfigPayload(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  }
}

async function mockConfigApi(page: Page, overrides: Record<string, unknown> = {}) {
  const payload = buildConfigPayload(overrides)

  await page.route('**/api/admin/config', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: payload }),
      })
    }
    if (route.request().method() === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: payload, message: '系统配置更新成功' }),
      })
    }
    return route.fallback()
  })

  await page.route('**/api/payment/packages', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { packages: [] } }),
    }),
  )
}

test.describe('Admin Storage & CDN Settings', () => {
  test('renders storage section with local backend', async ({ page }) => {
    await mockAdminAuth(page)
    await mockConfigApi(page, { storage_backend: 'local' })

    await page.goto('/admin/config')
    await page.waitForLoadState('networkidle')

    // Storage section heading visible (zh locale: "存储 & CDN")
    await expect(page.getByText('存储 & CDN')).toBeVisible()

    // Backend label shows "本地存储"
    await expect(page.getByText('本地存储')).toBeVisible()

    // "由环境变量配置" hint should appear
    await expect(page.getByText('由环境变量配置').first()).toBeVisible()

    // OSS-specific fields should NOT be visible when backend is local
    await expect(page.getByText('OSS Bucket')).not.toBeVisible()
    await expect(page.getByText('OSS Endpoint')).not.toBeVisible()

    // CDN Base URL input should be present
    const cdnInput = page.locator('input[placeholder="https://cdn.example.com"]')
    await expect(cdnInput).toBeVisible()
    await expect(cdnInput).toHaveValue('')
  })

  test('renders storage section with OSS backend and shows bucket/endpoint', async ({ page }) => {
    await mockAdminAuth(page)
    await mockConfigApi(page, {
      storage_backend: 'oss',
      oss_bucket: 'my-bucket',
      oss_endpoint: 'oss-us-west-1.aliyuncs.com',
    })

    await page.goto('/admin/config')
    await page.waitForLoadState('networkidle')

    // Backend label shows "阿里云 OSS"
    await expect(page.getByText('阿里云 OSS')).toBeVisible()

    // OSS Bucket and Endpoint should be visible
    await expect(page.getByText('OSS Bucket')).toBeVisible()
    await expect(page.getByText('my-bucket')).toBeVisible()

    await expect(page.getByText('OSS Endpoint')).toBeVisible()
    await expect(page.getByText('oss-us-west-1.aliyuncs.com')).toBeVisible()
  })

  test('CDN Base URL input is editable', async ({ page }) => {
    await mockAdminAuth(page)
    await mockConfigApi(page)

    await page.goto('/admin/config')
    await page.waitForLoadState('networkidle')

    const cdnInput = page.locator('input[placeholder="https://cdn.example.com"]')
    await expect(cdnInput).toBeVisible()

    // Type a CDN URL
    await cdnInput.fill('https://cdn.my-site.com')
    await expect(cdnInput).toHaveValue('https://cdn.my-site.com')
  })

  test('CDN hint text is displayed', async ({ page }) => {
    await mockAdminAuth(page)
    await mockConfigApi(page)

    await page.goto('/admin/config')
    await page.waitForLoadState('networkidle')

    // Hint: "设置后文件走 CDN 直连，不设置则走后端代理"
    await expect(page.getByText('设置后文件走 CDN 直连，不设置则走后端代理')).toBeVisible()
  })

  test('save button sends updated CDN URL', async ({ page }) => {
    await mockAdminAuth(page)

    const payload = buildConfigPayload()
    let savedData: Record<string, unknown> | null = null

    await page.route('**/api/admin/config', route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: payload }),
        })
      }
      if (route.request().method() === 'PUT') {
        savedData = route.request().postDataJSON()
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...payload, cdn_base_url: 'https://cdn.test.com' }, message: '系统配置更新成功' }),
        })
      }
      return route.fallback()
    })

    await page.route('**/api/payment/packages', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { packages: [] } }),
      }),
    )

    await page.goto('/admin/config')
    await page.waitForLoadState('networkidle')

    // Fill CDN URL
    const cdnInput = page.locator('input[placeholder="https://cdn.example.com"]')
    await cdnInput.fill('https://cdn.test.com')

    // Click save (zh: "保存配置")
    await page.getByRole('button', { name: /保存配置|Save Configuration/ }).click()

    // Wait for the PUT to complete
    await page.waitForTimeout(500)

    // Verify the PUT payload included cdn_base_url
    expect(savedData).not.toBeNull()
    expect((savedData as Record<string, unknown>).cdn_base_url).toBe('https://cdn.test.com')
  })

  test('pre-existing CDN URL is displayed in the input', async ({ page }) => {
    await mockAdminAuth(page)
    await mockConfigApi(page, { cdn_base_url: 'https://existing-cdn.example.com' })

    await page.goto('/admin/config')
    await page.waitForLoadState('networkidle')

    const cdnInput = page.locator('input[placeholder="https://cdn.example.com"]')
    await expect(cdnInput).toHaveValue('https://existing-cdn.example.com')
  })

  test('OSS fields are read-only (no input elements)', async ({ page }) => {
    await mockAdminAuth(page)
    await mockConfigApi(page, {
      storage_backend: 'oss',
      oss_bucket: 'test-bucket',
      oss_endpoint: 'oss-cn-hangzhou.aliyuncs.com',
    })

    await page.goto('/admin/config')
    await page.waitForLoadState('networkidle')

    // The OSS bucket value is displayed as text, not in an input
    const bucketText = page.getByText('test-bucket')
    await expect(bucketText).toBeVisible()

    // Ensure it's inside a div (read-only display), not an input
    const bucketParent = bucketText.locator('..')
    const tagName = await bucketParent.evaluate(el => el.tagName.toLowerCase())
    expect(tagName).toBe('div')
  })
})
