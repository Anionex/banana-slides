import { test, expect } from '@playwright/test';

test.describe('Attachment Sorting and Filtering', () => {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3401';

  test('should sort attachments by newest first (default)', async ({ page }) => {
    await page.route('**/api/reference-files?project_id=all', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            files: [
              { id: '1', filename: 'old.pdf', created_at: '2024-01-01T00:00:00Z', file_size: 1000, parse_status: 'completed' },
              { id: '2', filename: 'new.pdf', created_at: '2024-12-01T00:00:00Z', file_size: 2000, parse_status: 'completed' },
              { id: '3', filename: 'middle.pdf', created_at: '2024-06-01T00:00:00Z', file_size: 1500, parse_status: 'completed' }
            ]
          }
        })
      });
    });

    await page.goto(`${BASE_URL}`);
    await page.click('button:has-text("上传文件")');

    const fileItems = page.locator('.divide-y > div');
    await expect(fileItems.nth(0)).toContainText('new.pdf');
    await expect(fileItems.nth(1)).toContainText('middle.pdf');
    await expect(fileItems.nth(2)).toContainText('old.pdf');
  });

  test('should sort attachments by oldest first', async ({ page }) => {
    await page.route('**/api/reference-files?project_id=all', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            files: [
              { id: '1', filename: 'old.pdf', created_at: '2024-01-01T00:00:00Z', file_size: 1000, parse_status: 'completed' },
              { id: '2', filename: 'new.pdf', created_at: '2024-12-01T00:00:00Z', file_size: 2000, parse_status: 'completed' }
            ]
          }
        })
      });
    });

    await page.goto(`${BASE_URL}`);
    await page.click('button:has-text("上传文件")');
    await page.selectOption('select >> nth=1', 'oldest');

    const fileItems = page.locator('.divide-y > div');
    await expect(fileItems.nth(0)).toContainText('old.pdf');
    await expect(fileItems.nth(1)).toContainText('new.pdf');
  });

  test('should sort attachments by name A-Z', async ({ page }) => {
    await page.route('**/api/reference-files?project_id=all', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            files: [
              { id: '1', filename: 'zebra.pdf', created_at: '2024-01-01T00:00:00Z', file_size: 1000, parse_status: 'completed' },
              { id: '2', filename: 'apple.pdf', created_at: '2024-01-01T00:00:00Z', file_size: 2000, parse_status: 'completed' },
              { id: '3', filename: 'banana.pdf', created_at: '2024-01-01T00:00:00Z', file_size: 1500, parse_status: 'completed' }
            ]
          }
        })
      });
    });

    await page.goto(`${BASE_URL}`);
    await page.click('button:has-text("上传文件")');
    await page.selectOption('select >> nth=1', 'name-asc');

    const fileItems = page.locator('.divide-y > div');
    await expect(fileItems.nth(0)).toContainText('apple.pdf');
    await expect(fileItems.nth(1)).toContainText('banana.pdf');
    await expect(fileItems.nth(2)).toContainText('zebra.pdf');
  });

  test('should sort attachments by name Z-A', async ({ page }) => {
    await page.route('**/api/reference-files?project_id=all', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            files: [
              { id: '1', filename: 'apple.pdf', created_at: '2024-01-01T00:00:00Z', file_size: 1000, parse_status: 'completed' },
              { id: '2', filename: 'zebra.pdf', created_at: '2024-01-01T00:00:00Z', file_size: 2000, parse_status: 'completed' }
            ]
          }
        })
      });
    });

    await page.goto(`${BASE_URL}`);
    await page.click('button:has-text("上传文件")');
    await page.selectOption('select >> nth=1', 'name-desc');

    const fileItems = page.locator('.divide-y > div');
    await expect(fileItems.nth(0)).toContainText('zebra.pdf');
    await expect(fileItems.nth(1)).toContainText('apple.pdf');
  });

  test('should show all projects in filter dropdown', async ({ page }) => {
    await page.route('**/api/projects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            projects: [
              { id: 'proj1', title: 'Project Alpha' },
              { id: 'proj2', title: 'Project Beta' },
              { id: 'proj3', title: 'Project Gamma' }
            ],
            total: 3
          }
        })
      });
    });

    await page.route('**/api/reference-files?project_id=all', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { files: [] } })
      });
    });

    await page.goto(`${BASE_URL}`);
    await page.click('button:has-text("上传文件")');

    const filterSelect = page.locator('select').first();
    await expect(filterSelect.locator('option')).toHaveCount(5);
    await expect(filterSelect).toContainText('Project Alpha');
    await expect(filterSelect).toContainText('Project Beta');
    await expect(filterSelect).toContainText('Project Gamma');
  });

  test('should filter by specific project with one click', async ({ page }) => {
    let requestedProjectId = '';

    await page.route('**/api/projects*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            projects: [
              { id: 'proj1', title: 'Project Alpha' },
              { id: 'proj2', title: 'Project Beta' }
            ],
            total: 2
          }
        })
      });
    });

    await page.route('**/api/reference-files**', async (route) => {
      const url = route.request().url();
      const match = url.match(/project_id=([^&]+)/);
      requestedProjectId = match ? match[1] : '';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            files: requestedProjectId === 'proj2' ? [
              { id: 'f1', filename: 'beta-file.pdf', created_at: '2024-01-01T00:00:00Z', file_size: 1000, parse_status: 'completed' }
            ] : []
          }
        })
      });
    });

    await page.goto(`${BASE_URL}`);
    await page.click('button:has-text("上传文件")');

    const filterSelect = page.locator('select').first();
    await filterSelect.selectOption('proj2');

    await page.waitForTimeout(500);
    expect(requestedProjectId).toBe('proj2');
    await expect(page.locator('.divide-y > div')).toContainText('beta-file.pdf');
  });
});
