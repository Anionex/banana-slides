/**
 * E2E tests for image export feature.
 *
 * 1. Backend API tests: error case + happy path (single & multi-image export)
 * 2. Mock UI tests: verify the export menu renders the image export option
 */

import { test, expect } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

test.describe('Export Images - Backend API', () => {
  test('returns 400 when project has no images', async ({ request }) => {
    // Create a project
    const createResp = await request.post('/api/projects', {
      data: { creation_type: 'idea', idea_prompt: 'test', template_style: 'default' },
    })
    if (!createResp.ok()) { test.skip(true, 'Backend unavailable'); return }

    const projectId = (await createResp.json()).data?.project_id
    if (!projectId) { test.skip(true, 'No project_id'); return }

    const resp = await request.get(`/api/projects/${projectId}/export/images`)
    expect(resp.ok()).toBe(false)
    expect(resp.status()).toBe(400)
  })

  test('exports single image successfully', async ({ request, baseURL }) => {
    const { projectId } = await seedProjectWithImages(baseURL!, 1)

    const resp = await request.get(`/api/projects/${projectId}/export/images`)
    expect(resp.ok()).toBe(true)
    const data = (await resp.json()).data
    expect(data.download_url).toContain(`/files/${projectId}/exports/`)
    expect(data.download_url).toContain('.jpg')

    // Verify the file is downloadable
    const fileResp = await request.get(data.download_url)
    expect(fileResp.ok()).toBe(true)
    expect(fileResp.headers()['content-type']).toContain('image/jpeg')
  })

  test('exports multiple images as ZIP', async ({ request, baseURL }) => {
    const { projectId } = await seedProjectWithImages(baseURL!, 2)

    const resp = await request.get(`/api/projects/${projectId}/export/images`)
    expect(resp.ok()).toBe(true)
    const data = (await resp.json()).data
    expect(data.download_url).toContain('.zip')

    // Verify the ZIP is downloadable
    const fileResp = await request.get(data.download_url)
    expect(fileResp.ok()).toBe(true)
  })
})

test.describe('Export Images - UI Mock', () => {
  test.setTimeout(60_000)

  test('export dropdown contains image export option', async ({ page }) => {
    const PID = 'mock-img-export'

    // Intercept API requests (use function matcher to avoid catching Vite source files like /src/api/...)
    await page.route(url => new URL(url).pathname.startsWith('/api/'), async (route) => {
      const url = new URL(route.request().url())

      if (url.pathname === `/api/projects/${PID}`) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: PID, id: PID, status: 'IMAGES_GENERATED',
              template_style: 'default',
              pages: [
                { id: 'p1', page_id: 'p1', title: 'Slide 1', order_index: 0, generated_image_path: '/files/x/1.png', page_number: 1, outline_content: { title: 'Slide 1' }, status: 'COMPLETED' },
              ],
            },
          }),
        })
      }

      if (url.pathname === '/api/settings') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
      }
      if (url.pathname === '/api/output-language') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { language: 'zh' } }) })
      }
      if (url.pathname === '/api/user-templates') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { templates: [] } }) })
      }

      // Default: 200 empty
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
    })

    // Mock image files
    await page.route('**/files/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(100) })
    })

    await page.goto(`/project/${PID}/preview`)

    // Wait for page content to render (the preview title or page count text)
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 })

    // Find and click the export button using text content
    const exportBtn = page.locator('button:has-text("导出")').first()
    await expect(exportBtn).toBeVisible({ timeout: 10000 })
    await exportBtn.click()

    // Verify image export option appears in the dropdown
    const imgExportBtn = page.locator('button:has-text("导出为图片")')
    await expect(imgExportBtn).toBeVisible({ timeout: 5000 })
  })

  test('image export calls correct API endpoint', async ({ page }) => {
    const PID = 'mock-img-export2'
    let imageExportCalled = false

    await page.route(url => new URL(url).pathname.startsWith('/api/'), async (route) => {
      const url = new URL(route.request().url())

      if (url.pathname === `/api/projects/${PID}/export/images`) {
        imageExportCalled = true
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { download_url: '/files/x/slides.zip', download_url_absolute: 'http://localhost/files/x/slides.zip' } }),
        })
      }

      if (url.pathname === `/api/projects/${PID}`) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: PID, id: PID, status: 'IMAGES_GENERATED',
              template_style: 'default',
              pages: [
                { id: 'p1', page_id: 'p1', title: 'S1', order_index: 0, generated_image_path: '/files/x/1.png', page_number: 1, outline_content: { title: 'S1' }, status: 'COMPLETED' },
              ],
            },
          }),
        })
      }

      if (url.pathname === '/api/settings') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
      }
      if (url.pathname === '/api/output-language') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { language: 'zh' } }) })
      }
      if (url.pathname === '/api/user-templates') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { templates: [] } }) })
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
    })

    await page.route('**/files/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(100) })
    })

    await page.goto(`/project/${PID}/preview`)
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 })

    await page.locator('button:has-text("导出")').first().click()
    await page.locator('button:has-text("导出为图片")').click()

    await expect.poll(() => imageExportCalled).toBe(true)
  })
})
