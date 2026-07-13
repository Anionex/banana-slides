import { expect, test } from '@playwright/test'

test('browser tab uses the Banana Slides logo favicon', async ({ page }) => {
  await page.goto('/')

  const favicon = page.locator('link[rel="icon"]')
  await expect(favicon).toHaveAttribute('type', 'image/png')
  await expect(favicon).toHaveAttribute('sizes', '64x64')
  await expect(favicon).toHaveAttribute('href', '/favicon.png')

  const faviconUrl = new URL('/favicon.png', page.url()).toString()
  const response = await page.request.get(faviconUrl)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/png')

  const buffer = await response.body()
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(buffer.readUInt32BE(16)).toBe(64)
  expect(buffer.readUInt32BE(20)).toBe(64)
})
