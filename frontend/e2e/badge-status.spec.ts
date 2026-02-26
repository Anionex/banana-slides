import { test, expect } from '@playwright/test';
import { seedProjectWithImages } from './helpers/seed-project';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5346';

test.describe.serial('Page badge status after description update', () => {
  let projectId: string;
  let pageIds: string[];

  test('seed project with images and verify COMPLETED status', async ({ request }) => {
    const seeded = await seedProjectWithImages(BASE_URL, 2);
    projectId = seeded.projectId;
    pageIds = seeded.pageIds;

    const resp = await request.get(`${BASE_URL}/api/projects/${projectId}`);
    const body = await resp.json();
    const pages = body.data.pages;

    for (const page of pages) {
      expect(page.status).toBe('COMPLETED');
      expect(page.generated_image_url).toBeTruthy();
    }
  });

  test('updating description keeps COMPLETED status when page has image', async ({ request }) => {
    const pageId = pageIds[0];

    // Update description
    const resp = await request.put(
      `${BASE_URL}/api/projects/${projectId}/pages/${pageId}/description`,
      { data: { description_content: { text: 'Updated description for testing', generated_at: new Date().toISOString() } } }
    );
    expect(resp.ok()).toBeTruthy();

    // Verify status is still COMPLETED
    const projectResp = await request.get(`${BASE_URL}/api/projects/${projectId}`);
    const body = await projectResp.json();
    const page = body.data.pages.find((p: any) => p.page_id === pageId);

    expect(page).toBeTruthy();
    expect(page.status).toBe('COMPLETED');
    expect(page.generated_image_url).toBeTruthy();
  });

  test('badge shows completed (green) on preview page', async ({ page }) => {
    const frontendBase = BASE_URL.replace(/:\d+$/, ':3346');
    await page.goto(`${frontendBase}/project/${projectId}/preview`);

    // Wait for badges to render
    await page.waitForSelector('[class*="bg-green"]', { timeout: 10000 });

    // All badges should be green (COMPLETED), none blue (DESCRIPTION_GENERATED)
    const greenBadges = page.locator('[class*="bg-green-100"]');
    const blueBadges = page.locator('[class*="bg-blue-100"]');

    expect(await greenBadges.count()).toBeGreaterThanOrEqual(1);
    expect(await blueBadges.count()).toBe(0);
  });
});
