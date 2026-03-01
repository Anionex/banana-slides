import { test, expect } from '@playwright/test'

const PROJECT_ID = 'mock-preset-project'

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

// ── Mock tests: Outline presets ──────────────────────────────────────

test.describe('Preset capsules - OutlineEditor (mock)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage presets before each test
    await page.addInitScript(() => {
      localStorage.removeItem('presetCapsules_outline')
      localStorage.setItem('outlineReqOpen', 'true')
    })

    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() === 'PUT') {
        const data = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject(data) }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject() }),
        })
      }
    })
  })

  test('displays system presets as capsules', async ({ page }) => {
    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    const presets = page.locator('[data-testid="outline-presets"]')
    await expect(presets).toBeVisible()

    // Should have 3 system presets
    await expect(page.locator('[data-testid="outline-system-preset-0"]')).toBeVisible()
    await expect(page.locator('[data-testid="outline-system-preset-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="outline-system-preset-2"]')).toBeVisible()

    // Should have an add button
    await expect(page.locator('[data-testid="outline-add-preset"]')).toBeVisible()
  })

  test('clicking system preset appends content to textarea', async ({ page }) => {
    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('[data-testid="outline-requirements-textarea"]')
    await expect(textarea).toBeVisible()

    // Click first system preset
    await page.locator('[data-testid="outline-system-preset-0"]').click()

    // Textarea should now contain the preset content
    const value = await textarea.inputValue()
    expect(value.length).toBeGreaterThan(0)

    // Click second preset — should append with newline
    await page.locator('[data-testid="outline-system-preset-1"]').click()
    const value2 = await textarea.inputValue()
    expect(value2).toContain('\n')
    expect(value2.split('\n').length).toBe(2)
  })

  test('system presets show tooltip with content on hover', async ({ page }) => {
    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    const preset = page.locator('[data-testid="outline-system-preset-0"]')
    const title = await preset.getAttribute('title')
    expect(title).toBeTruthy()
    expect(title!.length).toBeGreaterThan(0)
  })

  test('can add custom preset', async ({ page }) => {
    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    // Click add button
    await page.locator('[data-testid="outline-add-preset"]').click()

    // Fill in name and content
    await page.locator('[data-testid="outline-preset-name-input"]').fill('我的预设')
    await page.locator('[data-testid="outline-preset-content-input"]').fill('自定义提示词内容')

    // Confirm
    await page.locator('[data-testid="outline-preset-confirm"]').click()

    // Should now show the user preset
    const userPreset = page.locator('[data-testid="outline-user-preset-0"]')
    await expect(userPreset).toBeVisible()
    await expect(userPreset).toContainText('我的预设')

    // Should have delete button
    await expect(page.locator('[data-testid="outline-delete-preset-0"]')).toBeVisible()
  })

  test('clicking custom preset appends content', async ({ page }) => {
    // Pre-seed a custom preset
    await page.addInitScript(() => {
      localStorage.setItem('presetCapsules_outline', JSON.stringify([
        { name: '测试预设', content: '测试提示词' }
      ]))
    })

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('[data-testid="outline-requirements-textarea"]')

    // Click user preset
    const userPreset = page.locator('[data-testid="outline-user-preset-0"]')
    await expect(userPreset).toBeVisible()
    await userPreset.locator('button').first().click()

    await expect(textarea).toHaveValue('测试提示词')
  })

  test('can delete custom preset', async ({ page }) => {
    // Pre-seed a custom preset
    await page.addInitScript(() => {
      localStorage.setItem('presetCapsules_outline', JSON.stringify([
        { name: '待删除', content: '内容' }
      ]))
    })

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    // Verify it exists
    await expect(page.locator('[data-testid="outline-user-preset-0"]')).toBeVisible()

    // Delete it
    await page.locator('[data-testid="outline-delete-preset-0"]').click()

    // Should be gone
    await expect(page.locator('[data-testid="outline-user-preset-0"]')).not.toBeVisible()
  })

  test('can cancel adding preset with Escape', async ({ page }) => {
    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    // Click add
    await page.locator('[data-testid="outline-add-preset"]').click()
    await expect(page.locator('[data-testid="outline-preset-name-input"]')).toBeVisible()

    // Press Escape
    await page.locator('[data-testid="outline-preset-name-input"]').press('Escape')

    // Form should disappear, add button should be back
    await expect(page.locator('[data-testid="outline-preset-name-input"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="outline-add-preset"]')).toBeVisible()
  })

  test('add button is disabled when fields are empty', async ({ page }) => {
    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')

    await page.locator('[data-testid="outline-add-preset"]').click()

    const confirmBtn = page.locator('[data-testid="outline-preset-confirm"]')
    await expect(confirmBtn).toBeDisabled()

    // Fill only name
    await page.locator('[data-testid="outline-preset-name-input"]').fill('名称')
    await expect(confirmBtn).toBeDisabled()

    // Fill content too
    await page.locator('[data-testid="outline-preset-content-input"]').fill('内容')
    await expect(confirmBtn).toBeEnabled()
  })
})

// ── Mock tests: Description presets ──────────────────────────────────

test.describe('Preset capsules - DetailEditor (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('presetCapsules_description')
      localStorage.setItem('descReqOpen', 'true')
    })

    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() === 'PUT') {
        const data = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject(data) }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockProject() }),
        })
      }
    })
  })

  test('displays description system presets', async ({ page }) => {
    await page.goto(`/project/${PROJECT_ID}/detail`)
    await page.waitForLoadState('networkidle')

    const presets = page.locator('[data-testid="description-presets"]')
    await expect(presets).toBeVisible()

    await expect(page.locator('[data-testid="description-system-preset-0"]')).toBeVisible()
    await expect(page.locator('[data-testid="description-system-preset-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="description-system-preset-2"]')).toBeVisible()
  })

  test('clicking description preset appends to textarea', async ({ page }) => {
    await page.goto(`/project/${PROJECT_ID}/detail`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('[data-testid="desc-requirements-textarea"]')
    await expect(textarea).toBeVisible()

    // Click first system preset
    await page.locator('[data-testid="description-system-preset-0"]').click()
    const value = await textarea.inputValue()
    expect(value.length).toBeGreaterThan(0)
  })

  test('description custom presets are independent from outline presets', async ({ page }) => {
    // Seed outline presets (should NOT appear in description)
    await page.addInitScript(() => {
      localStorage.setItem('presetCapsules_outline', JSON.stringify([
        { name: '大纲预设', content: '大纲内容' }
      ]))
      localStorage.setItem('presetCapsules_description', JSON.stringify([
        { name: '描述预设', content: '描述内容' }
      ]))
    })

    await page.goto(`/project/${PROJECT_ID}/detail`)
    await page.waitForLoadState('networkidle')

    // Only description user preset should be visible
    const descPreset = page.locator('[data-testid="description-user-preset-0"]')
    await expect(descPreset).toBeVisible()
    await expect(descPreset).toContainText('描述预设')

    // Outline user preset should not appear here
    await expect(page.locator('text=大纲预设')).not.toBeVisible()
  })
})

// ── Integration tests ────────────────────────────────────────────────

test.describe('Preset capsules (integration)', () => {
  let projectId: string

  test.beforeEach(async ({ request, page }) => {
    const res = await request.post('/api/projects', {
      data: { idea_prompt: 'Preset integration test', creation_type: 'idea' },
    })
    const body = await res.json()
    projectId = body.data.project_id

    // Use goto + evaluate instead of addInitScript so it only runs once
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('presetCapsules_outline')
      localStorage.removeItem('presetCapsules_description')
      localStorage.setItem('outlineReqOpen', 'true')
    })
  })

  test('system preset click appends to outline requirements and saves', async ({ page }) => {
    await page.goto(`/project/${projectId}/outline`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('[data-testid="outline-requirements-textarea"]')
    await expect(textarea).toBeVisible()

    // Click a system preset
    await page.locator('[data-testid="outline-system-preset-0"]').click()

    // Should have content now
    const value = await textarea.inputValue()
    expect(value.length).toBeGreaterThan(0)

    // Wait for auto-save
    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/projects/${projectId}`) && resp.request().method() === 'PUT'
    )
    // Trigger save by blurring
    await page.locator('header').first().click()
    await savePromise

    // Reload and verify persisted
    await page.reload()
    await page.waitForLoadState('networkidle')

    const textareaAfter = page.locator('[data-testid="outline-requirements-textarea"]')
    await expect(textareaAfter).toBeVisible()
    const persistedValue = await textareaAfter.inputValue()
    expect(persistedValue).toBe(value)
  })

  test('custom presets persist in localStorage across page navigations', async ({ page }) => {
    await page.goto(`/project/${projectId}/outline`)
    await page.waitForLoadState('networkidle')

    // Add a custom preset
    await page.locator('[data-testid="outline-add-preset"]').click()
    await page.locator('[data-testid="outline-preset-name-input"]').fill('集成测试预设')
    await page.locator('[data-testid="outline-preset-content-input"]').fill('集成测试内容')
    await page.locator('[data-testid="outline-preset-confirm"]').click()

    await expect(page.locator('[data-testid="outline-user-preset-0"]')).toBeVisible()

    // Navigate away and back
    await page.goto(`/project/${projectId}/outline`)
    await page.waitForLoadState('networkidle')

    // Custom preset should still be there
    const userPreset = page.locator('[data-testid="outline-user-preset-0"]')
    await expect(userPreset).toBeVisible()
    await expect(userPreset).toContainText('集成测试预设')
  })
})
