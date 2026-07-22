import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/**
 * 空白项目在大纲页要隐藏所有"来源文本"相关 UI，并且不能触发自动生成大纲。
 * 每条断言都同时验证反面（idea 项目仍然显示），避免"整页没加载"被误判成通过。
 */

const STREAM_URL = '**/generate/outline/stream';

async function createProject(request: APIRequestContext, body: object): Promise<string> {
  const res = await request.post('/api/projects', { data: body });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.data.project_id;
}

/** 拦截大纲流式生成，避免 idea 对照组真的打 AI；同时统计调用次数 */
async function blockOutlineStream(page: Page): Promise<() => number> {
  let calls = 0;
  await page.route(STREAM_URL, async route => {
    calls += 1;
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
  });
  return () => calls;
}

async function openOutline(page: Page, projectId: string) {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));
  await page.goto(`/project/${projectId}/outline`);
  await page.waitForLoadState('domcontentloaded');
  // 等页面真正渲染出大纲页（"添加页面"两种项目都有）
  await expect(page.getByRole('button', { name: /添加页面|Add Page/ }).first()).toBeVisible({
    timeout: 15000,
  });
}

const genOutlineBtn = (page: Page) =>
  page.getByRole('button', { name: /自动生成大纲|解析大纲|Auto Generate Outline|Parse Outline/ });

/**
 * 来源文本框：桌面端和移动端各渲染一个，靠 CSS class 控制显隐，
 * 所以两个节点始终在 DOM 里 —— 必须按"可见"来断言，不能数节点数量。
 */
const sourceBoxes = (page: Page) => page.locator('[contenteditable="true"]:visible');

test.describe('空白项目大纲页', () => {
  test('隐藏来源文本框与生成大纲按钮，且不自动生成', async ({ page, request }) => {
    const calls = await blockOutlineStream(page);
    const id = await createProject(request, { creation_type: 'blank' });
    await openOutline(page, id);

    await expect(genOutlineBtn(page)).toHaveCount(0);
    await expect(sourceBoxes(page)).toHaveCount(0);

    // 给自动生成的 useEffect 充分的触发时间
    await page.waitForTimeout(2500);
    expect(calls()).toBe(0);
  });

  test('对照：idea 项目仍显示来源文本框与生成按钮', async ({ page, request }) => {
    await blockOutlineStream(page);
    const id = await createProject(request, {
      creation_type: 'idea',
      idea_prompt: 'AI 发展史',
    });
    await openOutline(page, id);

    await expect(genOutlineBtn(page).first()).toBeVisible();
    await expect(sourceBoxes(page).first()).toBeVisible();
  });

  test('移动端视口下空白项目也不显示来源卡片', async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await blockOutlineStream(page);
    const id = await createProject(request, { creation_type: 'blank' });
    await openOutline(page, id);

    await expect(sourceBoxes(page)).toHaveCount(0);
    await expect(genOutlineBtn(page)).toHaveCount(0);
  });

  test('对照：移动端 idea 项目显示来源卡片', async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await blockOutlineStream(page);
    const id = await createProject(request, {
      creation_type: 'idea',
      idea_prompt: 'AI 发展史',
    });
    await openOutline(page, id);

    await expect(sourceBoxes(page).first()).toBeVisible();
  });

  test('空白项目可以手动添加页面', async ({ page, request }) => {
    await blockOutlineStream(page);
    const id = await createProject(request, { creation_type: 'blank' });
    await openOutline(page, id);

    await page.getByRole('button', { name: /添加页面|Add Page/ }).first().click();

    // 页面卡片用的是 <input>，不是 contenteditable
    await expect(page.getByText(/第\s*1\s*页|Page\s*1/).first()).toBeVisible({ timeout: 10000 });
    // 加完页面后来源文本框仍然不能冒出来
    await expect(sourceBoxes(page)).toHaveCount(0);
  });
});

test.describe('多模板模式 + 空白项目', () => {
  test('勾选多模板后创建空白项目会切到 multi', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    let modeBody: any = null;
    await page.route('**/template-mode', async route => {
      modeBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Success', data: {} }),
      });
    });

    await page.getByText(/每页独立模板|Per-page templates/).first().click();
    await page
      .getByRole('button', { name: /或从空白项目开始|Or start from a blank project/ })
      .first()
      .click();

    await expect.poll(() => modeBody, { timeout: 20000 }).not.toBeNull();
    expect(modeBody.mode).toBe('multi');
  });
});
