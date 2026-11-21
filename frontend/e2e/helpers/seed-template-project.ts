/**
 * Backend API helpers for per-page-template E2E scenarios.
 *
 * These drive the REAL backend (no mocks) to build deterministic template
 * fixtures: multi-mode projects, pages with descriptions, uploaded template
 * assets, page bindings, and task polling. Uploading an asset enqueues a real
 * ANALYZE_TEMPLATE task; tests that don't need analysis simply ignore it.
 */
import * as fs from 'fs'
import * as path from 'path'

const CWD = process.cwd()
const FRONTEND_DIR = CWD.endsWith('frontend') ? CWD : path.join(CWD, 'frontend')
const FIXTURES = path.join(FRONTEND_DIR, 'e2e', 'fixtures')

export interface PageDesc {
  title: string
  description?: string
}

async function api(backend: string, method: string, urlPath: string, body?: object) {
  const resp = await fetch(`${backend}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await resp.json().catch(() => ({}))
  return { status: resp.status, json }
}

export async function getProject(backend: string, projectId: string) {
  const { json } = await api(backend, 'GET', `/api/projects/${projectId}`)
  return json.data
}

/** Create a project and (optionally) flip it to multi-template mode. */
export async function createProject(
  backend: string,
  { multi = false }: { multi?: boolean } = {}
): Promise<string> {
  const { json } = await api(backend, 'POST', '/api/projects', {
    creation_type: 'idea',
    idea_prompt: 'e2e template scenario',
    template_style: 'default',
  })
  const projectId = json.data.project_id
  if (multi) {
    await api(backend, 'PATCH', `/api/projects/${projectId}/template-mode`, { mode: 'multi' })
  }
  return projectId
}

/** Add a page; if `description` is provided, fill description_content so the
 *  page is auto-match eligible. */
export async function addPage(
  backend: string,
  projectId: string,
  index: number,
  { title, description }: PageDesc
): Promise<string> {
  const { json } = await api(backend, 'POST', `/api/projects/${projectId}/pages`, {
    order_index: index,
    outline_content: { title, points: [] },
    ...(description ? { description_content: { text: description } } : {}),
  })
  return json.data.page_id
}

/** Upload a template image asset. Returns asset id + analyze task id. */
export async function uploadAsset(
  backend: string,
  projectId: string,
  { fixture = 'slide_1.jpg', label, bindToPage }: { fixture?: string; label?: string; bindToPage?: string } = {}
): Promise<{ assetId: string; analyzeTaskId: string }> {
  const buf = fs.readFileSync(path.join(FIXTURES, fixture))
  const form = new FormData()
  form.append('image', new Blob([buf], { type: 'image/jpeg' }), fixture)
  if (label) form.append('user_label', label)
  const qs = bindToPage ? `?bind_to_page=${bindToPage}` : ''
  const resp = await fetch(`${backend}/api/projects/${projectId}/template-assets${qs}`, {
    method: 'POST',
    body: form,
  })
  const json = await resp.json()
  return { assetId: json.data.asset.id, analyzeTaskId: json.data.analyze_task_id }
}

/** Upload a PDF for async splitting. Returns the split task id. */
export async function uploadPdf(
  backend: string,
  projectId: string,
  fixture: string
): Promise<string> {
  const buf = fs.readFileSync(path.join(FIXTURES, fixture))
  const form = new FormData()
  form.append('pdf', new Blob([buf], { type: 'application/pdf' }), fixture)
  const resp = await fetch(`${backend}/api/projects/${projectId}/template-assets/upload-pdf`, {
    method: 'POST',
    body: form,
  })
  const json = await resp.json()
  return json.data.task_id
}

export async function listAssets(backend: string, projectId: string) {
  const { json } = await api(backend, 'GET', `/api/projects/${projectId}/template-assets`)
  return json.data.assets as any[]
}

export async function bindPage(
  backend: string,
  projectId: string,
  pageId: string,
  assetId: string | null
) {
  return api(backend, 'PATCH', `/api/projects/${projectId}/pages/${pageId}/template`, {
    template_asset_id: assetId,
    selection_source: 'manual',
  })
}

export async function deleteAsset(backend: string, projectId: string, assetId: string) {
  const resp = await fetch(`${backend}/api/projects/${projectId}/template-assets/${assetId}`, {
    method: 'DELETE',
  })
  return resp.json()
}

export async function autoMatchAll(backend: string, projectId: string) {
  const { json } = await api(backend, 'POST', `/api/projects/${projectId}/template-assets/auto-match`, {
    overwrite_existing: true,
    preserve_non_empty: false,
  })
  return json.data.task_id as string
}

/** Poll a task until it leaves PENDING/RUNNING. Returns the final task dict. */
export async function pollTask(
  backend: string,
  projectId: string,
  taskId: string,
  { timeoutMs = 120000, intervalMs = 2000 }: { timeoutMs?: number; intervalMs?: number } = {}
) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { json } = await api(backend, 'GET', `/api/projects/${projectId}/tasks/${taskId}`)
    const task = json.data
    if (task && ['COMPLETED', 'FAILED'].includes(task.status)) return task
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Task ${taskId} did not finish within ${timeoutMs}ms`)
}