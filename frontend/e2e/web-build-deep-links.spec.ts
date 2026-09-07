import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Run against `vite preview` or the Docker frontend, never the dev server:
// E2E_WEB_BUILD=1 BASE_URL=http://localhost:3488 CI=true npx playwright test e2e/web-build-deep-links.spec.ts
test.skip(process.env.E2E_WEB_BUILD !== '1', 'Requires a built public-demo frontend and real backend');

test('built web admin history loads directly and after refresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/admin/history');
  await expect(page.getByLabel('管理员口令')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '查看历史', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('built web shared preview loads directly and after refresh', async ({ page, request }) => {
  const headers = { 'X-User-Token': randomUUID() };
  const created = await request.post('/api/projects', {
    headers, data: { creation_type: 'idea', idea_prompt: '生产静态构建分享链接回归' },
  });
  expect(created.ok()).toBeTruthy();
  const projectId = (await created.json()).data.project_id;
  const added = await request.post(`/api/projects/${projectId}/pages`, {
    headers, data: { order_index: 0, outline_content: { title: '直接打开预览' } },
  });
  expect(added.ok()).toBeTruthy();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/project/${projectId}/preview`);
  await expect(page.getByRole('heading', { name: '请保存当前 PPT 链接' })).toBeVisible();
  await expect(page.getByLabel('当前 PPT 链接', { exact: true })).toHaveValue(page.url());
  await page.getByRole('button', { name: '我知道了', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '分享 / 保存链接', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
