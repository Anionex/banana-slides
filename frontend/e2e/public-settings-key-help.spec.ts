import { publicProvider } from './helpers/public-provider';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Real clipboard contents are shared across browser contexts and workers.
test.describe.configure({ mode: 'serial' });

const providers = [
  { id: 'inferera', name: 'Inferera', url: 'https://inferera.com/?aff=17EC' },
  { id: 'volcengine', name: '火山 Agent Plan', url: 'https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides' },
];

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.config.workers > 1, 'Real system clipboard checks require --workers=1 across the entire run, including other spec files.');
  await page.addInitScript(token => localStorage.setItem('banana-slides-user-token', token), randomUUID());
});

for (const provider of providers) {
  test(`${provider.name}: real settings save/reload, help link and clipboard`, async ({ page }) => {
    await page.goto('/settings');
    try {
      await publicProvider(page, provider.id).click();
      await page.getByRole('button', { name: '保存设置', exact: true }).click();
      await expect(page.getByText('设置保存成功')).toBeVisible();
      await page.reload();
      await expect(publicProvider(page, provider.id)).toHaveAttribute('aria-checked', 'true');
      const step = page.locator('ol > li').first();
      await expect(step).toContainText(`前往 ${provider.name} 注册或登录`);
      if (provider.id === 'inferera') {
        await page.context().route(provider.url, route => route.fulfill({ body: 'Provider destination verified' }));
        const opened = page.context().waitForEvent('page');
        await step.getByRole('button', { name: '访问官网 ↗', exact: true }).click();
        const destination = await opened;
        await expect(destination).toHaveURL(provider.url);
        expect(await destination.evaluate(() => window.opener)).toBeNull();
        await destination.close();
      } else {
        await expect(step.getByRole('link')).toBeVisible();
        await expect(step.getByRole('link')).toHaveAttribute('href', provider.url);
        await expect(step.getByRole('link')).toHaveAttribute('target', '_blank');
      }
      await step.getByRole('button', { name: '复制链接', exact: true }).click();
      await expect(page.getByText('链接已复制到剪贴板', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(provider.url);
      await page.getByRole('region', { name: 'API 配置' }).screenshot({ path: test.info().outputPath(`${provider.id}.png`) });
    } finally {
      const token = await page.evaluate(() => localStorage.getItem('banana-slides-user-token'));
      const reset = await page.request.post('/api/settings/reset', { headers: { 'X-User-Token': token! } });
      expect(reset.ok()).toBeTruthy();
    }
  });

  test(`${provider.name}: hiding the link preserves instructions and copy action`, async ({ page }) => {
    await page.goto('/settings');
    await publicProvider(page, provider.id).click();
    // Reproduce the reported appearance without claiming an extension caused it.
    await page.addStyleTag({ content: 'ol a { display: none !important; }' });
    const step = page.locator('ol > li').first();
    expect(await step.innerText()).toContain(`前往 ${provider.name} 注册或登录`);
    await step.getByRole('button', { name: '复制链接', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(provider.url);
  });
}

for (const embedded of [false, true]) for (const mobile of [false, true]) {
  test(`filtered guidance: ${embedded ? 'project modal' : 'settings page'}, ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
    // The existing preview header exposes settings only on desktop. Open there,
    // then resize the modal to verify its narrow layout without altering navigation.
    await page.setViewportSize(mobile && !embedded ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));
    if (embedded) {
      const projectId = randomUUID();
      await page.route(url => url.pathname === `/api/projects/${projectId}`, route => route.fulfill({ json: {
        success: true, data: {
          project_id: projectId, idea_prompt: 'Key guidance regression', status: 'DRAFT',
          template_style: 'Plain', created_at: '2026-10-20T00:00:00', updated_at: '2026-10-20T00:00:00',
          pages: [{ page_id: 'fixture-page', order_index: 0, outline_content: { title: 'Key guidance regression' }, status: 'DRAFT' }],
        },
      } }));
      await page.goto(`/project/${projectId}/preview`);
      await page.getByRole('button', { name: '我知道了', exact: true }).click();
      await page.getByRole('button', { name: '项目设置', exact: true }).click();
      await page.getByRole('button', { name: '个人设置', exact: true }).click();
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    } else await page.goto('/settings');
    await publicProvider(page, 'inferera').click();
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), mobile);
    // Model cosmetic filtering without attributing the user's issue to a specific extension/list.
    await page.addStyleTag({ content: 'a[href*="inferera.com"], a[href*="?aff="], a[href*="&aff="] { display: none !important; }' });
    const region = page.getByRole('region', { name: 'API 配置', exact: true });
    await expect(region.getByText('若需快速配置或稳定高并发生图，可使用 Inferera。', { exact: false })).toBeVisible();
    await expect(region.getByText('在左侧「账户」区域点击「余额充值」，完成充值')).toBeVisible();
    await expect(region.getByText('在左侧「开发」区域点击「API Keys」，创建新的 API Key')).toBeVisible();
    await page.context().route(providers[0].url, route => route.fulfill({ body: 'Provider destination verified' }));
    for (const name of ['申请 API Key ↗', '访问官网 ↗']) {
      const action = region.getByRole('button', { name, exact: true });
      await expect(action).toBeVisible();
      await action.focus();
      const opened = page.context().waitForEvent('page');
      await action.press('Enter');
      const destination = await opened;
      await expect(destination).toHaveURL(providers[0].url);
      expect(await destination.evaluate(() => window.opener)).toBeNull();
      await destination.close();
    }
    await region.getByRole('button', { name: '复制链接', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(providers[0].url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await region.screenshot({ path: test.info().outputPath('filtered-guidance.png') });
  });
}

test('clipboard rejection shows an error instead of success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: '复制链接', exact: true }).click();
  await expect(page.getByText('复制失败，请手动复制链接', { exact: true })).toBeVisible();
  await expect(page.getByText('链接已复制到剪贴板', { exact: true })).toHaveCount(0);
});

test('legacy clipboard fallback copies the selected provider URL', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
  await page.goto('/settings');
  await publicProvider(page, 'inferera').click();
  await page.getByRole('button', { name: '复制链接', exact: true }).click();
  await expect(page.getByText('链接已复制到剪贴板', { exact: true })).toBeVisible();
  const reader = await page.context().newPage();
  await reader.goto('/');
  expect(await reader.evaluate(() => navigator.clipboard.readText())).toBe(providers[0].url);
  await reader.close();
  await expect(page.locator('textarea')).toHaveCount(0);
});
