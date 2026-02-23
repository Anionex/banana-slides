import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const DB = process.env.DB_PATH ??
  BASE.replace(/:\d+$/, '').replace('http://localhost', '') // unused fallback
const getDbPath = () => {
  // Derive DB path from the worktree that started the backend
  const port = new URL(BASE).port;
  const out = execSync(
    `lsof -iTCP:${port} -sTCP:LISTEN -Fn 2>/dev/null | grep '^n' | head -1 || true`
  ).toString().trim();
  // Fallback: use the standard worktree DB path
  return process.env.DB_PATH ??
    '/home/aa/banana-slides-settings-side-effect/backend/instance/database.db';
};

function dbQuery(sql: string): string {
  return execSync(`sqlite3 "${getDbPath()}" "${sql}"`).toString().trim();
}

// ===== Integration Test =====

test.describe('Settings read-only behavior', () => {
  test('GET /api/settings does not persist .env defaults to DB', async ({ request }) => {
    const dbPath = getDbPath();

    // 1. Save original value and set text_model to NULL in DB
    const original = dbQuery('SELECT text_model FROM settings WHERE id=1;');
    execSync(`sqlite3 "${dbPath}" "UPDATE settings SET text_model=NULL WHERE id=1;"`);

    try {
      // 2. Read settings via API — should return .env default in-memory
      const res = await request.get(`${BASE}/api/settings`);
      expect(res.ok()).toBeTruthy();
      const data = (await res.json()).data;
      expect(data.text_model).toBeTruthy(); // .env value merged in-memory

      // 3. Verify DB field is still NULL (no write side-effect)
      const dbVal = dbQuery('SELECT text_model FROM settings WHERE id=1;');
      expect(dbVal).toBe(''); // sqlite3 prints empty string for NULL
    } finally {
      // 4. Restore original value
      execSync(`sqlite3 "${dbPath}" "UPDATE settings SET text_model='${original}' WHERE id=1;"`);
    }
  });
});
