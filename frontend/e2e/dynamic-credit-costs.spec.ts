import { test, expect, Page } from '@playwright/test';

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

async function setupAuth(page: Page) {
  await page.addInitScript((data: any) => {
    localStorage.setItem('banana-slides-auth-tokens', JSON.stringify(data.tokens));
    localStorage.setItem('banana-slides-remember-me', 'true');
  }, { tokens: MOCK_TOKENS });

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { user: MOCK_USER } }) })
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...MOCK_TOKENS } }) })
  );
  await page.route('**/api/payment/credits', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { balance: 100, used_total: 50 } }) })
  );
}

// ============================================================
// Mock test: PricingPage displays dynamic credit costs from API
// ============================================================
test.describe('PricingPage - Dynamic Credit Costs (Mocked)', () => {
  test('displays credit costs fetched from API', async ({ page }) => {
    await setupAuth(page);

    const customCosts = {
      generate_outline: 99, generate_description: 1,
      generate_image_1k: 4, generate_image_2k: 8, generate_image_4k: 16,
      edit_image: 8, generate_material: 10, refine_outline: 2,
      refine_description: 1, parse_file: 5, export_editable: 77,
    };
    await page.route('**/api/payment/credit-costs', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: customCosts }) })
    );
    await page.route('**/api/payment/packages', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { packages: [] } }) })
    );

    await page.goto(`${BASE_URL}/pricing`);

    // Verify custom cost values are displayed (not hardcoded defaults)
    await expect(page.getByText('99 credits').first()).toBeVisible();
    await expect(page.getByText('77 credits').first()).toBeVisible();
  });

  test('hides usage guide when credit-costs API fails', async ({ page }) => {
    await setupAuth(page);

    await page.route('**/api/payment/credit-costs', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' })
    );
    await page.route('**/api/payment/packages', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { packages: [] } }) })
    );

    await page.goto(`${BASE_URL}/pricing`);
    // Usage guide should not render when costs fetch fails
    await expect(page.getByText(/积分消耗说明|Credit Usage Guide/)).not.toBeVisible();
  });
});

// ============================================================
// Integration test: PricingPage fetches real costs from backend
// ============================================================
test.describe('PricingPage - Dynamic Credit Costs (Integration)', () => {
  test('displays real credit costs from backend', async ({ page }) => {
    await setupAuth(page);
    await page.goto(`${BASE_URL}/pricing`);

    // Wait for the usage guide section to appear
    await expect(page.getByText(/积分消耗说明|Credit Usage Guide/)).toBeVisible();

    // Fetch actual costs from API for comparison
    const resp = await page.request.get(`${BASE_URL}/api/payment/credit-costs`);
    const json = await resp.json();
    const costs = json.data;

    // Verify the outline and export cost values are displayed
    await expect(page.getByText(new RegExp(`${costs.generate_outline}\\s*credits`)).first()).toBeVisible();
    await expect(page.getByText(new RegExp(`${costs.export_editable}\\s*credits`)).first()).toBeVisible();
  });
});
