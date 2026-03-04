import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PROJECT_ID = 'mock-style-test';

// 1x1 transparent PNG as data URL (always loads successfully)
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function makePage(id: string, index: number, title: string, description: string) {
  return {
    id,
    page_id: id,
    title,
    sort_order: index,
    order_index: index,
    status: 'COMPLETED',
    outline_content: { title, points: [`Point for ${title}`] },
    description_content: { text: description },
    generated_image_path: null,
  };
}

function setupMocks(page: import('@playwright/test').Page, pages: ReturnType<typeof makePage>[]) {
  return Promise.all([
    page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            project_id: PROJECT_ID,
            id: PROJECT_ID,
            status: 'DESCRIPTIONS_GENERATED',
            creation_type: 'idea',
            pages,
          },
        }),
      });
    }),
    page.route('**/api/projects/*/files*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    }),
  ]);
}

test.describe('Markdown image size and DescriptionCard max height', () => {
  test('markdown images should have constrained size classes', async ({ page }) => {
    const pages = [
      makePage('p1', 0, 'Cover', `Some text\n\n![test image](${TINY_PNG})\n\nMore text`),
    ];
    await setupMocks(page, pages);

    await page.goto(`${BASE}/project/${PROJECT_ID}/detail`);
    await expect(page.locator('text=第 1 页')).toBeVisible({ timeout: 10000 });

    const img = page.locator('.markdown-content img').first();
    await expect(img).toBeVisible({ timeout: 10000 });

    // Verify the image has constrained size classes
    await expect(img).toHaveClass(/max-w-48/);
    await expect(img).toHaveClass(/max-h-36/);
  });

  test('description card content area should have max height with scroll', async ({ page }) => {
    const longText = Array(50).fill('This is a long line of description text for testing overflow.').join('\n\n');
    const pages = [
      makePage('p1', 0, 'Cover', longText),
    ];
    await setupMocks(page, pages);

    await page.goto(`${BASE}/project/${PROJECT_ID}/detail`);
    await expect(page.locator('text=第 1 页')).toBeVisible({ timeout: 10000 });

    const contentArea = page.getByTestId('description-card-content');
    await expect(contentArea).toHaveClass(/max-h-96/);
    await expect(contentArea).toHaveClass(/overflow-y-auto/);

    // Verify actual computed max-height (max-h-96 = 24rem = 384px)
    const maxHeight = await contentArea.evaluate((el) => getComputedStyle(el).maxHeight);
    expect(maxHeight).toBe('384px');
  });
});
