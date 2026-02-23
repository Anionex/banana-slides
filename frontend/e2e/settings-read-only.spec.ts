import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const DB_PATH = process.env.DB_PATH ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend/instance/database.db');

function dbQuery(sql: string): string {
  return execSync(`sqlite3 "${DB_PATH}" "${sql}"`).toString().trim();
}

// ===== Integration Test =====

test.describe('Settings read-only behavior', () => {
  test('GET /api/settings does not persist .env defaults to DB', async ({ request }) => {
    // 1. Save original value (quote() preserves NULL vs empty string)
    const original = dbQuery('SELECT quote(text_model) FROM settings WHERE id=1;');
    dbQuery('UPDATE settings SET text_model=NULL WHERE id=1;');

    try {
      // 2. Read settings via API — should return .env default via to_dict()
      const res = await request.get(`${BASE}/api/settings`);
      expect(res.ok()).toBeTruthy();
      const data = (await res.json()).data;
      expect(data.text_model).toBeTruthy();

      // 3. Verify DB field is still NULL (no write side-effect)
      const dbVal = dbQuery('SELECT quote(text_model) FROM settings WHERE id=1;');
      expect(dbVal).toBe('NULL');
    } finally {
      // 4. Restore original value
      dbQuery('UPDATE settings SET text_model=' + original + ' WHERE id=1;');
    }
  });
});
