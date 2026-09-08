import type { Page } from '@playwright/test';

export const publicProvider = (page: Page, id: string) =>
  page.getByRole('radiogroup', { name: 'API 提供商', exact: true }).locator(`[data-provider="${id}"]`);
