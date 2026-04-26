/**
 * E2E integration: drag-and-drop documents into the Home markdown area
 *
 * Real backend — uploads an actual small PDF fixture by synthesizing a
 * drop event on the MarkdownTextarea, then verifies:
 *  1. POST /api/reference-files/upload was called
 *  2. POST /api/reference-files/{id}/parse was called (auto-trigger)
 *  3. The dropped file card appears in the reference list below the editor
 *
 * This covers the complete real data path: MarkdownTextarea onDocumentFiles →
 * Home.handleDocumentFiles → handleFileUpload → uploadReferenceFile API →
 * triggerFileParse API → setReferenceFiles → ReferenceFileList render.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.use({ baseURL: process.env.BASE_URL || 'http://localhost:3000' })

test.describe('Home document drop (real backend)', () => {
  test.setTimeout(60_000)

  test('dropping a small PDF uploads it and the file card appears in the list', async ({ page }) => {
    // Load a tiny local PDF fixture and hand it to the page as a byte array.
    const fixturePath = path.resolve(__dirname, 'fixtures/test-4-3.pdf')
    const pdfBytes = Array.from(fs.readFileSync(fixturePath))

    let uploadSeen = false
    let parseSeen = false
    page.on('response', async (res) => {
      const url = res.url()
      if (url.includes('/api/reference-files/upload') && res.request().method() === 'POST') {
        uploadSeen = true
      }
      if (/\/api\/reference-files\/[^/]+\/parse$/.test(url) && res.request().method() === 'POST') {
        parseSeen = true
      }
    })

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto('/')

    const editor = page.getByRole('textbox').first()
    await expect(editor).toBeVisible({ timeout: 10_000 })

    // Synthesize a real DragEvent with a DataTransfer carrying our File.
    await editor.evaluate((el, bytes: number[]) => {
      const file = new File([new Uint8Array(bytes)], 'integration-drop.pdf', {
        type: 'application/pdf',
      })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
      el.dispatchEvent(dropEvent)
    }, pdfBytes)

    // The real upload should land within a few seconds.
    await expect.poll(() => uploadSeen, { timeout: 15_000, message: 'upload endpoint not hit' }).toBe(true)

    // Auto-triggered parse call should follow.
    await expect.poll(() => parseSeen, { timeout: 15_000, message: 'parse endpoint not hit' }).toBe(true)

    // The file card should appear in the reference list below the editor.
    await expect(page.getByText('integration-drop.pdf').first()).toBeVisible({ timeout: 10_000 })
  })
})
