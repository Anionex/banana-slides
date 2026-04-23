/**
 * E2E tests for template_image_style auto-extraction.
 *
 * Mock tests: verify that template_image_style displays in ProjectSettingsModal.
 * Integration test: verify real backend stores template_image_style on upload.
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

const MOCK_STYLE = '视觉描述：简约商务风格\n\n配色与材质：深蓝背景(#0B1F3B)\n\n内容与排版：无衬线字体\n\n渲染要求：矢量风格'

const PROJECT_ID = 'mock-tis'

const baseMockProject = {
  project_id: PROJECT_ID,
  status: 'COMPLETED',
  idea_prompt: 'test',
  image_aspect_ratio: '16:9',
  template_style: '',
  created_at: '2025-01-01T00:00:00',
  updated_at: '2025-01-01T00:00:00',
  pages: [
    {
      page_id: 'p1',
      order_index: 0,
      outline_content: { title: 'Page 1', points: ['Point'] },
      description_content: { text: 'desc' },
      generated_image_url: null,
      status: 'COMPLETED',
    },
  ],
}

function mockProject(page: any, overrides: Record<string, any> = {}) {
  return page.route('**/api/projects/' + PROJECT_ID, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { ...baseMockProject, ...overrides },
      }),
    })
  })
}

test.describe('Template image style - Mock tests', () => {
  test('should display template_image_style in project settings modal', async ({ page }) => {
    await mockProject(page, { template_image_style: MOCK_STYLE })
    await page.goto(`/project/${PROJECT_ID}/preview`)
    await page.waitForLoadState('networkidle')

    // Open project settings modal
    const settingsBtn = page.locator('button').filter({ hasText: /设置|Settings/ }).first()
    await settingsBtn.click()

    // Verify template_image_style section and content are displayed
    await expect(page.getByText(/模板图片风格|Template Image Style/)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('视觉描述：简约商务风格')).toBeVisible()
  })

  test('should NOT show template image style section when field is empty', async ({ page }) => {
    await mockProject(page, { template_image_style: null })
    await page.goto(`/project/${PROJECT_ID}/preview`)
    await page.waitForLoadState('networkidle')

    const settingsBtn = page.locator('button').filter({ hasText: /设置|Settings/ }).first()
    await settingsBtn.click()

    // The template image style section should NOT be visible
    await expect(page.getByText(/模板图片风格|Template Image Style/)).not.toBeVisible({ timeout: 3000 })
  })

  test('template upload should return template_image_style in response', async ({ page }) => {
    let uploadCalled = false

    await page.route('**/api/projects/' + PROJECT_ID, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { ...baseMockProject, template_image_style: uploadCalled ? MOCK_STYLE : null },
        }),
      })
    })

    await page.route(`**/api/projects/${PROJECT_ID}/template`, async (route: any) => {
      uploadCalled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            template_image_url: '/files/mock/template/t.png',
            template_image_style: MOCK_STYLE,
          },
        }),
      })
    })

    await page.goto(`/project/${PROJECT_ID}/preview`)
    await page.waitForLoadState('networkidle')

    // Click "Change Template" button
    const changeBtn = page.locator('button').filter({ hasText: /更换模板|Change Template/ }).first()
    await changeBtn.click()

    // Upload a template via the file input in the template modal
    const fileInput = page.locator('.fixed input[type="file"][accept="image/*"]').first()
    await fileInput.setInputFiles({ name: 'template.png', mimeType: 'image/png', buffer: TINY_PNG })

    // Wait for upload to complete
    await expect(page.getByText(/模板更换成功|Template changed/)).toBeVisible({ timeout: 10000 })
    expect(uploadCalled).toBe(true)

    // Open settings to verify style is now shown
    const settingsBtn = page.locator('button').filter({ hasText: /设置|Settings/ }).first()
    await settingsBtn.click()
    await expect(page.getByText(/模板图片风格|Template Image Style/)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Template image style - Integration tests', () => {
  test('template upload stores template_image_style on project', async ({ page }) => {
    // Create a project via API
    const apiBase = BASE_URL.replace(/:\d+$/, ':' + (parseInt(BASE_URL.split(':').pop()!) + 2000))
    const createRes = await page.request.post(`${apiBase}/api/projects`, {
      data: { creation_type: 'idea', idea_prompt: 'template style test' },
    })
    const createData = await createRes.json()
    const projectId = createData.data?.project_id
    expect(projectId).toBeTruthy()

    // Upload template image
    const uploadRes = await page.request.post(`${apiBase}/api/projects/${projectId}/template`, {
      multipart: {
        template_image: { name: 'template.png', mimeType: 'image/png', buffer: TINY_PNG },
      },
    })
    const uploadData = await uploadRes.json()
    expect(uploadRes.ok()).toBe(true)
    // template_image_style may be null if AI service is unavailable, but the field should exist
    expect('template_image_style' in uploadData.data).toBe(true)

    // Verify project GET includes the field
    const getRes = await page.request.get(`${apiBase}/api/projects/${projectId}`)
    const getData = await getRes.json()
    expect('template_image_style' in getData.data).toBe(true)

    // Cleanup
    await page.request.delete(`${apiBase}/api/projects/${projectId}`)
  })
})
