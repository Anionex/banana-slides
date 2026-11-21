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

// ===== Integration Tests =====

test.describe.configure({ mode: 'serial' });

test.describe('Settings .env fallback behavior', () => {

  test('GET /api/settings does not persist .env defaults to DB', async ({ request }) => {
    const original = dbQuery('SELECT quote(text_model) FROM settings WHERE id=1;');
    dbQuery('UPDATE settings SET text_model=NULL WHERE id=1;');

    try {
      const res = await request.get(`${BASE}/api/settings`);
      expect(res.ok()).toBeTruthy();
      const data = (await res.json()).data;
      // API returns .env default even though DB is NULL
      expect(data.text_model).toBeTruthy();

      // DB field is still NULL (no write side-effect)
      const dbVal = dbQuery('SELECT quote(text_model) FROM settings WHERE id=1;');
      expect(dbVal).toBe('NULL');
    } finally {
      dbQuery('UPDATE settings SET text_model=' + original + ' WHERE id=1;');
    }
  });

  test('PUT /api/settings persists value to DB', async ({ request }) => {
    const original = dbQuery('SELECT quote(text_model) FROM settings WHERE id=1;');

    try {
      const res = await request.put(`${BASE}/api/settings`, {
        data: { text_model: 'test-model-persist' },
      });
      expect(res.ok()).toBeTruthy();

      // Verify DB has the saved value
      const dbVal = dbQuery('SELECT text_model FROM settings WHERE id=1;');
      expect(dbVal).toBe('test-model-persist');
    } finally {
      dbQuery('UPDATE settings SET text_model=' + original + ' WHERE id=1;');
    }
  });

  test('POST /api/settings/reset clears fields to NULL', async ({ request }) => {
    const origModel = dbQuery('SELECT quote(text_model) FROM settings WHERE id=1;');
    const origRes = dbQuery('SELECT quote(image_resolution) FROM settings WHERE id=1;');

    // Ensure non-NULL values exist before reset
    dbQuery("UPDATE settings SET text_model='before-reset', image_resolution='4K' WHERE id=1;");

    try {
      const res = await request.post(`${BASE}/api/settings/reset`);
      expect(res.ok()).toBeTruthy();

      // Verify DB fields are NULL after reset
      const modelVal = dbQuery('SELECT quote(text_model) FROM settings WHERE id=1;');
      expect(modelVal).toBe('NULL');
      const resVal = dbQuery('SELECT quote(image_resolution) FROM settings WHERE id=1;');
      expect(resVal).toBe('NULL');

      // API still returns .env defaults (not NULL)
      const getRes = await request.get(`${BASE}/api/settings`);
      const data = (await getRes.json()).data;
      expect(data.image_resolution).toBeTruthy();
    } finally {
      dbQuery('UPDATE settings SET text_model=' + origModel + ', image_resolution=' + origRes + ' WHERE id=1;');
    }
  });

  test('NULL fields in DB fall back to .env on every GET', async ({ request }) => {
    const origLang = dbQuery('SELECT quote(output_language) FROM settings WHERE id=1;');
    const origFormat = dbQuery('SELECT quote(ai_provider_format) FROM settings WHERE id=1;');

    dbQuery('UPDATE settings SET output_language=NULL, ai_provider_format=NULL WHERE id=1;');

    try {
      const res = await request.get(`${BASE}/api/settings`);
      expect(res.ok()).toBeTruthy();
      const data = (await res.json()).data;

      // These should return .env defaults, not NULL
      expect(data.output_language).toBeTruthy();
      expect(data.ai_provider_format).toBeTruthy();
    } finally {
      dbQuery('UPDATE settings SET output_language=' + origLang + ', ai_provider_format=' + origFormat + ' WHERE id=1;');
    }
  });
});
