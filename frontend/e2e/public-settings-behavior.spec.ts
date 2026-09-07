import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const serviceNames = ['text-model', 'caption-model', 'image-model', 'mineru-pdf', 'baidu-ocr', 'baidu-inpaint'];

test('all public settings round-trip, provider drafts stay separate, reset clears all personal keys', async ({ page, request }) => {
  const visitor = randomUUID();
  const headers = { 'X-User-Token': visitor };
  await page.addInitScript(token => localStorage.setItem('banana-slides-user-token', token), visitor);
  await page.goto('/settings');
  await expect(page.getByText(/合作方|合作关系/)).toHaveCount(0);
  await page.getByRole('combobox', { name: 'API 提供商', exact: true }).selectOption('apimart');
  await page.getByLabel('API Key', { exact: true }).fill('apimart-draft-placeholder');
  await page.getByRole('combobox', { name: 'API 提供商', exact: true }).selectOption('volcengine');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
  await page.getByLabel('API Key', { exact: true }).fill('volcengine-draft-placeholder');
  await page.getByRole('combobox', { name: 'API 提供商', exact: true }).selectOption('apimart');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('apimart-draft-placeholder');
  const values: Record<string, string | number | boolean> = {
    image_resolution: '4K', image_aspect_ratio: '9:16', output_language: 'en', description_generation_mode: 'parallel',
    max_description_workers: 3, max_image_workers: 2, enable_text_reasoning: true, enable_image_reasoning: true,
    enable_image_quality_control: true, text_thinking_budget: 2048, image_thinking_budget: 4096,
    elevenlabs_enabled: true, elevenlabs_voice_id: 'voice-test',
  };
  for (const [label, value] of [['图像清晰度', '4K'], ['默认图像比例', '9:16'], ['输出语言', 'en'], ['描述生成模式', 'parallel']]) {
    await page.getByRole('combobox', { name: label, exact: true }).selectOption(value);
  }
  for (const label of ['文本推理模式', '图像推理模式', '图像质量检查', '启用 ElevenLabs 视频配音']) await page.getByLabel(label, { exact: true }).check();
  for (const [label, value] of [['描述生成最大并发数', '3'], ['图像生成最大并发数', '2'], ['文本推理预算', '2048'], ['图像推理预算', '4096'], ['ElevenLabs Voice ID', 'voice-test']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  for (const label of ['MinerU Token', '百度 OCR API Key', 'ElevenLabs API Key']) await page.getByLabel(label, { exact: true }).fill('auxiliary-placeholder');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByText('设置保存成功')).toBeVisible();
  await page.reload();
  const saved = (await (await request.get('/api/settings', { headers })).json()).data;
  expect(saved).toMatchObject(values);
  for (const [label, value] of [['图像清晰度', '4K'], ['默认图像比例', '9:16'], ['输出语言', 'en'], ['描述生成模式', 'parallel']]) {
    await expect(page.getByRole('combobox', { name: label, exact: true })).toHaveValue(value);
  }
  for (const label of ['文本推理模式', '图像推理模式', '图像质量检查', '启用 ElevenLabs 视频配音']) await expect(page.getByLabel(label, { exact: true })).toBeChecked();
  for (const [label, value] of [['描述生成最大并发数', '3'], ['图像生成最大并发数', '2'], ['文本推理预算', '2048'], ['图像推理预算', '4096'], ['ElevenLabs Voice ID', 'voice-test']]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }
  for (const field of ['mineru_token_length', 'baidu_api_key_length', 'elevenlabs_api_key_length']) expect(saved[field]).toBe(21);
  await expect(page.getByRole('combobox', { name: '默认图像比例', exact: true })).toHaveValue('9:16');
  await expect(page.getByLabel('图像推理预算', { exact: true })).toHaveValue('4096');
  await page.getByRole('combobox', { name: 'API 提供商', exact: true }).selectOption('inferera');
  await page.getByRole('combobox', { name: 'API 提供商', exact: true }).selectOption('apimart');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveAttribute('placeholder', '已保存，留空保持不变');
  await page.getByRole('button', { name: '重置设置', exact: true }).click();
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.getByText('个人设置已重置')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('文本推理模式', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('文本推理预算', { exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: '默认图像比例', exact: true })).toHaveValue('16:9');
  const reset = (await (await request.get('/api/settings', { headers })).json()).data;
  expect(reset.provider_key_lengths).toEqual({ inferera: 0, apimart: 0, volcengine: 0 });
  expect(reset.mineru_token_length + reset.baidu_api_key_length + reset.elevenlabs_api_key_length).toBe(0);
});

test('service tests run independently, preserve results, retry separately and use saved configuration', async ({ page }) => {
  const states: Record<string, string> = {};
  const starts: Record<string, number> = {};
  const results: Record<string, object> = {
    'text-model': { reply: 'text-model 的独立结果' }, 'caption-model': { caption: 'caption-model 的独立结果' },
    'image-model': { image_size: [200, 100] }, 'mineru-pdf': { content_preview: 'mineru-pdf 的独立结果' },
    'baidu-ocr': { recognized_text: 'baidu-ocr 的独立结果' }, 'baidu-inpaint': { image_size: [300, 150] },
  };
  await page.route(url => url.pathname.startsWith('/api/settings/tests/'), async route => {
    const path = new URL(route.request().url()).pathname;
    const name = path.split('/')[4];
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({});
      starts[name] = (starts[name] || 0) + 1;
      states[name] = 'PROCESSING';
      await route.fulfill({ json: { success: true, data: { task_id: name } } });
    } else {
      await route.fulfill({ json: { success: true, data: { status: states[name], message: `${name} 完成`, error: `${name} 失败`, result: results[name] } } });
    }
  });
  await page.goto('/settings');
  for (const name of serviceNames) {
    const row = page.getByTestId(`service-test-${name}`);
    await expect(row.getByRole('button')).toBeEnabled();
    await row.getByRole('button').click();
    await expect(row.getByRole('button')).toBeDisabled();
  }
  expect(Object.keys(starts)).toHaveLength(6);
  states['text-model'] = 'COMPLETED';
  states['caption-model'] = 'FAILED';
  await expect(page.getByTestId('service-test-text-model')).toContainText('text-model 的独立结果');
  await expect(page.getByTestId('service-test-caption-model')).toContainText('caption-model 失败');
  await expect(page.getByTestId('service-test-image-model').getByRole('button')).toBeDisabled();
  await page.getByTestId('service-test-caption-model').getByRole('button').click();
  await expect.poll(() => starts['caption-model']).toBe(2);
  expect(starts['image-model']).toBe(1);
  await page.getByRole('combobox', { name: '图像清晰度', exact: true }).selectOption('4K');
  await expect(page.getByText('设置有未保存的修改，请先保存后再开始新测试。已运行的测试继续使用启动时的配置。')).toBeVisible();
  await expect(page.getByTestId('service-test-text-model').getByRole('button')).toBeDisabled();
  await expect(page.getByRole('button', { name: '保存设置', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByTestId('service-test-text-model').getByRole('button')).toBeEnabled();
  for (const name of serviceNames) states[name] = 'COMPLETED';
  for (const name of serviceNames) {
    const detail = name === 'image-model' ? '200 × 100' : name === 'baidu-inpaint' ? '300 × 150' : `${name} 的独立结果`;
    await expect(page.getByTestId(`service-test-${name}`)).toContainText(detail);
    await expect(page.getByTestId(`service-test-${name}`).getByRole('button')).toBeEnabled();
  }
});

test('slow image test times out independently after ten minutes', async ({ page }) => {
  await page.clock.install();
  await page.route(url => url.pathname.startsWith('/api/settings/tests/'), route => route.fulfill({ json: { success: true, data: route.request().method() === 'POST' ? { task_id: 'slow-image' } : { status: 'PROCESSING' } } }));
  await page.goto('/settings');
  await page.getByTestId('service-test-image-model').getByRole('button').click();
  await page.clock.fastForward(180001);
  await expect(page.getByTestId('service-test-image-model').getByRole('button')).toBeDisabled();
  await expect(page.getByTestId('service-test-text-model').getByRole('button')).toBeEnabled();
  await page.clock.fastForward(420000);
  await expect(page.getByTestId('service-test-image-model')).toContainText('等待结果超时');
  await expect(page.getByTestId('service-test-image-model').getByRole('button')).toBeEnabled();
});

test('leaving settings stops polling active tests', async ({ page }) => {
  let polls = 0;
  await page.clock.install();
  await page.route(url => url.pathname.startsWith('/api/settings/tests/'), route => {
    const start = route.request().method() === 'POST';
    if (!start) polls++;
    return route.fulfill({ json: { success: true, data: start ? { task_id: 'pending' } : { status: 'PROCESSING' } } });
  });
  await page.goto('/settings');
  await page.getByTestId('service-test-image-model').getByRole('button').click();
  await expect.poll(() => polls).toBeGreaterThan(0);
  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(page).toHaveURL('/');
  const afterLeaving = polls;
  await page.clock.fastForward(10000);
  expect(polls).toBe(afterLeaving);
});
