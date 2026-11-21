import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const splashUrl = pathToFileURL(path.resolve(__dirname, '../../desktop/splash.html')).href;

for (const appearance of [
  {
    colorScheme: 'light' as const,
    iconBackground: 'rgb(255, 255, 255)',
    titleColor: 'rgb(41, 37, 36)',
  },
  {
    colorScheme: 'dark' as const,
    iconBackground: 'rgb(17, 17, 17)',
    titleColor: 'rgb(250, 250, 249)',
  },
]) {
  test(`desktop splash follows the ${appearance.colorScheme} app icon appearance`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: appearance.colorScheme });
    await page.goto(splashUrl);

    const logo = page.getByRole('img', { name: 'Banana Slides' });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', 'resources/BananaSlides.icon/Assets/brand-logo.png');
    await expect.poll(() => logo.evaluate((element: HTMLImageElement) => ({
      complete: element.complete,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
    }))).toEqual({ complete: true, naturalWidth: 1024, naturalHeight: 1024 });

    const iconPresentation = await logo.evaluate((element: HTMLImageElement) => {
      const shell = element.parentElement;
      const title = document.querySelector('.app-name');
      const bounds = element.getBoundingClientRect();
      return {
        shellBackground: shell ? getComputedStyle(shell).backgroundColor : null,
        titleColor: title ? getComputedStyle(title).color : null,
        renderedWidth: Math.round(bounds.width),
        renderedHeight: Math.round(bounds.height),
      };
    });
    expect(iconPresentation).toEqual({
      shellBackground: appearance.iconBackground,
      titleColor: appearance.titleColor,
      renderedWidth: 82,
      renderedHeight: 82,
    });

    await expect(page.getByText('Banana Slides', { exact: true })).toBeVisible();
    await expect(page.getByText('AI-native presentation studio')).toBeVisible();
  });
}
