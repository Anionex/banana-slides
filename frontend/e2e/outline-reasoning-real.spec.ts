import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Opt in against a real backend/provider. Never record a trace containing the test key.
test.use({ trace: 'off', video: 'off' });
test('reasoning disabled: real browser generation persists after reload', async ({ page }, testInfo) => {
  const key = process.env.OUTLINE_REAL_API_KEY;
  test.skip(!key, 'Requires an explicitly supplied real provider key');
  test.setTimeout(240000);
  const token = randomUUID();
  const headers = { 'X-User-Token': token };
  let id: string | undefined;
  let configured = false;
  await page.addInitScript(token => {
    localStorage.setItem('banana-slides-user-token', token);
    localStorage.setItem('i18nextLng', 'zh');
    localStorage.setItem('hasSeenHelpModal', 'true');
  }, token);
  try {
    const setup = await page.request.put('/api/settings', { headers, data: {
      partner: 'inferera', api_key: key, enable_text_reasoning: false,
    } });
    configured = setup.ok();
    expect(configured).toBe(true);
    const settings = (await setup.json()).data;
    expect(settings.enable_text_reasoning).toBe(false);
    const created = await page.request.post('/api/projects', { headers, data: {
      creation_type: 'idea', idea_prompt: '1 page',
    } });
    expect(created.ok()).toBe(true);
    id = (await created.json()).data.project_id;
    expect(id).toBeTruthy();
    const seed = await page.request.post(`/api/projects/${id}/pages`, { headers, data: {
      order_index: 0, outline_content: { title: '生成验收初始页面', points: [] },
    } });
    expect(seed.ok()).toBe(true);
    await page.goto(`/project/${id}/outline`);
    await page.getByRole('button', { name: /重新生成大纲|Regenerate Outline/ }).click();
    const responsePromise = page.waitForResponse(r => r.url().endsWith(`/api/projects/${id}/generate/outline/stream`) && r.request().method() === 'POST');
    const start = Date.now();
    await page.getByRole('button', { name: '确定', exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await expect(page.getByRole('button', { name: /重新生成大纲|Regenerate Outline/ })).toBeEnabled({ timeout: 200000 });
    const savedResponse = await page.request.get(`/api/projects/${id}`, { headers });
    expect(savedResponse.ok()).toBe(true);
    const saved = (await savedResponse.json()).data;
    expect(saved.pages.length).toBeGreaterThan(0);
    const title = saved.pages[0].outline_content.title;
    expect(title).not.toBe('生成验收初始页面');
    expect(saved.pages[0].page_id).toBeTruthy();
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    const seconds = (Date.now() - start) / 1000;
    await page.reload();
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /重新生成大纲|Regenerate Outline/ })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('persisted.png') });
    const evidence = { clickedInBrowser: true, model: settings.text_model, seconds, pages: saved.pages.length, persistedAfterReload: true };
    console.log(JSON.stringify(evidence));
    await testInfo.attach('real-generation.json', { body: JSON.stringify(evidence), contentType: 'application/json' });
  } finally {
    if (id) await page.request.delete(`/api/projects/${id}`, { headers });
    if (configured) {
      const reset = await page.request.post('/api/settings/reset', { headers, data: {} });
      expect(reset.ok()).toBe(true);
      const clean = (await (await page.request.get('/api/settings', { headers })).json()).data;
      expect(clean.api_key_length).toBe(0);
    }
  }
});
