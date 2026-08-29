import { expect, test } from '@playwright/test';

test('desktop settings uses Electron update results and opens the release page', async ({ page }) => {
  const releaseUrl = 'https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4';
  let backendUpdateCheckCalled = false;

  await page.addInitScript((url) => {
    const openedUrls: string[] = [];
    Object.defineProperty(window, '__openedUpdateUrls', { value: openedUrls });
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        isElectron: true,
        getBackendPort: () => 5000,
        getPlatform: () => 'darwin',
        minimizeWindow: () => undefined,
        maximizeWindow: () => undefined,
        closeWindow: () => undefined,
        zoomIn: () => undefined,
        zoomOut: () => undefined,
        zoomReset: () => undefined,
        getAppVersion: async () => '0.9.0-rc.3',
        checkForUpdates: async () => ({
          status: 'update_available',
          currentVersion: '0.9.0-rc.3',
          latestVersion: '0.9.0-rc.4',
          update: {
            version: '0.9.0-rc.4',
            notes: 'Release candidate fixes',
            url,
          },
        }),
        openExternal: (target: string) => { openedUrls.push(target); },
        downloadFile: async () => ({ success: true }),
      },
    });
  }, releaseUrl);

  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/settings/check-update') {
      backendUpdateCheckCalled = true;
    }
    await route.fulfill({ json: { success: true, data: {} } });
  });

  await page.goto('/#/settings');
  await page.getByRole('button', { name: /检查更新|Check for Updates/ }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/有版本更新：0\.9\.0-rc\.4|Version update available: 0\.9\.0-rc\.4/)).toBeVisible();
  await expect(dialog.getByText(/无法判断当前是否为最新版本|Unable to determine/)).toBeHidden();
  await dialog.getByRole('button', { name: /前往下载|Download/ }).click();

  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __openedUpdateUrls: string[] }
  ).__openedUpdateUrls)).toEqual([releaseUrl]);
  expect(backendUpdateCheckCalled).toBe(false);
});
