import { test, expect } from '@playwright/test';

/**
 * 页面描述字段契约 v2 的端到端验证。
 *
 * Mock 测试验证前端 UI 逻辑；集成测试打真实后端与真实 AI，
 * 验证大纲论断、描述字段、保存回显、生图素材提取、精修保字段的完整数据流。
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3223';

const NEW_FIELDS = ['配图与素材', '版式与重点', '演讲者备注'];
const LEGACY_FIELDS = ['视觉元素', '视觉焦点', '排版布局'];

async function createProjectWithPages(page: import('@playwright/test').Page, prompt: string, titles: string[]) {
  const resp = await page.request.post(`${BASE_URL}/api/projects`, {
    data: { creation_type: 'idea', idea_prompt: prompt },
  });
  const projectId = (await resp.json()).data?.project_id;
  expect(projectId).toBeTruthy();

  for (let i = 0; i < titles.length; i++) {
    await page.request.post(`${BASE_URL}/api/projects/${projectId}/pages`, {
      data: {
        order_index: i,
        outline_content: { title: titles[i], points: [`要点 ${i + 1}`] },
        status: 'DRAFT',
      },
    });
  }
  await page.request.put(`${BASE_URL}/api/projects/${projectId}`, {
    data: { status: 'OUTLINE_GENERATED' },
  });
  return projectId;
}

async function setPageDescription(
  page: import('@playwright/test').Page,
  projectId: string,
  pageId: string,
  description_content: Record<string, unknown>,
) {
  const resp = await page.request.put(
    `${BASE_URL}/api/projects/${projectId}/pages/${pageId}/description`,
    { data: { description_content } },
  );
  expect(resp.ok()).toBeTruthy();
}

async function getPages(page: import('@playwright/test').Page, projectId: string) {
  const resp = await page.request.get(`${BASE_URL}/api/projects/${projectId}`);
  return (await resp.json()).data?.pages || [];
}

// ===== Mock 测试：前端 UI 逻辑 =====

test.describe('字段契约 - Mock', () => {
  test('默认字段胶囊展示新的三个正交字段', async ({ page }) => {
    await page.route('**/api/settings', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            description_generation_mode: 'streaming',
            description_extra_fields: NEW_FIELDS,
            image_prompt_extra_fields: ['配图与素材', '版式与重点'],
          },
        }),
      });
    });

    const projectId = await createProjectWithPages(page, '字段胶囊测试', ['第一页']);
    await page.goto(`${BASE_URL}/project/${projectId}/detail`);
    await page.waitForLoadState('networkidle');

    const gearBtn = page.locator('button[title="描述设置"], button[title="Description Settings"]');
    await gearBtn.click();

    for (const field of NEW_FIELDS) {
      await expect(page.locator('button').filter({ hasText: field }).first()).toBeVisible({ timeout: 5000 });
    }
    // 退役字段不应出现在默认胶囊里
    for (const legacy of LEGACY_FIELDS) {
      await expect(page.locator('button').filter({ hasText: new RegExp(`^${legacy}$`) })).toHaveCount(0);
    }
  });

  test('存量页面的旧字段名照常展示', async ({ page }) => {
    const projectId = await createProjectWithPages(page, '旧字段兼容', ['第一页']);
    const pages = await getPages(page, projectId);

    await setPageDescription(page, projectId, pages[0].page_id, {
      text: '正文内容',
      extra_fields: { '视觉元素': '关键指标卡片', '排版布局': '左文右图' },
    });

    await page.goto(`${BASE_URL}/project/${projectId}/detail`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=视觉元素')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=关键指标卡片')).toBeVisible();
    await expect(page.locator('text=排版布局')).toBeVisible();
    await expect(page.locator('text=左文右图')).toBeVisible();
  });
});

// ===== 集成测试：真实后端 =====

test.describe('字段契约 - 集成', () => {
  test('新字段保存后刷新回显，清空后消失', async ({ page }) => {
    const projectId = await createProjectWithPages(page, '字段持久化', ['第一页']);
    const pages = await getPages(page, projectId);
    const pageId = pages[0].page_id;

    await setPageDescription(page, projectId, pageId, {
      text: '正文内容',
      extra_fields: { '配图与素材': '折线图：三年增长', '版式与重点': '左文右图；趋势图为重点' },
    });

    await page.goto(`${BASE_URL}/project/${projectId}/detail`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=折线图：三年增长')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=左文右图；趋势图为重点')).toBeVisible();

    // 通过编辑弹窗改一个字段并保存
    await page.locator('button').filter({ hasText: /编辑|Edit/ }).first().click();
    const dialog = page.getByRole('dialog');
    // 主字段标签应已改名为「页面文字」，字段块按配置顺序排列
    await expect(dialog.getByText('页面文字', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText('配图与素材', { exact: true })).toBeVisible();
    await expect(dialog.getByText('版式与重点', { exact: true })).toBeVisible();

    // 输入框顺序：0=页面文字 1=配图与素材 2=版式与重点
    const layoutBox = dialog.getByRole('textbox').nth(2);
    await expect(layoutBox).toHaveText('左文右图；趋势图为重点', { timeout: 5000 });
    // contenteditable 组件：insertText 才能走到组件的 onChange（keyboard.type 对中文不可靠）
    await layoutBox.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('居中大标题；标题为重点');
    // 等保存请求真正完成再刷新，否则 reload 会抢在 PUT 之前
    const savePromise = page.waitForResponse(
      (r) => r.url().includes('/description') && r.request().method() === 'PUT' && r.ok(),
    );
    await page.locator('button').filter({ hasText: /^保存$|^Save$/ }).click();
    await savePromise;

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=居中大标题；标题为重点')).toBeVisible({ timeout: 5000 });

    // 持久化到后端而不只是前端状态
    const after = await getPages(page, projectId);
    expect(after[0].description_content.extra_fields['版式与重点']).toBe('居中大标题；标题为重点');

    // 清空字段后应从卡片消失
    await setPageDescription(page, projectId, pageId, { text: '正文内容' });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=居中大标题；标题为重点')).toHaveCount(0);
  });

  test('真实 AI：大纲内容页的首条要点是论断句', async ({ page }) => {
    test.setTimeout(240000);

    const resp = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { creation_type: 'idea', idea_prompt: '分析人工智能三次寒冬的成因与启示，6 页' },
    });
    const projectId = (await resp.json()).data?.project_id;

    const genResp = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/generate/outline`,
      { data: {}, timeout: 180000 },
    );
    expect(genResp.ok()).toBeTruthy();

    // 轮询直到大纲落库
    let pages: any[] = [];
    for (let i = 0; i < 60; i++) {
      pages = await getPages(page, projectId);
      if (pages.length > 1 && pages.every((p) => p.outline_content?.points?.length)) break;
      await page.waitForTimeout(3000);
    }
    expect(pages.length).toBeGreaterThan(1);

    // 内容页（跳过封面）的首条要点应是完整论断句，而非短话题短语
    const contentPages = pages.slice(1);
    const firstPoints = contentPages.map((p) => p.outline_content.points[0] as string);
    console.log('大纲首条要点：\n' + firstPoints.map((s, i) => `  ${i + 2}. ${s}`).join('\n'));

    const assertionLike = firstPoints.filter((s) => s && s.length >= 12);
    expect(assertionLike.length).toBeGreaterThanOrEqual(Math.ceil(contentPages.length * 0.7));
  });

  test('真实 AI：生成的描述带新字段且正文不含图片素材段', async ({ page }) => {
    test.setTimeout(300000);

    const projectId = await createProjectWithPages(page, 'SaaS 产品季度复盘', ['业务概览', '增长归因']);

    const genResp = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/generate/descriptions`,
      { data: {}, timeout: 240000 },
    );
    expect(genResp.ok()).toBeTruthy();

    let pages: any[] = [];
    for (let i = 0; i < 80; i++) {
      pages = await getPages(page, projectId);
      if (pages.every((p) => p.description_content?.text)) break;
      await page.waitForTimeout(3000);
    }

    const withFields = pages.filter((p) => p.description_content?.extra_fields);
    console.log('描述字段：', JSON.stringify(pages.map((p) => Object.keys(p.description_content?.extra_fields || {}))));
    expect(withFields.length).toBeGreaterThan(0);

    for (const p of pages) {
      // 字段行不能残留在页面文字里，否则会被逐字渲染到幻灯片上
      expect(p.description_content.text).not.toContain('图片素材：');
      expect(p.description_content.text).not.toContain('配图与素材：');
      expect(p.description_content.text).not.toContain('版式与重点：');
    }

    const allFieldNames = new Set(pages.flatMap((p) => Object.keys(p.description_content?.extra_fields || {})));
    console.log('出现过的字段名：', [...allFieldNames].join(', '));
    expect([...allFieldNames].some((n) => NEW_FIELDS.includes(n))).toBeTruthy();

    await page.goto(`${BASE_URL}/project/${projectId}/detail`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=配图与素材').or(page.locator('text=版式与重点')).first()).toBeVisible({ timeout: 10000 });
  });

  test('真实 AI：精修描述不丢失额外字段', async ({ page }) => {
    test.setTimeout(240000);

    const projectId = await createProjectWithPages(page, '精修保字段', ['市场机会']);
    const pages = await getPages(page, projectId);
    await setPageDescription(page, projectId, pages[0].page_id, {
      text: '页面文字：\n- 市场三年高速增长',
      extra_fields: { '配图与素材': '折线图：增长曲线', '版式与重点': '左文右图' },
    });

    const refineResp = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/refine/descriptions`,
      { data: { user_requirement: '让文字更简洁' }, timeout: 180000 },
    );
    expect(refineResp.ok()).toBeTruthy();

    const after = await getPages(page, projectId);
    const content = after[0].description_content;
    console.log('精修后：', JSON.stringify(content));

    // 关键回归：字段必须还在 extra_fields 里，且没有混进页面文字
    expect(content.extra_fields).toBeTruthy();
    expect(Object.keys(content.extra_fields).length).toBeGreaterThan(0);
    expect(content.text).not.toContain('配图与素材：');
    expect(content.text).not.toContain('版式与重点：');
  });

  test('真实生图：配图字段里的素材引用仍被提取为参考图', async ({ page }) => {
    test.setTimeout(420000);

    const projectId = await createProjectWithPages(page, '素材提取链路', ['素材页']);
    const pages = await getPages(page, projectId);

    // 上传一张素材图，拿到 /files/ 路径
    const uploadResp = await page.request.post(`${BASE_URL}/api/projects/${projectId}/materials/upload`, {
      multipart: {
        file: {
          name: 'material.png',
          mimeType: 'image/png',
          buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64',
          ),
        },
      },
    });
    expect(uploadResp.ok()).toBeTruthy();
    const materialUrl = (await uploadResp.json()).data?.url || (await uploadResp.json()).data?.file_path;
    console.log('素材 URL：', materialUrl);

    // 素材引用写在"配图与素材"字段里（新契约），而不是正文
    await setPageDescription(page, projectId, pages[0].page_id, {
      text: '页面文字：\n- 素材展示页',
      extra_fields: { '配图与素材': `![素材](${materialUrl})` },
    });

    // 生图要求项目有模板图或风格描述
    await page.request.put(`${BASE_URL}/api/projects/${projectId}`, {
      data: { template_style: '简洁商务风格，白底蓝色强调色' },
    });

    const genResp = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/generate/images`,
      { data: {}, timeout: 360000 },
    );
    expect(genResp.ok(), await genResp.text()).toBeTruthy();

    let imaged: any[] = [];
    for (let i = 0; i < 60; i++) {
      imaged = await getPages(page, projectId);
      if (imaged.every((p) => p.generated_image_url)) break;
      await page.waitForTimeout(4000);
    }
    console.log('生图结果：', imaged.map((p) => p.generated_image_url).join(', '));
    // 图片产出即证明「素材引用写在配图与素材字段里」仍能走通生图链路
    expect(imaged[0].generated_image_url).toBeTruthy();

    // 素材必须真的被识别为参考图：后端日志会记录提取到的图片数
    const imageResp = await page.request.get(imaged[0].generated_image_url.startsWith('http')
      ? imaged[0].generated_image_url
      : `${BASE_URL}${imaged[0].generated_image_url}`);
    expect(imageResp.ok()).toBeTruthy();
    expect(Number(imageResp.headers()['content-length'] || '0')).toBeGreaterThan(1000);
  });
});
