import { expect, test } from '@playwright/test';

test.skip(process.env.E2E_PUBLIC_LANDING !== '1', 'Requires the hosted public landing');

test.beforeEach(async ({ page }) => {
  await page.route('https://cloud.umami.is/**', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'zh'));
});

test('signup shows a recoverable error for a failed API request', async ({ page }) => {
  await page.route(url => url.pathname === '/api/waitlist', route => route.fulfill({ status: 500, body: '{}' }));
  await page.goto('/');
  await page.getByLabel('你的邮箱地址').fill('trial@example.com');
  await page.getByRole('button', { name: '预约内测' }).click();
  await expect(page.getByRole('status')).toContainText('提交失败，请稍后重试。');
  await expect(page.getByLabel('你的邮箱地址')).toHaveValue('trial@example.com');
});

test('real signup persists once and owner exports the CSV', async ({ page }) => {
  const email = `waitlist-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByLabel('你的邮箱地址').fill(email);
  await page.getByRole('button', { name: '预约内测' }).click();
  await expect(page.getByRole('status')).toContainText('已收到预约');
  await page.getByLabel('你的邮箱地址').fill(email.toUpperCase());
  await page.getByRole('button', { name: '预约内测' }).click();
  await expect(page.getByRole('status')).toContainText('已收到预约');

  await page.goto('/admin/history');
  await page.getByLabel('管理员口令').fill('local-waitlist-test-password');
  await page.getByRole('button', { name: '查看历史' }).click();
  await expect(page.getByRole('button', { name: '导出内测邮箱' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出内测邮箱' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString();
  expect(csv.split('\n').filter(line => line.includes(email))).toHaveLength(1);
});
