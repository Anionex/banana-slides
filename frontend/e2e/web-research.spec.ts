import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3240';

test.describe('Web Research Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));
  });

  test.describe('Mock Tests', () => {
    test('web research toggle is visible only on idea tab', async ({ page }) => {
      await page.goto(`${BASE_URL}/`);
      await page.waitForLoadState('networkidle');

      const toggle = page.locator('label:has-text("联网搜索"), label:has-text("Web Research")').first();
      await expect(toggle).toBeVisible();

      // Switch to outline tab
      await page.locator('button').filter({ hasText: /从大纲生成|From Outline/i }).click();
      await page.waitForTimeout(300);
      await expect(toggle).not.toBeVisible();

      // Switch back to idea tab
      await page.locator('button').filter({ hasText: /一句话生成|From Idea/i }).click();
      await page.waitForTimeout(300);
      await expect(toggle).toBeVisible();
    });

    test('web research toggle can be checked and unchecked', async ({ page }) => {
      await page.goto(`${BASE_URL}/`);
      await page.waitForLoadState('networkidle');

      const label = page.locator('label:has-text("联网搜索"), label:has-text("Web Research")').first();
      const checkbox = label.locator('input[type="checkbox"]');

      await expect(checkbox).not.toBeChecked();
      await label.click();
      await expect(checkbox).toBeChecked();
      await label.click();
      await expect(checkbox).not.toBeChecked();
    });

    test('research API is called when toggle is enabled', async ({ page }) => {
      let researchCalled = false;

      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { project_id: 'test-project-123', status: 'CREATED' } }),
          });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/projects/test-project-123/research', async (route) => {
        researchCalled = true;
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { task_id: 'research-task-1' } }),
        });
      });

      await page.route('**/api/projects/test-project-123/tasks/research-task-1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'research-task-1', status: 'COMPLETED', progress: { stage: 'completed' } },
          }),
        });
      });

      await page.route('**/api/projects/test-project-123/generate/outline', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { pages: [] } }),
        });
      });

      await page.route('**/api/projects/test-project-123', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { id: 'test-project-123', title: 'Test', status: 'OUTLINE_READY', pages: [] },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/`);
      await page.waitForLoadState('networkidle');

      // Enable web research toggle
      const label = page.locator('label:has-text("联网搜索"), label:has-text("Web Research")').first();
      await label.click();

      // Fill in idea using contenteditable editor
      const editor = page.locator('[role="textbox"][contenteditable="true"]').first();
      await editor.click();
      await editor.pressSequentially('AI trends in 2026', { delay: 10 });

      await page.locator('button').filter({ hasText: /下一步|Next/i }).click();
      await page.waitForTimeout(2000);

      expect(researchCalled).toBe(true);
    });

    test('progress log panel shows messages during research', async ({ page }) => {
      let progressCallCount = 0;

      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { project_id: 'test-project-log' } }),
          });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/projects/test-project-log/research', async (route) => {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { task_id: 'log-task-1' } }),
        });
      });

      await page.route('**/api/projects/test-project-log/research/log-task-1/progress', async (route) => {
        progressCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { messages: ['Searching for AI trends...', 'Analyzing sources...'] } }),
        });
      });

      let taskCallCount = 0;
      await page.route('**/api/projects/test-project-log/tasks/log-task-1', async (route) => {
        taskCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'log-task-1', status: taskCallCount >= 3 ? 'COMPLETED' : 'RUNNING' },
          }),
        });
      });

      await page.route('**/api/projects/test-project-log/generate/outline', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { pages: [] } }),
        });
      });

      await page.route('**/api/projects/test-project-log', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { id: 'test-project-log', title: 'Test', status: 'OUTLINE_READY', pages: [] },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/`);
      await page.waitForLoadState('networkidle');

      const label = page.locator('label:has-text("联网搜索"), label:has-text("Web Research")').first();
      await label.click();

      const editor = page.locator('[role="textbox"][contenteditable="true"]').first();
      await editor.click();
      await editor.pressSequentially('AI trends in 2026', { delay: 10 });

      await page.locator('button').filter({ hasText: /下一步|Next/i }).click();

      // Wait for log panel to appear with messages
      const logPanel = page.locator('text=Searching for AI trends...').first();
      await expect(logPanel).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Analyzing sources...').first()).toBeVisible();
    });

    test('research API is NOT called when toggle is disabled', async ({ page }) => {
      let researchCalled = false;

      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { project_id: 'test-project-456' } }),
          });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/projects/test-project-456/research', async (route) => {
        researchCalled = true;
        await route.fulfill({ status: 202, contentType: 'application/json', body: '{}' });
      });

      await page.route('**/api/projects/test-project-456/generate/outline', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { pages: [] } }),
        });
      });

      await page.route('**/api/projects/test-project-456', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { id: 'test-project-456', title: 'Test', status: 'OUTLINE_READY', pages: [] },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/`);
      await page.waitForLoadState('networkidle');

      // Keep toggle disabled (default)
      const editor = page.locator('[role="textbox"][contenteditable="true"]').first();
      await editor.click();
      await editor.pressSequentially('AI trends in 2026', { delay: 10 });

      await page.locator('button').filter({ hasText: /下一步|Next/i }).click();
      await page.waitForTimeout(2000);

      expect(researchCalled).toBe(false);
    });
  });

  test.describe('Settings Tests', () => {
    test('Tavily API key field exists in settings', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      const section = page.locator('h2, h3, [class*="title"]').filter({ hasText: /Web Research|网络搜索/ }).first();
      await expect(section).toBeVisible({ timeout: 10000 });

      const tavilyField = page.locator('input[placeholder*="DuckDuckGo"], input[placeholder*="duckduckgo"]').first();
      await expect(tavilyField).toBeVisible();
    });
  });
});
