import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Opt in through scripts/verify-public-demo.py --browser-tests. Never record keys.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('real APIs: text and caption run concurrently while missing OCR credentials fail independently', async ({ page, request }) => {
  test.skip(!process.env.PUBLIC_DEMO_LIVE_KEY, 'Requires an explicitly supplied provider credential');
  test.setTimeout(180000);
  const visitor = randomUUID();
  const headers = { 'X-User-Token': visitor };
  const key = process.env.PUBLIC_DEMO_LIVE_KEY!;
  await page.addInitScript(token => localStorage.setItem('banana-slides-user-token', token), visitor);
  const taskIds: string[] = [];
  page.on('response', async response => {
    if (response.request().method() === 'POST' && new URL(response.url()).pathname.startsWith('/api/settings/tests/')) {
      const body = await response.json();
      if (body.data?.task_id) taskIds.push(body.data.task_id);
    }
  });
  try {
    const saved = await request.put('/api/settings', { headers, data: { partner: process.env.PUBLIC_DEMO_LIVE_PROVIDER || 'apimart', api_key: key } });
    expect(saved.ok()).toBeTruthy();
    await page.goto('/settings');
    const text = page.getByTestId('service-test-text-model');
    const caption = page.getByTestId('service-test-caption-model');
    const ocr = page.getByTestId('service-test-baidu-ocr');
    await text.getByRole('button').click();
    await expect(text.getByRole('button')).toBeDisabled();
    await expect(caption.getByRole('button')).toBeEnabled();
    await caption.getByRole('button').click();
    await expect(ocr.getByRole('button')).toBeEnabled();
    await ocr.getByRole('button').click();
    await expect(ocr).toContainText('BAIDU_API_KEY', { timeout: 30000 });
    await expect(text).toContainText('文本模型测试成功', { timeout: 120000 });
    await expect(caption).toContainText('图片识别模型测试成功', { timeout: 120000 });
    expect(new Set(taskIds).size).toBe(3);
    for (const id of taskIds) {
      const other = await request.get(`/api/settings/tests/${id}/status`, { headers: { 'X-User-Token': randomUUID() } });
      expect(other.status()).toBe(404);
    }
    for (const row of [text, caption, ocr]) await expect(row.getByRole('button')).toBeEnabled();
  } finally {
    await request.post('/api/settings/reset', { headers });
    const cleared = (await (await request.get('/api/settings', { headers })).json()).data;
    expect(cleared.api_key_length).toBe(0);
  }
});
