/**
 * E2E test: Clicking a parsing attachment shows toast instead of preview modal
 */
import { test, expect } from '@playwright/test'

test.use({ baseURL: process.env.BASE_URL || 'http://localhost:3000' })

const PROJECT_ID = 'mock-proj-parse'
const FILE_PARSING = 'file-parsing-001'
const FILE_COMPLETED = 'file-completed-002'

const mockSettings = () => ({
  success: true,
  data: { ai_provider_format: 'gemini', google_api_key: 'fake' }
})

const mockProject = () => ({
  success: true,
  data: {
    id: PROJECT_ID, project_id: PROJECT_ID, title: 'Test',
    status: 'OUTLINE_GENERATED', creation_type: 'idea',
    pages: [{ id: 'p1', page_id: 'p1', title: 'Page 1', order_index: 0, outline_content: { title: 'Page 1', points: ['p'] } }]
  }
})

const mockFiles = () => ({
  success: true,
  data: {
    files: [
      { id: FILE_PARSING, filename: 'parsing-doc.pdf', file_size: 1000, file_type: 'application/pdf', parse_status: 'parsing' },
      { id: FILE_COMPLETED, filename: 'done-doc.pdf', file_size: 2000, file_type: 'application/pdf', parse_status: 'completed' },
    ]
  }
})

test.describe('Parsing attachment preview toast (mocked)', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/settings', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) }))
    await page.route(`**/api/projects/${PROJECT_ID}`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProject()) }))
    await page.route(`**/api/projects/${PROJECT_ID}/pages`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { pages: [] } }) }))
    await page.route(`**/api/reference-files/project/${PROJECT_ID}`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockFiles()) }))
    await page.route(`**/api/reference-files/${FILE_COMPLETED}`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { file: { id: FILE_COMPLETED, filename: 'done-doc.pdf', file_size: 2000, file_type: 'application/pdf', parse_status: 'completed', markdown_content: '# Done' } } }) }))
  })

  test('clicking parsing file shows toast, not preview modal', async ({ page }) => {
    let parsingFileFetched = false
    await page.route(`**/api/reference-files/${FILE_PARSING}`, async r => {
      parsingFileFetched = true
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { file: { id: FILE_PARSING, filename: 'parsing-doc.pdf', file_size: 1000, file_type: 'application/pdf', parse_status: 'parsing', markdown_content: null } } }) })
    })

    await page.goto(`/project/${PROJECT_ID}/outline`)

    const parsingCard = page.locator('text=parsing-doc.pdf').first()
    await parsingCard.waitFor({ state: 'visible', timeout: 10_000 })
    await parsingCard.click()

    const toast = page.locator('text=解析完成后可预览').or(page.locator('text=Preview available after parsing'))
    await expect(toast.first()).toBeVisible({ timeout: 3_000 })

    expect(parsingFileFetched).toBe(false)
  })

  test('clicking completed file still opens preview modal', async ({ page }) => {
    await page.goto(`/project/${PROJECT_ID}/outline`)

    const completedCard = page.locator('text=done-doc.pdf').first()
    await completedCard.waitFor({ state: 'visible', timeout: 10_000 })
    await completedCard.click()

    const modal = page.locator('[role="dialog"]').last()
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await expect(modal.locator('.prose h1')).toBeVisible({ timeout: 3_000 })
  })
})
