/**
 * E2E tests for PDF export with author metadata
 */

import { test, expect } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

test.describe('PDF Export - Backend API', () => {
  test('exports PDF with author metadata', async ({ request, baseURL }) => {
    const { projectId } = await seedProjectWithImages(baseURL!, 2)

    const resp = await request.get(`/api/projects/${projectId}/export/pdf`)
    expect(resp.ok()).toBe(true)
    const data = (await resp.json()).data
    expect(data.download_url).toContain('.pdf')

    // Verify the PDF is downloadable
    const fileResp = await request.get(data.download_url)
    expect(fileResp.ok()).toBe(true)
    expect(fileResp.headers()['content-type']).toContain('application/pdf')

    // Verify PDF has content (non-zero size)
    const pdfBuffer = await fileResp.body()
    expect(pdfBuffer.length).toBeGreaterThan(1000)

    // Verify PDF contains metadata (check for "banana-slides" in PDF content)
    const pdfContent = pdfBuffer.toString('utf-8')
    expect(pdfContent).toContain('banana-slides')
  })
})
