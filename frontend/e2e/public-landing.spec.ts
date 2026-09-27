import { test, expect, type Page } from '@playwright/test';

test.skip(process.env.E2E_PUBLIC_LANDING !== '1', 'Requires the opt-in web build');

async function setup(page: Page) {
  // Do not send automated test visits to the production analytics service.
  await page.route('https://cloud.umami.is/**', route => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'zh');
    localStorage.setItem('banana-slides-theme', 'light');
    localStorage.setItem('hasSeenHelpModal', 'true');
  });
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
test.beforeEach(async ({ page }) => setup(page));

test('landing: navigation, bilingual copy, FAQ and workspace entry', async ({ page }) => {
  await page.setViewportSize({ width: 1260, height: 656 });
  await page.goto('/landing');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('让想法落地');
  await expect(page.locator('.landing-feature')).toHaveCount(5);
  await expect(page.locator('#product')).toContainText('PPT 翻新');
  await expect(page.locator('#product')).toContainText('可编辑 PPTX（Beta）');
  for (const area of ['.landing-nav-actions', '.landing-hero-actions']) {
    const github = page.locator(area).getByRole('link', { name: 'GitHub', exact: true });
    await expect(github).toHaveAttribute('href', 'https://github.com/Anionex/banana-slides');
    await expect(github).toHaveAttribute('rel', 'noopener noreferrer');
    const popupPromise = page.waitForEvent('popup');
    await github.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL('https://github.com/Anionex/banana-slides');
    await popup.close();
    await expect(page).toHaveURL(/\/landing$/);
  }
  await expect(page.locator('.landing-nav nav').getByRole('link', { name: '文档', exact: true })).toHaveAttribute('href', 'https://docs.bananaslides.online');
  await page.screenshot({ path: '../work/landing/landing-zh.png', fullPage: true });
  await page.screenshot({ path: '../work/landing/hero-reference-size-zh.png' });
  await page.getByRole('link', { name: '使用场景', exact: true }).click();
  await expect(page).toHaveURL(/#scenarios$/);
  await expect(page.getByRole('heading', { name: '适合每一位需要演示的人' })).toBeInViewport();
  for (const [audience, heading] of [['PPT 设计师', '打破视觉灵感的瓶颈'], ['教育工作者', '从讲义到教学课件'], ['学生', '轻松准备课程汇报'], ['职场人士', '让商业提案更快成型'], ['零基础用户', '告别从零开始的焦虑']]) {
    await page.getByRole('button', { name: audience, exact: true }).click();
    await expect(page.getByRole('button', { name: audience, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#landing-scenario-content h3')).toHaveText(heading);
  }
  await page.getByRole('button', { name: '可以使用我自己的资料和模板吗？' }).click();
  await expect(page.getByText('可以。在创作页面上传参考资料', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '可以使用我自己的资料和模板吗？' }).click();
  await expect(page.getByText('可以。在创作页面上传参考资料', { exact: false })).toBeHidden();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Describe it.');
  for (const [audience, heading] of [['Designers', 'Explore more visual directions'], ['Educators', 'Turn lecture notes into courseware'], ['Students', 'Get ready for your class presentation'], ['Professionals', 'Bring your proposal into focus'], ['Beginners', 'Start without a blank canvas']]) {
    await page.getByRole('button', { name: audience, exact: true }).click();
    await expect(page.locator('#landing-scenario-content h3')).toHaveText(heading);
  }
  await page.getByRole('button', { name: 'Can I edit the exported PPTX?' }).click();
  await expect(page.locator('#faq-answer-2')).toContainText('Standard PPTX exports contain full-slide images');
  await page.getByRole('button', { name: 'What do I need to get started?' }).click();
  await expect(page.locator('#faq-answer-3')).toContainText('enter your own API key');
  await page.getByRole('button', { name: 'Do I need design experience?' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '../work/landing/landing-en.png', fullPage: true });
  await page.screenshot({ path: '../work/landing/hero-reference-size-en.png' });
  await page.getByRole('link', { name: 'Open workspace', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('textbox').first()).toBeVisible();
  await expect(page.locator('.landing-page')).toHaveCount(0);
  await fits(page);
});

for (const width of [1260, 390]) test(`landing: each audience switches to its own illustration at ${width}px`, async ({ page }) => {
  const audiences = ['零基础用户', 'PPT 设计师', '教育工作者', '学生', '职场人士'];
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/landing');
    const drawings = new Set<string>();
    for (const [i, audience] of audiences.entries()) {
      const button = page.getByRole('button', { name: audience, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      const art = page.locator('.scenario-artwork');
      await expect(art).toHaveAttribute('data-scenario', String(i + 1));
      await expect(art.locator('svg')).toBeVisible();
      drawings.add(await art.locator('svg').innerHTML());
      await art.screenshot({ path: `../work/landing/scenario-${i + 1}-${width}.png` });
      await fits(page);
    }
    expect(drawings.size).toBe(5);
    await page.locator('#scenarios').screenshot({ path: `../work/landing/scenarios-section-${width}.png` });
    await page.getByRole('button', { name: 'Switch to English' }).click();
    await expect(page.locator('.scenario-artwork')).toHaveAttribute('data-scenario', '5');
    await expect(page.locator('#landing-scenario-content h3')).toHaveText('Bring your proposal into focus');
});

test('landing: hover plays each illustration once, resets and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1260, height: 850 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/landing');
  const art = page.locator('.scenario-artwork');
  const motionState = () => art.locator('.scene-motion').evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node);
    return [style.transform, style.opacity, style.strokeDashoffset].join('|');
  }));
  for (const [i, audience] of ['零基础用户', 'PPT 设计师', '教育工作者', '学生', '职场人士'].entries()) {
    await page.getByRole('button', { name: audience, exact: true }).click();
    await page.mouse.move(0, 0);
    const resting = await motionState();
    await art.hover();
    await expect.poll(() => art.evaluate(node => node.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
    await art.evaluate(node => {
      for (const animation of node.getAnimations({ subtree: true })) {
        const timing = animation.effect!.getTiming();
        if (timing.iterations !== 1) throw new Error('Illustration must not loop');
      }
    });
    await expect.poll(motionState).not.toEqual(resting);
    await art.screenshot({ path: `../work/landing/scenario-motion-${i + 1}.png` });
    await art.evaluate(async node => {
      const animations = node.getAnimations({ subtree: true });
      await Promise.all(animations.map(animation => animation.finished));
    });
    expect(await art.evaluate(node => node.getAnimations({ subtree: true }).every(animation => animation.playState === 'finished'))).toBe(true);
    await page.mouse.move(0, 0);
    await expect.poll(() => art.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await motionState()).toEqual(resting);
    await art.hover();
    await expect.poll(() => art.evaluate(node => node.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'))).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => art.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
    await page.mouse.move(0, 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: '职场人士', exact: true }).focus();
  await expect.poll(() => art.evaluate(node => node.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
});


test('landing stays available with the API offline and does not load the application bundle', async ({ page, baseURL }) => {
  const apiRequests: string[] = [];
  const appResources: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === new URL(baseURL!).origin && url.pathname.startsWith('/api/')) apiRequests.push(request.url());
    if (/AppBootstrap-.*\.(js|css)/.test(request.url())) appResources.push(request.url());
  });
  await page.route(url => url.origin === new URL(baseURL!).origin && url.pathname.startsWith('/api/'), route => route.abort());
  for (const path of ['/', '/landing/', '/?utm_source=github']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('让想法落地');
    await page.getByRole('button', { name: '可以使用我自己的资料和模板吗？' }).click();
    await expect(page.locator('#faq-answer-1')).toBeVisible();
  }
  expect(apiRequests).toEqual([]);
  expect(appResources).toEqual([]);
});

test('real app: draft, personal settings and visitor identity survive landing navigation', async ({ page, request }) => {
  const token = `landing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const headers = { 'X-User-Token': token };
  await page.addInitScript(value => localStorage.setItem('banana-slides-user-token', value), token);
  try {
    await page.goto('/');
    await page.getByRole('link', { name: '开始创作', exact: true }).first().click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator('.landing-page')).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--studio-paper'))).toBe('');
    const draft = '官网入口回归：离开设置页后保留我的演示大纲';
    await page.getByRole('textbox').first().fill(draft);
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText('请先选择 API 提供商并填写你的 API Key。保存后返回首页继续，刚才的输入已保留。')).toBeVisible();
    await page.getByLabel('API Key', { exact: true }).fill('landing-settings-placeholder');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await expect(page.getByText('设置保存成功')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('API Key', { exact: true })).toHaveAttribute('placeholder', '已保存，留空保持不变');
    await page.getByRole('button', { name: '返回首页', exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('textbox').first()).toContainText(draft);
    await page.goto('/');
    await page.getByRole('link', { name: '进入工作空间', exact: true }).click();
    await expect(page.getByRole('textbox').first()).toContainText(draft);
    expect(await page.evaluate(() => localStorage.getItem('banana-slides-user-token'))).toBe(token);
    const saved = await request.get('/api/settings', { headers });
    expect((await saved.json()).data.api_key_length).toBe('landing-settings-placeholder'.length);
    await page.goto('/history');
    await expect(page).toHaveURL(/\/app$/);
  } finally {
    await request.post('/api/settings/reset', { headers });
  }
});
