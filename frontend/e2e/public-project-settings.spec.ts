import { publicProvider } from './helpers/public-provider';
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function openSettings(page: Page, projectId: string) {
  await page.goto(`/project/${projectId}/preview`);
  await page.getByRole('button', { name: '项目设置', exact: true }).waitFor();
  const reminder = page.getByRole('button', { name: '我知道了', exact: true });
  if (await reminder.isVisible()) await reminder.click();
  await page.getByRole('button', { name: '项目设置', exact: true }).click();
  await page.getByRole('button', { name: /^(个人设置|全局设置)$/ }).click();
}

let token: string;
let projectId: string;
test.use({ viewport: { width: 1440, height: 1000 }, trace: 'off', video: 'off', screenshot: process.env.PUBLIC_DEMO_LIVE_KEY ? 'off' : 'only-on-failure' });
test.beforeEach(async ({ page, request }) => {
  token = randomUUID();
  await page.addInitScript(value => {
    localStorage.setItem('banana-slides-user-token', value);
    localStorage.setItem('hasSeenHelpModal', 'true');
  }, token);
  projectId = process.env.PUBLIC_DEMO_PROJECT_ID || '';
  if (!projectId) {
    const response = await request.post('/api/projects', { headers: { 'X-User-Token': token }, data: { creation_type: 'idea', idea_prompt: '项目内个人设置入口验收' } });
    expect(response.ok()).toBeTruthy();
    projectId = (await response.json()).data.project_id;
    const added = await request.post(`/api/projects/${projectId}/pages`, { headers: { 'X-User-Token': token }, data: { order_index: 0, outline_content: { title: '设置入口验收' } } });
    expect(added.ok()).toBeTruthy();
  }
});
test.afterEach(async ({ request }) => {
  const headers = { 'X-User-Token': token };
  expect((await request.post('/api/settings/reset', { headers })).ok()).toBeTruthy();
  const settings = (await (await request.get('/api/settings', { headers })).json()).data;
  expect(settings.api_key_length).toBe(0);
});

for (const partner of ['inferera', 'apimart', 'volcengine']) {
  test(`real modal: ${partner} save, reload, page parity, isolation and reset`, async ({ page, request, browser }) => {
    await openSettings(page, projectId);
    const select = page.getByRole('radiogroup', { name: 'API 提供商', exact: true });
    await expect(select).toBeVisible();
    await expect(select.getByRole('radio')).toHaveCount(3);
    await expect(select).toContainText('仅需 $0.006/张');
    await expect(select).toContainText('国内直连');
    await expect(page.getByRole('heading', { name: '个人设置', exact: true })).toBeVisible();
    await expect(page.getByText('这些设置仅应用于你的请求，其他访客不受影响。')).toBeVisible();
    await expect(page.getByRole('button', { name: '返回首页', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('API Base URL', { exact: true })).toBeDisabled();
    await publicProvider(page, partner).click();
    for (const label of ['文本模型', '图像生成模型', '图像描述模型']) {
      await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
    }
    const key = page.getByLabel('API Key', { exact: true });
    await key.fill('integration-only-modal-key');
    await page.getByRole('combobox', { name: '图像清晰度', exact: true }).selectOption('4K');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await expect(page.getByText('设置保存成功', { exact: true })).toBeVisible();
    await openSettings(page, projectId); // Full reload, same visitor.
    await expect(publicProvider(page, partner)).toHaveAttribute('aria-checked', 'true');
    await expect(key).toHaveValue('');
    await expect(key).toHaveAttribute('placeholder', '已保存，留空保持不变');
    await expect(page.getByRole('combobox', { name: '图像清晰度', exact: true })).toHaveValue('4K');
    const guest = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    try {
      const guestPage = await guest.newPage();
      await openSettings(guestPage, projectId);
      await expect(guestPage.getByLabel('API Key', { exact: true })).toHaveAttribute('placeholder', '输入该 API 提供商的 API Key');
      await expect(guestPage.getByRole('combobox', { name: '图像清晰度', exact: true })).toHaveValue('2K');
    } finally { await guest.close(); }
    await page.goto('/settings');
    await expect(publicProvider(page, partner)).toHaveAttribute('aria-checked', 'true');
    await expect(key).toHaveAttribute('placeholder', '已保存，留空保持不变');
    await expect(page.getByRole('button', { name: '返回首页', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: '图像清晰度', exact: true }).selectOption('1K');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await expect(page.getByText('设置保存成功', { exact: true })).toBeVisible();
    await openSettings(page, projectId);
    await expect(page.getByRole('combobox', { name: '图像清晰度', exact: true })).toHaveValue('1K');
    await page.getByRole('button', { name: '重置设置', exact: true }).click();
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await expect(page.getByText('个人设置已重置', { exact: true })).toBeVisible();
    await openSettings(page, projectId);
    await expect(publicProvider(page, 'inferera')).toHaveAttribute('aria-checked', 'true');
    await expect(key).toHaveAttribute('placeholder', '输入该 API 提供商的 API Key');
    await expect(page.getByRole('combobox', { name: '图像清晰度', exact: true })).toHaveValue('2K');
    await page.getByRole('button', { name: '导出设置', exact: true }).click();
    await expect(page.getByRole('heading', { name: '可编辑 PPTX 导出设置', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '项目设置', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: '项目级配置', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '个人设置', exact: true }).click();
    await expect(publicProvider(page, 'inferera')).toHaveAttribute('aria-checked', 'true');
    const state = (await (await request.get('/api/settings', { headers: { 'X-User-Token': token } })).json()).data;
    expect(state.api_key_length).toBe(0);
    await publicProvider(page, partner).click();
    await page.getByRole('heading', { name: '个人设置', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ animations: 'disabled', path: test.info().outputPath(`modal-${partner}.png`) });
  });
}

test('mock non-demo: project modal retains the full global settings', async ({ page }) => {
  await page.route(url => url.pathname === '/api/public-config', route => route.fulfill({ json: { success: true, data: { enabled: false } } }));
  await page.route(url => url.pathname === '/api/settings', route => route.fulfill({ json: { success: true, data: { ai_provider_format: 'gemini', api_base_url: '', api_key_length: 0 } } }));
  // The project is a real backend project; only mode/config are mocked.
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/public-config' || pathname === '/api/settings') return route.fallback();
    await route.continue({ headers: { ...route.request().headers(), 'X-User-Token': token } });
  });
  await openSettings(page, projectId);
  await expect(page.getByRole('heading', { name: '全局设置', exact: true })).toBeVisible();
  await expect(page.getByText('API Base URL', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Gemini', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '个人设置', exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: /APIMart/ }).hover();
  await expect(page.getByText('按量付费、无月费', { exact: true })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`real settings page: provider benefits and responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/settings');
    for (const provider of ['inferera', 'apimart', 'volcengine']) {
      await publicProvider(page, provider).click();
      await expect(publicProvider(page, provider)).toHaveAttribute('aria-checked', 'true');
      if (provider !== 'inferera') {
        await publicProvider(page, provider).hover();
        await expect(page.getByTestId(`provider-plan-${provider}`)).toContainText(provider === 'apimart' ? '按量付费' : '国内直连');
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ animations: 'disabled', path: test.info().outputPath(`settings-${width}.png`), fullPage: true });
  });
}

test('live modal: saved personal key runs the real text service', async ({ page }) => {
  test.skip(!process.env.PUBLIC_DEMO_LIVE_KEY, 'Requires an explicitly supplied provider credential');
  test.setTimeout(180000);
  await openSettings(page, projectId);
  await publicProvider(page, 'apimart').click();
  await page.getByLabel('API Key', { exact: true }).fill(process.env.PUBLIC_DEMO_LIVE_KEY!);
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByText('设置保存成功', { exact: true })).toBeVisible();
  await openSettings(page, projectId);
  const service = page.getByTestId('service-test-text-model');
  await service.getByRole('button').click();
  await expect(service).toContainText('文本模型测试成功', { timeout: 120000 });
  await expect(service.getByRole('button')).toBeEnabled();
});

test('real modal: narrow viewport keeps tabs, provider controls and saving usable', async ({ page }) => {
  await openSettings(page, projectId);
  await page.setViewportSize({ width: 390, height: 844 });
  const key = page.getByLabel('API Key', { exact: true });
  const box = await key.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(250);
  expect(box!.x + box!.width).toBeLessThanOrEqual(374);
  await publicProvider(page, 'apimart').click();
  await page.getByRole('combobox', { name: '图像清晰度', exact: true }).selectOption('4K');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByText('设置保存成功', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '导出设置', exact: true }).click();
  await expect(page.getByRole('heading', { name: '可编辑 PPTX 导出设置', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '个人设置', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '图像清晰度', exact: true })).toHaveValue('4K');
  await page.getByRole('heading', { name: '个人设置', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ animations: 'disabled', path: test.info().outputPath('modal-390.png') });
});


test('modal presentation matches full settings fields and provider details', async ({ page }) => {
  await openSettings(page, projectId);
  const styles = async () => ({
    input: await page.locator('input[type=password]').first().evaluate(element => {
      const css = getComputedStyle(element);
      return [css.fontSize, css.height, css.padding, css.borderRadius, css.borderColor];
    }),
    provider: await page.locator('[data-provider="apimart"]').evaluate(element => {
      const css = getComputedStyle(element);
      return [css.fontSize, css.padding, css.borderRadius];
    }),
  });
  const personal = await styles();
  await page.locator('[data-provider="apimart"]').hover();
  const promo = page.getByTestId('provider-plan-apimart');
  await expect(promo).toHaveCSS('opacity', '1');
  await expect(promo).toContainText('1 美元可生成 160+ 张图片');
  await promo.getByRole('button').click();
  await expect(publicProvider(page, 'apimart')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('API Base URL', { exact: true })).toHaveValue('https://api.apimart.ai/v1');
  await page.getByRole('heading', { name: '个人设置', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('personal-modal.png'), animations: 'disabled' });

  await page.route(url => url.pathname === '/api/public-config', route => route.fulfill({ json: { success: true, data: { enabled: false } } }));
  await page.route(url => url.pathname === '/api/settings', route => route.fulfill({ json: { success: true, data: { ai_provider_format: 'gemini', api_base_url: '', api_key_length: 0 } } }));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    if (['/api/public-config', '/api/settings'].includes(new URL(route.request().url()).pathname)) return route.fallback();
    await route.continue({ headers: { ...route.request().headers(), 'X-User-Token': token } });
  });
  await openSettings(page, projectId);
  expect(await styles()).toEqual(personal);
  await page.screenshot({ path: test.info().outputPath('original-modal.png'), animations: 'disabled' });
  await page.locator('[data-provider="apimart"]').hover();
  await expect(promo).toHaveCSS('opacity', '1');
  await expect(promo).toContainText('1 美元可生成 160+ 张图片');
});
