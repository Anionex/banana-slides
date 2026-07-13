import { expect, test } from '@playwright/test'

test('browser tab uses the Banana Slides logo favicon', async ({ page }) => {
  await page.goto('/')

  const favicon = page.locator('link[rel="icon"][href="/favicon.png"]')
  await expect(favicon).toHaveCount(1)
  await expect(favicon).toHaveAttribute('type', 'image/png')
  await expect(favicon).toHaveAttribute('sizes', '64x64')
  await expect(favicon).toHaveAttribute('href', '/favicon.png')

  const response = await page.request.get('/favicon.png')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/png')

  const buffer = await response.body()
  expect(buffer.length).toBeGreaterThanOrEqual(24)
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(buffer.readUInt32BE(16)).toBe(64)
  expect(buffer.readUInt32BE(20)).toBe(64)

  const visibleBounds = await page.evaluate(async (pngBytes) => {
    const blob = new Blob([new Uint8Array(pngBytes)], { type: 'image/png' })
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    if (canvas.width === 0 || canvas.height === 0) {
      bitmap.close()
      return { width: 0, height: 0 }
    }
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is unavailable')
    context.drawImage(bitmap, 0, 0)
    bitmap.close()

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let minX = canvas.width
    let maxX = -1
    let minY = canvas.height
    let maxY = -1

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 10) continue
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }

    if (maxX === -1 || maxY === -1) return { width: 0, height: 0 }
    return { width: maxX - minX + 1, height: maxY - minY + 1 }
  }, Array.from(buffer))

  expect(visibleBounds.width).toBe(64)
  expect(visibleBounds.height).toBeGreaterThanOrEqual(54)
})
