import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { ASPECT_RATIO_OPTIONS } from '../src/config/aspectRatio';

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

  async function openMaterialGeneratorModal(page: Page) {
    // Use dispatchEvent to reliably trigger the click on the 素材生成 button
    // (regular click may be blocked by overlay elements)
    const materialBtn = page.locator('button', { hasText: /素材生成/ }).first();
    await expect(materialBtn).toBeAttached({ timeout: 5000 });
    await materialBtn.dispatchEvent('click');
    // Wait for the MaterialGeneratorModal dialog to appear (identified by its title)
    await expect(page.getByRole('dialog', { name: /素材工具箱|Material Toolbox/ })).toBeVisible({ timeout: 5000 });
  }

  test('should render aspect ratio selector with all options in material generator modal', async ({ page }) => {
    await openMaterialGeneratorModal(page);

    const dialog = page.getByRole('dialog', { name: /素材工具箱|Material Toolbox/ });

    // Check the aspect ratio label is visible
    await expect(dialog.getByText(/生成比例|Aspect Ratio/)).toBeVisible();

    // Check that all ratio buttons are visible inside the dialog (derived from config)
    for (const { value } of ASPECT_RATIO_OPTIONS) {
      await expect(dialog.locator('button', { hasText: value })).toBeVisible();
    }
  });

  test('should default to 16:9 and allow changing aspect ratio selection', async ({ page }) => {
    await openMaterialGeneratorModal(page);

    const dialog = page.getByRole('dialog', { name: /素材工具箱|Material Toolbox/ });

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
    let capturedOperation: string | null = null;
    let requestIntercepted = false;

    await page.route('**/api/projects/none/materials/process', async (route) => {
      const request = route.request();
      const postData = request.postData() || '';

      const opMatch = postData.match(/name="operation"\r\n\r\n([^\r\n]*)/);
      if (opMatch) {
        capturedOperation = opMatch[1].trim();
      }

      const match = postData.match(/name="aspect_ratio"\r\n\r\n([^\r\n]*)/);
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

    const dialog = page.getByRole('dialog', { name: /素材工具箱|Material Toolbox/ });

    // Select 1:1 ratio
    await dialog.locator('button', { hasText: '1:1' }).first().click();

    // Fill in prompt
    await dialog.locator('textarea').first().fill('test material prompt');

    // Click the generate button and wait for the API response
    const [response] = await Promise.all([
      page.waitForResponse('**/api/projects/none/materials/process'),
      dialog.locator('button', { hasText: /执行工具|Run Tool/ }).first().click(),
    ]);

    expect(response.status()).toBe(202);
    expect(requestIntercepted).toBe(true);
    expect(capturedOperation).toBe('generate');
    expect(capturedAspectRatio).toBe('1:1');
  });

  test('should send region edit selection and apply_mode payload', async ({ page }) => {
    let capturedSelection: string | null = null;
    let capturedApplyMode: string | null = null;
    let capturedOperation: string | null = null;

    await page.route('**/api/projects/none/materials/process', async (route) => {
      const postData = route.request().postData() || '';
      capturedSelection = postData.match(/name="selection"\r\n\r\n([^\r\n]*)/)?.[1]?.trim() || null;
      capturedApplyMode = postData.match(/name="apply_mode"\r\n\r\n([^\r\n]*)/)?.[1]?.trim() || null;
      capturedOperation = postData.match(/name="operation"\r\n\r\n([^\r\n]*)/)?.[1]?.trim() || null;

      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { task_id: 'mock-task-id', status: 'PENDING' },
        }),
      });
    });

    await page.route('**/api/projects/global/tasks/mock-task-id', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'mock-task-id',
            status: 'COMPLETED',
            progress: { image_url: '/files/materials/test-region.png', total: 1, completed: 1, failed: 0 },
          },
        }),
      });
    });

    await openMaterialGeneratorModal(page);
    const dialog = page.getByRole('dialog', { name: /素材工具箱|Material Toolbox/ });

    await dialog.locator('button', { hasText: /框选编辑|Region Edit/ }).first().click();
    await dialog.locator('textarea').first().fill('make the selected area glossy');
    await dialog.getByTestId('material-source-input').setInputFiles(path.join(process.cwd(), 'e2e', 'fixtures', 'slide_1.jpg'));
    await dialog.getByTestId('material-selection-toggle').click();

    const canvas = dialog.getByTestId('material-source-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('material source canvas has no bounding box');
    }

    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.35);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7);
    await page.mouse.up();

    await dialog.locator('button', { hasText: /直接用整张结果覆盖|Replace with the full generated image/ }).first().click();

    await Promise.all([
      page.waitForResponse('**/api/projects/none/materials/process'),
      dialog.locator('button', { hasText: /执行工具|Run Tool/ }).first().click(),
    ]);

    expect(capturedOperation).toBe('region_edit');
    expect(capturedApplyMode).toBe('replace_full');
    expect(capturedSelection).toContain('"width"');
    expect(capturedSelection).toContain('"height"');
  });
});
