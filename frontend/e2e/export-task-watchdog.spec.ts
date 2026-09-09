/**
 * 真实后端 + 真实前端：后台任务"假进行中"（僵尸任务）的验收。
 *
 * 客户反馈：导出可编辑 PPTX 卡在 "88% 构建第 17/24 页"，
 * 重启应用后仍然显示 88%。后台任务只存在于进程内，
 * 进程重启后数据库记录会永远停在最后一次进度上。
 */
import { expect, test } from '@playwright/test'
import { execFileSync } from 'child_process'
import crypto from 'crypto'
import path from 'path'

const FRONTEND_DIR = process.cwd().endsWith('frontend')
  ? process.cwd()
  : path.join(process.cwd(), 'frontend')
const PROJECT_ROOT = path.resolve(FRONTEND_DIR, '..')
const DB_PATH = path.join(PROJECT_ROOT, 'backend', 'instance', 'database.db')

function sqlText(value: string): string {
  return `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)`
}

async function createProject(request: any, idea: string): Promise<string> {
  const response = await request.post('/api/projects', {
    data: { creation_type: 'idea', idea_prompt: idea, template_style: 'default' },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.project_id as string
}

function insertExportTask(options: {
  taskId: string
  projectId: string
  status: string
  progress: Record<string, unknown>
}) {
  const progress = JSON.stringify(options.progress)
  execFileSync('sqlite3', [
    '-cmd',
    '.timeout 5000',
    DB_PATH,
    `INSERT INTO tasks (id, project_id, task_type, status, progress, created_at)
     VALUES ('${options.taskId}', '${options.projectId}', 'EXPORT_EDITABLE_PPTX',
       '${options.status}', ${sqlText(progress)}, CURRENT_TIMESTAMP);`,
  ])
}

async function seedStoredTask(page: any, payload: Record<string, unknown>) {
  await page.addInitScript((task: Record<string, unknown>) => {
    localStorage.setItem('hasSeenHelpModal', 'true')
    localStorage.setItem('export-tasks-storage', JSON.stringify({
      state: { tasks: [task] },
      version: 0,
    }))
  }, payload)
}

test('a task left over from a previous run stops showing 88% and reports interrupted', async ({ page, request }) => {
  const projectId = await createProject(request, '僵尸导出任务 E2E')
  const taskId = crypto.randomUUID()
  const localTaskId = `e2e-watchdog-${Date.now()}`
  const staleHeartbeat = new Date(Date.now() - 3.5 * 3600 * 1000).toISOString()

  insertExportTask({
    taskId,
    projectId,
    status: 'PROCESSING',
    progress: {
      total: 100,
      completed: 88,
      failed: 0,
      current_step: '构建第 17/24 页...',
      percent: 88,
      heartbeat_at: staleHeartbeat,
      messages: [
        '[构建PPTX] 构建第 16/24 页...',
        '[构建PPTX] 构建第 17/24 页...',
      ],
    },
  })

  await seedStoredTask(page, {
    id: localTaskId,
    taskId,
    projectId,
    type: 'editable-pptx',
    status: 'PROCESSING',
    progress: { total: 100, completed: 88, percent: 88, current_step: '构建第 17/24 页...' },
    createdAt: new Date().toISOString(),
  })

  try {
    await page.goto(`/project/${projectId}/preview`)
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 })
    await page.getByLabel('导出任务').click()

    const panel = page.getByTestId('export-tasks-list')
    // 页面加载后第一次轮询就会对账：任务从"进行中 88%"变成失败，并给出中断原因
    await expect(panel.getByText(/^导出失败$/)).toBeVisible({ timeout: 20000 })
    // 文案由前端按 error_code + 结构化细节拼装，不依赖后端中文句子
    await expect(panel.getByText(/导出被中断：.*3\.5 小时/)).toBeVisible({ timeout: 20000 })
    await expect(panel.getByText('TASK_INTERRUPTED')).toBeVisible()
    await expect(panel.getByText('任务状态对账')).toBeVisible()
    await expect(panel.getByText('点任务右侧的 × 移除这条记录，然后重新发起即可。')).toBeVisible()

    // 进度条（88%）不应再作为"进行中"显示，也不能显示"进行中"计数
    await expect(panel.getByText('88%')).toHaveCount(0)
    await expect(page.getByText(/^\d+ 进行中$/)).toHaveCount(0)

    const taskResponse = await request.get(`/api/projects/${projectId}/tasks/${taskId}`)
    expect(taskResponse.ok()).toBeTruthy()
    const backendTask = (await taskResponse.json()).data
    expect(backendTask.status).toBe('FAILED')
    expect(backendTask.progress.error_code).toBe('TASK_INTERRUPTED')
    expect(backendTask.progress.percent).toBe(88)
  } finally {
    await request.delete(`/api/projects/${projectId}`)
  }
})

test('a task with a fresh heartbeat keeps running instead of being failed', async ({ page, request }) => {
  const projectId = await createProject(request, '心跳正常导出任务 E2E')
  const taskId = crypto.randomUUID()
  const localTaskId = `e2e-watchdog-fresh-${Date.now()}`

  insertExportTask({
    taskId,
    projectId,
    status: 'PROCESSING',
    progress: {
      total: 100,
      completed: 88,
      failed: 0,
      current_step: '构建第 17/24 页...',
      percent: 88,
      heartbeat_at: new Date().toISOString(),
      messages: ['[构建PPTX] 构建第 17/24 页...'],
    },
  })

  await seedStoredTask(page, {
    id: localTaskId,
    taskId,
    projectId,
    type: 'editable-pptx',
    status: 'PROCESSING',
    progress: { total: 100, completed: 88, percent: 88, current_step: '构建第 17/24 页...' },
    createdAt: new Date().toISOString(),
  })

  const statusRequests: string[] = []
  page.on('request', (req) => {
    if (req.url().includes(`/tasks/${taskId}`)) statusRequests.push(req.url())
  })

  try {
    await page.goto(`/project/${projectId}/preview`)
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 })
    await page.getByLabel('导出任务').click()

    const panel = page.getByTestId('export-tasks-list')
    await expect(panel.getByText('88%')).toBeVisible({ timeout: 10000 })

    // 断言"确实发生了轮询"，而不是空等待
    await expect.poll(() => statusRequests.length, { timeout: 15000 }).toBeGreaterThanOrEqual(3)

    await expect(panel.getByText('88%')).toBeVisible()
    await expect(panel.getByText(/导出被中断|导出疑似卡住/)).toHaveCount(0)
    // 也不应该出现"状态查询中断"的监控横幅（说明轮询正常）
    await expect(panel.getByText('状态查询暂时中断')).toHaveCount(0)

    const taskResponse = await request.get(`/api/projects/${projectId}/tasks/${taskId}`)
    const backendTask = (await taskResponse.json()).data
    expect(backendTask.status).toBe('PROCESSING')
  } finally {
    await request.delete(`/api/projects/${projectId}`)
  }
})

test('a stalled task renders the localized stuck message', async ({ page, request }) => {
  const projectId = await createProject(request, '卡住任务展示 E2E')
  const taskId = crypto.randomUUID()
  const localTaskId = `e2e-watchdog-stalled-${Date.now()}`

  insertExportTask({
    taskId,
    projectId,
    status: 'FAILED',
    progress: {
      total: 100,
      completed: 88,
      failed: 1,
      current_step: '构建第 17/24 页...',
      percent: 88,
      backend_status: 'FAILED',
      error_code: 'TASK_STALLED',
      error_stage: 'task_watchdog',
      error_details: { reason: 'stalled', idle_seconds: 1260, last_step: '构建PPTX' },
      messages: ['[构建PPTX] 构建第 17/24 页...'],
    },
  })

  await seedStoredTask(page, {
    id: localTaskId,
    taskId,
    projectId,
    type: 'editable-pptx',
    // 以"进行中"恢复，第一次轮询就能拿到后端的 FAILED + TASK_STALLED
    status: 'PROCESSING',
    progress: { total: 100, completed: 88, percent: 88 },
    createdAt: new Date().toISOString(),
  })

  try {
    await page.goto(`/project/${projectId}/preview`)
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 })
    await page.getByLabel('导出任务').click()

    const panel = page.getByTestId('export-tasks-list')
    await expect(panel.getByText(/^导出失败$/)).toBeVisible({ timeout: 15000 })
    await expect(panel.getByText(/导出疑似卡住：已 21 分钟没有进度更新（最后一步：构建PPTX）/)).toBeVisible()
    await expect(panel.getByText('TASK_STALLED')).toBeVisible()
    await expect(panel.getByText('任务状态对账')).toBeVisible()
  } finally {
    await request.delete(`/api/projects/${projectId}`)
  }
})
