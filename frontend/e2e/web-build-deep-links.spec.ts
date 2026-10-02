import { test, expect } from '@playwright/test';

// Run against `vite preview` or the Docker frontend, never the dev server:
// E2E_WEB_BUILD=1 BASE_URL=http://localhost:3488 CI=true npx playwright test e2e/web-build-deep-links.spec.ts
test.skip(process.env.E2E_WEB_BUILD !== '1', 'Requires a built web frontend and real backend');

test('built web history loads directly and after refresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: '历史项目', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '历史项目', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('built web project preview loads directly and after refresh', async ({ page, request }) => {
  const created = await request.post('/api/projects', {
    data: { creation_type: 'idea', idea_prompt: '生产静态构建预览链接回归' },
  });
  expect(created.ok()).toBeTruthy();
  const projectId = (await created.json()).data.project_id;
  try {
    const added = await request.post(`/api/projects/${projectId}/pages`, {
      data: { order_index: 0, outline_content: { title: '直接打开预览' } },
    });
    expect(added.ok()).toBeTruthy();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/project/${projectId}/preview`);
    await expect(page.getByText('1. 直接打开预览', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('1. 直接打开预览', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '分享 / 保存链接', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    const deleted = await request.delete(`/api/projects/${projectId}`);
    expect(deleted.ok()).toBeTruthy();
  }
});
