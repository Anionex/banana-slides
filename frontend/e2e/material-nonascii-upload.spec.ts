import { test, expect } from '@playwright/test'

const PNG_1X1_RED = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8zwACTGCSAQANHQEDgslx/wAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('Material upload filenames (#426)', () => {
  test('uploads a PNG whose original filename contains Chinese characters', async ({ request }) => {
    const uploadResp = await request.post('/api/materials/upload', {
      multipart: {
        file: {
          name: '正文.png',
          mimeType: 'image/png',
          buffer: PNG_1X1_RED,
        },
      },
    })

    if (!uploadResp.ok()) {
      const body = await uploadResp.text()
      expect(uploadResp.status(), body).toBe(201)
    }

    const material = (await uploadResp.json()).data
    expect(material.original_filename).toBe('正文.png')
    expect(material.filename).toMatch(/^[0-9a-f]{32}\.png$/)
    expect(material.relative_path).toBe(`materials/${material.filename}`)
    expect(material.url).toBe(`/files/materials/${material.filename}`)

    const fileResp = await request.get(material.url)
    expect(fileResp.ok()).toBe(true)
    expect(fileResp.headers()['content-type']).toContain('image/png')
  })
})
