/**
 * Export Aspect Ratio - Integration E2E Test
 *
 * Verifies that PDF and PPTX exports use the project's aspect ratio
 * instead of hardcoding 16:9.
 */
import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
// Derive backend URL from frontend URL (frontend 3xxx → backend 5xxx, same offset)
const API = `http://localhost:${Number(new URL(BASE).port) + 2000}`

// Minimal 1x1 red PNG (68 bytes)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
)

// Worktree root (two levels up from frontend/e2e/)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKTREE_ROOT = path.resolve(__dirname, '..', '..')
const UPLOADS_DIR = path.join(WORKTREE_ROOT, 'uploads')
const DB_PATH = path.join(WORKTREE_ROOT, 'backend', 'instance', 'database.db')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUUID(val: string, label: string) {
  if (!UUID_RE.test(val)) throw new Error(`Invalid ${label}: ${val}`)
}

interface ProjectData {
  projectId: string
  pageId: string
  imagePath: string
}

async function setupProject(
  request: any,
  aspectRatio: string
): Promise<ProjectData> {
  // Create project
  const projRes = await request.post(`${API}/api/projects`, {
    data: {
      creation_type: 'idea',
      idea_prompt: 'test export aspect ratio',
      image_aspect_ratio: aspectRatio,
    },
  })
  expect(projRes.ok()).toBeTruthy()
  const proj = await projRes.json()
  const projectId = proj.data.project_id

  // Create page
  const pageRes = await request.post(`${API}/api/projects/${projectId}/pages`, {
    data: { order_index: 0 },
  })
  expect(pageRes.ok()).toBeTruthy()
  const page = await pageRes.json()
  const pageId = page.data.page_id

  // Place test image on disk
  const pagesDir = path.join(UPLOADS_DIR, projectId, 'pages')
  fs.mkdirSync(pagesDir, { recursive: true })
  const imgFile = `test_${pageId}.png`
  const imgAbsPath = path.join(pagesDir, imgFile)
  fs.writeFileSync(imgAbsPath, TINY_PNG)

  // Update DB to set generated_image_path (validate UUIDs to prevent injection)
  assertUUID(projectId, 'projectId')
  assertUUID(pageId, 'pageId')
  const relPath = `${projectId}/pages/${imgFile}`
  execSync(
    `sqlite3 "${DB_PATH}" "UPDATE pages SET generated_image_path='${relPath}', status='IMAGE_GENERATED' WHERE id='${pageId}';"`
  )

  return { projectId, pageId, imagePath: imgAbsPath }
}

function cleanup(projectId: string) {
  assertUUID(projectId, 'projectId')
  const dir = path.join(UPLOADS_DIR, projectId)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  try {
    execSync(
      `sqlite3 "${DB_PATH}" "DELETE FROM pages WHERE project_id='${projectId}'; DELETE FROM projects WHERE id='${projectId}';"`
    )
  } catch { /* best effort */ }
}

test.describe.serial('Export aspect ratio', () => {
  test.setTimeout(30_000)

  const createdProjects: string[] = []

  test.afterAll(async () => {
    for (const id of createdProjects) cleanup(id)
  })

  test('PDF export uses 4:3 page dimensions', async ({ request }) => {
    const { projectId } = await setupProject(request, '4:3')
    createdProjects.push(projectId)

    const res = await request.get(
      `${API}/api/projects/${projectId}/export/pdf`
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const downloadUrl = body.data.download_url_absolute

    // Download the PDF
    const pdfRes = await request.get(downloadUrl)
    expect(pdfRes.ok()).toBeTruthy()
    const pdfBuf = Buffer.from(await pdfRes.body())

    // Parse PDF MediaBox to verify aspect ratio
    // MediaBox format: [0 0 width height] in points (1 inch = 72 pt)
    const pdfStr = pdfBuf.toString('latin1')
    const match = pdfStr.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/)
    expect(match).not.toBeNull()

    const pdfW = parseFloat(match![3])
    const pdfH = parseFloat(match![4])
    const ratio = pdfW / pdfH

    // 4:3 = 1.333...
    expect(ratio).toBeCloseTo(4 / 3, 1)
    // Should NOT be 16:9 (1.778)
    expect(Math.abs(ratio - 16 / 9)).toBeGreaterThan(0.1)
  })

  test('PPTX export uses 4:3 slide dimensions', async ({ request }) => {
    const { projectId } = await setupProject(request, '4:3')
    createdProjects.push(projectId)

    const res = await request.get(
      `${API}/api/projects/${projectId}/export/pptx`
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const downloadUrl = body.data.download_url_absolute

    // Extract slide dimensions from PPTX (ZIP containing XML)
    // The download_url is like /files/{id}/exports/file.pptx
    const pptxPath = path.join(UPLOADS_DIR, body.data.download_url.replace('/files/', ''))
    if (!pptxPath.startsWith(UPLOADS_DIR)) throw new Error('Invalid pptx path')
    const xml = execSync(`unzip -p "${pptxPath}" ppt/presentation.xml`).toString()
    const sldSzMatch = xml.match(/sldSz\s+cx="(\d+)"\s+cy="(\d+)"/)
    expect(sldSzMatch).not.toBeNull()

    const cx = parseInt(sldSzMatch![1])
    const cy = parseInt(sldSzMatch![2])
    const ratio = cx / cy

    // 4:3 = 1.333...
    expect(ratio).toBeCloseTo(4 / 3, 1)
    expect(Math.abs(ratio - 16 / 9)).toBeGreaterThan(0.1)
  })
})
