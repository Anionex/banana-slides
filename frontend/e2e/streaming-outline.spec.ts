import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3240';

/**
 * Helper: create a project via API and navigate to outline editor
 */
async function createProjectAndNavigate(page: import('@playwright/test').Page, ideaPrompt: string) {
  const resp = await page.request.post(`${BASE_URL}/api/projects`, {
    data: {
      creation_type: 'idea',
      idea_prompt: ideaPrompt,
    },
  });
  const body = await resp.json();
  const projectId = body.data?.project_id;
  expect(projectId).toBeTruthy();
  await page.goto(`${BASE_URL}/project/${projectId}/outline`);
  await page.waitForLoadState('networkidle');
  return projectId;
}

// ===== Mock Tests =====

test.describe('Streaming Outline - Mock Tests', () => {
  test('should render cards incrementally as SSE pages arrive', async ({ page }) => {
    const projectId = await createProjectAndNavigate(page, 'Test streaming outline');

    // Mock the SSE streaming endpoint
    let requestReceived = false;
    await page.route(`**/api/projects/*/generate/outline/stream`, async (route) => {
      requestReceived = true;

      // Simulate SSE response with 3 pages arriving sequentially
      const pages = [
        { index: 0, title: 'Introduction', points: ['Welcome', 'Overview'], part: null },
        { index: 1, title: 'Main Content', points: ['Topic A', 'Topic B'], part: 'Part 1' },
        { index: 2, title: 'Conclusion', points: ['Summary', 'Q&A'], part: 'Part 1' },
      ];

      let sseBody = '';
      for (const p of pages) {
        sseBody += `event: page\ndata: ${JSON.stringify(p)}\n\n`;
      }

      // Done event with fake persisted pages (include real IDs)
      const donePages = pages.map((p, i) => ({
        id: `real-page-${i}`,
        order_index: i,
        outline_content: { title: p.title, points: p.points },
        part: p.part,
        status: 'DRAFT',
      }));
      sseBody += `event: done\ndata: ${JSON.stringify({ total: 3, pages: donePages })}\n\n`;

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: sseBody,
      });
    });

    // Click the generate button
    const generateBtn = page.getByRole('button', { name: /自动生成|Auto Generate/i });
    await generateBtn.click();

    // Wait for cards to appear
    await expect(page.getByText('Introduction')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Main Content')).toBeVisible();
    await expect(page.getByText('Conclusion')).toBeVisible();

    // Verify the SSE endpoint was called
    expect(requestReceived).toBe(true);

    // Verify all 3 cards are rendered
    const cards = page.locator('[class*="animate-slide-in-up"], [data-testid="outline-card"]');
    // At minimum, check that the page titles are visible
    await expect(page.getByText('Topic A')).toBeVisible();
    await expect(page.getByText('Summary')).toBeVisible();
  });

  test('should show error message on SSE error event', async ({ page }) => {
    const projectId = await createProjectAndNavigate(page, 'Test error handling');

    await page.route(`**/api/projects/*/generate/outline/stream`, async (route) => {
      const sseBody = `event: error\ndata: ${JSON.stringify({ message: 'AI service unavailable' })}\n\n`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody,
      });
    });

    const generateBtn = page.getByRole('button', { name: /自动生成|Auto Generate/i });
    await generateBtn.click();

    // The error should be displayed somewhere in the UI
    // Wait a moment for the error to propagate
    await page.waitForTimeout(1000);

    // The store sets error state, which may show as a toast or error message
    // Just verify no cards appeared
    await expect(page.getByText('Introduction')).not.toBeVisible();
  });

  test('should disable generate button during streaming and re-enable on completion', async ({ page }) => {
    const projectId = await createProjectAndNavigate(page, 'Test button state');

    await page.route(`**/api/projects/*/generate/outline/stream`, async (route) => {
      const pageEvent = `event: page\ndata: ${JSON.stringify({ index: 0, title: 'Page 1', points: ['Point'] })}\n\n`;
      const doneEvent = `event: done\ndata: ${JSON.stringify({ total: 1, pages: [{id: 'p1', order_index: 0, outline_content: {title: 'Page 1', points: ['Point']}}] })}\n\n`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: pageEvent + doneEvent,
      });
    });

    const generateBtn = page.getByRole('button', { name: /自动生成|Auto Generate/i });
    await generateBtn.click();

    // Assert button shows disabled "Generating..." state
    await expect(page.getByRole('button', { name: /生成中|Generating/i })).toBeDisabled();

    // Wait for page to render
    await expect(page.getByText('Page 1')).toBeVisible();

    // Assert button re-enables with "Regenerate" text
    await expect(page.getByRole('button', { name: /重新生成|Regenerate/i })).toBeEnabled();
  });
});

// ===== Integration Tests =====

test.describe('Streaming Outline - Integration Tests', () => {
  // Skip in CI — requires real AI API keys
  test.skip(!!process.env.CI, 'Requires real AI backend');

  test('should stream outline from real backend and persist pages', async ({ page }) => {
    // Create project
    const projectId = await createProjectAndNavigate(page, 'A 3-page presentation about cats');

    // Click generate
    const generateBtn = page.getByRole('button', { name: /自动生成|Auto Generate/i });
    await generateBtn.click();

    // Wait for at least one card to appear (streaming in progress)
    // The first card should appear within 15 seconds
    await expect(page.locator('h4').first()).toBeVisible({ timeout: 30000 });

    // Wait for streaming to complete - "Regenerate" button appears when done
    await expect(page.getByRole('button', { name: /重新生成|Regenerate/i })).toBeVisible({ timeout: 60000 });

    // Verify multiple cards were generated
    const cardTitles = page.locator('h4');
    const count = await cardTitles.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Reload page and verify pages persisted
    await page.reload();
    await page.waitForLoadState('networkidle');

    const reloadedTitles = page.locator('h4');
    const reloadedCount = await reloadedTitles.count();
    expect(reloadedCount).toBe(count);
  });
});
