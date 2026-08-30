import { expect, test, type Page } from '@playwright/test';

const releaseUrl = 'https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4';

async function installDesktopUpdateBridge(page: Page, startWithUpdate: boolean) {
  await page.addInitScript(({ url, hasStartupUpdate }) => {
    let automaticUpdatesEnabled = true;
    let updateState = hasStartupUpdate
      ? {
          status: 'update_available',
          currentVersion: '0.9.0-rc.3',
          latestVersion: '0.9.0-rc.4',
          canAutoUpdate: true,
          automaticUpdatesEnabled,
          checkSource: 'automatic',
          update: {
            version: '0.9.0-rc.4',
            notes: '- 更清晰的自动更新提示\n- 修复桌面端稳定性问题',
            url,
          },
        }
      : {
          status: 'idle',
          currentVersion: '0.9.0-rc.3',
          latestVersion: '0.9.0-rc.3',
          canAutoUpdate: true,
          automaticUpdatesEnabled,
          checkSource: null,
          update: null,
        } as Record<string, unknown>;
    const updateListeners = new Set<(state: Record<string, unknown>) => void>();
    const openedUrls: string[] = [];
    const preferenceChanges: boolean[] = [];
    let downloadCalls = 0;
    let installCalls = 0;
    let checkCalls = 0;

    const notify = () => updateListeners.forEach((listener) => listener(updateState));
    const availableState = (checkSource: 'automatic' | 'manual') => ({
      status: 'update_available',
      currentVersion: '0.9.0-rc.3',
      latestVersion: '0.9.0-rc.4',
      canAutoUpdate: true,
      automaticUpdatesEnabled,
      checkSource,
      update: {
        version: '0.9.0-rc.4',
        notes: '- 更清晰的自动更新提示\n- 修复桌面端稳定性问题',
        url,
      },
    });

    Object.defineProperties(window, {
      __desktopUpdateTest: {
        value: {
          openedUrls,
          preferenceChanges,
          get downloadCalls() { return downloadCalls; },
          get installCalls() { return installCalls; },
          get checkCalls() { return checkCalls; },
          emitCurrentState: notify,
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
          getAutoUpdateSettings: async () => ({ automaticUpdatesEnabled, canAutoUpdate: true }),
          setAutomaticUpdatesEnabled: async (enabled: boolean) => {
            automaticUpdatesEnabled = enabled;
            preferenceChanges.push(enabled);
            updateState = { ...updateState, automaticUpdatesEnabled };
            return { automaticUpdatesEnabled, canAutoUpdate: true };
          },
          getUpdateState: async () => updateState,
          onUpdateStatus: (listener: (state: Record<string, unknown>) => void) => {
            updateListeners.add(listener);
            return () => updateListeners.delete(listener);
          },
          checkForUpdates: async () => {
            checkCalls += 1;
            updateState = availableState('manual');
            notify();
            return updateState;
          },
          downloadUpdate: async () => {
            downloadCalls += 1;
            updateState = {
              ...availableState((updateState.checkSource as 'automatic' | 'manual') || 'manual'),
              status: 'downloading',
              progress: { percent: 48, bytesPerSecond: 1024, transferred: 480, total: 1000 },
            };
            notify();
            await new Promise((resolve) => setTimeout(resolve, 50));
            updateState = { ...updateState, status: 'update_downloaded' };
            notify();
            return updateState;
          },
          installUpdate: async () => {
            installCalls += 1;
            return { success: true };
          },
          openExternal: async (target: string) => { openedUrls.push(target); },
          downloadFile: async () => ({ success: true }),
        },
      },
    });
  }, { url: releaseUrl, hasStartupUpdate: startWithUpdate });
}

async function mockBackendApi(page: Page) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    await route.fulfill({ json: { success: true, data: {} } });
  });
}

test('startup update card supports changelog, update now, and next-launch deferral', async ({ page }) => {
  await installDesktopUpdateBridge(page, true);
  await mockBackendApi(page);
  await page.goto('/#/settings');

  let dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/0\.9\.0-rc\.4/)).toBeVisible();
  await expect(dialog.getByText('更清晰的自动更新提示')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __desktopUpdateTest: { downloadCalls: number } }
  ).__desktopUpdateTest.downloadCalls)).toBe(0);

  await dialog.getByRole('button', { name: /查看完整更新日志|View full changelog/ }).click();
  expect(await page.evaluate(() => (
    window as typeof window & { __desktopUpdateTest: { openedUrls: string[] } }
  ).__desktopUpdateTest.openedUrls)).toEqual([releaseUrl]);

  await dialog.getByRole('button', { name: /稍后更新|Update later/ }).click();
  await expect(dialog).not.toBeVisible();
  await page.evaluate(() => (
    window as typeof window & { __desktopUpdateTest: { emitCurrentState: () => void } }
  ).__desktopUpdateTest.emitCurrentState());
  await expect(dialog).not.toBeVisible();

  await page.reload();
  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /立即更新|Update now/ }).click();
  await expect(dialog.getByText(/已下载完成|Update downloaded/)).toBeVisible();
  await dialog.getByRole('button', { name: /重启并更新|Restart to update/ }).click();

  const finalState = await page.evaluate(() => (
    window as typeof window & {
      __desktopUpdateTest: { downloadCalls: number; installCalls: number };
    }
  ).__desktopUpdateTest);
  expect(finalState.downloadCalls).toBe(1);
  expect(finalState.installCalls).toBe(1);
});

test('Settings can toggle startup checks and manually start an update', async ({ page }) => {
  await installDesktopUpdateBridge(page, false);
  let backendUpdateCheckCalled = false;
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    if (new URL(route.request().url()).pathname === '/api/settings/check-update') {
      backendUpdateCheckCalled = true;
    }
    await route.fulfill({ json: { success: true, data: {} } });
  });

  await page.goto('/#/settings');
  const automaticUpdateToggle = page.getByRole('switch', { name: /自动检查更新|Automatic update checks/ });
  await expect(automaticUpdateToggle).toHaveAttribute('aria-checked', 'true');
  await automaticUpdateToggle.click();
  await expect(automaticUpdateToggle).toHaveAttribute('aria-checked', 'false');
  await automaticUpdateToggle.click();
  await expect(automaticUpdateToggle).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: /检查更新|Check for Updates/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(1);
  await expect(dialog.getByText('更清晰的自动更新提示')).toBeVisible();
  await dialog.getByRole('button', { name: /立即更新|Update now/ }).click();
  await expect(dialog.getByText(/已下载|is ready/)).toBeVisible();
  await dialog.getByRole('button', { name: /重启并更新|Restart to update/ }).click();

  const testState = await page.evaluate(() => (
    window as typeof window & {
      __desktopUpdateTest: {
        preferenceChanges: boolean[];
        downloadCalls: number;
        installCalls: number;
        checkCalls: number;
      };
    }
  ).__desktopUpdateTest);
  expect(testState.preferenceChanges).toEqual([false, true]);
  expect(testState.checkCalls).toBe(1);
  expect(testState.downloadCalls).toBe(1);
  expect(testState.installCalls).toBe(1);
  expect(backendUpdateCheckCalled).toBe(false);
});
