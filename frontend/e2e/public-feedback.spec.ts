import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.use({ trace: 'off', video: 'off' });

test('real public feedback: submit on landing, inspect in admin inbox, and reauthenticate after refresh', async ({ page, request }) => {
  const password = process.env.PUBLIC_DEMO_ADMIN_PASSWORD;
  test.skip(!password, 'Requires a local public-demo backend admin password');
  const message = `反馈验收-${randomUUID()}`;

  await page.goto('/');
  await expect(page.locator('.landing-page')).toBeVisible();
  await page.getByRole('button', { name: '反馈问题' }).click();
  await page.getByRole('textbox', { name: '问题描述' }).fill(message);
  await page.getByRole('textbox', { name: /联系邮箱/ }).fill('feedback-check@example.com');
  await page.getByRole('button', { name: '提交反馈' }).click();
  await expect(page.getByRole('status')).toContainText('已收到');

  await page.goto('/app');
  await expect(page.getByRole('button', { name: '反馈问题' })).toBeVisible();
  await page.goto('/admin/feedback');
  await page.getByLabel('管理员口令').fill('wrong-password');
  await page.getByRole('button', { name: '查看反馈' }).click();
  await expect(page.getByRole('alert')).toContainText('口令错误');
  await page.getByLabel('管理员口令').fill(password!);
  await page.getByRole('button', { name: '查看反馈' }).click();
  const report = page.locator('article').filter({ hasText: message });
  await expect(report).toBeVisible();
  await expect(report).toContainText('feedback-check@example.com');
  await expect(report.getByRole('link', { name: '/' })).toBeVisible();

  const leaked = await page.evaluate(value => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(item => item.includes(value)), password!);
  expect(leaked).toBe(false);
  const token = await page.evaluate(() => localStorage.getItem('banana-slides-user-token'));
  const unauthorized = await request.post('/api/admin/feedback', { headers: { 'X-User-Token': token! }, data: { password: 'wrong-password' } });
  expect(unauthorized.status()).toBe(401);

  await page.reload();
  await expect(page.getByLabel('管理员口令')).toBeVisible();
  await expect(page.getByText(message)).toHaveCount(0);
});

test('feedback retains the draft when submission fails and can be retried', async ({ page }) => {
  await page.goto('/');
  await page.route(url => url.pathname === '/api/feedback', route => route.fulfill({ status: 503, json: { success: false } }));
  await page.getByRole('button', { name: '反馈问题' }).click();
  await page.getByRole('textbox', { name: '问题描述' }).fill('请帮忙修复这个问题');
  await page.getByRole('button', { name: '提交反馈' }).click();
  await expect(page.getByRole('alert')).toContainText('暂时无法提交');
  await expect(page.getByRole('textbox', { name: '问题描述' })).toHaveValue('请帮忙修复这个问题');
});
