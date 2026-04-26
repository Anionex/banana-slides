import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3240';

test.describe('Web Research Feature', () => {
  test.describe('Mock Tests', () => {
    test('web research toggle is visible only on idea tab', async ({ page }) => {
      await page.goto(`${BASE_URL}/`);
      await page.waitForLoadState('networkidle');

      // Check toggle is visible on idea tab (default)
      const toggle = page.locator('label:has-text("联网搜索"), label:has-text("Web Research")').first();
      await expect(toggle).toBeVisible();

      // Switch to outline tab
      const outlineTab = page.locator('button').filter({ hasText: /大纲|Outline/ }).first();
      await outlineTab.click();
      await page.waitForTimeout(300);

      // Toggle should not be visible
      await expect(toggle).not.toBeVisible();

      // Switch back to idea tab
      const ideaTab = page.locator('button').filter({ hasText: /想法|Idea/ }).first();
      await ideaTab.click();
      await page.waitForTimeout(300);

      // Toggle should be visible again
      await expect(toggle).toBeVisible();
    });

    test('web research toggle can be checked and unchecked', async ({ page }) => {
      await page.goto(`${BASE_URL}/`);
      await page.waitForLoadState('networkidle');

      const checkbox = page.locator('label:has-text("联网搜索"), label:has-text("Web Research")').first().locator('input[type="checkbox"]');

      // Initially unchecked
      await expect(checkbox).not.toBeChecked();

      // Click to check
      const label = page.locator('label:has-text("联网搜索"), label:has-text("Web Research")').first();
      await label.click();
      await expect(checkbox).toBeChecked();

      // Click to uncheck
      await label.click();
      await expect(checkbox).not.toBeChecked();
    });

    test('research API is called when toggle is enabled', async ({ page }) => {
      let researchCalled = false;
      let researchPayload: any = null;

      // Mock project creation
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                project_id: 'test-project-123',
                status: 'CREATED',
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Mock research endpoint
      await page.route('**/api/projects/test-project-123/research', async (route) => {
        researchCalled = true;
        researchPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { task_id: 'research-task-1' },
          }),
        });
      });

      // Mock task polling
      await page.route('**/api/projects/test-project-123/tasks/research-task-1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'research-task-1',
              status: 'COMPLETED',
              progress: { stage: 'completed' },
            },
          }),
        });
      });

      // Mock outline generation
      await page.route('**/api/projects/test-project-123/generate/outline', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { pages: [] },
          }),
        });
      });

      // Mock project fetch
      await page.route('**/api/projects/test-project-123', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'test-project-123',
                title: 'Test',
                status: 'OUTLINE_READY',
                pages: [],
              },
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

      // Fill in idea
      const textarea = page.locator('textarea').first();
      await textarea.fill('AI trends in 2026');

      // Click generate button
      const generateBtn = page.locator('button').filter({ hasText: /下一步|Next/ }).first();
      await generateBtn.click();

      // Wait for research to be called
      await page.waitForTimeout(2000);

      expect(researchCalled).toBe(true);
    });

    test('research API is NOT called when toggle is disabled', async ({ page }) => {
      let researchCalled = false;

      // Mock project creation
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { project_id: 'test-project-456' },
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Mock research endpoint (should not be called)
      await page.route('**/api/projects/test-project-456/research', async (route) => {
        researchCalled = true;
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { task_id: 'research-task-1' } }),
        });
      });

      // Mock outline generation
      await page.route('**/api/projects/test-project-456/generate/outline', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { pages: [] },
          }),
        });
      });

      // Mock project fetch
      await page.route('**/api/projects/test-project-456', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'test-project-456',
                title: 'Test',
                status: 'OUTLINE_READY',
                pages: [],
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/`);
      await page.waitForLoadState('networkidle');

      // Keep web research toggle disabled (default)
      const textarea = page.locator('textarea').first();
      await textarea.fill('AI trends in 2026');

      // Click generate button
      const generateBtn = page.locator('button').filter({ hasText: /下一步|Next/ }).first();
      await generateBtn.click();

      // Wait a bit
      await page.waitForTimeout(2000);

      // Research should NOT have been called
      expect(researchCalled).toBe(false);
    });
  });

  test.describe('Settings Tests', () => {
    test('Tavily API key field exists in settings', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      // Look for Web Research section
      const section = page.locator('text=/Web Research|联网搜索/').first();
      await expect(section).toBeVisible();

      // Look for Tavily API key input field
      const tavilyField = page.locator('input[placeholder*="sk-"], input[placeholder*="Tavily"], input[placeholder*="API"]').first();
      await expect(tavilyField).toBeVisible();
    });
  });
});
