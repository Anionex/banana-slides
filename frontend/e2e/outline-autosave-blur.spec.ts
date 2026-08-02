import { test, expect } from '@playwright/test'

const PROJECT_ID = 'mock-autosave-project'

const mockProject = {
  project_id: PROJECT_ID,
  status: 'OUTLINE_GENERATED',
  idea_prompt: 'Original idea text',
  creation_type: 'idea',
  pages: [
    {
      page_id: 'page-1',
      order_index: 0,
      outline_content: { title: 'Page One', points: ['Point A'] },
      status: 'DRAFT',
    },
  ],
  created_at: '2025-01-01T00:00:00',
  updated_at: '2025-01-01T00:00:00',
}

// Mock test: verify blur triggers save API call
test.describe('Outline auto-save on blur (mock)', () => {
  test('saves input text when textarea loses focus', async ({ page }) => {
    let savePayload: { idea_prompt?: string } | null = null

    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() === 'PUT') {
        savePayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...mockProject, idea_prompt: savePayload?.idea_prompt } }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject }),
        })
      }
    })

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    // Find the contenteditable editor in the left panel (desktop)
    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible()

    // Type new text
    await editor.click()
    await editor.pressSequentially(' updated content')

    // Blur by clicking outside
    await page.locator('header').first().click()

    // Wait for the save API call
    await expect.poll(() => savePayload, { timeout: 5000 }).not.toBeNull()
    expect(savePayload).toHaveProperty('idea_prompt')
    expect(savePayload.idea_prompt).toContain('updated content')
  })

  test('does not save when content is unchanged', async ({ page }) => {
    let putCalled = false

    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() === 'PUT') {
        putCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject }),
        })
      }
    })

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    // Click editor then blur without changing content
    const editor = page.locator('[contenteditable="true"]').first()
    await editor.click()
    await page.locator('header').first().click()

    // Verify no save is triggered after blur
    await expect.poll(() => putCalled, { timeout: 2000 }).toBe(false)
  })
})

// Integration test: verify data persists after blur
test.describe('Outline auto-save on blur (integration)', () => {
  let projectId: string

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/projects', {
      data: { idea_prompt: 'Integration test idea', creation_type: 'idea' },
    })
    const body = await res.json()
    projectId = body.data.project_id
  })

  test('persists edited text after blur and page reload', async ({ page }) => {
    await page.goto(`/project/${projectId}/outline`)
    await page.waitForLoadState('networkidle')

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible()

    // Edit the text
    await editor.click()
    await page.keyboard.press('End')
    await editor.pressSequentially(' - auto saved')

    // Blur to trigger save and wait for the PUT request to complete
    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/projects/${projectId}`) && resp.request().method() === 'PUT'
    )
    await page.locator('header').first().click()
    await savePromise

    // Reload and verify text persisted
    await page.reload()
    await page.waitForLoadState('networkidle')

    const editorAfter = page.locator('[contenteditable="true"]').first()
    await expect(editorAfter).toContainText('auto saved', { timeout: 5000 })
  })
})
