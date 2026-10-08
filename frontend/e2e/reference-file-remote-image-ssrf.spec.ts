import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'

test.use({ baseURL: process.env.BASE_URL || 'http://localhost:3011' })

test('uploaded Markdown preserves remote images without fetching them', async ({ page }) => {
  const canaryPort = Number(process.env.SSRF_CANARY_PORT || '55956')
  const imagePayload = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DAwMDAxMDAwAAAFQABfRYpWQAAAABJRU5ErkJggg==',
    'base64',
  )
  const remoteRequests: string[] = []
  const canary = createServer((request, response) => {
    remoteRequests.push(`${request.method} ${request.url}`)
    if (request.method === 'GET') {
      response.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': imagePayload.length,
      })
      response.end(imagePayload)
      return
    }

    const completion = JSON.stringify({
      id: 'chatcmpl-ssrf-regression',
      object: 'chat.completion',
      created: 0,
      model: 'test-caption',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: '远程图片' },
        finish_reason: 'stop',
      }],
    })
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(completion),
    })
    response.end(completion)
  })

  await new Promise<void>((resolve, reject) => {
    canary.once('error', reject)
    canary.listen(canaryPort, '127.0.0.1', resolve)
  })

  try {
    const remoteImageUrl = `http://127.0.0.1:${canaryPort}/latest/meta-data`
    const markdown = `# SSRF regression\n\n![](${remoteImageUrl})\n`
    let uploadedFileId = ''
    let parseSeen = false

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/api/reference-files/upload') && response.request().method() === 'POST') {
        const body = await response.json()
        uploadedFileId = body.data.file.id
      }
      if (/\/api\/reference-files\/[^/]+\/parse$/.test(url) && response.request().method() === 'POST') {
        parseSeen = true
      }
    })

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto('/')

    const editor = page.getByRole('textbox').first()
    await expect(editor).toBeVisible({ timeout: 10_000 })
    await editor.evaluate((element, content) => {
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(new File([content], 'ssrf-regression.md', { type: 'text/markdown' }))
      element.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }))
    }, markdown)

    await expect.poll(() => uploadedFileId, { timeout: 15_000 }).not.toBe('')
    await expect.poll(() => parseSeen, { timeout: 15_000 }).toBe(true)

    let parsedFile: { parse_status: string; markdown_content?: string } | undefined
    await expect.poll(async () => {
      const response = await page.request.get(`/api/reference-files/${uploadedFileId}`)
      expect(response.ok()).toBeTruthy()
      parsedFile = (await response.json()).data.file
      return parsedFile?.parse_status
    }, { timeout: 15_000 }).toBe('completed')

    expect(parsedFile?.markdown_content).toBe(markdown)
    expect(remoteRequests).toEqual([])
    await expect(page.getByText('ssrf-regression.md').first()).toBeVisible()
  } finally {
    await new Promise<void>((resolve) => canary.close(() => resolve()))
  }
})
