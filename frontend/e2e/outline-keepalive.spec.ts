import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'zh');
    localStorage.setItem('hasSeenHelpModal', 'true');
  });
});

for (const failure of ['504', 'eof', 'error'] as const) {
  test(`outline ${failure} exits loading and lets the user retry`, async ({ page }) => {
    const created = await page.request.post('/api/projects', {
      data: { creation_type: 'idea', idea_prompt: '连接失败验收' },
    });
    const id = (await created.json()).data.project_id;
    let received = false;
    await page.route(url => url.pathname === `/api/projects/${id}/generate/outline/stream`, async route => {
      await route.fulfill({
        status: failure === '504' ? 504 : 200,
        contentType: 'text/event-stream',
        body: failure === 'error'
          ? 'event: error\ndata: {"message":"模型等待超时，请重试。"}\n\n'
          : ': keep-alive\n\n',
      });
      received = true;
    });
    try {
      await page.goto(`/project/${id}/outline`);
      await expect.poll(() => received).toBe(true);
      await expect(page.getByText(failure === '504' ? '生成连接超时，请重试。'
        : failure === 'eof' ? '生成连接已中断，未收到完成结果，请重试。'
        : '模型等待超时，请重试。', { exact: true }).first()).toBeVisible({ timeout: 2000 });
      await expect(page.getByRole('button', { name: /生成大纲|Generate Outline/ })).toBeEnabled();
      await expect(page.getByRole('button', { name: /生成中|Generating/ })).toHaveCount(0);
    } finally {
      await page.request.delete(`/api/projects/${id}`);
    }
  });
}

test('a 70s model response survives the proxy and persists through reload', async ({ page }) => {
  test.skip(process.env.OUTLINE_SLOW_FIXTURE !== '1', 'Run against the isolated outline_slow_server.py fixture');
  test.setTimeout(110000);
  const created = await page.request.post('/api/projects', {
    data: { creation_type: 'idea', idea_prompt: '慢响应保活验收' },
  });
  const id = (await created.json()).data.project_id;
  try {
    await page.request.post(`/api/projects/${id}/pages`, {
      data: { order_index: 0, outline_content: { title: '初始页面', points: [] } },
    });
    await page.goto(`/project/${id}/outline`);
    await page.getByRole('button', { name: /重新生成|Regenerate/ }).click();
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await expect(page.getByRole('button', { name: /生成中|Generating/ })).toBeDisabled();
    await expect(page.getByText('等待超过 60 秒后正常生成')).toBeVisible({ timeout: 90000 });
    await expect(page.getByRole('button', { name: /重新生成|Regenerate/ })).toBeEnabled();
    const saved = (await (await page.request.get(`/api/projects/${id}`)).json()).data;
    expect(saved.pages).toHaveLength(1);
    expect(saved.pages[0].outline_content.title).toBe('慢响应保活验收');
    await page.reload();
    await expect(page.getByText('等待超过 60 秒后正常生成')).toBeVisible();
    await expect(page.getByRole('button', { name: /重新生成|Regenerate/ })).toBeEnabled();
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});
