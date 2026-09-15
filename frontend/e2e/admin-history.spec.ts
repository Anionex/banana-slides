import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// The real test receives the local .env password; never write it into artifacts.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenHelpModal', 'true');
    localStorage.setItem('history_page_size', '5');
  });
});

test('real admin history: password, pagination, preview, refresh and exit; public routes stay blocked', async ({ page, request }) => {
  const password = process.env.PUBLIC_DEMO_ADMIN_PASSWORD;
  test.skip(!password, 'Requires the verification backend .env admin password');
  const headers = { 'X-User-Token': randomUUID() };
  const prefix = '管理员历史验收-' + randomUUID().slice(0, 8);
  const created = await Promise.all(Array.from({ length: 6 }, (_, index) => request.post('/api/projects', {
    headers, data: { creation_type: 'idea', idea_prompt: `${prefix}-${index}` },
  })));
  for (const response of created) expect(response.ok()).toBeTruthy();
  expect((await request.post('/api/admin/history', { headers, data: { password: 'wrong-password' } })).status()).toBe(401);
  await page.goto('/');
  await expect(page.getByRole('link', { name: /历史/ })).toHaveCount(0);
  await page.goto('/admin/history');
  await page.getByLabel('管理员口令').fill('wrong-password');
  await page.getByRole('button', { name: '查看历史', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('管理员口令错误。');
  await expect(page.getByRole('heading', { name: '历史项目', exact: true })).toHaveCount(0);
  await page.getByLabel('管理员口令').fill(password!);
  await page.getByRole('button', { name: '查看历史', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(prefix) })).toHaveCount(5);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /删除/ })).toHaveCount(0);
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('heading', { name: new RegExp(prefix) }).first().click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/project\/[^/]+\/preview$/);
  await expect(popup.getByRole('heading', { name: '请保存当前 PPT 链接' })).toBeVisible();
  await popup.close();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(prefix) })).toHaveCount(1);
  expect((await request.get('/api/projects', { headers })).status()).toBe(403);
  const projectId = (await created[0].json()).data.project_id;
  expect((await request.delete(`/api/projects/${projectId}`, { headers })).status()).toBe(403);
  const leaked = await page.evaluate(value => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(item => item.includes(value)), password!);
  expect(leaked).toBe(false);
  await page.getByRole('button', { name: '退出历史查看' }).click();
  await expect(page.getByLabel('管理员口令')).toHaveValue('');
  await page.getByLabel('管理员口令').fill(password!);
  await page.getByRole('button', { name: '查看历史', exact: true }).click();
  await expect(page.getByRole('heading', { name: '历史项目', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('管理员口令')).toHaveValue('');
  await page.goto('/history');
  await expect(page).toHaveURL('/');
});

test('mock admin history: disabled entry, request errors and retry keep the password form usable', async ({ page }) => {
  await page.route(url => url.pathname === '/api/public-config', route => route.fulfill({ json: { success: true, data: { enabled: true, partners: {} } } }));
  let status = 404;
  await page.route(url => url.pathname === '/api/admin/history', route => route.fulfill({ status, json: status === 200 ? { success: true, data: { projects: [], total: 0 } } : { success: false } }));
  await page.goto('/admin/history');
  await page.getByLabel('管理员口令').fill('mock-only');
  await page.getByRole('button', { name: '查看历史', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('入口未启用');
  status = 500;
  await page.getByRole('button', { name: '查看历史', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('加载失败');
  status = 200;
  await page.getByRole('button', { name: '查看历史', exact: true }).click();
  await expect(page.getByText('暂无历史项目', { exact: true })).toBeVisible();
});

test('mock normal history retains editing and selection', async ({ page }) => {
  await page.route(url => url.pathname === '/api/public-config', route => route.fulfill({ json: { success: true, data: { enabled: false, partners: {} } } }));
  let title = '普通模式项目';
  await page.route(url => url.pathname === '/api/projects', route => route.fulfill({ json: { success: true, data: { projects: [{ project_id: 'normal-history', project_title: title, status: 'DRAFT', pages: [] }], total: 1 } } }));
  await page.route(url => url.pathname === '/api/projects/normal-history', async route => {
    title = route.request().postDataJSON().project_title;
    await route.fulfill({ json: { success: true, data: { project_id: 'normal-history', project_title: title, pages: [] } } });
  });
  await page.goto('/history');
  await page.getByRole('heading', { name: title, exact: true }).click();
  await page.getByRole('textbox').fill('仍可修改标题');
  await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('heading', { name: '仍可修改标题' })).toBeVisible();
  await page.getByRole('checkbox').last().check();
  await expect(page.getByRole('button', { name: '批量删除', exact: true })).toBeEnabled();
});
