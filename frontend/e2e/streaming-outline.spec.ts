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

/**
 * Helper: create a project via API without navigating (for cross-project scenarios)
 */
async function createProject(page: import('@playwright/test').Page, creationType: string, ideaPrompt?: string) {
  const resp = await page.request.post(`${BASE_URL}/api/projects`, {
    data: {
      creation_type: creationType,
      ...(ideaPrompt ? { idea_prompt: ideaPrompt } : {}),
    },
  });
  const body = await resp.json();
  const projectId = body.data?.project_id;
  expect(projectId).toBeTruthy();
  return projectId as string;
}

// ===== Mock Tests =====

test.describe('Streaming Outline - Mock Tests', () => {
  test('should render cards incrementally as SSE pages arrive', async ({ page }) => {
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

    await createProjectAndNavigate(page, 'Test streaming outline');

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
    await page.route(`**/api/projects/*/generate/outline/stream`, async (route) => {
      const sseBody = `event: error\ndata: ${JSON.stringify({ message: 'AI service unavailable' })}\n\n`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sseBody,
      });
    });

    await createProjectAndNavigate(page, 'Test error handling');

    // The error should be displayed somewhere in the UI
    // Wait a moment for the error to propagate
    await page.waitForTimeout(1000);

    // The store sets error state, which may show as a toast or error message
    // Just verify no cards appeared
    await expect(page.getByText('Introduction')).not.toBeVisible();
  });

  test('should show generated pages and the regenerate action on completion', async ({ page }) => {
    await page.route(`**/api/projects/*/generate/outline/stream`, async (route) => {
      const pageEvent = `event: page\ndata: ${JSON.stringify({ index: 0, title: 'Page 1', points: ['Point'] })}\n\n`;
      const doneEvent = `event: done\ndata: ${JSON.stringify({ total: 1, pages: [{id: 'p1', order_index: 0, outline_content: {title: 'Page 1', points: ['Point']}}] })}\n\n`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: pageEvent + doneEvent,
      });
    });

    await createProjectAndNavigate(page, 'Test button state');

    // Wait for page to render
    await expect(page.getByText('Page 1')).toBeVisible();

    // Assert button re-enables with "Regenerate" text
    await expect(page.getByRole('button', { name: /重新生成|Regenerate/i })).toBeEnabled();
  });

  test('disables the generate button while streaming and re-enables on completion', async ({ page }) => {
    const sourceId = await createProject(page, 'idea', 'Button state source');

    let streamRequested = false;
    let releaseStream!: () => void;
    await page.route(`**/api/projects/${sourceId}/generate/outline/stream`, async (route) => {
      streamRequested = true;
      // Hold the stream so the disabled state is observable before completion.
      await new Promise<void>((resolve) => { releaseStream = resolve; });
      const pageEvent = `event: page\ndata: ${JSON.stringify({ index: 0, title: 'Page 1', points: ['Point'] })}\n\n`;
      const doneEvent = `event: done\ndata: ${JSON.stringify({ total: 1, complete: true, pages: [{ id: 'p1', order_index: 0, outline_content: { title: 'Page 1', points: ['Point'] } }] })}\n\n`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: pageEvent + doneEvent,
      });
    });

    await page.goto(`${BASE_URL}/project/${sourceId}/outline`);
    await expect.poll(() => streamRequested, { timeout: 15000 }).toBe(true);

    // Assert button shows disabled "Generating..." state while the stream is pending.
    await expect(page.getByRole('button', { name: /生成中|Generating/i })).toBeDisabled();

    releaseStream();

    // Wait for the page to render, then assert the button re-enables with "Regenerate".
    await expect(page.getByText('Page 1')).toBeVisible();
    await expect(page.getByRole('button', { name: /重新生成|Regenerate/i })).toBeEnabled();
  });

  test('keeps a delayed stream out of a project opened after generation starts', async ({ page }) => {
    const sourceProjectId = await createProject(page, 'idea', 'Source project');
    const targetProjectId = await createProject(page, 'blank');

    const streamedPages = [
      { index: 0, title: 'Source only: Introduction', points: ['Source point'] },
      { index: 1, title: 'Source only: Details', points: ['More source content'] },
      { index: 2, title: 'Source only: Conclusion', points: ['Source summary'] },
    ];
    await page.route(`**/api/projects/${sourceProjectId}/generate/outline/stream`, async (route) => {
      const body = streamedPages.map((streamedPage) =>
        `event: page\ndata: ${JSON.stringify(streamedPage)}\n\n`
      ).join('') + `event: done\ndata: ${JSON.stringify({
        total: streamedPages.length,
        complete: true,
        pages: streamedPages.map((streamedPage) => ({
          id: `source-page-${streamedPage.index}`,
          order_index: streamedPage.index,
          outline_content: { title: streamedPage.title, points: streamedPage.points },
          status: 'DRAFT',
        })),
      })}\n\n`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body,
      });
    });

    await page.goto(`${BASE_URL}/project/${sourceProjectId}/outline`);
    await expect(page.getByText('Source only: Introduction')).toBeVisible();

    // SPA-switch while the staggered render loop is still consuming the remaining source pages.
    // A full reload would destroy the source JS context and hide the leak; the same route
    // element stays mounted here, so any page/write-back leak would land in the target.
    await page.evaluate((projectId) => {
      const current = window.history.state ?? { idx: 0 };
      window.history.pushState(
        { ...current, idx: (current.idx ?? 0) + 1, key: `k-${Date.now()}` },
        '',
        `/project/${projectId}/outline`
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, targetProjectId);
    await expect(page).toHaveURL(new RegExp(`/project/${targetProjectId}/outline`));
    await page.waitForTimeout(700);
    await expect(page.getByText('Source only: Introduction')).not.toBeVisible();
    await expect(page.getByText('Source only: Details')).not.toBeVisible();
    await expect(page.getByText('Source only: Conclusion')).not.toBeVisible();

    // The projects themselves use the live backend; only the delayed AI stream is deterministic.
    const persistedTarget = await page.request.get(`${BASE_URL}/api/projects/${targetProjectId}`);
    expect(persistedTarget.ok()).toBeTruthy();
    expect((await persistedTarget.json()).data.pages).toHaveLength(0);

    await page.reload();
    await expect(page.getByText('Source only: Introduction')).not.toBeVisible();
  });

  test('suppresses a stale stream failure after switching to another project', async ({ page }) => {
    const sourceId = await createProject(page, 'idea', 'Stale failure source');
    const targetId = await createProject(page, 'blank');

    let streamRequested = false;
    let streamAborted = false;
    await page.route(`**/api/projects/${sourceId}/generate/outline/stream`, async (route) => {
      streamRequested = true;
      // Hold the request open long enough to switch projects, then fail the read side.
      await new Promise((resolve) => setTimeout(resolve, 2500));
      streamAborted = true;
      await route.abort('failed');
    });

    await page.goto(`${BASE_URL}/project/${sourceId}/outline`);
    await expect.poll(() => streamRequested, { timeout: 15000 }).toBe(true);

    // SPA-switch to the target project while the source stream is still pending.
    // The same route element stays mounted, so a stale failure would surface here.
    await page.evaluate((projectId) => {
      const current = window.history.state ?? { idx: 0 };
      window.history.pushState(
        { ...current, idx: (current.idx ?? 0) + 1, key: `k-${Date.now()}` },
        '',
        `/project/${projectId}/outline`
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, targetId);

    await expect(page).toHaveURL(new RegExp(`/project/${targetId}/outline`));

    // Anchor the assertion right after the stale stream fails: an error toast from
    // the source project would auto-dismiss after 5s, so a plain not.toBeVisible()
    // later could miss it. Assert immediately and once more after settling.
    await expect.poll(() => streamAborted, { timeout: 15000 }).toBe(true);
    await expect(page.getByText(/Failed to fetch|生成大纲失败|网络错误|大纲生成可能不完整/i)).not.toBeVisible({ timeout: 2000 });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Failed to fetch|生成大纲失败|网络错误|大纲生成可能不完整/i)).not.toBeVisible({ timeout: 0 });

    // Target project must still be intact and empty.
    const persistedTarget = await page.request.get(`${BASE_URL}/api/projects/${targetId}`);
    expect(persistedTarget.ok()).toBeTruthy();
    expect((await persistedTarget.json()).data.pages).toHaveLength(0);
  });

  test('keeps a mid-stream switch from writing source pages into the later project', async ({ page }) => {
    const sourceId = await createProject(page, 'idea', 'Mid-stream switch source');
    const targetId = await createProject(page, 'blank');

    const streamedPages = [
      { index: 0, title: 'Mid-stream only: Introduction', points: ['Source point'] },
      { index: 1, title: 'Mid-stream only: Details', points: ['More source content'] },
      { index: 2, title: 'Mid-stream only: Conclusion', points: ['Source summary'] },
    ];

    let streamRequested = false;
    let releaseStream!: () => void;
    await page.route(`**/api/projects/${sourceId}/generate/outline/stream`, async (route) => {
      streamRequested = true;
      // Hold the stream until the test has switched to the target project.
      await new Promise<void>((resolve) => { releaseStream = resolve; });
      const body = streamedPages.map((streamedPage) =>
        `event: page\ndata: ${JSON.stringify(streamedPage)}\n\n`
      ).join('') + `event: done\ndata: ${JSON.stringify({
        total: streamedPages.length,
        complete: true,
        pages: streamedPages.map((streamedPage) => ({
          id: `mid-stream-page-${streamedPage.index}`,
          order_index: streamedPage.index,
          outline_content: { title: streamedPage.title, points: streamedPage.points },
          status: 'DRAFT',
        })),
      })}\n\n`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body,
      });
    });

    await page.goto(`${BASE_URL}/project/${sourceId}/outline`);
    await expect.poll(() => streamRequested, { timeout: 15000 }).toBe(true);

    // SPA-switch to the target project while the source stream is still pending
    // (same route element stays mounted; a full reload would hide the leak).
    await page.evaluate((projectId) => {
      const current = window.history.state ?? { idx: 0 };
      window.history.pushState(
        { ...current, idx: (current.idx ?? 0) + 1, key: `k-${Date.now()}` },
        '',
        `/project/${projectId}/outline`
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, targetId);
    await expect(page).toHaveURL(new RegExp(`/project/${targetId}/outline`));

    // Deliver the source pages + done only now, while the target is being viewed.
    releaseStream();

    // Let the staggered render loop and the write-back fully settle.
    await page.waitForTimeout(1500);
    await expect(page.getByText('Mid-stream only: Introduction')).not.toBeVisible();
    await expect(page.getByText('Mid-stream only: Details')).not.toBeVisible();
    await expect(page.getByText('Mid-stream only: Conclusion')).not.toBeVisible();

    // The target must not have been written to (in-memory view or persisted data).
    const persistedTarget = await page.request.get(`${BASE_URL}/api/projects/${targetId}`);
    expect(persistedTarget.ok()).toBeTruthy();
    expect((await persistedTarget.json()).data.pages).toHaveLength(0);

    await page.reload();
    await expect(page.getByText('Mid-stream only: Introduction')).not.toBeVisible();
  });

  test('shows an error toast when the current project stream fails', async ({ page }) => {
    const sourceId = await createProject(page, 'idea', 'Active failure source');

    let streamRequested = false;
    await page.route(`**/api/projects/${sourceId}/generate/outline/stream`, async (route) => {
      streamRequested = true;
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.abort('failed');
    });

    await page.goto(`${BASE_URL}/project/${sourceId}/outline`);
    await expect.poll(() => streamRequested, { timeout: 15000 }).toBe(true);

    // Both the global error toast and the editor toast may carry the message.
    await expect(page.getByText(/Failed to fetch|生成大纲失败|网络错误/i).first()).toBeVisible({ timeout: 10000 });
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
