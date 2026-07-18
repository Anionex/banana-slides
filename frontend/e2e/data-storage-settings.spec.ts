import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const calls: Array<{ path: string; allowInitialize: boolean }> = [];
    Object.defineProperty(window, '__dataStorageApplyCalls', { value: calls });
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        isElectron: true,
        getBackendPort: () => 5000,
        getPlatform: () => 'win32',
        minimizeWindow: () => undefined,
        maximizeWindow: () => undefined,
        closeWindow: () => undefined,
        zoomIn: () => undefined,
        zoomOut: () => undefined,
        zoomReset: () => undefined,
        checkForUpdates: async () => null,
        getAppVersion: async () => '0.9.0',
        openExternal: () => undefined,
        downloadFile: async () => ({ success: true }),
        getDataStorageInfo: async () => ({
          dataRoot: 'C:\\Users\\Test\\AppData\\Roaming\\banana-slides-desktop',
          isDefault: true,
          hasDatabase: true,
          configurable: true,
        }),
        chooseDataStorageDirectory: async () => 'D:\\Banana Slides Data',
        inspectDataStorageDirectory: async (path: string) => ({
          dataRoot: path,
          exists: true,
          writable: true,
          hasDatabase: false,
          isEmpty: true,
        }),
        openDataStorageDirectory: async () => ({ success: true }),
        applyDataStorageDirectory: async (path: string, allowInitialize: boolean) => {
          calls.push({ path, allowInitialize });
          return { success: true, restarting: true };
        },
      },
    });
  });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    await route.fulfill({ json: { success: true, data: {} } });
  });
});

test('desktop settings requires explicit confirmation before using an empty custom data location', async ({ page }) => {
  await page.goto('/#/settings');

  await expect(page.getByRole('heading', { name: /数据存储位置|Data storage location/ })).toBeHidden();
  await page.getByRole('button', { name: /高级设置|Advanced Settings/ }).click();
  await expect(page.getByRole('heading', { name: /数据存储位置|Data storage location/ })).toBeVisible();
  const storagePath = page.getByLabel(/存储路径|Storage path/);
  await expect(storagePath).toHaveValue('C:\\Users\\Test\\AppData\\Roaming\\banana-slides-desktop');
  await expect(page.getByText(/不会自动移动或删除已有数据|does not move or delete existing data automatically/)).toBeVisible();

  const browse = page.getByRole('button', { name: /浏览|Browse/ });
  await expect(browse).toHaveCSS('white-space', 'nowrap');
  await browse.click();
  await expect(storagePath).toHaveValue('D:\\Banana Slides Data');
  await page.getByRole('button', { name: /保存并重启|Save and restart/ }).click();

  const confirm = page.getByRole('button', { name: /确认并重启|Confirm and restart/ });
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __dataStorageApplyCalls?: unknown[] }
  ).__dataStorageApplyCalls)).toEqual([
    { path: 'D:\\Banana Slides Data', allowInitialize: true },
  ]);
});
