import { test, expect } from '@playwright/test';

test('settings page does not show default API config section', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  // The "默认 API 配置" / "Default API Configuration" section should be gone
  await expect(page.getByText('默认 API 配置')).not.toBeVisible();
  await expect(page.getByText('Default API Configuration')).not.toBeVisible();

  // The global api_provider_format buttons should not exist
  await expect(page.getByText('OpenAI 格式')).not.toBeVisible();
  await expect(page.getByText('Gemini 格式')).not.toBeVisible();

  // Model configuration section should be visible and first
  await expect(page.getByText('模型配置').first()).toBeVisible();

  // Per-model provider dropdowns should still be present
  const providerSelects = page.locator('select');
  await expect(providerSelects.first()).toBeVisible();
});

test('settings page model config cards render correctly', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  // All three model config groups should be present
  await expect(page.getByText('文本大模型').first()).toBeVisible();
  await expect(page.getByText('图像生成模型').first()).toBeVisible();
  await expect(page.getByText('图片识别模型').first()).toBeVisible();
});
