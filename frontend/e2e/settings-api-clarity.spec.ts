import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
});

test('default API config section shows every provider as visible pills', async ({ page }) => {
  await expect(page.getByText('默认 API 配置')).toBeVisible();

  const section = page.getByTestId('global-api-config-section');
  const pills = section.getByTestId('global-provider-pills');
  await expect(pills).toBeVisible();
  await expect(pills.locator('[data-provider="gemini"]')).toBeVisible();
  await expect(pills.locator('[data-provider="openai"]')).toBeVisible();
  await expect(pills.locator('[data-provider="deepseek"]')).toBeVisible();
  await expect(pills.locator('[data-provider="volcengine"]')).toContainText('国内直连 · 高性价比');
});

test('per-model provider placeholder references default config', async ({ page }) => {
  const defaultOption = page.locator('option', { hasText: '默认配置' });
  await expect(defaultOption.first()).toBeAttached();
});
