import { test, expect } from '@playwright/test';

test.describe('Banana Slides official domains', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('homepage and help links stay on Banana Slides domains', async ({ page }) => {
    const thirdPartyHost = ['inferera', 'com'].join('.');

    const footerDocsLink = page.locator('footer a[href="https://docs.bananaslides.online"]');
    await expect(footerDocsLink).toBeVisible();
    await expect(footerDocsLink).toHaveAttribute('target', '_blank');

    await page.getByRole('button', { name: /帮助|Help/, exact: true }).click();
    await expect(page.locator('a[href="https://docs.bananaslides.online/zh/features/overview"], a[href="https://docs.bananaslides.online/features/overview"]')).toBeVisible();
    await expect(page.locator('a[href="https://docs.bananaslides.online/zh/faq"], a[href="https://docs.bananaslides.online/faq"]')).toBeVisible();
    await expect(page.locator(`a[href*="${thirdPartyHost}"]`)).toHaveCount(0);
  });

});
