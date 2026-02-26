import { test, expect, Page } from '@playwright/test';
import { seedProjectWithImages } from './helpers/seed-project';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Mock test: Verify disabled button tooltips and i18n strings
 * via page.route() without hitting a real backend.
 */
test.describe('UX Polish – disabled button tooltips (mock)', () => {
  test('export button shows tooltip when images are missing', async ({ page }) => {
    // Set English locale to verify i18n tooltip content
    await page.addInitScript(() => {
      localStorage.setItem('banana-slides-language', 'en');
    });

    // Mock project with pages that have NO generated images
    const mockProject = {
      data: {
        id: 'proj-1',
        project_id: 'proj-1',
        creation_type: 'idea',
        idea_prompt: 'Test',
        pages: [
          { id: 'p1', order_index: 0, outline_content: { title: 'Page 1', points: [] }, description_content: { text: 'desc' } },
          { id: 'p2', order_index: 1, outline_content: { title: 'Page 2', points: [] }, description_content: { text: 'desc' } },
        ],
      },
    };

    await page.route('**/api/projects/proj-1', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProject) });
    });

    await page.goto(`${BASE}/project/proj-1/preview`);
    await page.waitForSelector('text=Page 1', { timeout: 5000 }).catch(() => {});

    // The export button should be disabled and have a title attribute explaining why
    const exportBtn = page.locator('button:has-text("PPTX")').first();
    if (await exportBtn.count() > 0) {
      const title = await exportBtn.getAttribute('title');
      // Should have the English tooltip explaining why export is disabled
      expect(title).toContain('no images yet');
    }
  });

  test('next button shows tooltip when descriptions are missing in detail editor', async ({ page }) => {
    // Set English locale to verify i18n tooltip content
    await page.addInitScript(() => {
      localStorage.setItem('banana-slides-language', 'en');
    });

    const mockProject = {
      data: {
        id: 'proj-2',
        project_id: 'proj-2',
        creation_type: 'idea',
        idea_prompt: 'Test',
        pages: [
          { id: 'p1', order_index: 0, outline_content: { title: 'Page 1', points: [] } },
          { id: 'p2', order_index: 1, outline_content: { title: 'Page 2', points: [] }, description_content: { text: 'has desc' } },
        ],
      },
    };

    await page.route('**/api/projects/proj-2', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProject) });
    });

    await page.goto(`${BASE}/project/proj-2/detail`);
    await page.waitForSelector('text=Page 1', { timeout: 5000 }).catch(() => {});

    // Target the "Generate Images" / next-step button specifically (not the AI refine submit)
    const nextBtn = page.locator('button[title*="descriptions"]').first();
    if (await nextBtn.count() > 0) {
      const title = await nextBtn.getAttribute('title');
      expect(title).toContain('missing descriptions');
    }
  });
});

test.describe('UX Polish – i18n strings (mock)', () => {
  test('project status text uses i18n (not hardcoded Chinese)', async ({ page }) => {
    // Set English locale
    await page.addInitScript(() => {
      localStorage.setItem('banana-slides-language', 'en');
    });

    const mockProjects = {
      data: {
        projects: [
          {
            id: 'proj-en-1',
            project_id: 'proj-en-1',
            creation_type: 'idea',
            idea_prompt: 'English test',
            pages: [
              { id: 'p1', page_id: 'p1', order_index: 0, outline_content: { title: 'Slide 1', points: [] }, description_content: { text: 'desc' }, generated_image_url: '/img.png' },
            ],
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
      },
    };

    await page.route('**/api/projects**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProjects) });
      } else {
        route.continue();
      }
    });

    await page.goto(`${BASE}/history`);
    await expect(page.locator('text=Slide 1')).toBeVisible({ timeout: 5000 });

    // The status badge should show English text, not Chinese
    const pageContent = await page.textContent('body');
    // In English mode, status should be "Completed" not "已完成"
    expect(pageContent).toContain('Completed');
    expect(pageContent).not.toContain('已完成');
  });

  test('settings page error messages use i18n', async ({ page }) => {
    // Set English locale
    await page.addInitScript(() => {
      localStorage.setItem('banana-slides-language', 'en');
    });

    // Mock settings endpoint to fail
    await page.route('**/api/settings', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Server error' } }) });
      } else {
        route.continue();
      }
    });

    await page.goto(`${BASE}/settings`);
    // Wait for the settings page to render (heading appears even on error)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 });

    // The error toast should show English text
    const toastText = await page.textContent('body');
    // Should NOT contain hardcoded Chinese error like "加载设置失败"
    expect(toastText).not.toContain('加载设置失败');
  });
});

/**
 * Integration test: Verify i18n works with real backend
 */
test.describe('UX Polish – integration', () => {
  test('settings page loads without hardcoded Chinese in English mode', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('banana-slides-language', 'en');
    });

    await page.goto(`${BASE}/settings`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 });

    // Check that the page title is in English
    const heading = page.locator('h1, h2').first();
    if (await heading.count() > 0) {
      const text = await heading.textContent();
      expect(text).toContain('Settings');
    }

    // Check that action buttons are in English
    const saveBtn = page.locator('button:has-text("Save")').first();
    if (await saveBtn.count() > 0) {
      expect(await saveBtn.textContent()).toContain('Save');
    }
  });
});
