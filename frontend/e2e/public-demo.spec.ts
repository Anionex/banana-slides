import { publicProvider } from './helpers/public-provider';
import { test, expect } from '@playwright/test';
const token = 'public-e2e-visitor-00000000000001';
const noKeyToken = 'public-e2e-no-key-000000000000000';
const invalidKeyToken = 'public-e2e-invalid-key-000000000000';
const base = process.env.BASE_URL || 'http://localhost:3487';
const auth = { 'X-User-Token': token };
test.beforeEach(async ({ page }, testInfo) => {
  const visitor = testInfo.title.startsWith('real home:') ? noKeyToken
    : testInfo.title.startsWith('mock creation:') ? invalidKeyToken : token;
  await page.addInitScript(value => {
    localStorage.setItem('banana-slides-user-token', value);
    localStorage.setItem('hasSeenHelpModal', 'true');
  }, visitor);
});
test('real settings: partners, locked models, persistence, isolation and reset', async ({ page, request }) => {
  await request.post(`${base}/api/settings/reset`, { headers: auth });
  await page.goto('/settings');
  await publicProvider(page, 'apimart').click();
  await expect(page.getByLabel('文本模型', { exact: true })).toHaveCount(0);
  await page.getByLabel('API Key', { exact: true }).fill('public-e2e-placeholder-key');
  await page.getByRole('button', { name: '高级设置', exact: true }).click();
  await page.getByRole('switch', { name: '文本推理模式', exact: true }).check();
  await page.getByLabel('文本推理预算', { exact: true }).fill('2048');
  await page.getByLabel('MinerU Token', { exact: true }).fill('private-parser-placeholder');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByText('设置保存成功')).toBeVisible();
  await page.reload();
  await expect(publicProvider(page, 'apimart')).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: '高级设置', exact: true }).click();
  await expect(page.getByLabel('文本推理预算', { exact: true })).toHaveValue('2048');
  await expect(page.getByLabel('MinerU Token', { exact: true })).toHaveAttribute('placeholder', '已保存，留空保持不变');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveAttribute('placeholder', '已保存，留空保持不变');
  const other = await request.get(`${base}/api/settings`, { headers: { 'X-User-Token': 'public-e2e-other-000000000000001' } });
  expect((await other.json()).data.api_key_length).toBe(0);
  for (const partner of ['inferera', 'volcengine']) {
    await publicProvider(page, partner).click();
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    await page.reload();
    await expect(publicProvider(page, partner)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('API Key', { exact: true })).toHaveAttribute('placeholder', '输入该 API 提供商的 API Key');
    await expect(page.getByLabel('图像生成模型', { exact: true })).toHaveCount(0);
  }
  await page.getByRole('button', { name: '重置设置', exact: true }).click();
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.getByText('个人设置已重置')).toBeVisible();
  await page.reload();
  await expect(publicProvider(page, 'inferera')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('MinerU Token', { exact: true })).toHaveAttribute('placeholder', '输入 MinerU Token');
  await page.screenshot({ path: '../work/qa/public-settings.png', fullPage: true });
});
test('real pages: no history, share URL, first preview reminder, fixed fields', async ({ page, request, browser }) => {
  const created = await request.post(`${base}/api/projects`, { headers: auth, data: { creation_type: 'idea', idea_prompt: '公开版分享链接验收' } });
  expect(created.ok()).toBeTruthy();
  const projectId = (await created.json()).data.project_id;
  const added = await request.post(`${base}/api/projects/${projectId}/pages`, { headers: auth, data: { order_index: 0, outline_content: { title: '分享测试' } } });
  expect(added.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('button', { name: /历史/ })).toHaveCount(0);
  expect((await request.get(`${base}/api/projects`, { headers: auth })).status()).toBe(403);
  expect((await request.delete(`${base}/api/projects/${projectId}`, { headers: auth })).status()).toBe(403);
  await page.goto('/history');
  await expect(page).toHaveURL(base + '/');
  await page.goto(`/project/${projectId}/preview`);
  await expect(page.getByRole('heading', { name: '请保存当前 PPT 链接' })).toBeVisible();
  const url = await page.getByLabel('当前 PPT 链接', { exact: true }).inputValue();
  expect(url).toBe(`${base}/project/${projectId}/preview`);
  expect(url).not.toContain(token);
  await expect(page.getByText('如果链接丢失，将无法再次访问此 PPT。')).toBeVisible();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '复制链接', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await page.screenshot({ path: '../work/qa/public-share.png' });
  await page.getByRole('button', { name: '我知道了' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '分享 / 保存链接' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '请保存当前 PPT 链接' })).toHaveCount(0);
  await page.getByRole('button', { name: '分享 / 保存链接' }).click();
  await expect(page.getByLabel('当前 PPT 链接', { exact: true })).toHaveValue(url);
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(url);
  await expect(guestPage.getByRole('heading', { name: '请保存当前 PPT 链接' })).toBeVisible();
  await guest.close();
  await page.goto(`/project/${projectId}/detail`);
  await page.getByRole('button', { name: /生成设置|设置/ }).first().click();
  await expect(page.getByTestId('public-description-fields')).toBeVisible();
  await expect(page.getByPlaceholder('添加字段')).toHaveCount(0);
  const requirements = page.locator('[data-testid="desc-requirements-textarea"] [contenteditable="true"]').first();
  await requirements.fill('保持每页生成要求可编辑');
  await expect.poll(async () => (await (await request.get(`${base}/api/projects/${projectId}`, { headers: auth })).json()).data.description_requirements).toBe('保持每页生成要求可编辑');
  await page.reload();
  await page.getByRole('button', { name: '描述设置', exact: true }).click();
  await expect(requirements).toHaveText('保持每页生成要求可编辑');
  await page.getByRole('button', { name: '描述设置', exact: true }).click();
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  await page.locator('[role="dialog"] [contenteditable="true"]').first().fill('每页描述正文仍可编辑');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(async () => (await (await request.get(`${base}/api/projects/${projectId}`, { headers: auth })).json()).data.pages[0].description_content?.text).toBe('每页描述正文仍可编辑');
  expect((await request.put(`${base}/api/settings`, { headers: auth, data: { description_extra_fields: ['override'] } })).status()).toBe(400);
});

test('real home: missing personal key keeps the draft and explains setup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox').first().fill('验证缺少密钥时保留首页草稿');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await expect(page).toHaveURL(base + '/settings');
  await expect(page.getByText('请先选择 API 提供商并填写你的 API Key。保存后返回首页继续，刚才的输入已保留。')).toBeVisible();
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await expect(page.getByRole('textbox').first()).toContainText('验证缺少密钥时保留首页草稿');
});

test('mock nonpublic mode keeps main history and full settings', async ({ page }) => {
  await page.route(url => url.pathname === '/api/public-config', route => route.fulfill({ json: { success: true, data: { enabled: false, partners: {} } } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /历史/ })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByLabel('API 提供商')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '默认 API 配置', exact: true })).toBeVisible();
});

test('mock creation: invalid saved key is verified before creating a project', async ({ page, request }) => {
  const visitor = invalidKeyToken;
  await request.put(`${base}/api/settings`, { headers: { 'X-User-Token': visitor }, data: { partner: 'apimart', api_key: 'invalid-placeholder' } });
  let verified = false;
  let created = false;
  await page.route(url => url.pathname === '/api/settings/verify', async route => {
    expect(route.request().headers()['x-user-token']).toBe(visitor);
    verified = true;
    await route.fulfill({ json: { success: true, data: { available: false } } });
  });
  await page.route(url => url.pathname === '/api/projects', async route => {
    if (route.request().method() === 'POST') created = true;
    await route.continue();
  });
  try {
    await page.goto('/');
    await page.getByRole('textbox').first().fill('验证无效密钥不会创建项目');
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await expect(page).toHaveURL(base + '/settings');
    await expect(page.getByRole('alert')).toContainText('API Key 验证失败');
    expect(verified).toBeTruthy();
    expect(created).toBeFalsy();
  } finally {
    await request.post(`${base}/api/settings/reset`, { headers: { 'X-User-Token': visitor } });
  }
});
test('mock bootstrap: failure is closed and retry restores settings', async ({ page }) => {
  let unavailable = true;
  await page.route(url => url.pathname === '/api/public-config', async route => {
    if (unavailable) await route.fulfill({ status: 503, json: { error: 'offline' } });
    else await route.continue();
  });
  await page.goto('/settings');
  await expect(page.getByText('无法读取站点配置，请稍后重试。')).toBeVisible();
  await expect(page.getByLabel('API 提供商')).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByLabel('API 提供商')).toBeVisible();
});
