import { test, expect } from '@playwright/test';

const mockProjects: Record<string, any> = {};

function makeProject(projectId: string, creationType: string, payload: any, status = 'DRAFT') {
  return {
    project_id: projectId,
    id: projectId,
    creation_type: creationType,
    idea_prompt: payload.idea_prompt || '',
    outline_text: payload.outline_text,
    description_text: payload.description_text,
    status,
    pages: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

test.describe('Home async generation', () => {
  test.beforeEach(async ({ page }) => {
    for (const key of Object.keys(mockProjects)) delete mockProjects[key];

    await page.route('**/api/user-templates', async (route) => {
      await route.fulfill({ json: { success: true, data: { templates: [] } } });
    });

    await page.route('**/api/settings', async (route) => {
      await route.fulfill({ json: { success: true, data: {} } });
    });

    await page.route('**/api/projects', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      const payload = route.request().postDataJSON();
      const projectId = `project-${Object.keys(mockProjects).length + 1}`;
      mockProjects[projectId] = makeProject(projectId, payload.creation_type, payload);

      await route.fulfill({
        status: 201,
        json: { success: true, data: { project_id: projectId, status: 'DRAFT', pages: [] } },
      });
    });

    await page.route('**/api/projects/*', async (route) => {
      const url = new URL(route.request().url());
      const parts = url.pathname.split('/');
      const projectId = parts[3];
      const project = mockProjects[projectId];

      if (route.request().method() !== 'GET' || !project || parts.length !== 4) {
        await route.continue();
        return;
      }

      await route.fulfill({ json: { success: true, data: project } });
    });

    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true');
    });
  });

  test('from outline starts a background task and polls it', async ({ page }) => {
    const calls: string[] = [];

    await page.route('**/api/projects/*/generate/outline/task', async (route) => {
      calls.push(route.request().url());
      const projectId = new URL(route.request().url()).pathname.split('/')[3];
      mockProjects[projectId].status = 'GENERATING_OUTLINE';
      await route.fulfill({
        status: 202,
        json: { success: true, data: { task_id: 'outline-task-1', status: 'GENERATING_OUTLINE' } },
      });
    });

    await page.route('**/api/projects/*/generate/outline', async (route) => {
      throw new Error(`sync outline endpoint should not be called: ${route.request().url()}`);
    });

    await page.route('**/api/projects/*/tasks/outline-task-1', async (route) => {
      const projectId = new URL(route.request().url()).pathname.split('/')[3];
      mockProjects[projectId].status = 'OUTLINE_GENERATED';
      mockProjects[projectId].pages = [
        {
          page_id: 'page-1',
          id: 'page-1',
          order_index: 0,
          outline_content: { title: '异步大纲页', points: ['不会等待同步长请求'] },
          status: 'DRAFT',
        },
      ];
      await route.fulfill({
        json: { success: true, data: { task_id: 'outline-task-1', status: 'COMPLETED', progress: { total: 1, completed: 1 } } },
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: '从大纲生成' }).click();
    await page.getByRole('textbox').fill('第一页\n- 不会等待同步长请求');
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page).toHaveURL(/\/project\/project-1\/outline/);
    expect(calls).toHaveLength(1);
  });

  test('from description starts a background task and polls it', async ({ page }) => {
    const calls: string[] = [];

    await page.route('**/api/projects/*/generate/from-description/task', async (route) => {
      calls.push(route.request().url());
      const projectId = new URL(route.request().url()).pathname.split('/')[3];
      mockProjects[projectId].status = 'GENERATING_DESCRIPTIONS';
      await route.fulfill({
        status: 202,
        json: { success: true, data: { task_id: 'description-task-1', status: 'GENERATING_DESCRIPTIONS' } },
      });
    });

    await page.route('**/api/projects/*/generate/from-description', async (route) => {
      throw new Error(`sync description endpoint should not be called: ${route.request().url()}`);
    });

    await page.route('**/api/projects/*/tasks/description-task-1', async (route) => {
      const projectId = new URL(route.request().url()).pathname.split('/')[3];
      mockProjects[projectId].status = 'DESCRIPTIONS_GENERATED';
      mockProjects[projectId].pages = [
        {
          page_id: 'page-1',
          id: 'page-1',
          order_index: 0,
          outline_content: { title: '异步描述页', points: ['已生成描述'] },
          description_content: { text: '页面描述已落库' },
          status: 'DESCRIPTION_GENERATED',
        },
      ];
      await route.fulfill({
        json: { success: true, data: { task_id: 'description-task-1', status: 'COMPLETED', progress: { total: 2, completed: 2 } } },
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: '从描述生成' }).click();
    await page.getByRole('textbox').fill('第一页：页面描述已落库');
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page).toHaveURL(/\/project\/project-1\/detail/);
    expect(calls).toHaveLength(1);
  });
});
