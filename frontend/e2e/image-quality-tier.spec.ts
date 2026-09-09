import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

const baseSettings = {
  id: 1,
  ai_provider_format: 'openai',
  api_base_url: 'https://api.apimart.ai/v1',
  image_model_source: 'openai',
  openai_image_api_protocol: 'images',
  image_quality: 'auto',
  image_model: 'gpt-image-2.5-flare',
  text_model: 'gpt-5.6-sol',
  image_resolution: '2K',
  image_aspect_ratio: '16:9',
  max_description_workers: 5,
  max_image_workers: 8,
  api_key_length: 10,
  mineru_token_length: 0,
  output_language: 'zh',
  description_generation_mode: 'streaming',
  enable_text_reasoning: false,
  text_thinking_budget: 1024,
  enable_image_reasoning: false,
  image_thinking_budget: 1024,
  baidu_api_key_length: 0,
  text_api_key_length: 0,
  image_api_key_length: 0,
  image_caption_api_key_length: 0,
  openai_oauth_connected: false,
};

// Only intercept the settings API, never the frontend's own /api/*.ts modules.
const mockSettings = async (page, overrides: Record<string, unknown> = {}) => {
  await page.route(
    (url) => url.pathname === '/api/settings',
    async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...baseSettings, ...overrides } }),
        });
      } else {
        await route.continue();
      }
    }
  );
};

test.describe('Image quality tier setting', () => {
  test.describe('Mock tests - UI logic', () => {
    test('shows six quality tiers for an OpenAI-compatible image model', async ({ page }) => {
      await mockSettings(page);

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      const qualitySelect = page.getByTestId('openai-image-quality-select');
      await expect(qualitySelect).toBeVisible();
      await expect(qualitySelect.locator('option')).toHaveCount(6);
      await expect(qualitySelect).toHaveValue('auto');
      await expect(qualitySelect.locator('option[value="xhigh"]')).toHaveCount(1);
      await expect(qualitySelect.locator('option[value="max"]')).toHaveCount(1);
    });

    test('hides the quality tiers for a Gemini image model', async ({ page }) => {
      await mockSettings(page, {
        ai_provider_format: 'gemini',
        image_model_source: 'gemini',
        image_model: 'imagen-3.0-generate-001',
      });

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('openai-image-quality-select')).toHaveCount(0);
    });

    test('hides the quality tiers for a model that ignores them (Seedream)', async ({ page }) => {
      await mockSettings(page, {
        ai_provider_format: 'volcengine',
        image_model_source: 'volcengine',
        image_model: 'doubao-seedream-5.0-lite',
      });

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      // Protocol select is still shown (Seedream needs the images path) while the
      // quality tiers are hidden because Seedream does not accept a quality param.
      await expect(page.getByTestId('openai-image-api-protocol-select')).toBeVisible();
      await expect(page.getByTestId('openai-image-quality-select')).toHaveCount(0);
    });

    test('restores the saved tier into the select', async ({ page }) => {
      await mockSettings(page, { image_quality: 'xhigh' });

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('openai-image-quality-select')).toHaveValue('xhigh');
    });

    test('sends image_quality in the save payload', async ({ page }) => {
      let savedPayload: Record<string, unknown> | null = null;

      await page.route(
        (url) => url.pathname === '/api/settings',
        async (route) => {
          if (route.request().method() === 'GET') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: baseSettings }),
            });
          } else if (route.request().method() === 'PUT') {
            savedPayload = route.request().postDataJSON();
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: savedPayload }),
            });
          } else {
            await route.continue();
          }
        }
      );

      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      await page.getByTestId('openai-image-quality-select').selectOption('max');
      await page.getByRole('button', { name: /保存|Save/i }).click();

      await expect
        .poll(() => savedPayload && (savedPayload as Record<string, unknown>).image_quality)
        .toBe('max');
    });
  });

  test.describe.serial('Integration tests - real backend', () => {
    const apiBase = () =>
      BASE_URL.replace(/:\d+$/, ':' + (parseInt(BASE_URL.split(':').pop()!) + 2000));

    test.beforeAll(async ({ request }) => {
      // Make the OpenAI-compatible image section visible in the settings page:
      // the quality control only shows for GPT Image models.
      await request.put(`${apiBase()}/api/settings`, {
        data: {
          ai_provider_format: 'openai',
          image_model_source: 'openai',
          image_model: 'gpt-image-2.5-flare',
        },
      });
    });

    test.afterAll(async ({ request }) => {
      await request.put(`${apiBase()}/api/settings`, { data: { image_quality: 'auto' } });
    });

    test('persists and reloads the quality tier', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      const qualitySelect = page.getByTestId('openai-image-quality-select');
      await expect(qualitySelect).toBeVisible();

      await qualitySelect.selectOption('xhigh');
      await page.getByRole('button', { name: /保存|Save/i }).click();
      await expect(page.getByText(/保存成功|Saved successfully|设置已保存|Settings saved/i).first()).toBeVisible();

      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('openai-image-quality-select')).toHaveValue('xhigh');

      // Put it back so the shared local database stays predictable.
      await page.getByTestId('openai-image-quality-select').selectOption('auto');
      await page.getByRole('button', { name: /保存|Save/i }).click();
      await expect(page.getByText(/保存成功|Saved successfully|设置已保存|Settings saved/i).first()).toBeVisible();
    });

    test('returns image_quality in GET /api/settings', async ({ request }) => {
      const response = await request.get(`${apiBase()}/api/settings`);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('image_quality');
      expect(['auto', 'low', 'medium', 'high', 'xhigh', 'max']).toContain(json.data.image_quality);
    });

    test('validates quality values on save', async ({ request }) => {
      const validResponse = await request.put(`${apiBase()}/api/settings`, {
        data: { image_quality: 'max' },
      });
      expect(validResponse.ok()).toBe(true);

      const invalidResponse = await request.put(`${apiBase()}/api/settings`, {
        data: { image_quality: 'ultra' },
      });
      expect(invalidResponse.ok()).toBe(false);

      await request.put(`${apiBase()}/api/settings`, { data: { image_quality: 'auto' } });
    });

    test('resets the quality tier back to auto', async ({ request }) => {
      const setResponse = await request.put(`${apiBase()}/api/settings`, {
        data: { image_quality: 'xhigh' },
      });
      expect(setResponse.ok()).toBe(true);

      const beforeReset = await request.get(`${apiBase()}/api/settings`);
      expect((await beforeReset.json()).data.image_quality).toBe('xhigh');

      const resetResponse = await request.post(`${apiBase()}/api/settings/reset`);
      expect(resetResponse.ok()).toBe(true);

      const afterReset = await request.get(`${apiBase()}/api/settings`);
      expect((await afterReset.json()).data.image_quality).toBe('auto');
    });
  });
});
