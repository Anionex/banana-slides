import { test, expect } from '@playwright/test';

/**
 * E2E tests for material generation aspect ratio selector.
 * Tests both UI rendering (mock) and API payload (mock).
 */

test.describe('Material generation aspect ratio selector', () => {
  test.beforeEach(async ({ page }) => {
    // Disable access code guard
    await page.route('**/api/access-code/check', (route) =>
      route.fulfill({ json: { data: { enabled: false } } })
    );
    // Mark help modal as already seen to prevent it from blocking interactions
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true');
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  async function openMaterialGeneratorModal(page: any) {
    // Use dispatchEvent to reliably trigger the click on the 素材生成 button
    // (regular click may be blocked by overlay elements)
    const materialBtn = page.locator('button', { hasText: /素材生成/ }).first();
    await expect(materialBtn).toBeAttached({ timeout: 5000 });
    await materialBtn.dispatchEvent('click');
    // Wait for the MaterialGeneratorModal dialog to appear (identified by its title)
    await expect(page.getByRole('dialog', { name: /素材生成|Generate Material/ })).toBeVisible({ timeout: 5000 });
  }

  test('should render aspect ratio selector with all options in material generator modal', async ({ page }) => {
    await openMaterialGeneratorModal(page);

    const dialog = page.getByRole('dialog', { name: /素材生成|Generate Material/ });

    // Check the aspect ratio label is visible
    await expect(dialog.getByText(/生成比例|Aspect Ratio/)).toBeVisible();

    // Check that all common ratio buttons are visible inside the dialog
    for (const ratio of ['16:9', '4:3', '1:1', '9:16']) {
      await expect(dialog.locator('button', { hasText: ratio })).toBeVisible();
    }
  });

  test('should default to 16:9 and allow changing aspect ratio selection', async ({ page }) => {
    await openMaterialGeneratorModal(page);

    const dialog = page.getByRole('dialog', { name: /素材生成|Generate Material/ });

    // 16:9 should be the default selected ratio
    const btn169 = dialog.locator('button', { hasText: '16:9' }).first();
    await expect(btn169).toHaveClass(/border-banana-500/);

    // Click on 4:3
    const btn43 = dialog.locator('button', { hasText: '4:3' }).first();
    await btn43.click();

    // 4:3 should now be selected
    await expect(btn43).toHaveClass(/border-banana-500/);
    // 16:9 should no longer be selected
    await expect(btn169).not.toHaveClass(/border-banana-500/);
  });

  test('should send selected aspect_ratio in material generation API request', async ({ page }) => {
    let capturedAspectRatio: string | null = null;
    let requestIntercepted = false;

    // Intercept the material generation call (global, projectId=none)
    await page.route('**/api/projects/none/materials/generate', async (route) => {
      const request = route.request();
      const postData = request.postData() || '';

      // Multipart form: find aspect_ratio field value
      const match = postData.match(/name="aspect_ratio"[\r\n]+([^\r\n-][^\r\n]*)/);
      if (match) {
        capturedAspectRatio = match[1].trim();
      }
      requestIntercepted = true;

      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { task_id: 'mock-task-id', status: 'PENDING' },
        }),
      });
    });

    // Mock task status poll
    await page.route('**/api/projects/global/tasks/mock-task-id', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'mock-task-id',
            status: 'COMPLETED',
            progress: { image_url: '/files/materials/test.png', total: 1, completed: 1, failed: 0 },
          },
        }),
      });
    });

    await openMaterialGeneratorModal(page);

    const dialog = page.getByRole('dialog', { name: /素材生成|Generate Material/ });

    // Select 1:1 ratio
    await dialog.locator('button', { hasText: '1:1' }).first().click();

    // Fill in prompt
    await dialog.locator('textarea').first().fill('test material prompt');

    // Click the generate button
    await dialog.locator('button', { hasText: /生成素材|Generate Material/ }).first().click();

    // Wait for request to be intercepted
    await page.waitForTimeout(2000);

    expect(requestIntercepted).toBe(true);
    expect(capturedAspectRatio).toBe('1:1');
  });
});
