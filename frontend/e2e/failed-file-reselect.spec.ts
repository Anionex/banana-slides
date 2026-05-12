/**
 * E2E test: Failed files can be re-selected in selector and re-parsed from card
 */
import { test, expect } from '@playwright/test'

test.use({ baseURL: process.env.BASE_URL || 'http://localhost:3000' })

const FILE_FAILED = 'file-failed-001'
const FILE_COMPLETED = 'file-completed-002'

const mockFileList = () => ({
  success: true,
  data: {
    files: [
      { id: FILE_FAILED, filename: 'broken.pdf', file_size: 1000, file_type: 'application/pdf', parse_status: 'failed', error_message: 'MinerU timeout' },
      { id: FILE_COMPLETED, filename: 'good.pdf', file_size: 2000, file_type: 'application/pdf', parse_status: 'completed' },
    ]
  }
})

const mockSettings = () => ({
  success: true,
  data: { ai_provider_format: 'gemini', google_api_key: 'fake' }
})

test.describe('Failed file re-selection (mocked)', () => {
  test.setTimeout(60_000)

  test('selecting a failed file in selector triggers re-parse on confirm', async ({ page }) => {
    let parseCalled = false

    await page.route('**/api/settings', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) }))
    await page.route('**/api/reference-files/project/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockFileList()) }))
    await page.route(`**/api/reference-files/${FILE_FAILED}/parse`, r => {
      parseCalled = true
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { file: { id: FILE_FAILED, filename: 'broken.pdf', file_size: 1000, file_type: 'application/pdf', parse_status: 'parsing' }, message: 'ok' } }) })
    })

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto('/')

    // Click paperclip button to open file selector
    const paperclip = page.locator('button[title]').filter({ has: page.locator('svg.lucide-paperclip') })
    await paperclip.click()

    // Wait for file selector modal (by title)
    const modal = page.getByRole('dialog', { name: '选择参考文件' })
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Click the failed file row to select it
    await modal.locator('text=broken.pdf').first().click()

    // Click confirm button
    await modal.getByRole('button', { name: /确定/ }).click()

    // Verify parse was triggered for the failed file
    expect(parseCalled).toBe(true)
  })

  test('failed file card shows reparse button', async ({ page }) => {
    const PROJECT_ID = 'mock-proj-reparse'
    let parseCalled = false

    await page.route('**/api/settings', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) }))
    await page.route(`**/api/projects/${PROJECT_ID}`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true,
      data: {
        id: PROJECT_ID, project_id: PROJECT_ID, title: 'Test', status: 'OUTLINE_GENERATED', creation_type: 'idea',
        pages: [{ id: 'p1', page_id: 'p1', title: 'Page 1', order_index: 0, outline_content: { title: 'Page 1', points: ['p'] } }],
        reference_files: [{ id: FILE_FAILED, filename: 'broken.pdf', file_size: 1000, file_type: 'application/pdf', parse_status: 'failed', error_message: 'MinerU timeout' }]
      }
    }) }))
    await page.route(`**/api/projects/${PROJECT_ID}/pages`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { pages: [] } }) }))
    await page.route(`**/api/reference-files/project/${PROJECT_ID}`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { files: [{ id: FILE_FAILED, filename: 'broken.pdf', file_size: 1000, file_type: 'application/pdf', parse_status: 'failed', error_message: 'MinerU timeout' }] } }) }))
    await page.route(`**/api/reference-files/${FILE_FAILED}`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { file: { id: FILE_FAILED, filename: 'broken.pdf', file_size: 1000, file_type: 'application/pdf', parse_status: 'failed', error_message: 'MinerU timeout' } } }) }))
    await page.route(`**/api/reference-files/${FILE_FAILED}/parse`, r => {
      parseCalled = true
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { file: { id: FILE_FAILED, filename: 'broken.pdf', file_size: 1000, file_type: 'application/pdf', parse_status: 'parsing' }, message: 'ok' } }) })
    })

    await page.goto(`/project/${PROJECT_ID}/outline`)

    // Find the failed file card
    const card = page.locator('text=broken.pdf').first()
    await card.waitFor({ state: 'visible', timeout: 10_000 })

    // The reparse button (RefreshCw icon) should be visible on the card
    const cardContainer = card.locator('xpath=ancestor::div[contains(@class,"w-72")]')
    const reparseBtn = cardContainer.locator('button').filter({ has: page.locator('svg.lucide-refresh-cw') })
    await expect(reparseBtn).toBeVisible({ timeout: 3_000 })

    // Click reparse
    await reparseBtn.click()
    expect(parseCalled).toBe(true)
  })
})
