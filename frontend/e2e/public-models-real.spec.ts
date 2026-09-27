import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.use({ trace: 'off', video: 'off' });
test('public Inferera models: real browser text, caption and image tests', async ({ page }, testInfo) => {
  const key = process.env.OUTLINE_REAL_API_KEY;
  test.skip(!key, 'Opt in with a real Inferera key');
  test.setTimeout(720000);
  const token = randomUUID();
  const headers = { 'X-User-Token': token };
  await page.addInitScript(token => {
    localStorage.setItem('banana-slides-user-token', token);
    localStorage.setItem('i18nextLng', 'zh');
    localStorage.setItem('hasSeenHelpModal', 'true');
  }, token);
  try {
    const setup = await page.request.put('/api/settings', { headers, data: {
      partner: 'inferera', api_key: key, enable_text_reasoning: false,
    } });
    expect(setup.ok()).toBe(true);
    const settings = (await setup.json()).data;
    expect(settings.text_model).toBe('gemini-3.8-flash');
    expect(settings.image_caption_model).toBe('gemini-3.8-flash');
    expect(settings.image_model).toBe('gpt-image-2');
    await page.goto('/settings');
    const trials = [];
    for (const [service, label] of [['text-model', '文本模型'], ['caption-model', '图片识别'], ['image-model', '图像生成']]) {
      const responsePromise = page.waitForResponse(r => r.url().endsWith(`/api/settings/tests/${service}`) && r.request().method() === 'POST');
      const started = Date.now();
      await page.getByRole('button', { name: `测试${label}`, exact: true }).click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);
      const taskId = (await response.json()).data.task_id;
      trials.push({ service, taskId, started });
    }
    const evidence = await Promise.all(trials.map(async trial => {
      let result: any;
      await expect.poll(async () => {
        const response = await page.request.get(`/api/settings/tests/${trial.taskId}/status`, { headers });
        expect(response.ok()).toBe(true);
        result = (await response.json()).data;
        return ['COMPLETED', 'FAILED'].includes(result.status);
      }, { timeout: 620000, intervals: [1500, 3000] }).toBe(true);
      console.log(JSON.stringify({ service: trial.service, seconds: (Date.now() - trial.started) / 1000, result }));
      expect(result.status, JSON.stringify(result)).toBe('COMPLETED');
      await expect(page.getByTestId(`service-test-${trial.service}`).getByRole('status')).toContainText('成功');
      return { service: trial.service, result, clickedInBrowser: true };
    }));
    await page.screenshot({ path: testInfo.outputPath('models-passed.png'), fullPage: true });
    await testInfo.attach('models.json', { body: JSON.stringify(evidence), contentType: 'application/json' });
  } finally {
    const reset = await page.request.post('/api/settings/reset', { headers, data: {} });
    expect(reset.ok()).toBe(true);
    expect((await (await page.request.get('/api/settings', { headers })).json()).data.api_key_length).toBe(0);
  }
});

test('public model migration: outline and slide generation persist after reload', async ({ page }, testInfo) => {
  const key = process.env.OUTLINE_REAL_API_KEY;
  test.skip(!key, 'Requires an explicitly supplied real provider key');
  test.setTimeout(720000);
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
    expect(settings.text_model).toBe('gemini-3.8-flash');
    expect(settings.image_model).toBe('gpt-image-2');
    const created = await page.request.post('/api/projects', { headers, data: {
      creation_type: 'idea', idea_prompt: '1 page', template_style: '白底简洁演示文稿，黑色文字，少量黄色点缀。',
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
    const pageId = saved.pages[0].page_id;
    const description = await page.request.put(`/api/projects/${id}/pages/${pageId}/description`, { headers, data: {
      description_content: { text: `标题：${title}。白底演示文稿，标题醒目，三个简洁要点配黄色几何图形。` },
    } });
    expect(description.ok()).toBe(true);
    await page.goto(`/project/${id}/preview`);
    await page.getByRole('button', { name: '我知道了', exact: true }).click();
    const imageStart = Date.now();
    const [imageResponse] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/api/projects/${id}/pages/${pageId}/generate/image`) && r.request().method() === 'POST'),
      page.getByRole('button', { name: '生成此页', exact: true }).click(),
    ]);
    expect(imageResponse.status()).toBe(202);
    const imageTask = (await imageResponse.json()).data.task_id;
    let task: any;
    await expect.poll(async () => {
      const status = await page.request.get(`/api/projects/${id}/tasks/${imageTask}`, { headers });
      const body = await status.json();
      expect(status.ok(), JSON.stringify(body)).toBe(true);
      task = body.data;
      return ['COMPLETED', 'FAILED'].includes(task.status);
    }, { timeout: 600000, intervals: [2000, 4000] }).toBe(true);
    expect(task.status, JSON.stringify(task)).toBe('COMPLETED');
    const finalProject = (await (await page.request.get(`/api/projects/${id}`, { headers })).json()).data;
    const imageUrl = finalProject.pages.find((p: any) => p.page_id === pageId).generated_image_url;
    expect(imageUrl).toBeTruthy();
    expect((await page.request.get(imageUrl, { headers })).ok()).toBe(true);
    await page.reload();
    const slide = page.getByRole('main').getByRole('img', { name: 'Slide 1', exact: true });
    await expect(slide).toBeVisible();
    await expect.poll(() => slide.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth >= 1024), { timeout: 20000 }).toBe(true);
    console.log(JSON.stringify({ slideGeneratedInBrowser: true, projectId: id, pageId, imageUrl, imageSeconds: (Date.now() - imageStart) / 1000 }));
    await page.screenshot({ path: testInfo.outputPath('persisted.png') });
    const evidence = { clickedInBrowser: true, model: settings.text_model, seconds, pages: saved.pages.length, persistedAfterReload: true };
    console.log(JSON.stringify(evidence));
    await testInfo.attach('real-generation.json', { body: JSON.stringify(evidence), contentType: 'application/json' });
  } finally {
    if (id) {
      const deleted = await page.request.delete(`/api/projects/${id}`, { headers });
      if (!deleted.ok()) {
        expect(deleted.status()).toBe(403);
        expect((await deleted.json()).error.code).toBe('PUBLIC_DELETE_DISABLED');
        console.log(JSON.stringify({ testProjectRetained: id, reason: 'public-delete-disabled' }));
      }
    }
    if (configured) {
      const reset = await page.request.post('/api/settings/reset', { headers, data: {} });
      expect(reset.ok()).toBe(true);
      const clean = (await (await page.request.get('/api/settings', { headers })).json()).data;
      expect(clean.api_key_length).toBe(0);
    }
  }
});
