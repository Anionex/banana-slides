import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
});

test('default API config section shows provider dropdown instead of buttons', async ({ page }) => {
  await expect(page.getByText('默认 API 配置')).toBeVisible();

  // Should have a provider dropdown (select), not buttons
  const section = page.getByTestId('global-api-config-section');
  const providerSelect = section.locator('select').first();
  await expect(providerSelect).toBeVisible();

  // Dropdown should contain same vendors as per-model
  const texts = await providerSelect.locator('option').allTextContents();
  expect(texts).toContain('Gemini');
  expect(texts).toContain('OpenAI');
  expect(texts).toContain('DeepSeek');
});

test('per-model provider placeholder references default config', async ({ page }) => {
  const defaultOption = page.locator('option', { hasText: '默认配置' });
  await expect(defaultOption.first()).toBeAttached();
});
