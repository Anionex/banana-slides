/**
 * Shared helper to create projects with fake images for E2E testing.
 * Bypasses AI image generation by placing fake PNGs on disk + updating DB directly.
 */
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import type { APIRequestContext } from '@playwright/test'

// Derive project root from cwd (Playwright runs from frontend/)
const PROJECT_ROOT = path.resolve(process.cwd(), '..')
const DB_PATH = path.join(PROJECT_ROOT, 'backend', 'instance', 'database.db')
const UPLOADS = path.join(PROJECT_ROOT, 'uploads')

function sql(query: string) {
  execSync(`sqlite3 -cmd ".timeout 5000" "${DB_PATH}" "${query.replace(/"/g, '\\"')}"`)
}

/** Minimal valid 1x1 PNG */
function fakePng(): Buffer {
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c4944415478016360f8cf00000002000160e7274a00000000' +
    '0049454e44ae426082',
    'hex'
  )
}

export interface SeededProject {
  projectId: string
  pageIds: string[]
}

/**
 * Create a project with N pages, each having a fake PNG image on disk.
 */
export async function seedProjectWithImages(
  request: APIRequestContext,
  pageCount = 1
): Promise<SeededProject> {
  // 1. Create project
  const createResp = await request.post('/api/projects', {
    data: { creation_type: 'idea', idea_prompt: 'e2e test', template_style: 'default' },
  })
  const projectId = (await createResp.json()).data?.project_id

  // 2. Create pages and place images
  const pageIds: string[] = []
  const pagesDir = path.join(UPLOADS, projectId, 'pages')
  fs.mkdirSync(pagesDir, { recursive: true })

  for (let i = 0; i < pageCount; i++) {
    const pageResp = await request.post(`/api/projects/${projectId}/pages`, {
      data: { order_index: i, outline_content: { title: `Slide ${i + 1}` } },
    })
    const pageId = (await pageResp.json()).data?.page_id
    pageIds.push(pageId)

    // Place fake PNG and update DB
    const rel = `${projectId}/pages/${pageId}_v1.png`
    fs.writeFileSync(path.join(UPLOADS, rel), fakePng())
    sql(`UPDATE pages SET generated_image_path='${rel}', status='COMPLETED' WHERE id='${pageId}'`)
  }

  return { projectId, pageIds }
}
