import { test, expect } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'
import { execSync } from 'child_process'
import * as path from 'path'

const FRONTEND_DIR = process.cwd().endsWith('frontend') ? process.cwd() : path.join(process.cwd(), 'frontend')
const PROJECT_ROOT = path.resolve(FRONTEND_DIR, '..')
const DB_PATH = path.join(PROJECT_ROOT, 'backend', 'instance', 'database.db')

/** Escape a value for use inside SQL single-quoted strings */
function esc(v: string): string { return v.replace(/'/g, "''") }

function sql(query: string): string {
  return execSync(`sqlite3 -cmd ".timeout 5000" "${DB_PATH}" "${query.replace(/"/g, '\\"')}"`)
    .toString().trim()
}

function getBackendBase(): string {
  const base = process.env.BASE_URL || 'http://localhost:3000'
  const url = new URL(base)
  url.port = String(parseInt(url.port || '3000') + 2000)
  return url.origin
}

test.describe('Regenerate active task detection (integration)', () => {
  test('batch generate stores page_ids in task progress', async () => {
    const backend = getBackendBase()
    const { projectId, pageIds } = await seedProjectWithImages(backend, 1)
    const pageId = pageIds[0]

    sql(`UPDATE pages SET status='FAILED' WHERE id='${esc(pageId)}'`)
    sql(`UPDATE projects SET template_style='minimalist modern' WHERE id='${esc(projectId)}'`)

    const resp = await (await fetch(`${backend}/api/projects/${projectId}/generate/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'zh', page_ids: [pageId] }),
    })).json()

    const taskId = resp.data?.task_id
    expect(taskId).toBeTruthy()

    // Verify page_ids stored in task progress (regardless of task completion speed)
    const progress = JSON.parse(sql(`SELECT progress FROM tasks WHERE id='${esc(taskId)}'`))
    expect(progress.page_ids).toContain(pageId)
  })

  test('single-page generate stores page_id in task progress', async () => {
    const backend = getBackendBase()
    const { projectId, pageIds } = await seedProjectWithImages(backend, 1)
    const pageId = pageIds[0]

    const desc = JSON.stringify({ text: 'Test content.' }).replace(/'/g, "''")
    sql(`UPDATE pages SET status='FAILED', description_content='${desc}' WHERE id='${esc(pageId)}'`)
    sql(`UPDATE projects SET template_style='minimalist modern' WHERE id='${esc(projectId)}'`)

    const resp = await (await fetch(`${backend}/api/projects/${projectId}/pages/${pageId}/generate/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force_regenerate: true, language: 'zh' }),
    })).json()

    const taskId = resp.data?.task_id
    expect(taskId).toBeTruthy()

    const progress = JSON.parse(sql(`SELECT progress FROM tasks WHERE id='${esc(taskId)}'`))
    expect(progress.page_ids).toContain(pageId)
  })

  test('project GET includes active_image_tasks for pending tasks', async () => {
    const backend = getBackendBase()
    const { projectId, pageIds } = await seedProjectWithImages(backend, 1)
    const pageId = pageIds[0]

    // Manually insert a PENDING task to simulate an in-progress generation
    const taskId = 'test-active-task-' + Date.now()
    const progress = JSON.stringify({ total: 1, completed: 0, failed: 0, page_ids: [pageId] }).replace(/'/g, "''")
    sql(`INSERT INTO tasks (id, project_id, task_type, status, progress, created_at) VALUES ('${esc(taskId)}', '${esc(projectId)}', 'GENERATE_IMAGES', 'PENDING', '${progress}', datetime('now'))`)

    const resp = await (await fetch(`${backend}/api/projects/${projectId}`)).json()
    const tasks = resp.data.active_image_tasks
    expect(tasks).toBeDefined()
    expect(tasks.some((t: any) => t.task_id === taskId && t.page_ids.includes(pageId))).toBe(true)

    // Cleanup
    sql(`DELETE FROM tasks WHERE id='${esc(taskId)}'`)
  })
})

test.describe('Frontend resumes polling (mock)', () => {
  test('shows generating state when active_image_tasks present', async ({ page }) => {
    const frontendBase = process.env.BASE_URL || 'http://localhost:3000'
    const backend = getBackendBase()
    const { projectId, pageIds } = await seedProjectWithImages(backend, 1)
    const pageId = pageIds[0]

    // Mock project GET to include active_image_tasks
    let intercepted = false
    await page.route(`**/api/projects/${projectId}`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return }
      const resp = await route.fetch()
      const json = await resp.json()
      if (!intercepted) {
        intercepted = true
        json.data.active_image_tasks = [{ task_id: 'fake-task', page_ids: [pageId] }]
        // Ensure page has no image so placeholder shows
        const pg = json.data.pages?.find((p: any) => p.page_id === pageId)
        if (pg) { pg.generated_image_url = null; pg.status = 'FAILED' }
      }
      await route.fulfill({ json })
    })

    // Mock task polling to return PROCESSING
    await page.route(`**/api/projects/${projectId}/tasks/fake-task`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { status: 'PROCESSING', progress: { total: 1, completed: 0, failed: 0 } } }),
      })
    })

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto(`${frontendBase}/project/${projectId}/preview`)

    // Should show generating state
    await expect(page.getByText('生成中', { exact: true }).or(page.getByText('Generating', { exact: true }))).toBeVisible({ timeout: 10000 })
  })
})
