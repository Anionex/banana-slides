import { test, expect } from '@playwright/test';

// Opt in against an isolated backend already connected to Codex OAuth.
// CI=1 CODEX_IMAGE_LIVE=1 BASE_URL=http://localhost:<port> npx playwright test e2e/codex-image-live.spec.ts
test('Codex OAuth generates an image through the settings service test', async ({ page, request }) => {
  test.skip(process.env.CODEX_IMAGE_LIVE !== '1', 'Requires a connected Codex account and consumes image quota');
  test.setTimeout(240_000);

  const settingsResponse = await request.get('/api/settings');
  expect(settingsResponse.ok()).toBeTruthy();
  const { data: settings } = await settingsResponse.json();
  expect(settings.ai_provider_format).toBe('codex');
  expect(settings.image_model_source || 'codex').toBe('codex');
  expect(settings.image_model).toBe('gpt-image-2');

  await page.goto('/settings');
  await expect(page.locator('input[value="gpt-image-2"]')).toBeVisible();
  const card = page.locator('div.py-4.border-b').filter({
    hasText: /Generate presentation background from test image|基于测试图片生成演示文稿背景图/,
  });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: /Start Test|开始测试/ }).click();
  await expect(card.locator('p.text-green-600')).toContainText('图像生成模型测试成功', { timeout: 210_000 });
  await expect(card.locator('p.text-green-600')).toContainText(/\d+x\d+/);
  await expect(card.locator('p.text-red-600')).toHaveCount(0);
});
