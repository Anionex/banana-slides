// Visual smoke: open the drawer, capture the default layout, then drag the
// resize handle wider and capture again. Both PNGs are for manual UX review.
import { test, expect } from '@playwright/test';
import path from 'path';
import { seedProjectWithImages } from './helpers/seed-project';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5143';

test('drawer visual smoke (default + resized)', async ({ page }) => {
  const seeded = await seedProjectWithImages(BACKEND_URL, 3);
  await page.goto('/');
  await page.evaluate((pid) => {
    localStorage.setItem(`template_mode_${pid}`, 'multi');
    // Reset any persisted width so this run starts at the default 380px.
    localStorage.removeItem('page_fine_tune_drawer_width');
  }, seeded.projectId);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/project/${seeded.projectId}/preview`);

  // Capture the closed state first so we can see the edge tab shape
  await page.waitForSelector('button[aria-label*="打开页面精调"], button[aria-label*="Open fine-tune panel"]');
  await page.screenshot({ path: 'test-results/drawer-closed.png', fullPage: false });

  // Open drawer
  await page.getByRole('button', { name: /打开页面精调|Open fine-tune panel/i }).click();

  // Upload a fake template so the drawer has content worth screenshotting
  const fixturesDir = path.resolve('e2e', 'fixtures');
  await page.getByText(/项目模板库|Template Library/).click();
  const input = page.locator('input[type="file"][accept="image/*"]');
  await input.setInputFiles([
    path.join(fixturesDir, 'slide_1.jpg'),
    path.join(fixturesDir, 'slide_2.jpg'),
  ]);

  // Assign first template
  await page.locator('img[alt="slide_1"]').first().click();
  await page.waitForTimeout(300);

  // Add an extra field so the screenshot includes that section with content.
  // Field name is still a native <input>, but field value now uses
  // MarkdownTextarea (contenteditable div) — so we type into it via keyboard.
  const drawerForFields = page.locator('aside').filter({ hasText: /页面精调|Page Fine-tune/ });
  await drawerForFields.getByRole('button', { name: /添加字段|Add Field/ }).click();
  const fieldNameInput = drawerForFields
    .locator('input[placeholder*="字段名"], input[placeholder*="Field name"]')
    .last();
  await fieldNameInput.fill('排版建议');
  const fieldValueEditor = drawerForFields
    .locator('section[data-section="extra-fields"] [contenteditable="true"]')
    .last();
  await fieldValueEditor.click();
  await page.keyboard.type('标题居中，正文左对齐');
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(200);

  // Measure default drawer width and preview width
  const drawer = page.locator('aside').filter({ hasText: /页面精调|Page Fine-tune/ });
  const main = page.locator('main').first();

  const drawerBoxDefault = await drawer.boundingBox();
  const mainBoxDefault = await main.boundingBox();
  console.log(`default: drawer=${drawerBoxDefault?.width}px, main=${mainBoxDefault?.width}px`);

  await page.screenshot({ path: 'test-results/drawer-default.png', fullPage: false });

  // --- Resize: drag the left-edge handle to the left by ~140px ---
  const handle = drawer.locator('[role="separator"][aria-orientation="vertical"]');
  await expect(handle).toBeVisible();
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('resize handle not measurable');

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  // Drawer is right-anchored: dragging LEFT should GROW it.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Multiple small steps so the browser sees real drag deltas
  for (let i = 0; i < 14; i++) {
    await page.mouse.move(startX - 10 * (i + 1), startY);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);

  const drawerBoxResized = await drawer.boundingBox();
  const mainBoxResized = await main.boundingBox();
  console.log(`resized: drawer=${drawerBoxResized?.width}px, main=${mainBoxResized?.width}px`);

  // Sanity: drawer grew, preview shrank
  expect(drawerBoxResized!.width).toBeGreaterThan(drawerBoxDefault!.width + 50);
  expect(mainBoxResized!.width).toBeLessThan(mainBoxDefault!.width - 50);

  await page.screenshot({ path: 'test-results/drawer-resized.png', fullPage: false });

  // Reload and confirm width persisted via localStorage
  await page.reload();
  await page.getByRole('button', { name: /打开页面精调|Open fine-tune panel/i }).click();
  await page.waitForTimeout(300);
  const drawerBoxAfterReload = await drawer.boundingBox();
  console.log(`after reload: drawer=${drawerBoxAfterReload?.width}px`);
  expect(Math.abs((drawerBoxAfterReload?.width ?? 0) - (drawerBoxResized?.width ?? 0))).toBeLessThan(5);

  console.log('Screenshots: test-results/drawer-default.png, test-results/drawer-resized.png');
});
