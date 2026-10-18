import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.use({ trace: 'off', video: 'off' });

for (const embedded of [false, true]) for (const legacy of [false, true]) {
  test(`removed sponsor stays absent: ${embedded ? 'project modal' : 'settings page'}, ${legacy ? 'saved configuration' : 'new visitor'}`, async ({ page, request }) => {
    const token = randomUUID();
    const headers = { 'X-User-Token': token };
    const projectId = randomUUID();
    let saved: Record<string, unknown> | undefined;
    await page.addInitScript(value => {
      localStorage.setItem('banana-slides-user-token', value);
      localStorage.setItem('hasSeenHelpModal', 'true');
    }, token);
    await page.route(url => url.pathname === '/api/settings', async route => {
      const response = await request.get('/api/settings', { headers });
      const body = await response.json();
      if (legacy) body.data = { ...body.data, partner: 'apimart', api_key_length: 12, provider_key_lengths: { inferera: 0, apimart: 12, volcengine: 0 } };
      if (route.request().method() === 'PUT') saved = route.request().postDataJSON();
      await route.fulfill({ json: body });
    });
    {
      if (embedded) {
        await page.route(url => url.pathname === `/api/projects/${projectId}`, route => route.fulfill({ json: {
          success: true, data: {
            project_id: projectId, idea_prompt: 'Settings regression', status: 'DRAFT',
            template_style: 'Plain', created_at: '2026-10-18T00:00:00', updated_at: '2026-10-18T00:00:00',
            pages: [{ page_id: 'fixture-page', order_index: 0, outline_content: { title: 'Settings regression' }, status: 'DRAFT' }],
          },
        } }));
        await page.goto(`/project/${projectId}/preview`);
        const reminder = page.getByRole('button', { name: '我知道了', exact: true });
        await reminder.click();
        await page.getByRole('button', { name: '项目设置', exact: true }).click();
        await page.getByRole('button', { name: '个人设置', exact: true }).click();
      } else await page.goto('/settings');
      const choices = page.getByRole('radiogroup', { name: 'API 提供商', exact: true });
      await expect(choices).toBeVisible();
      await expect(choices.getByRole('radio')).toHaveCount(2);
      await expect(page.locator('body')).not.toContainText(/apimart/i);
      await expect(page.locator('a[href*="apimart"], [data-provider="apimart"]')).toHaveCount(0);
      if (legacy) {
        await expect(page.getByText('当前使用此前保存的兼容接口配置。选择提供商并保存后才会切换。')).toBeVisible();
        await expect(choices.locator('[aria-checked="true"]')).toHaveCount(0);
        await page.getByRole('combobox', { name: '图像清晰度', exact: true }).selectOption('4K');
        await page.getByRole('button', { name: '保存设置', exact: true }).click();
        await expect.poll(() => saved?.partner).toBe('apimart');
        expect(saved?.api_key).toBe('');
      }
    }
  });
}
