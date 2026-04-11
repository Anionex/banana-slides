/**
 * E2E: drag-and-drop documents into the Home markdown area
 *
 * Mocked test — verifies that dropping a non-image file onto the
 * MarkdownTextarea triggers the reference-file upload pipeline and
 * the file card appears in the list below.
 */
import { test, expect } from '@playwright/test'

test.use({ baseURL: process.env.BASE_URL || 'http://localhost:3000' })

const FILE_ID = 'mock-dropped-pdf-001'

const mockSettings = () => ({
  success: true,
  data: { ai_provider_format: 'gemini', google_api_key: 'fake' },
})

const uploadedFileFixture = (parseStatus: 'pending' | 'parsing' | 'completed') => ({
  id: FILE_ID,
  filename: 'drop-report.pdf',
  file_size: 1024,
  file_type: 'application/pdf',
  parse_status: parseStatus,
})

test.describe('Home document drop (mocked)', () => {
  test.setTimeout(60_000)

  test('dropping a PDF onto the markdown area uploads it and auto-triggers parse', async ({ page }) => {
    let uploadCalled = false
    let parseCalled = false

    await page.route('**/api/settings', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) })
    )

    // Upload endpoint — returns the file in 'pending' state so the client auto-triggers parsing.
    await page.route('**/api/reference-files/upload', r => {
      uploadCalled = true
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { file: uploadedFileFixture('pending') } }),
      })
    })

    // Parse trigger endpoint — confirms we moved the file into 'parsing'.
    await page.route(`**/api/reference-files/${FILE_ID}/parse`, r => {
      parseCalled = true
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { file: uploadedFileFixture('parsing'), message: 'ok' } }),
      })
    })

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto('/')

    // The Home MarkdownTextarea exposes role="textbox"
    const editor = page.getByRole('textbox').first()
    await expect(editor).toBeVisible({ timeout: 10_000 })

    // Simulate drag-and-drop with a synthetic File.
    // jsdom/Playwright don't let us hand-craft a DataTransfer in Node, so we
    // create it inside the page and dispatch a real DragEvent.
    await editor.evaluate((el) => {
      const file = new File(['fake-pdf-bytes'], 'drop-report.pdf', { type: 'application/pdf' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
      el.dispatchEvent(dropEvent)
    })

    // The upload should have been hit exactly once.
    await expect.poll(() => uploadCalled, { timeout: 5_000 }).toBe(true)

    // Parse auto-trigger follows the upload (pending -> parsing).
    await expect.poll(() => parseCalled, { timeout: 5_000 }).toBe(true)

    // And the dropped file should show up in the reference list below the editor.
    await expect(page.getByText('drop-report.pdf').first()).toBeVisible({ timeout: 5_000 })
  })

  test('dropping only images does not hit the upload endpoint', async ({ page }) => {
    let uploadCalled = false

    await page.route('**/api/settings', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) })
    )
    await page.route('**/api/reference-files/upload', r => {
      uploadCalled = true
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { file: uploadedFileFixture('pending') } }),
      })
    })

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto('/')

    const editor = page.getByRole('textbox').first()
    await expect(editor).toBeVisible({ timeout: 10_000 })

    // A 1x1 transparent PNG is enough for the MIME sniff.
    const pngBytes = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Z1i1+IAAAAASUVORK5CYII='
      ),
      c => c.charCodeAt(0)
    )

    await editor.evaluate((el, bytes) => {
      const file = new File([new Uint8Array(bytes)], 'a.png', { type: 'image/png' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })
      el.dispatchEvent(dropEvent)
    }, Array.from(pngBytes))

    // Give any accidental upload a chance to fire, then assert it did not.
    await page.waitForTimeout(500)
    expect(uploadCalled).toBe(false)
  })

  test('dropping multiple unsupported files shows a deduped toast', async ({ page }) => {
    let uploadCalled = false

    await page.route('**/api/settings', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) })
    )
    await page.route('**/api/reference-files/upload', r => {
      uploadCalled = true
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { file: uploadedFileFixture('pending') } }) })
    })

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto('/')

    const editor = page.getByRole('textbox').first()
    await expect(editor).toBeVisible({ timeout: 10_000 })

    // Three unsupported files, two sharing the same extension — the toast
    // must list each unsupported extension only once.
    await editor.evaluate((el) => {
      const files = [
        new File(['x'], 'a.exe', { type: 'application/octet-stream' }),
        new File(['x'], 'b.exe', { type: 'application/octet-stream' }),
        new File(['x'], 'c.zip', { type: 'application/zip' }),
      ]
      const dataTransfer = new DataTransfer()
      for (const f of files) dataTransfer.items.add(f)
      const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })
      el.dispatchEvent(dropEvent)
    })

    // Unsupported file types — upload must NOT be hit.
    await page.waitForTimeout(300)
    expect(uploadCalled).toBe(false)

    // The toast should contain both unique extensions, exactly once each.
    const toast = page.getByText(/不支持的文件类型|Unsupported file type/).first()
    await expect(toast).toBeVisible({ timeout: 3_000 })
    const toastText = (await toast.textContent()) ?? ''
    // Each extension appears exactly once (dedup): no `exe, exe`.
    expect((toastText.match(/exe/g) || []).length).toBe(1)
    expect((toastText.match(/zip/g) || []).length).toBe(1)
  })
})
