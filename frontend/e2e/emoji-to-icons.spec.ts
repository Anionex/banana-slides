import { test, expect, type Page } from '@playwright/test';

/** 首页的装饰性 emoji 已换成 lucide 图标 / 直接去掉，避免不同平台字形不一致。 */

async function openHome(page: Page) {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
}

/** 上传一个假的 pptx，只为触发本地状态，不会发网络请求 */
async function attachFakePptx(page: Page) {
  await page.locator('input[accept=".pdf,.pptx,.ppt"]').setInputFiles({
    name: 'demo.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    buffer: Buffer.from('fake pptx for e2e'),
  });
}

test('tagline 不再包含 🍌', async ({ page }) => {
  await openHome(page);
  const tagline = page.getByText(/nano banana pro/).first();
  await expect(tagline).toBeVisible();
  expect(await tagline.textContent()).not.toContain('🍌');
});

test('上传 pptx 的提示 toast 不带 💡 前缀', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: /PPT 翻新|PPT Renovation/ }).first().click();
  await page.waitForTimeout(400);

  await attachFakePptx(page);

  const toast = page.getByText(/建议先在本地将 PPTX 转为 PDF|recommend converting/i).first();
  await expect(toast).toBeVisible({ timeout: 10000 });
  expect(await toast.textContent()).not.toContain('💡');
});

test('已选文件的移除按钮是 lucide 图标而不是 ✕ 字符', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: /PPT 翻新|PPT Renovation/ }).first().click();
  await page.waitForTimeout(400);

  await attachFakePptx(page);

  const chip = page.getByText('demo.pptx').first();
  await expect(chip).toBeVisible({ timeout: 10000 });

  // 移除按钮：同一容器里那个带 svg 的 button
  const removeBtn = page
    .locator('button')
    .filter({ has: page.locator('svg.lucide-x') })
    .first();
  await expect(removeBtn).toBeVisible();
  expect(await removeBtn.textContent()).not.toContain('✕');

  // 点一下应当真的能移除
  await removeBtn.click();
  await expect(page.getByText('demo.pptx')).toHaveCount(0);
});
