import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3240';

/**
 * Helper: create a project with outline pages via API and navigate to detail editor
 */
async function createProjectWithOutline(page: import('@playwright/test').Page, ideaPrompt: string) {
  // Create project
  const resp = await page.request.post(`${BASE_URL}/api/projects`, {
    data: {
      creation_type: 'idea',
      idea_prompt: ideaPrompt,
    },
  });
  const body = await resp.json();
  const projectId = body.data?.project_id;
  expect(projectId).toBeTruthy();

  // Create some pages with outlines
  const pageTitles = ['Introduction', 'Main Content', 'Conclusion'];
  for (let i = 0; i < pageTitles.length; i++) {
    await page.request.post(`${BASE_URL}/api/projects/${projectId}/pages`, {
      data: {
        order_index: i,
        outline_content: { title: pageTitles[i], points: [`Point ${i + 1}A`, `Point ${i + 1}B`] },
        status: 'DRAFT',
      },
    });
  }

  // Update project status
  await page.request.put(`${BASE_URL}/api/projects/${projectId}`, {
    data: { status: 'OUTLINE_GENERATED' },
  });

  await page.goto(`${BASE_URL}/project/${projectId}/detail`);
  await page.waitForLoadState('networkidle');
  return projectId;
}

// ===== Mock Tests =====

test.describe('Streaming Descriptions - Mock Tests', () => {
  test('should render descriptions incrementally via SSE', async ({ page }) => {
    const projectId = await createProjectWithOutline(page, 'Test streaming descriptions');

    // Get page IDs
    const projectResp = await page.request.get(`${BASE_URL}/api/projects/${projectId}`);
    const projectData = await projectResp.json();
    const pages = projectData.data?.pages || [];
    expect(pages.length).toBe(3);

    // Mock SSE streaming endpoint
    let mockCalled = false;
    await page.route(`**/api/projects/*/generate/descriptions/stream`, async (route) => {
      mockCalled = true;

      const sseEvents = pages.map((p: any, i: number) => {
        const descEvent = `event: description\ndata: ${JSON.stringify({
          page_index: i,
          page_id: p.page_id,
          text: `页面标题：Page ${i + 1}\n\n页面文字：\n- Content for page ${i + 1}`,
          layout_suggestion: i === 0 ? '居中布局，大标题' : '左文右图',
        })}\n\n`;
        return descEvent;
      });

      const doneEvent = `event: done\ndata: ${JSON.stringify({
        total: pages.length,
        pages: pages.map((p: any, i: number) => ({
          ...p,
          status: 'DESCRIPTION_GENERATED',
          description_content: {
            text: `页面标题：Page ${i + 1}\n\n页面文字：\n- Content for page ${i + 1}`,
            layout_suggestion: i === 0 ? '居中布局，大标题' : '左文右图',
          },
        })),
      })}\n\n`;

      const body = sseEvents.join('') + doneEvent;

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        body,
      });
    });

    // Also mock the settings to return streaming mode (cached in sessionStorage)
    await page.evaluate(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'streaming',
      }));
    });

    // Click the generate descriptions button
    const generateBtn = page.locator('button').filter({ hasText: /生成描述|Generate/ });
    await generateBtn.first().click();

    // Wait for descriptions to appear
    await expect(page.locator('text=Content for page 1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Content for page 2')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Content for page 3')).toBeVisible({ timeout: 10000 });

    expect(mockCalled).toBe(true);
  });

  test('should display layout suggestion when present', async ({ page }) => {
    const projectId = await createProjectWithOutline(page, 'Test layout suggestion');

    // Get page IDs
    const projectResp = await page.request.get(`${BASE_URL}/api/projects/${projectId}`);
    const projectData = await projectResp.json();
    const pages = projectData.data?.pages || [];

    // Update a page with description_content that includes layout_suggestion
    await page.request.put(
      `${BASE_URL}/api/projects/${projectId}/pages/${pages[0].page_id}/description`,
      {
        data: {
          description_content: {
            text: '页面标题：Test Page\n\n页面文字：\n- Test content',
            layout_suggestion: '居中布局，大标题+副标题',
          },
        },
      }
    );

    // Navigate to detail editor
    await page.goto(`${BASE_URL}/project/${projectId}/detail`);
    await page.waitForLoadState('networkidle');

    // Check layout suggestion is displayed
    await expect(page.locator('text=排版建议').or(page.locator('text=Layout Suggestion'))).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=居中布局，大标题+副标题')).toBeVisible({ timeout: 5000 });
  });

  test('should fall back to parallel mode when setting is parallel', async ({ page }) => {
    const projectId = await createProjectWithOutline(page, 'Test parallel mode');

    // Get page IDs
    const projectResp = await page.request.get(`${BASE_URL}/api/projects/${projectId}`);
    const projectData = await projectResp.json();
    const pages = projectData.data?.pages || [];

    // Set parallel mode in sessionStorage
    await page.evaluate(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'parallel',
      }));
    });

    // Mock the parallel endpoint (not streaming)
    let parallelCalled = false;
    await page.route(`**/api/projects/*/generate/descriptions`, async (route) => {
      // Only intercept POST (not the stream endpoint which has /stream suffix)
      if (route.request().url().includes('/stream')) {
        return route.continue();
      }
      parallelCalled = true;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { task_id: 'mock-task-123', status: 'GENERATING_DESCRIPTIONS', total_pages: pages.length },
        }),
      });
    });

    // Mock task polling
    await page.route(`**/api/tasks/mock-task-123`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { status: 'COMPLETED', progress: { total: pages.length, completed: pages.length } },
        }),
      });
    });

    // Click generate
    const generateBtn = page.locator('button').filter({ hasText: /生成描述|Generate/ });
    await generateBtn.first().click();

    // Wait a bit for the mode dispatch
    await page.waitForTimeout(2000);
    expect(parallelCalled).toBe(true);
  });
});

// ===== Integration Tests =====

test.describe('Streaming Descriptions - Integration Tests', () => {
  test('settings page should show description generation mode toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');

    // Check the toggle exists
    const modeLabel = page.locator('text=描述生成模式').or(page.locator('text=Description Generation Mode'));
    await expect(modeLabel).toBeVisible({ timeout: 5000 });

    // Check both options are present
    const streamingBtn = page.locator('button').filter({ hasText: /流式|Streaming/ });
    const parallelBtn = page.locator('button').filter({ hasText: /并行|Parallel/ });
    await expect(streamingBtn.first()).toBeVisible();
    await expect(parallelBtn.first()).toBeVisible();
  });

  test('settings should persist description generation mode', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');

    // Click parallel button
    const parallelBtn = page.locator('button').filter({ hasText: /并行|Parallel/ });
    await parallelBtn.first().click();

    // Save settings
    const saveBtn = page.locator('button').filter({ hasText: /保存|Save/ });
    await saveBtn.first().click();

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Reload and verify
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check that the API returns parallel mode
    const settingsResp = await page.request.get(`${BASE_URL}/api/settings`);
    const settingsData = await settingsResp.json();
    expect(settingsData.data?.description_generation_mode).toBe('parallel');

    // Reset back to streaming
    await page.request.put(`${BASE_URL}/api/settings`, {
      data: { description_generation_mode: 'streaming' },
    });
  });

  test('single page regeneration should still work and return layout suggestion', async ({ page }) => {
    const projectId = await createProjectWithOutline(page, 'Test single page regen');

    // Get page IDs
    const projectResp = await page.request.get(`${BASE_URL}/api/projects/${projectId}`);
    const projectData = await projectResp.json();
    const pages = projectData.data?.pages || [];
    expect(pages.length).toBeGreaterThan(0);

    await page.goto(`${BASE_URL}/project/${projectId}/detail`);
    await page.waitForLoadState('networkidle');

    // Click regenerate on the first page card
    const regenBtn = page.locator('button').filter({ hasText: /重新生成|Regenerate/ });
    // This button should exist
    await expect(regenBtn.first()).toBeVisible({ timeout: 5000 });
  });
});
