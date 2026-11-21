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

test('renders structured editable-export failure returned by the real backend', async ({ page, request }) => {
  const projectResponse = await request.post('/api/projects', {
    data: {
      creation_type: 'idea',
      idea_prompt: '可编辑导出诊断 E2E',
      template_style: 'default',
    },
  })
  expect(projectResponse.ok()).toBeTruthy()
  const projectId = (await projectResponse.json()).data.project_id as string
  const taskId = crypto.randomUUID()
  const localTaskId = `e2e-export-${Date.now()}`
  const errorMessage = '文本样式提取失败：图片识别服务请求超时'
  const progress = JSON.stringify({
    total: 100,
    completed: 50,
    failed: 1,
    current_step: '样式提取失败',
    percent: 50,
    backend_status: 'FAILED',
    error_code: 'EXPORT_STYLE_TIMEOUT',
    error_type: 'style_extraction',
    error_stage: 'style_extraction',
    error_details: {
      stage: 'style_extraction',
      reason: 'timeout',
      retryable: true,
      provider: 'CodexTextProvider',
      model: 'gpt-5.4',
      request_timeout_seconds: 120,
      max_attempts: 5,
      technical_message: 'Read timed out after automatic retries',
    },
    help_text: '请检查网络、代理和图片识别服务状态后重试。',
  })

  execFileSync('sqlite3', [
    '-cmd',
    '.timeout 5000',
    DB_PATH,
    `INSERT INTO tasks (id, project_id, task_type, status, progress, error_message, created_at, completed_at)
     VALUES ('${taskId}', '${projectId}', 'EXPORT_EDITABLE_PPTX', 'FAILED', ${sqlText(progress)},
       ${sqlText(errorMessage)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
  ])

  await page.addInitScript(({ projectId, taskId, localTaskId }) => {
    localStorage.setItem('hasSeenHelpModal', 'true')
    localStorage.setItem('export-tasks-storage', JSON.stringify({
      state: {
        tasks: [{
          id: localTaskId,
          taskId,
          projectId,
          type: 'editable-pptx',
          status: 'RUNNING',
          progress: { total: 100, completed: 40, percent: 40 },
          createdAt: new Date().toISOString(),
        }],
      },
      version: 0,
    }))
  }, { projectId, taskId, localTaskId })

  try {
    await page.goto(`/project/${projectId}/preview`)
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 })
    await page.getByLabel('导出任务').click()

    await expect(page.getByText(errorMessage)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('EXPORT_STYLE_TIMEOUT')).toBeVisible()
    await expect(page.getByText('文本样式提取', { exact: true })).toBeVisible()
    await expect(page.getByText('CodexTextProvider')).toBeVisible()
    await expect(page.getByText('gpt-5.4')).toBeVisible()
    await expect(page.getByText(/120.*5/)).toBeVisible()
    await expect(page.getByText('技术原因')).toBeVisible()
    await expect(page.getByText('请检查网络、代理和图片识别服务状态后重试。')).toBeVisible()

    const taskResponse = await request.get(`/api/projects/${projectId}/tasks/${taskId}`)
    expect(taskResponse.ok()).toBeTruthy()
    const backendTask = (await taskResponse.json()).data
    expect(backendTask.status).toBe('FAILED')
    expect(backendTask.progress.percent).toBe(50)
    expect(backendTask.progress.error_code).toBe('EXPORT_STYLE_TIMEOUT')
  } finally {
    await request.delete(`/api/projects/${projectId}`)
  }
})
