import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { expect, test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3009';
const DESKTOP_BACKEND_PORT = Number(new URL(process.env.BACKEND_URL || 'http://127.0.0.1:5011').port);
const DB_PATH = process.env.DB_PATH
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend/instance/database.db');

function sqlite(sql: string): string {
  return execFileSync('sqlite3', ['-cmd', '.timeout 5000', DB_PATH, sql], { encoding: 'utf8' }).trim();
}

async function expandAdvancedSettings(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /高级设置|Advanced Settings/ }).click();
}

test('desktop UI observes OAuth credentials persisted by the real backend database', async ({ page, request }) => {
  await request.get(`${BASE_URL}/api/settings`);
  const restoreSql = sqlite(`
    SELECT 'UPDATE settings SET openai_oauth_access_token=' || quote(openai_oauth_access_token)
      || ', openai_oauth_refresh_token=' || quote(openai_oauth_refresh_token)
      || ', openai_oauth_expires_at=' || quote(openai_oauth_expires_at)
      || ', openai_oauth_account_id=' || quote(openai_oauth_account_id)
      || ' WHERE id=' || id || ';'
    FROM settings WHERE id=1;
  `);

  sqlite(`
    UPDATE settings
    SET openai_oauth_access_token=NULL,
        openai_oauth_refresh_token=NULL,
        openai_oauth_expires_at=NULL,
        openai_oauth_account_id=NULL
    WHERE id=1;
  `);

  try {
    await page.addInitScript((backendPort) => {
      Object.defineProperty(window, 'electronAPI', {
        configurable: true,
        value: {
          isElectron: true,
          getBackendPort: () => backendPort,
          getPlatform: () => 'darwin',
          minimizeWindow: () => undefined,
          maximizeWindow: () => undefined,
          closeWindow: () => undefined,
          zoomIn: () => undefined,
          zoomOut: () => undefined,
          zoomReset: () => undefined,
        },
      });
      window.open = () => null;
    }, DESKTOP_BACKEND_PORT);
    await page.route('**/api/settings/openai-oauth/authorize', async (route) => {
      await route.fulfill({
        json: { success: true, data: { auth_url: 'https://auth.openai.com/oauth/authorize?client_id=integration' } },
      });
    });

    await page.goto(`${BASE_URL}/#/settings`);
    await expandAdvancedSettings(page);
    await page.getByRole('button', { name: 'Login with OpenAI' }).click();
    await expect(page.getByRole('button', { name: /连接中|Connecting/ })).toBeVisible();

    sqlite(`
      UPDATE settings
      SET openai_oauth_access_token='integration-access-token',
          openai_oauth_refresh_token='integration-refresh-token',
          openai_oauth_expires_at=datetime('now', '+1 hour'),
          openai_oauth_account_id='persisted@example.com'
      WHERE id=1;
    `);

    await expect(page.getByText('persisted@example.com')).toBeVisible({ timeout: 5000 });
    const statusResponse = await request.get(`${BASE_URL}/api/settings/openai-oauth/status`);
    expect(await statusResponse.json()).toMatchObject({
      success: true,
      data: { connected: true, account_id: 'persisted@example.com' },
    });
  } finally {
    if (restoreSql) sqlite(restoreSql);
  }
});
