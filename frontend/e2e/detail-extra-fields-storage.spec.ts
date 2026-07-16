import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'banana-available-extra-fields';
const DEFAULT_FIELDS = ['视觉元素', '视觉焦点', '排版布局', '演讲者备注'];
const MOCK_PROJECT_ID = 'extra-field-storage-project';

async function openDescriptionSettings(page: Page) {
  await page.getByTitle('描述设置').click();
  await expect(page.getByPlaceholder('添加字段')).toBeVisible();
}

async function setupMockRoutes(page: Page) {
  await page.route('**/api/access-code/check', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { enabled: false } }),
  }));
  await page.route(`**/api/projects/${MOCK_PROJECT_ID}`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        id: MOCK_PROJECT_ID,
        project_id: MOCK_PROJECT_ID,
        status: 'OUTLINE_GENERATED',
        creation_type: 'idea',
        pages: [{
          id: 'page-1',
          page_id: 'page-1',
          order_index: 0,
          status: 'OUTLINE_GENERATED',
          outline_content: { title: '缓存恢复测试', points: [] },
          description_content: null,
        }],
      },
    }),
  }));
  await page.route('**/api/projects/*/files*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [] }),
  }));
  await page.route('**/api/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: {} }),
  }));
}

test.describe('Description extra-field storage recovery', () => {
  test('repairs a non-array cached value and keeps the editor usable', async ({ page }) => {
    await setupMockRoutes(page);
    await page.addInitScript(([key]) => {
      localStorage.setItem(key, JSON.stringify({ field: '旧版对象结构' }));
    }, [STORAGE_KEY]);

    await page.goto(`/project/${MOCK_PROJECT_ID}/detail`);
    await expect(page.getByRole('button', { name: '批量生成描述' })).toBeVisible();
    await openDescriptionSettings(page);

    for (const field of DEFAULT_FIELDS) {
      await expect(page.getByRole('button', { name: new RegExp(`^${field}`) })).toBeVisible();
    }
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY))
      .toEqual(DEFAULT_FIELDS);
  });

  test('real backend project opens and salvages a valid custom field from mixed cache data', async ({ page }) => {
    const frontendUrl = process.env.BASE_URL || 'http://127.0.0.1:3011';
    const backendUrl = process.env.BACKEND_URL
      || `http://127.0.0.1:${Number(new URL(frontendUrl).port || 3011) + 2000}`;
    const projectResponse = await fetch(`${backendUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_type: 'idea', idea_prompt: '额外字段真实后端测试' }),
    });
    expect(projectResponse.ok).toBeTruthy();
    const projectId = (await projectResponse.json()).data.project_id as string;

    try {
      const pageResponse = await fetch(`${backendUrl}/api/projects/${projectId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: 0, outline_content: { title: '真实项目页', points: [] } }),
      });
      expect(pageResponse.ok).toBeTruthy();

      await page.addInitScript(([key]) => {
        localStorage.setItem(key, JSON.stringify(['  自定义指标  ', 7, null, '自定义指标']));
      }, [STORAGE_KEY]);
      await page.goto(`/project/${projectId}/detail`);
      await expect(page.getByRole('button', { name: '批量生成描述' })).toBeVisible();
      await openDescriptionSettings(page);
      await expect(page.getByRole('button', { name: /^自定义指标/ })).toBeVisible();

      const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
      expect(stored).toContain('自定义指标');
      expect(stored).toEqual(expect.arrayContaining(DEFAULT_FIELDS));
      expect(stored.every((field: unknown) => typeof field === 'string')).toBeTruthy();
      expect(new Set(stored).size).toBe(stored.length);
    } finally {
      await fetch(`${backendUrl}/api/projects/${projectId}`, { method: 'DELETE' });
    }
  });
});
