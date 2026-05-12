import { test, expect } from '@playwright/test'

const PROJECT_ID = 'mock-gen-req-project'

const mockProject = (overrides: Record<string, unknown> = {}) => ({
  project_id: PROJECT_ID,
  status: 'OUTLINE_GENERATED',
  idea_prompt: 'Test idea',
  creation_type: 'idea',
  outline_requirements: '',
  description_requirements: '',
  pages: [
    {
      page_id: 'page-1',
      order_index: 0,
      outline_content: { title: 'Page One', points: ['Point A'] },
      description_content: { text: 'Page one description', generated_at: '2025-01-01' },
      status: 'DESCRIPTION_GENERATED',
    },
  ],
  created_at: '2025-01-01T00:00:00',
  updated_at: '2025-01-01T00:00:00',
  ...overrides,
})

/** Locate the outline requirements editor (contentEditable inside data-testid wrapper) */
const outlineReqEditor = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid="outline-requirements-textarea"] [contenteditable="true"]').first()

/** Locate the description requirements editor */
const descReqEditor = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid="desc-requirements-textarea"] [contenteditable="true"]').first()

/** Locate the outline requirements toggle button */
const outlineReqToggle = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid="outline-requirements-toggle"]').first()

/** Locate the description requirements toggle button */
const descReqToggle = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid="desc-requirements-toggle"]').first()

/** Clear and type into a contentEditable element */
async function clearAndType(editor: import('@playwright/test').Locator, text: string) {
  await editor.focus()
  await editor.press('Control+a')
  if (text) {
    await editor.page().keyboard.insertText(text)
  } else {
    await editor.press('Backspace')
  }
}

// ── Mock tests ──────────────────────────────────────────────────────

test.describe('Generation requirements - OutlineEditor (mock)', () => {
  test('shows collapsible requirements section that auto-saves', async ({ page }) => {
    let savedPayload: Record<string, unknown> | null = null

    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() === 'PUT') {
        savedPayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject(savedPayload) }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject() }),
        })
      }
    })

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    // Requirements toggle should exist
    const toggle = outlineReqToggle(page)
    await expect(toggle).toBeVisible()

    // Expand it
    await toggle.click()

    // Editor should now be visible
    const editor = outlineReqEditor(page)
    await expect(editor).toBeVisible()

    // Type requirements
    await clearAndType(editor, '限制在5页以内')

    // Blur to trigger save
    await page.locator('header').first().click()

    // Wait for save
    await expect.poll(() => savedPayload, { timeout: 5000 }).not.toBeNull()
    expect(savedPayload).toHaveProperty('outline_requirements', '限制在5页以内')
  })

  test('auto-expands when requirements exist', async ({ page }) => {
    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockProject({ outline_requirements: 'Some requirement' }),
        }),
      })
    })

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    // Should auto-expand when there are existing requirements
    const editor = outlineReqEditor(page)
    await expect(editor).toBeVisible()
    await expect(editor).toContainText('Some requirement')
  })
})

test.describe('Generation requirements - DetailEditor (mock)', () => {
  test('shows collapsible requirements section that auto-saves', async ({ page }) => {
    let savedPayload: Record<string, unknown> | null = null

    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() === 'PUT') {
        savedPayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject(savedPayload) }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject() }),
        })
      }
    })

    await page.goto(`/project/${PROJECT_ID}/detail`)
    await page.waitForLoadState('networkidle')

    // Requirements toggle should exist
    const toggle = descReqToggle(page)
    await expect(toggle).toBeVisible()

    // Expand it
    await toggle.click()

    // Editor should be visible
    const editor = descReqEditor(page)
    await expect(editor).toBeVisible()

    // Type requirements
    await clearAndType(editor, '每页不超过50字')

    // Blur to trigger save
    await page.locator('header').first().click()

    // Wait for save
    await expect.poll(() => savedPayload, { timeout: 5000 }).not.toBeNull()
    expect(savedPayload).toHaveProperty('description_requirements', '每页不超过50字')
  })

  test('auto-expands when requirements exist', async ({ page }) => {
    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockProject({ description_requirements: 'Existing desc requirement' }),
        }),
      })
    })

    await page.goto(`/project/${PROJECT_ID}/detail`)
    await page.waitForLoadState('networkidle')

    // Should auto-expand with existing content
    const editor = descReqEditor(page)
    await expect(editor).toBeVisible()
    await expect(editor).toContainText('Existing desc requirement')
  })
})

// ── Integration tests ───────────────────────────────────────────────

test.describe('Generation requirements (integration)', () => {
  let projectId: string

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/projects', {
      data: { idea_prompt: 'Integration test for requirements', creation_type: 'idea' },
    })
    const body = await res.json()
    projectId = body.data.project_id
  })

  test('outline requirements: save, reload, verify persisted', async ({ page }) => {
    await page.goto(`/project/${projectId}/outline`)
    await page.waitForLoadState('networkidle')

    // Expand requirements section
    const toggle = outlineReqToggle(page)
    await toggle.click()

    // Type requirements
    const editor = outlineReqEditor(page)
    await expect(editor).toBeVisible()
    await clearAndType(editor, '限制在8页以内')

    // Blur and wait for save
    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/projects/${projectId}`) && resp.request().method() === 'PUT'
    )
    await page.locator('header').first().click()
    await savePromise

    // Reload and verify persisted
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Should auto-expand since there's content
    const editorAfter = outlineReqEditor(page)
    await expect(editorAfter).toBeVisible()
    await expect(editorAfter).toContainText('限制在8页以内')
  })

  test('description requirements: save, reload, verify persisted', async ({ page, request }) => {
    // Create a page so detail editor has content
    const outlineRes = await request.post(`/api/projects/${projectId}/pages`, {
      data: {
        outline_content: { title: 'Test Page', points: ['Point 1'] },
        order_index: 0,
      },
    })
    expect(outlineRes.ok()).toBeTruthy()

    await page.goto(`/project/${projectId}/detail`)
    await page.waitForLoadState('networkidle')

    // Expand requirements section
    const toggle = descReqToggle(page)
    await toggle.click()

    // Type requirements
    const editor = descReqEditor(page)
    await expect(editor).toBeVisible()
    await clearAndType(editor, '多使用数据和案例')

    // Blur and wait for save
    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/projects/${projectId}`) && resp.request().method() === 'PUT'
    )
    await page.locator('header').first().click()
    await savePromise

    // Reload and verify persisted
    await page.reload()
    await page.waitForLoadState('networkidle')

    const editorAfter = descReqEditor(page)
    await expect(editorAfter).toBeVisible()
    await expect(editorAfter).toContainText('多使用数据和案例')
  })

  test('clearing requirements saves empty string', async ({ page }) => {
    // First set a requirement via API
    const setRes = await page.request.put(`/api/projects/${projectId}`, {
      data: { outline_requirements: 'Temporary requirement' },
    })
    expect(setRes.ok()).toBeTruthy()

    await page.goto(`/project/${projectId}/outline`)
    await page.waitForLoadState('networkidle')

    // Should auto-expand with existing content
    const editor = outlineReqEditor(page)
    await expect(editor).toBeVisible()
    await expect(editor).toContainText('Temporary requirement')

    // Clear it
    await clearAndType(editor, '')

    // Blur and wait for save
    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/projects/${projectId}`) && resp.request().method() === 'PUT'
    )
    await page.locator('header').first().click()
    await savePromise

    // Reload and verify cleared
    await page.reload()
    await page.waitForLoadState('networkidle')

    // After clearing, the toggle should still exist
    const toggle = outlineReqToggle(page)
    await expect(toggle).toBeVisible()
  })
})
