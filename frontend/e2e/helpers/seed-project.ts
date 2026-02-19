/**
 * Shared helper to create projects with real images for E2E testing.
 * Bypasses AI image generation by placing fixture images on disk + updating DB directly.
 */
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import type { APIRequestContext } from '@playwright/test'

// Derive project root from cwd (Playwright runs from frontend/)
const PROJECT_ROOT = path.resolve(process.cwd(), '..')
const DB_PATH = path.join(PROJECT_ROOT, 'backend', 'instance', 'database.db')
const UPLOADS = path.join(PROJECT_ROOT, 'uploads')
const FIXTURES = path.join(process.cwd(), 'e2e', 'fixtures')

function sql(query: string) {
  execSync(`sqlite3 -cmd ".timeout 5000" "${DB_PATH}" "${query.replace(/"/g, '\\"')}"`)
}

/** Get fixture image path (cycles through slide_1.jpg, slide_2.jpg, slide_3.jpg) */
function getFixtureImage(index: number): string {
  const num = (index % 3) + 1
  return path.join(FIXTURES, `slide_${num}.jpg`)
}

export interface SeededProject {
  projectId: string
  pageIds: string[]
}

/**
 * Create a project with N pages, each having a real image on disk.
 */
export async function seedProjectWithImages(
  request: APIRequestContext,
  pageCount = 1
): Promise<SeededProject> {
  const createResp = await request.post('/api/projects', {
    data: { creation_type: 'idea', idea_prompt: 'e2e test', template_style: 'default' },
  })
  const projectId = (await createResp.json()).data?.project_id

  const pageIds: string[] = []
  const pagesDir = path.join(UPLOADS, projectId, 'pages')
  fs.mkdirSync(pagesDir, { recursive: true })

  for (let i = 0; i < pageCount; i++) {
    const pageResp = await request.post(`/api/projects/${projectId}/pages`, {
      data: { order_index: i, outline_content: { title: `Slide ${i + 1}` } },
    })
    const pageId = (await pageResp.json()).data?.page_id
    pageIds.push(pageId)

    const rel = `${projectId}/pages/${pageId}_v1.jpg`
    fs.copyFileSync(getFixtureImage(i), path.join(UPLOADS, rel))
    sql(`UPDATE pages SET generated_image_path='${rel}', status='COMPLETED' WHERE id='${pageId}'`)
  }

  return { projectId, pageIds }
}
