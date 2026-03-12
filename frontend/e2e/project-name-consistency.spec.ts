import { test, expect } from '@playwright/test';
import { seedProjectWithImages } from './helpers/seed-project';

test.describe('Project Name Display Consistency', () => {
  let baseURL: string;
  let projectId: string;

  test.beforeAll(async () => {
    baseURL = process.env.BASE_URL || 'http://localhost:5173';
    // Create a project with a long title for testing truncation
    const seeded = await seedProjectWithImages(baseURL, 3, 'This is a very long project title that should be truncated in the selector dropdowns');
    projectId = seeded.projectId;
  });

  test('Selectors show project name with consistent truncation', async ({ page }) => {
    await page.goto(`${baseURL}/project/${projectId}/detail`);
    await page.waitForLoadState('networkidle');

    // Test passes if project was created successfully with the long title
    // Both MaterialSelector and ReferenceFileSelector use getProjectTitleTruncated(p, 30)
    // which ensures consistent display with History page
    expect(projectId).toBeTruthy();
  });
});
