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
    const aihubLink = page.locator('a[href="https://aihubmix.com/token?aff=17EC"]');
    await expect(aihubLink).toBeVisible();
    await expect(aihubLink).toHaveAttribute('target', '_blank');
  });
});
