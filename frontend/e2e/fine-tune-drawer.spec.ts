/**
 * E2E smoke test for the per-page fine-tune drawer in SlidePreview.
 *
 * The drawer is the UX landing point for the per-page template feature:
 * users can now set page-specific templates + text styles, edit descriptions,
 * and manage extra fields without leaving the preview. Backend persistence
 * for template fields is not in yet — the drawer uses localStorage as a
 * mock store, so this test verifies the full UX round-trip including
 * reload-resilient persistence.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { seedProjectWithImages } from './helpers/seed-project';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5143';

test.describe('PageFineTuneDrawer', () => {
  let projectId: string;

  test.beforeAll(async () => {
    const seeded = await seedProjectWithImages(BACKEND_URL, 3);
    projectId = seeded.projectId;
  });

  test('edge tab opens drawer and drawer renders sections', async ({ page }) => {
    // Mark this project as multi-template so the drawer shows template sections
    await page.goto('/');
    await page.evaluate((pid) => {
      localStorage.setItem(`template_mode_${pid}`, 'multi');
    }, projectId);

    await page.goto(`/project/${projectId}/preview`);

    // Wait for slide preview to load (look for thumbnail list)
    await expect(page.getByRole('button', { name: /打开页面精调|Open fine-tune panel/i })).toBeVisible({ timeout: 10_000 });

    // Click edge tab to open drawer
    await page.getByRole('button', { name: /打开页面精调|Open fine-tune panel/i }).click();

    // Drawer header shows the page number (first page)
    await expect(page.getByText(/第 1 页|Page 1/)).toBeVisible();

    // Description section is visible
    await expect(page.getByText(/^描述$|^Description$/i)).toBeVisible();

    // Multi-template mode: Template section and Template Library section visible
    await expect(page.getByText(/^模板$|^Template$/).first()).toBeVisible();
    await expect(page.getByText(/项目模板库|Template Library/)).toBeVisible();
  });

  test('upload template to library and assign it to current page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((pid) => {
      localStorage.setItem(`template_mode_${pid}`, 'multi');
      // Clean any prior test state
      localStorage.removeItem(`template_assets_${pid}`);
      localStorage.removeItem(`page_template_assign_${pid}`);
    }, projectId);

    await page.goto(`/project/${projectId}/preview`);
    await page.getByRole('button', { name: /打开页面精调|Open fine-tune panel/i }).click();

    // Expand template library
    await page.getByText(/项目模板库|Template Library/).click();

    // Upload a template image via the hidden file input.
    // Playwright CWD is the frontend dir when invoked via npx playwright test.
    const fixturesDir = path.resolve('e2e', 'fixtures');
    const input = page.locator('input[type="file"][accept="image/*"]');
    await input.setInputFiles(path.join(fixturesDir, 'slide_1.jpg'));

    // After upload: one card in the library grid
    await expect(page.locator('img[alt="slide_1"]')).toBeVisible({ timeout: 5_000 });

    // Click the uploaded template card to assign it to the current page
    await page.locator('img[alt="slide_1"]').first().click();

    // Verify the template section now shows "Change" (i.e. a template is assigned)
    await expect(page.getByRole('button', { name: /^更换$|^Change$/ })).toBeVisible();

    // Reload the page and verify persistence (localStorage-backed mock)
    await page.reload();
    await page.getByRole('button', { name: /打开页面精调|Open fine-tune panel/i }).click();
    await expect(page.getByRole('button', { name: /^更换$|^Change$/ })).toBeVisible({ timeout: 5_000 });
  });

  test('description edit persists via updatePageLocal', async ({ page }) => {
    await page.goto(`/project/${projectId}/preview`);
    await page.getByRole('button', { name: /打开页面精调|Open fine-tune panel/i }).click();

    // The description is now rendered by MarkdownTextarea (contenteditable div),
    // not a native textarea — locate it via the section data attribute and type
    // via keyboard rather than .fill().
    const drawerRegion = page.locator('aside').filter({ hasText: /页面精调|Page Fine-tune/ });
    const descEditor = drawerRegion
      .locator('section[data-section="description"] [contenteditable="true"]')
      .first();
    await expect(descEditor).toBeVisible();

    const unique = `drawer-edit-${Date.now()}`;
    await descEditor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type(unique);
    // Blur by clicking outside the editor so onBlur → commit → debounced API call fires
    await page.locator('body').click({ position: { x: 10, y: 10 } });

    // Wait ~1.5s for debounced API call
    await page.waitForTimeout(1800);

    // Reload and verify the description survived
    await page.reload();
    await page.getByRole('button', { name: /打开页面精调|Open fine-tune panel/i }).click();
    const descAfter = drawerRegion
      .locator('section[data-section="description"] [contenteditable="true"]')
      .first();
    await expect(descAfter).toContainText(unique);
  });

  test('single-mode project hides template sections', async ({ page }) => {
    // Fresh project in single mode (no localStorage flag)
    const seeded = await seedProjectWithImages(BACKEND_URL, 2);
    await page.goto('/');
    await page.evaluate((pid) => {
      localStorage.removeItem(`template_mode_${pid}`);
    }, seeded.projectId);

    await page.goto(`/project/${seeded.projectId}/preview`);
    await page.getByRole('button', { name: /打开页面精调|Open fine-tune panel/i }).click();

    // Description is always visible
    await expect(page.getByText(/^描述$|^Description$/).first()).toBeVisible();

    // Template sections should NOT be visible in single mode
    await expect(page.getByText(/项目模板库|Template Library/)).toHaveCount(0);
  });
});
