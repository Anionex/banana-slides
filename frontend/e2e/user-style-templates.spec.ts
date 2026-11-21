import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';

async function enableTextStyleMode(page: Page) {
  const label = page.locator('label').filter({ hasText: /使用文字描述风格|Use text description/ });
  const checkbox = label.locator('input[type="checkbox"]');
  if (!(await checkbox.isChecked())) {
    await label.click();
    await page.waitForTimeout(300);
  }
}

async function createStyleTemplate(page: Page, name: string, description: string) {
  await enableTextStyleMode(page);
  const textarea = page.locator('textarea').first();
  await textarea.fill(description);
  await page.getByRole('button', { name: /保存为模板|Save as template/ }).click();
  const nameInput = page.locator('input[type="text"]').last();
  await nameInput.fill(name);
  await page.getByRole('button', { name: /^保存$|^Save$/ }).click();
  await page.waitForTimeout(500);
}

async function deleteStyleByName(page: Page, name: string) {
  const styleBtn = page.getByRole('button', { name });
  const container = styleBtn.locator('..');
  await container.hover();
  await container.locator('button:has(svg)').last().click();
  await page.waitForTimeout(300);
}

test.describe('User Style Templates - Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true');
    });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('save a custom style template and verify it persists after reload', async ({ page }) => {
    const styleName = `E2E-Style-${Date.now()}`;
    const styleDesc = 'A unique test style for E2E validation';

    await createStyleTemplate(page, styleName, styleDesc);
    await expect(page.getByRole('button', { name: styleName })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await enableTextStyleMode(page);

    await expect(page.getByRole('button', { name: styleName })).toBeVisible();

    await page.getByRole('button', { name: styleName }).click();
    const textarea = page.locator('textarea').first();
    await expect(textarea).toHaveValue(styleDesc);

    await deleteStyleByName(page, styleName);
    await expect(page.getByRole('button', { name: styleName })).not.toBeVisible();
  });

  test('delete a user style template', async ({ page }) => {
    const styleName = `Delete-Test-${Date.now()}`;
    await createStyleTemplate(page, styleName, 'Style to be deleted');
    await expect(page.getByRole('button', { name: styleName })).toBeVisible();

    await deleteStyleByName(page, styleName);
    await expect(page.getByRole('button', { name: styleName })).not.toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await enableTextStyleMode(page);
    await expect(page.getByRole('button', { name: styleName })).not.toBeVisible();
  });

  test('clicking user style fills textarea with description', async ({ page }) => {
    const styleName = `Click-Test-${Date.now()}`;
    const styleDesc = 'Clicking this should fill the textarea with this exact text';

    await createStyleTemplate(page, styleName, styleDesc);

    const textarea = page.locator('textarea').first();
    await textarea.fill('');
    await expect(textarea).toHaveValue('');

    await page.getByRole('button', { name: styleName }).click();
    await expect(textarea).toHaveValue(styleDesc);

    await deleteStyleByName(page, styleName);
  });

  test('preset styles still work alongside user styles', async ({ page }) => {
    await enableTextStyleMode(page);
    const presetBtn = page.locator('button').filter({ hasText: /简约商务|Business Simple/ }).first();
    await presetBtn.click();
    const textarea = page.locator('textarea').first();
    const val = await textarea.inputValue();
    expect(val.length).toBeGreaterThan(10);
  });

  test('cannot save template without description', async ({ page }) => {
    await enableTextStyleMode(page);
    const textarea = page.locator('textarea').first();
    await textarea.fill('');
    await page.getByRole('button', { name: /保存为模板|Save as template/ }).click();
    await page.waitForTimeout(300);
    const nameInput = page.locator('input[placeholder*="风格名称"], input[placeholder*="style name"]');
    await expect(nameInput).not.toBeVisible();
  });
});

test.describe('User Style Templates - Mock', () => {
  test('displays user styles from API', async ({ page }) => {
    const mockTemplates = [
      { id: 'mock-1', name: 'Mock Style A', description: 'Description A', color: '#EF4444' },
      { id: 'mock-2', name: 'Mock Style B', description: 'Description B', color: '#3B82F6' },
    ];

    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true');
    });

    await page.route('**/api/user-style-templates', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { templates: mockTemplates }, message: 'Success' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await enableTextStyleMode(page);

    await expect(page.getByRole('button', { name: 'Mock Style A' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mock Style B' })).toBeVisible();
  });

  test('save dialog shows name input and color picker', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true');
    });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await enableTextStyleMode(page);

    const textarea = page.locator('textarea').first();
    await textarea.fill('Some style description');
    await page.getByRole('button', { name: /保存为模板|Save as template/ }).click();

    const nameInput = page.locator('input[type="text"]').last();
    await expect(nameInput).toBeVisible();

    const colorButtons = page.locator('.flex.gap-1 button');
    expect(await colorButtons.count()).toBeGreaterThanOrEqual(8);

    await page.locator('button:has(svg.lucide-x)').last().click();
    await expect(nameInput).not.toBeVisible();
  });
});
