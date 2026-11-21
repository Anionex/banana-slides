import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import { downloadPptx } from './helpers/download-pptx'
import { seedProjectWithImages } from './helpers/seed-project'

test('downloads a real PPTX from seeded images without an AI request', async ({
  page, request, baseURL,
}, testInfo) => {
  const { projectId } = await seedProjectWithImages(baseURL!, 2)
  try {
    await page.goto(`/project/${projectId}/preview`)
    const download = await downloadPptx(page)
    expect(download.suggestedFilename()).toMatch(/\.pptx$/i)

    const output = testInfo.outputPath('seeded-export.pptx')
    await download.saveAs(output)
    expect(await download.failure()).toBeNull()
    const bytes = fs.readFileSync(output)
    expect(bytes.length).toBeGreaterThan(1000)
    // PPTX is a ZIP archive; verify actual downloaded bytes, not just HTTP 200.
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  } finally {
    const response = await request.delete(`/api/projects/${projectId}`)
    expect(response.ok()).toBeTruthy()
  }
})
