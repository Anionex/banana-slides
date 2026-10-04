import { seedProjectWithImages } from './helpers/seed-project';
import { expect, test } from '@playwright/test';
test.use({ video: 'off', launchOptions: { channel: 'chrome' } });

// Run with scripts/verify_screenshot_issues.py: real HTTP/SQLite/tasks, fixture AI only.
test.skip(process.env.BANANA_ISSUE_FIXTURES !== '1', 'Requires the isolated issue verification runner');
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenHelpModal', 'true');
    localStorage.setItem('banana-slides-language', 'zh');
  });
});

test('report form preserves input and sends edited prompt through real project and outline APIs', async ({ page, request }) => {
  await page.goto('/');
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.fill('自由输入草稿');
  await page.getByRole('button', { name: '日常汇报', exact: true }).click();
  await expect(page.getByText('请填写主题后继续')).toBeVisible();
  await expect(page.getByRole('button', { name: '下一步', exact: true })).toBeDisabled();
  await page.getByLabel('主题（必填）').fill('十月项目进展');
  await page.getByLabel('场景预设').selectOption('1');
  await page.getByLabel('目标受众').fill('研发团队');
  await page.getByLabel('场景预设').selectOption('3');
  await expect(page.getByLabel('目标受众')).toHaveValue('研发团队');
  await expect(editor).toContainText('十月项目进展');
  const finalPrompt = '主题：十月项目进展，汇报给研发团队。只使用已确认数据。';
  await editor.fill(finalPrompt);
  await page.getByLabel('补充要求').fill('不能覆盖手动预览');
  await expect(editor).toHaveText(finalPrompt);
  await page.getByRole('button', { name: '自由输入', exact: true }).click();
  await expect(editor).toHaveText('自由输入草稿');
  await page.getByRole('button', { name: '日常汇报', exact: true }).click();
  await expect(editor).toHaveText(finalPrompt);
  await page.getByRole('button', { name: '16:9', exact: true }).click();
  await page.getByRole('button', { name: '4:3', exact: true }).click();
  await page.screenshot({ path: '../output/issue-verification/report-form.png', fullPage: true });
  const created = page.waitForResponse(r => r.url().endsWith('/api/projects') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  const id = (await (await created).json()).data.project_id;
  try {
    await expect(page).toHaveURL(new RegExp(`/project/${id}/outline`));
    await expect.poll(async () => (await (await request.get(`/api/projects/${id}`)).json()).data.pages.length).toBe(1);
    await page.reload();
    const saved = (await (await request.get(`/api/projects/${id}`)).json()).data;
    expect(saved.idea_prompt).toBe(finalPrompt);
    expect(saved.image_aspect_ratio).toBe('4:3');
    await expect(page.locator('[contenteditable="true"]:visible').first()).toContainText('十月项目进展');
    await page.screenshot({ path: '../output/issue-verification/report.png', fullPage: true });
  } finally { await request.delete(`/api/projects/${id}`); }
});

test('Codex selection opens login, cancellation preserves provider, manual callback applies intended field', async ({ page }) => {
  const settings = await (await page.request.get('/api/settings')).json();
  await page.route('**/api/settings', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { ...settings, data: { ...settings.data, ai_provider_format: 'gemini', openai_oauth_connected: false } } })
    : route.continue());
  await page.goto('/settings');
  const codex = page.getByRole('radio', { name: 'Codex (OpenAI OAuth)', exact: true });
  await expect(codex).toBeEnabled();
  await codex.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Login with OpenAI' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(codex).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('image_model_source-select').selectOption('codex');
  await expect(dialog).toBeVisible();
  await page.route('**/api/settings/openai-oauth/manual-callback', route => route.fulfill({ json: { success: true, data: { account_id: 'fixture-user' } } }));
  await dialog.getByRole('button', { name: /登录后连接失败|Connection failed/ }).click();
  await dialog.locator('input').fill('http://localhost:1455/auth/callback?code=fixture&state=fixture');
  await dialog.getByRole('button', { name: /提交|Submit/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('image_model_source-select')).toHaveValue('codex');
  await expect(codex).toHaveAttribute('aria-checked', 'false');
  await codex.click();
  await expect(codex).toHaveAttribute('aria-checked', 'true');
  await expect(dialog).not.toBeVisible();
});

test('OAuth popup opens synchronously before the delayed authorize response', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Codex (OpenAI OAuth)', exact: true }).click();
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/settings/openai-oauth/authorize', async route => {
    await gate;
    await route.fulfill({ json: { success: true, data: { auth_url: `${new URL(page.url()).origin}/?oauth-fixture=1` } } });
  });
  const popupEvent = page.waitForEvent('popup');
  await page.getByRole('dialog').getByRole('button', { name: 'Login with OpenAI' }).click();
  const popup = await popupEvent;
  expect(popup.url()).toBe('about:blank');
  release();
  await expect(popup).toHaveURL(/oauth-fixture=1/);
  await popup.close();
  await expect(page.getByRole('button', { name: 'Login with OpenAI' })).toBeEnabled();
});

test('two material jobs run concurrently, survive closing/reopening and retain separate results', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/?action=material-generate');
  let dialog = page.getByRole('dialog', { name: '素材工具箱' });
  const prompt = dialog.locator('textarea').first();
  await prompt.fill('slow first blue');
  const submitted = page.waitForResponse(r => r.url().endsWith('/materials/process') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: '执行工具', exact: true }).click();
  expect((await submitted).ok()).toBeTruthy();
  await expect(dialog.getByRole('button', { name: '执行工具', exact: true })).toBeEnabled();
  await prompt.fill('fast second green');
  await dialog.getByRole('button', { name: '执行工具', exact: true }).click();
  const runs = page.getByTestId('material-runs');
  await expect(runs.getByRole('button', { name: /#2 fast second green/ })).toBeVisible();
  await expect(runs.getByRole('button', { name: /#1 slow first blue/ })).toContainText('生成中');
  await dialog.getByRole('button', { name: '关闭', exact: true }).last().click();
  await page.reload();
  await page.getByRole('button', { name: '素材生成', exact: true }).first().click();
  dialog = page.getByRole('dialog', { name: '素材工具箱' });
  await expect(runs.getByRole('button', { name: /#2 fast second green/ })).toContainText('已完成', { timeout: 15000 });
  await expect(runs.getByRole('button', { name: /#1 slow first blue/ })).toContainText('已完成', { timeout: 20000 });
  await runs.getByRole('button', { name: /#1 slow first blue/ }).click();
  const first = await dialog.getByAltText('处理结果').getAttribute('src');
  await runs.getByRole('button', { name: /#2 fast second green/ }).click();
  const second = await dialog.getByAltText('处理结果').getAttribute('src');
  expect(first).not.toBe(second);
  await expect(dialog.getByAltText('处理结果')).toBeVisible();
  await dialog.locator('textarea').first().fill('fail third');
  await dialog.getByRole('button', { name: '执行工具', exact: true }).click();
  await expect(runs.getByRole('button', { name: /#3 fail third/ })).toContainText('失败', { timeout: 15000 });
  await expect(runs.getByRole('button', { name: /#1 slow first blue/ })).toContainText('已完成');
  await runs.scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: '../output/issue-verification/materials.png' });
});

for (const [format, label] of [['pptx', '导出为 PPTX'], ['pdf', '导出为 PDF'], ['images', '导出为图片']]) {
  test(`delayed ${format} export downloads real bytes with popup opening blocked`, async ({ page, request, baseURL }) => {
    const { projectId } = await seedProjectWithImages(baseURL!, 1);
    try {
      await page.addInitScript(() => { window.open = () => { throw new Error('Popup blocked'); }; });
      await page.route(`**/api/projects/${projectId}/export/${format}**`, async route => {
        const response = await route.fetch();
        await new Promise(resolve => setTimeout(resolve, 5500));
        await route.fulfill({ response });
      });
      await page.goto(`/project/${projectId}/preview`);
      await page.locator('button:has-text("导出")').first().click();
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name: label, exact: true }).click();
      if (format === 'pptx') await page.getByRole('button', { name: '开始导出' }).click();
      const download = await downloading;
      expect(await download.failure()).toBeNull();
      const stream = await download.createReadStream();
      let size = 0;
      for await (const chunk of stream!) size += chunk.length;
      expect(size).toBeGreaterThan(100);
      expect(page.url()).toContain(`/project/${projectId}/preview`);
    } finally { await request.delete(`/api/projects/${projectId}`); }
  });
}

test('editable export without randomUUID sends a valid task ID and surfaces errors', async ({ page, request, baseURL }) => {
  const { projectId } = await seedProjectWithImages(baseURL!, 1);
  try {
    await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }));
    let taskId = '';
    await page.route(`**/api/projects/${projectId}/export/editable-pptx`, async route => {
      taskId = route.request().postDataJSON().client_task_id;
      await route.fulfill({ status: 400, json: { success: false, error: { message: 'Fixture export validation error' } } });
    });
    await page.goto(`/project/${projectId}/preview`);
    await page.locator('button:has-text("导出")').first().click();
    await page.getByRole('button', { name: /导出可编辑 PPTX/ }).click();
    await page.getByRole('button', { name: '开始导出' }).click();
    await expect.poll(() => taskId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await expect(page.getByText(/Fixture export validation error/).first()).toBeVisible();
  } finally { await request.delete(`/api/projects/${projectId}`); }
});

for (const multi of [false, true]) {
  test(`report entry preserves ${multi ? 'per-page' : 'single'} templates and reference files`, async ({ page, request }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '日常汇报', exact: true }).click();
    await page.getByLabel('主题（必填）').fill('有资料与模板的汇报');
    const uploaded = page.waitForResponse(r => r.url().endsWith('/api/reference-files/upload') && r.request().method() === 'POST');
    await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({ name: 'report-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Confirmed report evidence: milestone A completed.') });
    const fileResponse = await (await uploaded).json();
    const fileId = fileResponse.data.file_id || fileResponse.data.id;
    await expect(page.getByRole('button', { name: '下一步', exact: true })).toBeEnabled({ timeout: 15000 });
    await page.getByAltText('复古卷轴', { exact: true }).click();
    if (multi) await page.getByRole('checkbox', { name: /每页独立模板/ }).check();
    const created = page.waitForResponse(r => r.url().endsWith('/api/projects') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    const id = (await (await created).json()).data.project_id;
    try {
      await expect(page).toHaveURL(new RegExp(`/project/${id}/outline`));
      const saved = (await (await request.get(`/api/projects/${id}`)).json()).data;
      expect(saved.template_mode).toBe(multi ? 'multi' : 'single');
      if (!multi) expect(saved.template_image_url).toBeTruthy();
      const refs = (await (await request.get(`/api/reference-files/project/${id}`)).json()).data;
      expect(JSON.stringify(refs)).toContain('report-notes.txt');
      await page.reload();
      await expect(page.getByText('report-notes.txt').first()).toBeVisible();
    } finally {
      await request.delete(`/api/projects/${id}`);
      if (fileId) await request.delete(`/api/reference-files/${fileId}`);
    }
  });
}

test('global Codex login applies the selection and clears the previous APIMart default endpoint', async ({ page }) => {
  const base = await (await page.request.get('/api/settings')).json();
  await page.route('**/api/settings', route => route.fulfill({ json: {
    ...base, data: { ...base.data, ai_provider_format: 'openai', api_base_url: 'https://api.apimart.ai/v1', openai_oauth_connected: false },
  } }));
  await page.route('**/api/settings/openai-oauth/manual-callback', route => route.fulfill({ json: { success: true, data: { account_id: 'fixture-user' } } }));
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Codex (OpenAI OAuth)', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /登录后连接失败|Connection failed/ }).click();
  await dialog.locator('input').fill('http://localhost:1455/auth/callback?code=fixture&state=fixture');
  await dialog.getByRole('button', { name: '提交' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('radio', { name: 'Codex (OpenAI OAuth)', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: /^OpenAI/ }).click();
  await expect(page.getByTestId('global-api-config-section').locator('input[type="text"]').first()).toHaveValue('');
});
