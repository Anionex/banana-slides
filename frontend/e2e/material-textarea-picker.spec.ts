import { test, expect } from '@playwright/test'

const PROJECT_ID = 'mock-material-picker-project'

const mockProject = {
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
}

const mockMaterials = [
  {
    id: 'mat-1',
    project_id: null,
    filename: 'test_image_1.png',
    original_filename: 'sunset.png',
    url: '/files/materials/test_image_1.png',
    relative_path: 'materials/test_image_1.png',
    created_at: '2025-01-01T00:00:00',
  },
  {
    id: 'mat-2',
    project_id: null,
    filename: 'test_image_2.jpg',
    original_filename: 'mountain.jpg',
    url: '/files/materials/test_image_2.jpg',
    relative_path: 'materials/test_image_2.jpg',
    created_at: '2025-01-01T00:00:00',
  },
]

/** Setup common route mocks for material library */
async function setupMaterialMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/materials*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { materials: mockMaterials } }),
    })
  })
  await page.route('**/api/projects?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { projects: [], total: 0 } }),
    })
  })
}

// ── Mock tests: Upload button dropdown on Home page ──────────────────

test.describe('MarkdownTextarea upload dropdown - Home (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.route('**/api/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      })
    })
    await page.route('**/api/user-templates*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { templates: [] } }),
      })
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('upload button shows dropdown with two options', async ({ page }) => {
    const imageBtn = page.locator('[title="上传图片"], [title="Upload image"]').first()
    await expect(imageBtn).toBeVisible()

    await imageBtn.click()

    // Dropdown should appear with two options
    await expect(page.getByText(/Local upload|本地上传/)).toBeVisible()
    await expect(page.getByText(/Select from library|从素材库选择/)).toBeVisible()
  })

  test('clicking outside closes the dropdown', async ({ page }) => {
    const imageBtn = page.locator('[title="上传图片"], [title="Upload image"]').first()
    await imageBtn.click()
    await expect(page.getByText(/Local upload|本地上传/)).toBeVisible()

    // Click on the backdrop to dismiss
    await page.locator('.fixed.inset-0').first().click()
    await expect(page.getByText(/Local upload|本地上传/)).not.toBeVisible()
  })

  test('"Select from library" opens MaterialSelector modal', async ({ page }) => {
    await setupMaterialMocks(page)

    const imageBtn = page.locator('[title="上传图片"], [title="Upload image"]').first()
    await imageBtn.click()
    await page.getByText(/Select from library|从素材库选择/).click()

    // MaterialSelector modal should appear
    await expect(page.getByText(/Select Material|选择素材/)).toBeVisible()

    // Materials should be displayed in the modal's grid (max-h-96 distinguishes it)
    const materialGrid = page.locator('.grid.grid-cols-4.max-h-96')
    await expect(materialGrid).toBeVisible()
    await expect(materialGrid.locator('> div')).toHaveCount(2)
  })

  test('selecting material inserts image chip into textarea', async ({ page }) => {
    await setupMaterialMocks(page)

    // Open dropdown → library
    const imageBtn = page.locator('[title="上传图片"], [title="Upload image"]').first()
    await imageBtn.click()
    await page.getByText(/Select from library|从素材库选择/).click()

    // Wait for modal and select first material
    const materialGrid = page.locator('.grid.grid-cols-4.max-h-96')
    await expect(materialGrid).toBeVisible()
    await materialGrid.locator('> div').first().click()

    // Confirm selection
    await page.getByRole('button', { name: /Confirm|确认/ }).click()

    // Modal should close
    await expect(page.getByText(/Select Material|选择素材/).first()).not.toBeVisible()

    // Check the editor has the image chip (sunset.png = original_filename of mat-1)
    const chip = page.locator('[contenteditable="true"]').first().locator('.md-chip')
    await expect(chip).toBeVisible()
    await expect(chip).toContainText('sunset')
  })
})

// ── Mock tests: Upload button dropdown on OutlineEditor ──────────────

test.describe('MarkdownTextarea upload dropdown - OutlineEditor (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockProject }),
      })
    })
    await page.route('**/api/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      })
    })
    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForLoadState('networkidle')
  })

  test('outline card edit mode shows upload dropdown with library option', async ({ page }) => {
    // Find the outline card's edit button (p-1.5 text-gray-500 with Edit2 icon)
    // The card contains "Page One" title text
    // Use the edit button that is inside the flex-shrink-0 container
    const editBtn = page.locator('.flex-shrink-0.flex.gap-2 button').first()
    await editBtn.click()

    // Now in edit mode - MarkdownTextarea should be visible
    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible()

    // Click the upload/image button
    const imageBtn = page.locator('[title="上传图片"], [title="Upload image"]').first()
    await imageBtn.click()

    // Dropdown menu should appear (positioned above the button)
    const dropdownMenu = page.locator('.absolute.bottom-full')
    await expect(dropdownMenu).toBeVisible()
    await expect(dropdownMenu.getByText(/Local upload|本地上传/)).toBeVisible()
    await expect(dropdownMenu.getByText(/Select from library|从素材库选择/)).toBeVisible()
  })
})
