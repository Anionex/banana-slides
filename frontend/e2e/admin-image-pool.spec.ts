import { test, expect, Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3003'
const ADMIN_EMAIL = 'admin@bananaslides.online'
const ADMIN_PASSWORD = 'ydw20040928Z#admin'

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app/)
}

test.describe('Image Provider Pool - UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('renders pool section and supports add/remove channels', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/config`)
    const poolSection = page.locator('[data-testid="image-pool-section"]')
    await expect(poolSection).toBeVisible()

    // Count existing channels via remove buttons
    const removeButtons = poolSection.locator('button[aria-label="Remove channel"]')
    const initialCount = await removeButtons.count()

    // Add channel and verify count increased
    await page.getByRole('button', { name: 'Add Channel' }).click()
    await expect(removeButtons).toHaveCount(initialCount + 1)

    // Add second channel
    await page.getByRole('button', { name: 'Add Channel' }).click()
    await expect(removeButtons).toHaveCount(initialCount + 2)

    // Remove last added channel
    await removeButtons.last().click()
    await expect(removeButtons).toHaveCount(initialCount + 1)

    // Remove remaining added channel
    await removeButtons.last().click()
    await expect(removeButtons).toHaveCount(initialCount)
  })
})

test.describe('Image Provider Pool - Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('save channels and verify persistence on reload', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/config`)
    await page.waitForSelector('[data-testid="image-pool-section"]')

    // Add a channel
    await page.getByRole('button', { name: 'Add Channel' }).click()
    const poolSection = page.locator('[data-testid="image-pool-section"]')
    const card = poolSection.locator('.border.rounded-lg').first()
    const inputs = card.locator('input')

    // name, model, api_key, api_base
    await inputs.nth(0).fill('E2E Test Channel')
    await inputs.nth(1).fill('test-model-v1')
    await inputs.nth(2).fill('test-api-key-12345')
    await inputs.nth(3).fill('https://test.example.com/v1')

    // Save
    await page.getByRole('button', { name: 'Save Configuration' }).click()
    await page.waitForTimeout(1500)

    // Reload and verify persistence
    await page.reload()
    await page.waitForSelector('[data-testid="image-pool-section"]')

    const reloadedCard = page.locator('[data-testid="image-pool-section"] .border.rounded-lg').first()
    await expect(reloadedCard).toBeVisible()

    // Verify name persisted
    const nameVal = await reloadedCard.locator('input').nth(0).inputValue()
    expect(nameVal).toBe('E2E Test Channel')

    // Verify model persisted
    const modelVal = await reloadedCard.locator('input').nth(1).inputValue()
    expect(modelVal).toBe('test-model-v1')

    // Clean up: remove channel and save
    await reloadedCard.locator('button[aria-label="Remove channel"]').click()
    await page.getByRole('button', { name: 'Save Configuration' }).click()
    await page.waitForTimeout(1500)

    // Verify cleanup
    await page.reload()
    await page.waitForSelector('[data-testid="image-pool-section"]')
    const remaining = page.locator('[data-testid="image-pool-section"] .border.rounded-lg')
    await expect(remaining).toHaveCount(0)
  })
})
