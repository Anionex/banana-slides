/**
 * PPT Renovation Aspect Ratio - Integration E2E Test
 *
 * Verifies that PPT renovation projects preserve the original PDF's
 * aspect ratio instead of always defaulting to 16:9.
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const API = `http://localhost:${Number(new URL(BASE).port) + 2000}`

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe.serial('Renovation aspect ratio', () => {
  test.setTimeout(60_000)

  const createdProjects: string[] = []

  test.afterAll(async ({ request }) => {
    for (const id of createdProjects) {
      try {
        await request.delete(`${API}/api/projects/${id}`)
      } catch { /* best effort */ }
    }
  })

  test('4:3 PDF gets 4:3 aspect ratio on project', async ({ request }) => {
    const pdfPath = path.join(__dirname, 'fixtures', 'test-4-3.pdf')
    const pdfBuffer = fs.readFileSync(pdfPath)

    const res = await request.post(`${API}/api/projects/renovation`, {
      multipart: {
        file: {
          name: 'test-4-3.pdf',
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        },
      },
    })
    expect(res.ok()).toBeTruthy()

    const body = await res.json()
    const projectId = body.data.project_id
    createdProjects.push(projectId)

    // Fetch the project to check its aspect ratio
    const projRes = await request.get(`${API}/api/projects/${projectId}`)
    expect(projRes.ok()).toBeTruthy()

    const projData = await projRes.json()
    expect(projData.data.image_aspect_ratio).toBe('4:3')
  })

  test('16:9 PDF gets 16:9 aspect ratio on project', async ({ request }) => {
    const pdfPath = path.join(__dirname, 'fixtures', 'test-16-9.pdf')
    const pdfBuffer = fs.readFileSync(pdfPath)

    const res = await request.post(`${API}/api/projects/renovation`, {
      multipart: {
        file: {
          name: 'test-16-9.pdf',
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        },
      },
    })
    expect(res.ok()).toBeTruthy()

    const body = await res.json()
    const projectId = body.data.project_id
    createdProjects.push(projectId)

    // Fetch the project to check its aspect ratio
    const projRes = await request.get(`${API}/api/projects/${projectId}`)
    expect(projRes.ok()).toBeTruthy()

    const projData = await projRes.json()
    expect(projData.data.image_aspect_ratio).toBe('16:9')
  })

  test('aspect ratio reflected in SlidePreview UI', async ({ page, request }) => {
    // Upload a 4:3 PDF
    const pdfPath = path.join(__dirname, 'fixtures', 'test-4-3.pdf')
    const pdfBuffer = fs.readFileSync(pdfPath)

    const res = await request.post(`${API}/api/projects/renovation`, {
      multipart: {
        file: {
          name: 'test-4-3.pdf',
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        },
      },
    })
    expect(res.ok()).toBeTruthy()

    const body = await res.json()
    const projectId = body.data.project_id
    createdProjects.push(projectId)

    // Navigate to SlidePreview
    await page.goto(`/project/${projectId}/preview`)
    await page.waitForLoadState('networkidle')

    // Open project settings
    const settingsBtn = page.locator('button').filter({ hasText: /设置|Settings/ }).first()
    await settingsBtn.click()

    // The 4:3 button should be the active/selected one (has border-banana-500 class)
    const ratioButton = page.locator('button:has-text("4:3")').first()
    await expect(ratioButton).toBeVisible()
    await expect(ratioButton).toHaveClass(/border-banana-500/)
  })
})
