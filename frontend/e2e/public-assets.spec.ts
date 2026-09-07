import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

test('real public assets: independent visitors can manage only their own uploads and templates', async ({ browser, request, baseURL }) => {
  test.skip(!(await (await request.get('/api/public-config')).json()).data.enabled, 'Requires public-demo mode');
  const a = randomUUID();
  const b = randomUUID();
  const owner = { 'X-User-Token': a };
  const other = { 'X-User-Token': b };
  const png = readFileSync('../assets/test_img.png');
  const name = 'private-asset-' + randomUUID().slice(0, 8) + '.png';
  const contextA = await browser.newContext({ baseURL });
  const contextB = await browser.newContext({ baseURL });
  for (const [context, token] of [[contextA, a], [contextB, b]] as const) {
    await context.addInitScript(value => {
      localStorage.setItem('banana-slides-user-token', value);
      localStorage.setItem('hasSeenHelpModal', 'true');
    }, token);
  }
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  let historyRequests = 0;
  for (const page of [pageA, pageB]) page.on('request', r => { if (new URL(r.url()).pathname === '/api/projects' && r.method() === 'GET') historyRequests++; });
  const template = (await (await request.post('/api/user-templates', {
    headers: owner, multipart: { name, template_image: { name, mimeType: 'image/png', buffer: png } },
  })).json()).data;
  const style = (await (await request.post('/api/user-style-templates', {
    headers: owner, data: { name, description: 'Only visible to the creator' },
  })).json()).data;
  const reference = (await (await request.post('/api/reference-files/upload', {
    headers: owner, multipart: { file: { name: name + '.md', mimeType: 'text/markdown', buffer: Buffer.from('# Private reference') } },
  })).json()).data.file;
  let materialId = '';
  try {
    expect((await request.post(`/api/reference-files/${reference.id}/parse`, { headers: owner })).ok()).toBeTruthy();
    await expect.poll(async () => (await (await request.get(`/api/reference-files/${reference.id}`, { headers: owner })).json()).data.file.parse_status).toBe('completed');
    await pageA.goto('/');
    await expect(pageA.getByAltText(name, { exact: true })).toBeVisible();
    await pageA.getByRole('button', { name: '素材中心', exact: true }).first().click();
    const modalA = pageA.getByRole('dialog');
    await modalA.locator('input[type=file]').setInputFiles({ name, mimeType: 'image/png', buffer: png });
    await expect(modalA.getByAltText(name, { exact: true })).toBeVisible({ timeout: 30000 });
    const material = (await (await request.get('/api/materials?project_id=all', { headers: owner })).json()).data.materials[0];
    materialId = material.id;
    await pageB.goto('/');
    await expect(pageB.getByAltText(name, { exact: true })).toHaveCount(0);
    await pageB.getByRole('button', { name: '素材中心', exact: true }).first().click();
    await expect(pageB.getByRole('dialog').getByText('暂无素材', { exact: true }).last()).toBeVisible();
    expect((await (await request.get('/api/materials?project_id=all', { headers: other })).json()).data.materials).toEqual([]);
    expect((await (await request.get('/api/user-templates', { headers: other })).json()).data.templates).toEqual([]);
    expect((await (await request.get('/api/user-style-templates', { headers: other })).json()).data.templates).toEqual([]);
    expect((await (await request.get('/api/reference-files/project/all', { headers: other })).json()).data.files).toEqual([]);
    expect((await request.get(`/api/reference-files/${reference.id}`, { headers: other })).status()).toBe(404);
    expect((await request.post(`/api/reference-files/${reference.id}/parse`, { headers: other })).status()).toBe(404);
    for (const url of [`/api/materials/${materialId}`, `/api/user-templates/${template.template_id}`, `/api/user-style-templates/${style.id}`, `/api/reference-files/${reference.id}`]) {
      expect((await request.delete(url, { headers: other })).status()).toBe(404);
    }
    expect((await request.post('/api/materials/download', { headers: other, data: { material_ids: [materialId] } })).status()).toBe(404);
    const download = await request.post('/api/materials/download', { headers: owner, data: { material_ids: [materialId] } });
    expect(download.ok()).toBeTruthy();
    expect((await download.body()).subarray(0, 2).toString()).toBe('PK');
    await modalA.getByAltText(name, { exact: true }).hover();
    await modalA.getByRole('button', { name: '删除', exact: true }).click();
    await expect(modalA.getByText('暂无素材', { exact: true }).last()).toBeVisible();
    await pageA.goto('/');
    await pageA.getByTitle('选择参考文件', { exact: true }).click();
    await expect(pageA.getByRole('dialog').getByText(name + '.md', { exact: true })).toBeVisible();
    await pageB.goto('/');
    await pageB.getByTitle('选择参考文件', { exact: true }).click();
    await expect(pageB.getByRole('dialog').getByText('暂无参考文件', { exact: true })).toBeVisible();
    expect(historyRequests).toBe(0);
  } finally {
    for (const url of [`/api/materials/${materialId}`, `/api/user-templates/${template.template_id}`, `/api/user-style-templates/${style.id}`, `/api/reference-files/${reference.id}`]) {
      await request.delete(url, { headers: owner });
    }
    await contextA.close();
    await contextB.close();
  }
});
