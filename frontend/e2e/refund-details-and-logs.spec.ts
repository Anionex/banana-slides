import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const MOCK_TOKENS = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  token_type: 'Bearer',
  expires_in: 3600,
};

const MOCK_USER = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'TestUser',
  subscription_plan: 'free',
  credits_balance: 100,
  credits_used_total: 50,
  projects_count: 0,
  storage_used_mb: 0,
  is_active: true,
  is_admin: false,
  email_verified: true,
  created_at: '2026-01-01T00:00:00Z',
};

const MOCK_ADMIN = { ...MOCK_USER, id: 'admin-1', email: 'admin@example.com', is_admin: true };

async function setupAuth(page: any, user = MOCK_USER) {
  // Set tokens in localStorage before page loads
  await page.addInitScript((data: any) => {
    localStorage.setItem('banana-slides-auth-tokens', JSON.stringify(data.tokens));
    localStorage.setItem('banana-slides-remember-me', 'true');
  }, { tokens: MOCK_TOKENS });

  // Mock all auth-related endpoints
  await page.route('**/api/auth/me', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { user } }) })
  );
  await page.route('**/api/auth/refresh', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...MOCK_TOKENS } }) })
  );
  // Mock credits endpoint (called by auth interceptor)
  await page.route('**/api/payment/credits', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { balance: user.credits_balance, used_total: user.credits_used_total } }) })
  );
}

// ============================================================
// Feature 1: Refund error details in credits history
// ============================================================
test.describe('Credits History - Refund Details', () => {
  const MOCK_TRANSACTIONS = [
    {
      id: 'tx-1',
      user_id: 'user-1',
      operation: 'generate_image',
      amount: -3,
      balance_after: 97,
      description: null,
      project_id: 'proj-1',
      created_at: '2026-02-20T10:00:00Z',
    },
    {
      id: 'tx-2',
      user_id: 'user-1',
      operation: 'refund',
      amount: 2,
      balance_after: 99,
      description: '任务失败退还 - generate_image x2: 批量生成图片部分失败 (2/3)',
      project_id: null,
      created_at: '2026-02-20T10:01:00Z',
    },
    {
      id: 'tx-3',
      user_id: 'user-1',
      operation: 'purchase',
      amount: 100,
      balance_after: 199,
      description: 'Purchase Basic Pack',
      project_id: null,
      created_at: '2026-02-19T08:00:00Z',
    },
  ];

  test('refund row shows expandable description on click', async ({ page }) => {
    await setupAuth(page);

    await page.route('**/api/payment/transactions**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { transactions: MOCK_TRANSACTIONS, total: 3, limit: 20, offset: 0 },
        }),
      })
    );

    await page.goto(`${BASE_URL}/credits`);
    await page.waitForSelector('table');

    // Refund row should exist
    const refundRow = page.locator('tr', { hasText: 'Refund' }).first();
    await expect(refundRow).toBeVisible();

    // Description sub-row should NOT be visible initially
    await expect(page.locator('text=Refund Reason')).not.toBeVisible();

    // Click the refund row to expand
    await refundRow.click();

    // Now the description sub-row should be visible
    await expect(page.locator('text=Refund Reason')).toBeVisible();
    await expect(page.locator('td[colspan] >> text=批量生成图片部分失败')).toBeVisible();

    // Click again to collapse
    await refundRow.click();
    await expect(page.locator('text=Refund Reason')).not.toBeVisible();
  });

  test('non-refund rows are not expandable', async ({ page }) => {
    await setupAuth(page);

    await page.route('**/api/payment/transactions**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { transactions: MOCK_TRANSACTIONS, total: 3, limit: 20, offset: 0 },
        }),
      })
    );

    await page.goto(`${BASE_URL}/credits`);
    await page.waitForSelector('table');

    // Purchase row should exist but not be expandable
    const purchaseRow = page.locator('tr', { hasText: 'Purchase Credits' }).first();
    await purchaseRow.click();

    // No refund reason should appear
    await expect(page.locator('text=Refund Reason')).not.toBeVisible();
  });
});

// ============================================================
// Feature 2: Admin Logs Page (Mock)
// ============================================================
test.describe('Admin Logs Page - Mock', () => {
  const MOCK_LOGS = {
    lines: [
      '2026-02-20 10:00:00 [INFO] app - Server starting on: http://localhost:5000',
      '2026-02-20 10:00:01 [INFO] werkzeug - GET /health 200',
      '2026-02-20 10:01:00 [WARNING] ai_service - Rate limit approaching',
      '2026-02-20 10:02:00 [ERROR] task_manager - Task failed: API timeout',
    ],
    total: 4,
  };

  test('admin logs page renders with filters and log content', async ({ page }) => {
    await setupAuth(page, MOCK_ADMIN);

    await page.route('**/api/admin/logs**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_LOGS }),
      })
    );

    await page.goto(`${BASE_URL}/admin/logs`);

    // Page title
    await expect(page.locator('text=Backend Logs')).toBeVisible();

    // Filter controls should be present
    await expect(page.locator('input[placeholder*="keyword"]')).toBeVisible();
    await expect(page.locator('select')).toHaveCount(2); // level + lines

    // Log content should be displayed
    await expect(page.locator('text=Server starting')).toBeVisible();
    await expect(page.locator('text=Rate limit approaching')).toBeVisible();
    await expect(page.locator('text=Task failed')).toBeVisible();

    // Total count
    await expect(page.locator('text=4')).toBeVisible();
  });

  test('admin logs page filters by level', async ({ page }) => {
    await setupAuth(page, MOCK_ADMIN);

    let lastParams: any = {};
    await page.route('**/api/admin/logs**', (route: any) => {
      const url = new URL(route.request().url());
      lastParams = Object.fromEntries(url.searchParams);
      const level = lastParams.level;

      const filtered = level
        ? MOCK_LOGS.lines.filter((l: string) => l.includes(`[${level}]`))
        : MOCK_LOGS.lines;

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { lines: filtered, total: filtered.length } }),
      });
    });

    await page.goto(`${BASE_URL}/admin/logs`);
    await page.waitForSelector('text=Server starting');

    // Select ERROR level
    const levelSelect = page.locator('select').first();
    await levelSelect.selectOption('ERROR');

    // Wait for filtered results
    await page.waitForResponse('**/api/admin/logs**');
    await expect(page.locator('text=Task failed')).toBeVisible();
  });
});

// ============================================================
// Feature 2: Admin Logs API (Integration)
// ============================================================
test.describe('Admin Logs API - Integration', () => {
  test('admin logs endpoint returns log data', async ({ request }) => {
    // Login as admin
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@bananaslides.com',
        password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
      },
    });

    if (loginRes.status() !== 200) {
      test.skip(true, 'Admin login failed - skipping integration test');
      return;
    }

    const loginData = await loginRes.json();
    const token = loginData.data?.tokens?.access_token;
    if (!token) {
      test.skip(true, 'No access token - skipping integration test');
      return;
    }

    // Call admin logs API
    const logsRes = await request.get(`${BASE_URL}/api/admin/logs?lines=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(logsRes.status()).toBe(200);
    const logsData = await logsRes.json();
    expect(logsData.success).toBe(true);
    expect(logsData.data).toHaveProperty('lines');
    expect(logsData.data).toHaveProperty('total');
    expect(Array.isArray(logsData.data.lines)).toBe(true);
    // Should have some logs since the server is running
    expect(logsData.data.lines.length).toBeGreaterThan(0);
  });
});
