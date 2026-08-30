import { expect, test } from '@playwright/test';

test('desktop users can toggle automatic updates and install a downloaded release', async ({ page }) => {
  const releaseUrl = 'https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4';
  let backendUpdateCheckCalled = false;

  await page.addInitScript((url) => {
    let automaticUpdatesEnabled = true;
    let updateState = {
      status: 'idle',
      currentVersion: '0.9.0-rc.3',
      latestVersion: '0.9.0-rc.3',
      update: null,
      canAutoUpdate: true,
      automaticUpdatesEnabled,
    } as Record<string, unknown>;
    const updateListeners = new Set<(state: Record<string, unknown>) => void>();
    const openedUrls: string[] = [];
    const preferenceChanges: boolean[] = [];
    let downloadCalls = 0;
    let installCalls = 0;

    Object.defineProperties(window, {
      __desktopUpdateTest: {
        value: {
          openedUrls,
          preferenceChanges,
          get downloadCalls() { return downloadCalls; },
          get installCalls() { return installCalls; },
        },
      },
      electronAPI: {
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
          getAutoUpdateSettings: async () => ({ automaticUpdatesEnabled }),
          setAutomaticUpdatesEnabled: async (enabled: boolean) => {
            automaticUpdatesEnabled = enabled;
            preferenceChanges.push(enabled);
            updateState = { ...updateState, automaticUpdatesEnabled };
            return { automaticUpdatesEnabled };
          },
          getUpdateState: async () => updateState,
          onUpdateStatus: (listener: (state: Record<string, unknown>) => void) => {
            updateListeners.add(listener);
            return () => updateListeners.delete(listener);
          },
          checkForUpdates: async () => {
            updateState = {
              status: 'update_available',
              currentVersion: '0.9.0-rc.3',
              latestVersion: '0.9.0-rc.4',
              canAutoUpdate: true,
              automaticUpdatesEnabled,
              update: {
                version: '0.9.0-rc.4',
                notes: 'Release candidate fixes',
                url,
              },
            };
            updateListeners.forEach((listener) => listener(updateState));
            return updateState;
          },
          downloadUpdate: async () => {
            downloadCalls += 1;
            updateState = { ...updateState, status: 'update_downloaded' };
            updateListeners.forEach((listener) => listener(updateState));
            return updateState;
          },
          installUpdate: async () => {
            installCalls += 1;
            return { success: true };
          },
          openExternal: (target: string) => { openedUrls.push(target); },
          downloadFile: async () => ({ success: true }),
        },
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

  const automaticUpdateToggle = page.getByRole('switch', { name: /自动更新|Automatic updates/ });
  await expect(automaticUpdateToggle).toHaveAttribute('aria-checked', 'true');
  await automaticUpdateToggle.click();
  await expect(automaticUpdateToggle).toHaveAttribute('aria-checked', 'false');
  await automaticUpdateToggle.click();
  await expect(automaticUpdateToggle).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: /检查更新|Check for Updates/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/有版本更新：0\.9\.0-rc\.4|Version update available: 0\.9\.0-rc\.4/)).toBeVisible();
  await dialog.getByRole('button', { name: /下载更新|Download update/ }).click();
  await expect(dialog.getByText(/已下载|is ready/)).toBeVisible();
  await dialog.getByRole('button', { name: /重启并更新|Restart to update/ }).click();

  const testState = await page.evaluate(() => (
    window as typeof window & {
      __desktopUpdateTest: {
        openedUrls: string[];
        preferenceChanges: boolean[];
        downloadCalls: number;
        installCalls: number;
      };
    }
  ).__desktopUpdateTest);
  expect(testState.preferenceChanges).toEqual([false, true]);
  expect(testState.downloadCalls).toBe(1);
  expect(testState.installCalls).toBe(1);
  expect(testState.openedUrls).toEqual([]);
  expect(backendUpdateCheckCalled).toBe(false);
});
