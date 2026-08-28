import { test, expect, type Page } from '@playwright/test';

const providerPill = (page: Page) =>
  page.getByTestId('global-provider-pills').locator('[data-provider="apimart"]');

test.describe('Settings: APIMart provider integration (real backend)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(30_000);

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/settings');
    await page.getByRole('button', { name: /重置|Reset/ }).click();
    await page.getByRole('button', { name: /确定重置|Confirm/ }).click();
    await expect(page.locator('text=设置已重置').or(page.locator('text=reset successfully')))
      .toBeVisible({ timeout: 5000 });
    await page.close();
  });

  test('save and reload APIMart configuration', async ({ page }) => {
    await page.goto('/settings');
    await providerPill(page).click();

    const apiSection = page.getByTestId('global-api-config-section');
    await apiSection.locator('input[type="password"]').fill('apimart-integration-test-key');
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('text=保存成功').or(page.locator('text=saved')))
      .toBeVisible({ timeout: 5000 });

    const response = await page.request.get('/api/settings');
    const payload = await response.json();
    expect(payload.data.ai_provider_format).toBe('apimart');
    expect(payload.data.api_base_url).toBe('https://api.apimart.ai/v1');
    expect(payload.data.text_model).toBe('gpt-5');
    expect(payload.data.image_model).toBe('gpt-image-2');
    expect(payload.data.image_caption_model).toBe('gpt-4o');
    expect(payload.data.text_model_source).toBe('');
    expect(payload.data.image_model_source).toBe('');
    expect(payload.data.image_caption_model_source).toBe('');
    expect(payload.data.api_key_length).toBe('apimart-integration-test-key'.length);

    await page.reload();
    await expect(providerPill(page)).toHaveAttribute('aria-checked', 'true');
    await expect(apiSection.locator('input').first()).toHaveValue('https://api.apimart.ai/v1');
  });

  test('switching provider without a new key clears the previous provider credential', async ({ page }) => {
    await page.goto('/settings');
    await page.getByTestId('global-provider-pills').locator('[data-provider="gemini"]').click();
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('text=保存成功').or(page.locator('text=saved')))
      .toBeVisible({ timeout: 5000 });

    const response = await page.request.get('/api/settings');
    const payload = await response.json();
    expect(payload.data.ai_provider_format).toBe('gemini');
    expect(payload.data.api_key_length).not.toBe('apimart-integration-test-key'.length);
  });
});
