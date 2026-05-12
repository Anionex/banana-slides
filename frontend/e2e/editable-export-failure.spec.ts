import { expect, test } from '@playwright/test';

test.describe('Editable export failure UI', () => {
  test('shows normalized task panel error when style extraction fails', async ({ page }) => {
    const projectId = 'mock-editable-export-failure';
    let pollCount = 0;

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));
    page.on('pageerror', error => console.log('pageerror:', error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        console.log('console-error:', message.text());
      }
    });

    await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
      const url = new URL(route.request().url());

      if (url.pathname === '/api/access-code/check') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { enabled: false } }),
        });
      }

      if (url.pathname === `/api/projects/${projectId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: projectId,
              id: projectId,
              status: 'COMPLETED',
              template_style: 'default',
              export_allow_partial: false,
              pages: [
                {
                  id: 'p1',
                  page_id: 'p1',
                  order_index: 0,
                  generated_image_path: '/files/mock/slide-1.png',
                  outline_content: { title: 'Slide 1', points: [] },
                  description_content: { text: 'desc' },
                  status: 'COMPLETED',
                },
              ],
            },
          }),
        });
      }

      if (url.pathname === `/api/projects/${projectId}/export/editable-pptx`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { task_id: 'editable-export-task-1' },
          }),
        });
      }

      if (url.pathname === `/api/projects/${projectId}/tasks/editable-export-task-1`) {
        pollCount += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              task_id: 'editable-export-task-1',
              task_type: 'EXPORT_EDITABLE_PPTX',
              status: 'FAILED',
              error_message: '文本样式提取失败: 当前图片样式提取模型不支持图片输入: caption_provider 不支持图片输入',
              progress: {
                total: 100,
                completed: 0,
                failed: 1,
                percent: 0,
                help_text: '当前用于图片样式提取的 caption/image_caption 模型不支持图片输入。',
              },
            },
          }),
        });
      }

      if (url.pathname === '/api/settings') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
      }

      if (url.pathname === `/api/projects/${projectId}/exports`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { files: [] } }),
        });
      }

      if (url.pathname === '/api/output-language') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { language: 'zh' } }),
        });
      }

      if (url.pathname === '/api/user-templates') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { templates: [] } }),
        });
      }

      if (url.pathname.includes('/image-versions')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { versions: [] } }),
        });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });

    await page.route('**/files/**', async route => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(256) });
    });

    await page.goto(`/project/${projectId}/preview`);
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 });

    await page.locator('button:has-text("导出")').first().click();
    await page.getByRole('button', { name: /导出可编辑 PPTX/ }).click();
    await page.getByRole('button', { name: '开始导出' }).click();

    await expect
      .poll(() => pollCount, { timeout: 10000 })
      .toBeGreaterThan(0);

    await page.getByRole('button', { name: /^1$/ }).click();
    await expect(page.getByText('当前图片样式提取模型不支持图片输入')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /^1$/ })).toBeVisible({ timeout: 10000 });
  });

  test('shows codex relogin toast for oauth 401 failures and keeps it visible for 5s', async ({ page }) => {
    const projectId = 'mock-codex-oauth-401-sync';

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));

    await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
      const url = new URL(route.request().url());

      if (url.pathname === '/api/access-code/check') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { enabled: false } }),
        });
      }

      if (url.pathname === `/api/projects/${projectId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: projectId,
              id: projectId,
              status: 'COMPLETED',
              template_style: 'default',
              export_allow_partial: false,
              pages: [
                {
                  id: 'p1',
                  page_id: 'p1',
                  order_index: 0,
                  generated_image_path: '/files/mock/slide-1.png',
                  outline_content: { title: 'Slide 1', points: [] },
                  description_content: { text: 'desc' },
                  status: 'COMPLETED',
                },
              ],
            },
          }),
        });
      }

      if (url.pathname === `/api/projects/${projectId}/export/editable-pptx`) {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { message: '401 OpenAI OAuth is not connected for codex export' },
          }),
        });
      }

      if (url.pathname === '/api/settings') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
      }

      if (url.pathname === `/api/projects/${projectId}/exports`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { files: [] } }),
        });
      }

      if (url.pathname === '/api/output-language') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { language: 'zh' } }),
        });
      }

      if (url.pathname === '/api/user-templates') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { templates: [] } }),
        });
      }

      if (url.pathname.includes('/image-versions')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { versions: [] } }),
        });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });

    await page.route('**/files/**', async route => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(256) });
    });

    await page.goto(`/project/${projectId}/preview`);
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 });

    await page.locator('button:has-text("导出")').first().click();
    await page.getByRole('button', { name: /导出可编辑 PPTX/ }).click();
    await page.getByRole('button', { name: '开始导出' }).click();

    const reloginToast = page.getByText('Codex 登录已过期或未连接，请前往设置重新登录 OpenAI 账号后再试。');
    await expect(reloginToast).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(3500);
    await expect(reloginToast).toBeVisible();

    await page.waitForTimeout(2200);
    await expect(reloginToast).toHaveCount(0);
  });
});
