import { test, expect } from '@playwright/test';

test.describe('Settings page API key labels and links', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('Baidu section title should not contain OCR', async ({ page }) => {
    const baiduSection = page.locator('h2').filter({ hasText: /百度配置|Baidu Configuration/ });
    await expect(baiduSection).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: /百度 OCR 配置|Baidu OCR Configuration/ })).not.toBeVisible();
  });

  test('Baidu API Key label should not contain OCR', async ({ page }) => {
    const baiduLabel = page.locator('label').filter({ hasText: /百度 API Key|Baidu API Key/ });
    await expect(baiduLabel).toBeVisible();
    await expect(page.locator('label:has-text("百度 OCR API Key")')).not.toBeVisible();
  });

  test('MinerU Token field has application link', async ({ page }) => {
    const mineruLink = page.locator('a[href="https://mineru.net/apiManage/token"]');
    await expect(mineruLink).toBeVisible();
    await expect(mineruLink).toHaveAttribute('target', '_blank');
  });

  test('Baidu API Key field has application link', async ({ page }) => {
    const baiduLink = page.locator('a[href="https://console.bce.baidu.com/iam/#/iam/apikey/list"]');
    await expect(baiduLink).toBeVisible();
    await expect(baiduLink).toHaveAttribute('target', '_blank');
  });

  test('AIHubMix has apply link', async ({ page }) => {
    const targetUrl = 'https://api.inferera.com/?aff=17EC';
    const legacyUrl = targetUrl.replace('/?', '/token?');
    const blockedHost = ['aihubmix', 'com'].join('.');

    const aihubLinks = page.locator(`a[href="${targetUrl}"]`);
    await expect(aihubLinks).toHaveCount(2);
    await expect(aihubLinks.first()).toBeVisible();
    await expect(aihubLinks.first()).toHaveAttribute('target', '_blank');
    await expect(aihubLinks.last()).toBeVisible();
    await expect(aihubLinks.last()).toHaveAttribute('target', '_blank');
    await expect(page.locator(`a[href="${legacyUrl}"]`)).toHaveCount(0);
    await expect(page.locator(`a[href*="${blockedHost}"]`)).toHaveCount(0);
  });

  test('AIHubMix API key guide uses current Console flow', async ({ page }) => {
    await expect(page.locator('li').filter({ hasText: /Console.*Top Up|Console.*Account.*Top Up/ })).toBeVisible();
    await expect(page.locator('li').filter({ hasText: /充值后.*Develop.*API Keys|After topping up.*Develop.*API Keys/ })).toBeVisible();
    await expect(page.locator('li').filter({ hasText: /Add key/ })).toBeVisible();
  });
});
