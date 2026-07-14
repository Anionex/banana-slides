import { test, expect } from '@playwright/test';

test.describe('Inferera domain migration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('homepage and help links use Inferera domains', async ({ page }) => {
    const retiredDemoHost = ['bananaslides', 'online'].join('.');

    const footerDocsLink = page.locator('footer a[href="https://docs.inferera.com"]');
    await expect(footerDocsLink).toBeVisible();
    await expect(footerDocsLink).toHaveAttribute('target', '_blank');

    await page.getByRole('button', { name: /帮助|Help/, exact: true }).click();
    await expect(page.locator('a[href="https://docs.inferera.com/zh/features/overview"], a[href="https://docs.inferera.com/features/overview"]')).toBeVisible();
    await expect(page.locator('a[href="https://docs.inferera.com/zh/faq"], a[href="https://docs.inferera.com/faq"]')).toBeVisible();
    await expect(page.locator(`a[href*="${retiredDemoHost}"]`)).toHaveCount(0);
  });
});
