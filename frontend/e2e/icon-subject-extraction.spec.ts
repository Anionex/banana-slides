import { expect, test } from '@playwright/test';
import { seedProjectWithImages } from './helpers/seed-project';

test.describe('Icon subject extraction toggle', () => {
  test('mock: toggle renders, default ON, sends value in PUT payload', async ({ page }) => {
    const projectId = 'mock-icon-subject-extraction';
    let savedPayload: any = null;

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));

    await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
      const url = new URL(route.request().url());
      const method = route.request().method();

      if (url.pathname === '/api/access-code/check') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { enabled: false } }),
        });
      }

      if (url.pathname === `/api/projects/${projectId}` && method === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: projectId,
              id: projectId,
              status: 'COMPLETED',
              template_style: 'default',
              export_extractor_method: 'hybrid',
              export_inpaint_method: 'hybrid',
              export_allow_partial: false,
              enable_icon_subject_extraction: true,
              pages: [{
                id: 'p1', page_id: 'p1', order_index: 0,
                generated_image_path: '/files/mock/slide-1.png',
                outline_content: { title: 'Slide 1', points: [] },
                description_content: { text: 'desc' },
                status: 'COMPLETED',
              }],
            },
          }),
        });
      }

      if (url.pathname === `/api/projects/${projectId}` && method === 'PUT') {
        savedPayload = route.request().postDataJSON();
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { project_id: projectId } }),
        });
      }

      // Catch-all: return empty success to avoid real backend
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await page.route('**/files/**', async route => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(256) });
    });

    await page.goto(`/project/${projectId}/preview`);
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 });

    // Open settings modal (button name "项目设置" in zh)
    await page.getByRole('button', { name: /^项目设置$|^Project Settings$/ }).click();
    // Switch to export tab in modal sidebar
    await page.locator('aside').getByRole('button', { name: /导出设置|Export Settings/ }).click();

    // Find checkbox by label content
    const iconLabel = page.locator('label', {
      hasText: /图标透明背景|Icon Transparent Background/,
    });
    await expect(iconLabel).toBeVisible();
    const iconCheckbox = iconLabel.locator('input[type="checkbox"]');
    await expect(iconCheckbox).toBeChecked();

    // Toggle off, save, verify payload
    await iconCheckbox.uncheck();
    await expect(iconCheckbox).not.toBeChecked();

    await page.getByRole('button', { name: /保存导出设置|Save Export Settings/ }).click();
    await page.waitForTimeout(500);

    expect(savedPayload).toBeTruthy();
    expect(savedPayload.enable_icon_subject_extraction).toBe(false);
  });
});

test.describe('Icon subject extraction integration', () => {
  test('persists toggle through PUT and reload', async ({ page, baseURL }) => {
    const apiBase = baseURL!;
    const seeded = await seedProjectWithImages(apiBase, 1);
    const projectId = seeded.projectId;

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));

    // 1. Open settings, default should be ON (column server default true)
    await page.goto(`/project/${projectId}/preview`);
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 });

    await page.getByRole('button', { name: /^项目设置$|^Project Settings$/ }).click();
    await page.locator('aside').getByRole('button', { name: /导出设置|Export Settings/ }).click();

    const iconLabel = page.locator('label', {
      hasText: /图标透明背景|Icon Transparent Background/,
    });
    await expect(iconLabel).toBeVisible();
    const iconCheckbox = iconLabel.locator('input[type="checkbox"]');
    await expect(iconCheckbox).toBeChecked();

    // 2. Toggle off, save
    await iconCheckbox.uncheck();
    await page.getByRole('button', { name: /保存导出设置|Save Export Settings/ }).click();
    // Wait for save indicator to clear
    await page.waitForTimeout(2000);

    // 3. Reload page, re-open modal, verify still off
    await page.reload();
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 });
    await page.getByRole('button', { name: /^项目设置$|^Project Settings$/ }).click();
    await page.locator('aside').getByRole('button', { name: /导出设置|Export Settings/ }).click();

    const reloadedLabel = page.locator('label', {
      hasText: /图标透明背景|Icon Transparent Background/,
    });
    const reloadedCheckbox = reloadedLabel.locator('input[type="checkbox"]');
    await expect(reloadedCheckbox).not.toBeChecked();

    // 4. Verify backend GET returns false
    const resp = await page.request.get(`${apiBase}/api/projects/${projectId}`);
    const json = await resp.json();
    expect(json.data.enable_icon_subject_extraction).toBe(false);
  });
});
