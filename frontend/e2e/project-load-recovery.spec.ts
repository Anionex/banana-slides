import { expect, test } from '@playwright/test';

const PROJECT_ID = 'project-load-recovery';
const project = {
  project_id: PROJECT_ID,
  status: 'OUTLINE_GENERATED',
  creation_type: 'outline',
  outline_text: 'Recovery test outline',
  template_mode: 'multi',
  pages: [{
    page_id: 'page-1',
    order_index: 0,
    status: 'DRAFT',
    outline_content: { title: 'Recovered project', points: ['Visible after retry'] },
  }],
};

async function mockApiFailure(page: import('@playwright/test').Page) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/access-code/check') {
        await route.fulfill({ json: { success: true, data: { enabled: false } } });
        return;
      }
      if (url.pathname === `/api/projects/${PROJECT_ID}`) {
        await route.fulfill({
          status: 503,
          json: { success: false, error: { message: '测试后端暂时不可用' } },
        });
        return;
      }
      await route.fulfill({ json: { success: true, data: {} } });
    },
  );
}

for (const path of ['outline', 'detail', 'template-setup', 'preview']) {
  test(`shows a recoverable project load error on the ${path} route`, async ({ page }) => {
    await mockApiFailure(page);
    await page.goto(`/project/${PROJECT_ID}/${path}`);

    await expect(page.getByRole('heading', { name: '无法打开项目' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('测试后端暂时不可用');
    await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
    await expect(page.getByRole('button', { name: '返回首页' })).toBeVisible();
    await expect(page.getByText(/加载项目中/)).not.toBeVisible();
  });
}

test('retries in place and renders the project after a transient failure', async ({ page }) => {
  let attempts = 0;
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/access-code/check') {
        await route.fulfill({ json: { success: true, data: { enabled: false } } });
        return;
      }
      if (url.pathname === `/api/projects/${PROJECT_ID}`) {
        attempts += 1;
        if (attempts === 1) {
          await route.fulfill({ status: 503, json: { success: false, error: { message: '临时故障' } } });
        } else {
          await route.fulfill({ json: { success: true, data: project } });
        }
        return;
      }
      await route.fulfill({ json: { success: true, data: {} } });
    },
  );

  await page.goto(`/project/${PROJECT_ID}/outline`);
  await expect(page.getByRole('heading', { name: '无法打开项目' })).toBeVisible();
  await page.getByRole('button', { name: '重试' }).click();

  await expect(page.getByText('编辑大纲', { exact: true })).toBeVisible();
  await expect(page.getByText('Recovered project')).toBeVisible();
  expect(attempts).toBe(2);
});

test('does not open a stale history snapshot when project validation fails', async ({ page }) => {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/access-code/check') {
        await route.fulfill({ json: { success: true, data: { enabled: false } } });
        return;
      }
      if (url.pathname === '/api/projects' && route.request().method() === 'GET') {
        await route.fulfill({
          json: { success: true, data: { projects: [project], total: 1 } },
        });
        return;
      }
      if (url.pathname === `/api/projects/${PROJECT_ID}`) {
        await route.fulfill({
          status: 404,
          json: { success: false, error: { message: 'Project not found' } },
        });
        return;
      }
      await route.fulfill({ json: { success: true, data: {} } });
    },
  );

  await page.goto('/history');
  await page.getByText('待生成描述', { exact: true }).click();

  await expect(page).toHaveURL(`/project/${PROJECT_ID}/outline`);
  await expect(page.getByRole('heading', { name: '无法打开项目' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/Project not found|项目不存在/);
  await expect(page.getByText('Recovered project')).not.toBeVisible();
});

test('shows an actual backend 404 and lets the user return home', async ({ page }) => {
  const missingProjectId = `missing-project-${Date.now()}`;
  await page.goto(`/project/${missingProjectId}/outline`);

  await expect(page.getByRole('heading', { name: '无法打开项目' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/Project not found|项目不存在/);
  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(page).toHaveURL(/\/$/);
});
