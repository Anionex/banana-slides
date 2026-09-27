import { expect, test } from '@playwright/test';

test.skip(process.env.E2E_PUBLIC_LANDING !== '1', 'Requires the hosted public landing');

test.beforeEach(async ({ page }) => {
  await page.route('https://cloud.umami.is/**', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'zh'));
});

test('beta button opens a full-screen signup on desktop and mobile', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.landing-nav-actions a[href="/app"]')).toHaveText('体验 Demo');
    await expect(page.locator('.landing-hero-actions a[href="/app"]')).toContainText('体验 Demo');
    await expect(page.locator('.landing-hero-actions a[href="https://github.com/Anionex/banana-slides"]')).toBeVisible();
    const waitlist = page.locator('.landing-waitlist');
    await expect(waitlist).toBeHidden();
    await page.getByRole('button', { name: '预约在线版内测' }).click();
    await expect(page.getByRole('dialog', { name: '在线托管版即将开放' })).toBeVisible();
    await expect(waitlist).toBeVisible();
    const style = await waitlist.evaluate(element => {
      const computed = getComputedStyle(element);
      return { background: computed.backgroundColor, border: computed.borderTopWidth, shadow: computed.boxShadow };
    });
    expect(style).toEqual({ background: 'rgba(0, 0, 0, 0)', border: '0px', shadow: 'none' });
    const input = await page.getByLabel('你的邮箱地址').boundingBox();
    const button = await page.getByRole('button', { name: '预约内测' }).boundingBox();
    expect(input && button && Math.abs(input.y - button.y) < 2).toBeTruthy();
    await page.keyboard.press('Escape');
    await expect(waitlist).toBeHidden();
    if (width === 1440) {
      await expect(page.locator('.landing-scenario-copy a[href="/app"]')).toContainText('体验 Demo');
      await page.getByRole('navigation', { name: '产品能力' }).getByRole('button', { name: '在线版内测' }).click();
      await expect(waitlist).toBeVisible();
      await page.getByRole('button', { name: '关闭预约' }).click();
      await expect(waitlist).toBeHidden();
    }
  }
});

test('English mobile beta button keeps text clear of the light gradient', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  const beta = page.getByRole('button', { name: 'Join the hosted beta' });
  await expect(beta).toBeVisible();
  const layout = await beta.evaluate(element => {
    const button = element.getBoundingClientRect();
    const label = element.querySelector('span')!.getBoundingClientRect();
    return {
      paddingRight: parseFloat(getComputedStyle(element).paddingRight),
      labelEnd: (label.right - button.left) / button.width,
      buttonEnd: button.right,
    };
  });
  expect(layout.paddingRight).toBeGreaterThanOrEqual(36);
  expect(layout.labelEnd).toBeLessThan(0.7);
  expect(layout.buttonEnd).toBeLessThanOrEqual(390);
  await beta.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('signup shows a recoverable error for a failed API request', async ({ page }) => {
  await page.route(url => url.pathname === '/api/waitlist', route => route.fulfill({ status: 500, body: '{}' }));
  await page.goto('/');
  await page.getByRole('button', { name: '预约在线版内测' }).click();
  await page.getByLabel('你的邮箱地址').fill('trial@example.com');
  await page.getByRole('button', { name: '预约内测' }).click();
  await expect(page.getByRole('status')).toContainText('提交失败，请稍后重试。');
  await expect(page.getByLabel('你的邮箱地址')).toHaveValue('trial@example.com');
});

test('signup explains rate limiting without losing the address', async ({ page }) => {
  await page.route(url => url.pathname === '/api/waitlist', route => route.fulfill({ status: 429, body: '{}' }));
  await page.goto('/');
  await page.getByRole('button', { name: '预约在线版内测' }).click();
  await page.getByLabel('你的邮箱地址').fill('rate@example.com');
  await page.getByRole('button', { name: '预约内测' }).click();
  await expect(page.getByRole('status')).toContainText('提交较频繁，请稍后再试。');
  await expect(page.getByLabel('你的邮箱地址')).toHaveValue('rate@example.com');
});

test('signup explains a rejected email address', async ({ page }) => {
  await page.route(url => url.pathname === '/api/waitlist', route => route.fulfill({ status: 400, body: '{}' }));
  await page.goto('/');
  await page.getByRole('button', { name: '预约在线版内测' }).click();
  await page.getByLabel('你的邮箱地址').fill('invalid@example.com');
  await page.getByRole('button', { name: '预约内测' }).click();
  await expect(page.getByRole('status')).toContainText('请输入有效的邮箱地址。');
});

test('reopening during submission keeps the form locked until the request finishes', async ({ page }) => {
  let finishRequest = () => {};
  const pending = new Promise<void>(resolve => { finishRequest = resolve; });
  let requestCount = 0;
  await page.route(url => url.pathname === '/api/waitlist', async route => {
    requestCount += 1;
    await pending;
    await route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '预约在线版内测' }).click();
  await page.getByLabel('你的邮箱地址').fill('pending@example.com');
  await page.getByRole('button', { name: '预约内测' }).click();
  await expect(page.getByRole('button', { name: '提交中…' })).toBeDisabled();
  await expect.poll(() => requestCount).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '预约在线版内测' }).click();
  await expect(page.getByRole('button', { name: '提交中…' })).toBeDisabled();
  expect(requestCount).toBe(1);
  finishRequest();
  await expect(page.getByRole('status')).toContainText('已收到预约');
});

test('reopening after a hidden result still shows the submission outcome', async ({ page }) => {
  let finishRequest = () => {};
  const pending = new Promise<void>(resolve => { finishRequest = resolve; });
  await page.route(url => url.pathname === '/api/waitlist', async route => {
    await pending;
    await route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '预约在线版内测' }).click();
  await page.getByLabel('你的邮箱地址').fill('closed@example.com');
  await page.getByRole('button', { name: '预约内测' }).click();
  await expect(page.getByRole('button', { name: '提交中…' })).toBeDisabled();
  await page.keyboard.press('Escape');
  finishRequest();
  await expect(page.locator('.landing-waitlist-feedback')).toContainText('已收到预约');
  await page.getByRole('button', { name: '预约在线版内测' }).click();
  await expect(page.getByRole('status')).toContainText('已收到预约');
  await expect(page.getByLabel('你的邮箱地址')).toBeEmpty();
});

test('real signup persists once and owner exports the CSV', async ({ page }) => {
  const email = `waitlist-${Date.now()}@example.com`;
  await page.goto('/');
  await page.getByRole('button', { name: '预约在线版内测' }).click();
  await page.getByLabel('你的邮箱地址').fill(email);
  await page.getByRole('button', { name: '预约内测' }).click();
  await expect(page.getByRole('status')).toContainText('已收到预约');
  await page.getByLabel('你的邮箱地址').fill(email.toUpperCase());
  await expect(page.getByRole('status')).toBeEmpty();
  await page.getByRole('button', { name: '预约内测' }).click();
  await expect(page.getByRole('status')).toContainText('已收到预约');

  await page.goto('/admin/history');
  await page.getByLabel('管理员口令').fill(process.env.E2E_WAITLIST_ADMIN_PASSWORD || 'local-waitlist-test-password');
  await page.getByRole('button', { name: '查看历史' }).click();
  await expect(page.getByRole('button', { name: '导出内测邮箱' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出内测邮箱' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString();
  expect(csv.split('\n').filter(line => line.includes(email))).toHaveLength(1);
});
