import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

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

  test('repository links keep first-party and AI provider domains separate', () => {
    const firstPartyFiles = [
      '.github/ISSUE_TEMPLATE/bug_report.yml',
      'README.md',
      'README_EN.md',
      'docs/quickstart.mdx',
      'docs/zh/quickstart.mdx',
      'skills/banana-cli/references/setup.md',
    ];

    for (const relativePath of firstPartyFiles) {
      const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
      expect(content, relativePath).toContain('bananaslides.online');
      expect(content, relativePath).not.toContain('https://docs.inferera.com');
      expect(content, relativePath).not.toContain('https://inferera.com');
    }

    const providerExamples = [
      '.env.example',
      'docs/configuration.mdx',
      'docs/zh/configuration.mdx',
    ];

    for (const relativePath of providerExamples) {
      const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
      expect(content, relativePath).toContain('https://api.inferera.com');
    }
  });
});
