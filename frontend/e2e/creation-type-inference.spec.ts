import { test, expect, type Page } from '@playwright/test';

/**
 * createProject 现在优先使用显式传入的 creation_type，只在缺省时才按文本字段推断。
 * 这条路径所有创建方式都会走，所以三种老方式必须保持原有推断结果不变。
 */

const CREATE_URL = '**/api/projects';

/** 拦截创建请求，返回捕获到的 payload；用 mock 响应避免真实建项目和后续 AI 调用 */
async function capturePayload(page: Page, act: () => Promise<void>): Promise<any> {
  let body: any = null;
  await page.route(CREATE_URL, async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Success',
        data: { project_id: 'e2e-fake-id', status: 'DRAFT', pages: [] },
      }),
    });
  });
  await act();
  await expect.poll(() => body, { timeout: 15000 }).not.toBeNull();
  await page.unroute(CREATE_URL);
  return body;
}

async function openHome(page: Page) {
  // 首次访问会弹出"快速开始"引导弹窗，会挡住下面所有点击
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenHelpModal', 'true');
  });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
}

async function selectTab(page: Page, names: RegExp) {
  await page.getByRole('button', { name: names }).first().click();
  await page.waitForTimeout(300);
}

async function fillContent(page: Page, text: string) {
  // MarkdownTextarea 是 contenteditable div，不是 <textarea>
  const box = page.locator('[contenteditable="true"]').first();
  await box.waitFor({ state: 'visible', timeout: 10000 });
  await box.click();
  await page.keyboard.insertText(text);
  // 等 React state 同步（提交按钮靠 content.trim() 解除 disabled）
  await expect(
    page.getByRole('button', { name: /^(下一步|Next)$/ }).first()
  ).toBeEnabled({ timeout: 10000 });
}

async function clickCreate(page: Page) {
  // 提交按钮用的是 common.next（"下一步"），不是 home.actions.createProject
  await page
    .getByRole('button', { name: /^(下一步|Next)$/ })
    .first()
    .click();
}

test.describe('creation_type 推断', () => {
  test('一句话生成 -> idea', async ({ page }) => {
    await openHome(page);
    await selectTab(page, /一句话生成|From Idea/);
    await fillContent(page, 'AI 发展史');
    const body = await capturePayload(page, () => clickCreate(page));

    expect(body.creation_type).toBe('idea');
    expect(body.idea_prompt).toBe('AI 发展史');
    expect(body.outline_text).toBeUndefined();
    expect(body.description_text).toBeUndefined();
  });

  test('从大纲生成 -> outline', async ({ page }) => {
    await openHome(page);
    await selectTab(page, /从大纲生成|From Outline/);
    await fillContent(page, '第一页：起源');
    const body = await capturePayload(page, () => clickCreate(page));

    expect(body.creation_type).toBe('outline');
    expect(body.outline_text).toBe('第一页：起源');
    expect(body.idea_prompt).toBeUndefined();
  });

  test('从描述生成 -> descriptions', async ({ page }) => {
    await openHome(page);
    await selectTab(page, /从描述生成|From Description/);
    await fillContent(page, '第一页：起源，左文右图');
    const body = await capturePayload(page, () => clickCreate(page));

    // 注意后端用的是复数 descriptions
    expect(body.creation_type).toBe('descriptions');
    expect(body.description_text).toBe('第一页：起源，左文右图');
    expect(body.idea_prompt).toBeUndefined();
  });

  test('空白项目 -> blank，且不带任何文本字段', async ({ page }) => {
    await openHome(page);
    const body = await capturePayload(page, async () => {
      await page
        .getByRole('button', { name: /或从空白项目开始|Or start from a blank project/ })
        .first()
        .click();
    });

    expect(body.creation_type).toBe('blank');
    expect(body.idea_prompt).toBeUndefined();
    expect(body.outline_text).toBeUndefined();
    expect(body.description_text).toBeUndefined();
  });
});
