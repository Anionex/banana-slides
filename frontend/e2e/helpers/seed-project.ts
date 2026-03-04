/**
 * Shared helper to create projects with real images for E2E testing.
 * Bypasses AI image generation by placing fixture images on disk + updating DB directly.
 *
 * Usage:
 *   - Playwright: import { seedProjectWithImages } from './helpers/seed-project'
 *   - CLI:        npx tsx frontend/e2e/helpers/seed-project.ts [PAGE_COUNT]
 */
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const cwd = process.cwd()
const FRONTEND_DIR = cwd.endsWith('frontend') ? cwd : path.join(cwd, 'frontend')
const PROJECT_ROOT = path.resolve(FRONTEND_DIR, '..')
const DB_PATH = path.join(PROJECT_ROOT, 'backend', 'instance', 'database.db')
const UPLOADS = path.join(PROJECT_ROOT, 'uploads')
const FIXTURES = path.join(FRONTEND_DIR, 'e2e', 'fixtures')

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
 * @param baseUrl - Backend base URL, e.g. "http://localhost:5441"
 */
export async function seedProjectWithImages(
  baseUrl: string,
  pageCount = 1
): Promise<SeededProject> {
  const post = async (urlPath: string, body: object) => {
    const resp = await fetch(`${baseUrl}${urlPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return resp.json()
  }

  const projectId = (await post('/api/projects', {
    creation_type: 'idea', idea_prompt: 'e2e test', template_style: 'default',
  })).data?.project_id

  const pageIds: string[] = []
  fs.mkdirSync(path.join(UPLOADS, projectId, 'pages'), { recursive: true })

  for (let i = 0; i < pageCount; i++) {
    const pageId = (await post(`/api/projects/${projectId}/pages`, {
      order_index: i, outline_content: { title: `Slide ${i + 1}` },
    })).data?.page_id
    pageIds.push(pageId)

    const rel = `${projectId}/pages/${pageId}_v1.jpg`
    fs.copyFileSync(getFixtureImage(i), path.join(UPLOADS, rel))
    sql(`UPDATE pages SET generated_image_path='${rel}', status='COMPLETED' WHERE id='${pageId}'`)
  }

  sql(`UPDATE projects SET status='IMAGES_GENERATED' WHERE id='${projectId}'`)
  return { projectId, pageIds }
}

// CLI entry point: npx tsx frontend/e2e/helpers/seed-project.ts [PAGE_COUNT]
if (process.argv[1]?.includes('seed-project')) {
  const { createHash } = await import('crypto')
  const pageCount = parseInt(process.argv[2] || '3', 10)

  // Auto-detect backend port (same MD5 logic as app.py)
  const envFile = path.join(PROJECT_ROOT, '.env')
  let port = '5000'
  if (fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, 'utf8').match(/^BACKEND_PORT=(\d+)/m)
    if (m) port = m[1]
  }
  if (port === '5000') {
    const basename = path.basename(PROJECT_ROOT)
    const offset = parseInt(createHash('md5').update(basename).digest('hex').slice(0, 8), 16) % 500
    port = String(5000 + offset)
  }

  const baseUrl = `http://localhost:${port}`
  const res = await seedProjectWithImages(baseUrl, pageCount)
  const fport = parseInt(port) - 2000
  console.log(`Project: ${res.projectId}`)
  console.log(`Preview: http://localhost:${fport}/project/${res.projectId}/preview`)
}
