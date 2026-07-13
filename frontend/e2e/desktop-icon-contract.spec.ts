import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('desktop splash renders the shared app icon master', async ({ page }) => {
  const splashUrl = pathToFileURL(path.resolve(__dirname, '../../desktop/splash.html')).href;

  await page.goto(splashUrl);

  const logo = page.getByRole('img', { name: 'Banana Slides' });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', 'resources/icon.png');
  await expect.poll(() => logo.evaluate((element: HTMLImageElement) => ({
    complete: element.complete,
    naturalWidth: element.naturalWidth,
    naturalHeight: element.naturalHeight,
  }))).toEqual({ complete: true, naturalWidth: 1024, naturalHeight: 1024 });

  await expect(page.getByText('Banana Slides', { exact: true })).toBeVisible();
  await expect(page.getByText('AI-native presentation studio')).toBeVisible();
});
