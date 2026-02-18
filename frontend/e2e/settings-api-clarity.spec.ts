import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
});

test('global API config section shows provider dropdown instead of buttons', async ({ page }) => {
  // Section title should say "全局" not "默认"
  await expect(page.getByText('全局 API 配置')).toBeVisible();
  await expect(page.getByText('默认 API 配置')).not.toBeVisible();

  // Should have a provider dropdown (select), not buttons
  const globalSection = page.locator('div').filter({ hasText: '全局 API 配置' }).first();
  const providerSelect = globalSection.locator('select').first();
  await expect(providerSelect).toBeVisible();

  // Dropdown should contain same vendors as per-model (e.g. Gemini, OpenAI, DeepSeek)
  const options = providerSelect.locator('option');
  const texts = await options.allTextContents();
  expect(texts).toContain('Gemini');
  expect(texts).toContain('OpenAI');
  expect(texts).toContain('DeepSeek');
});

test('per-model provider placeholder references global config', async ({ page }) => {
  // Per-model dropdowns should say "全局配置" not "默认配置"
  const modelSelects = page.locator('select');
  // Find an option with "全局" text
  const globalOption = page.locator('option', { hasText: '全局配置' });
  await expect(globalOption.first()).toBeAttached();
});
