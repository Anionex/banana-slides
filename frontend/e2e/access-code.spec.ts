import { test, expect } from '@playwright/test';

// ===== Mock Tests =====

test.describe('Access Code Guard (mocked)', () => {
  test('shows app directly when access code is disabled', async ({ page }) => {
    await page.route('**/api/access-code/check', route =>
      route.fulfill({ json: { data: { enabled: false } } })
    );
    await page.goto('/');
    // Verify app loaded (no access code prompt)
    await expect(page.getByText('请输入访问口令')).not.toBeVisible({ timeout: 5000 });
  });

  test('shows access code prompt when enabled and no saved code', async ({ page }) => {
    await page.route('**/api/access-code/check', route =>
      route.fulfill({ json: { data: { enabled: true } } })
    );
    await page.goto('/');
    await expect(page.getByText('请输入访问口令')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('grants access after correct code submission', async ({ page }) => {
    await page.route('**/api/access-code/check', route =>
      route.fulfill({ json: { data: { enabled: true } } })
    );
    await page.route('**/api/access-code/verify', route =>
      route.fulfill({ json: { data: { valid: true } } })
    );
    await page.goto('/');
    await page.locator('input[type="password"]').fill('test123');
    await page.getByRole('button', { name: '确认' }).click();
    await expect(page.getByText('请输入访问口令')).not.toBeVisible({ timeout: 10000 });
  });

  test('shows error on wrong code', async ({ page }) => {
    await page.route('**/api/access-code/check', route =>
      route.fulfill({ json: { data: { enabled: true } } })
    );
    await page.route('**/api/access-code/verify', route =>
      route.fulfill({ status: 403, json: { error: 'Invalid access code' } })
    );
    await page.goto('/');
    await page.locator('input[type="password"]').fill('wrong');
    await page.getByRole('button', { name: '确认' }).click();
    await expect(page.getByText('口令错误')).toBeVisible({ timeout: 5000 });
  });

  test('auto-verifies saved code from localStorage', async ({ page }) => {
    let verified = false;
    await page.route('**/api/access-code/check', route =>
      route.fulfill({ json: { data: { enabled: true } } })
    );
    await page.route('**/api/access-code/verify', route => {
      verified = true;
      return route.fulfill({ json: { data: { valid: true } } });
    });
    // Set localStorage before navigating
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('banana-access-code', 'saved-code'));
    await page.reload();
    await expect(page.getByText('请输入访问口令')).not.toBeVisible({ timeout: 10000 });
    expect(verified).toBe(true);
  });
});
