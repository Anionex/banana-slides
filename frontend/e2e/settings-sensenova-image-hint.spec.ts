/**
 * E2E tests for the SenseNova image-source guidance shown in Settings.
 */
import { test, expect } from '@playwright/test'

test.describe('Settings: SenseNova image guidance', () => {
  test('real backend keeps the SenseNova image source and shows the guidance hint', async ({ page, request }) => {
    const getResponse = await request.get('/api/settings')
    const body = await getResponse.json()
    const previousImageSource = body?.data?.image_model_source

    const putResponse = await request.put('/api/settings', {
      data: { image_model_source: 'sensenova' },
    })
    expect(putResponse.ok()).toBeTruthy()

    try {
      await page.goto('/settings')
      await expect(page.getByTestId('image_model_source-select')).toHaveValue('sensenova')
      await expect(page.getByTestId('sensenova-image-model-hint')).toContainText(
        'https://token.sensenova.cn/v1',
      )
    } finally {
      const restoreResponse = await request.put('/api/settings', {
        data: { image_model_source: previousImageSource ?? '' },
      })
      expect(restoreResponse.ok()).toBeTruthy()
    }
  })

  test('selecting the global SenseNova provider shows the guidance hint', async ({ page }) => {
    await page.goto('/settings')

    const providerPills = page.getByTestId('global-provider-pills')
    await providerPills.locator('[data-provider="sensenova"]').click()

    await expect(page.getByTestId('sensenova-global-image-hint')).toContainText(
      'https://token.sensenova.cn/v1',
    )
  })
})
