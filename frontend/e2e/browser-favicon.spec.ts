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

  const dimensions = await page.evaluate(async (src) => {
    const image = new Image()
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to decode favicon'))
    })
    image.src = src
    await loaded
    return { width: image.naturalWidth, height: image.naturalHeight }
  }, faviconUrl)

  expect(dimensions).toEqual({ width: 64, height: 64 })
})
