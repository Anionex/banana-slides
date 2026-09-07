import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Real clipboard contents are shared across browser contexts and workers.
test.describe.configure({ mode: 'serial' });

const providers = [
  { id: 'inferera', name: 'Inferera', url: 'https://inferera.com/?aff=17EC' },
  { id: 'apimart', name: 'APIMart', url: 'https://go.apimart.ai/gh-banana-slides' },
  { id: 'volcengine', name: '火山 Agent Plan', url: 'https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides' },
];

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.config.workers > 1, 'Real system clipboard checks require --workers=1 across the entire run, including other spec files.');
  await page.addInitScript(token => localStorage.setItem('banana-slides-user-token', token), randomUUID());
});

for (const provider of providers) {
  test(`${provider.name}: real settings save/reload, help link and clipboard`, async ({ page }) => {
    await page.goto('/settings');
    const select = page.getByRole('combobox', { name: 'API 提供商', exact: true });
    try {
      await select.selectOption(provider.id);
      await page.getByRole('button', { name: '保存设置', exact: true }).click();
      await expect(page.getByText('设置保存成功')).toBeVisible();
      await page.reload();
      await expect(select).toHaveValue(provider.id);
      const step = page.locator('ol > li').first();
      await expect(step).toContainText(`前往 ${provider.name} 注册或登录`);
      await expect(step.getByRole('link')).toBeVisible();
      await expect(step.getByRole('link')).toHaveAttribute('href', provider.url);
      await expect(step.getByRole('link')).toHaveAttribute('target', '_blank');
      await step.getByRole('button', { name: '复制链接', exact: true }).click();
      await expect(page.getByText('链接已复制到剪贴板', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(provider.url);
      await page.getByRole('region', { name: 'API 配置' }).screenshot({ path: test.info().outputPath(`${provider.id}.png`) });
    } finally {
      const token = await page.evaluate(() => localStorage.getItem('banana-slides-user-token'));
      const reset = await page.request.post('/api/settings/reset', { headers: { 'X-User-Token': token! } });
      expect(reset.ok()).toBeTruthy();
    }
  });

  test(`${provider.name}: hiding the link preserves instructions and copy action`, async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('combobox', { name: 'API 提供商', exact: true }).selectOption(provider.id);
    // Reproduce the reported appearance without claiming an extension caused it.
    await page.addStyleTag({ content: 'ol a { display: none !important; }' });
    const step = page.locator('ol > li').first();
    expect(await step.innerText()).toContain(`前往 ${provider.name} 注册或登录`);
    await step.getByRole('button', { name: '复制链接', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(provider.url);
  });
}

test('clipboard rejection shows an error instead of success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: '复制链接', exact: true }).click();
  await expect(page.getByText('复制失败，请手动复制链接', { exact: true })).toBeVisible();
  await expect(page.getByText('链接已复制到剪贴板', { exact: true })).toHaveCount(0);
});

test('legacy clipboard fallback copies the selected provider URL', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
  await page.goto('/settings');
  await page.getByRole('combobox', { name: 'API 提供商', exact: true }).selectOption('apimart');
  await page.getByRole('button', { name: '复制链接', exact: true }).click();
  await expect(page.getByText('链接已复制到剪贴板', { exact: true })).toBeVisible();
  const reader = await page.context().newPage();
  await reader.goto('/');
  expect(await reader.evaluate(() => navigator.clipboard.readText())).toBe(providers[1].url);
  await reader.close();
  await expect(page.locator('textarea')).toHaveCount(0);
});
