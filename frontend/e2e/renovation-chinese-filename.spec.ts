/**
 * Renovation non-ASCII filename - Integration E2E Test
 *
 * Regression test for: uploading a PDF with a Chinese (or other non-ASCII)
 * filename caused the background task to fail with "No PDF file found for
 * renovation project" because secure_filename() strips non-ASCII chars,
 * leaving the file with no .pdf extension that the task could discover.
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const API = `http://localhost:${Number(new URL(BASE).port) + 2000}`

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Poll task until it leaves PENDING/PROCESSING, or timeout */
async function waitForTask(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  taskId: string,
  timeoutMs = 120_000
): Promise<{ status: string; error_message?: string }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await request.get(`${API}/api/tasks/${taskId}`)
    if (!res.ok()) throw new Error(`Task poll failed: ${res.status()}`)
    const body = await res.json()
    const task = body.data ?? body
    if (task.status !== 'PENDING' && task.status !== 'PROCESSING') {
      return task
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error(`Task ${taskId} did not complete within ${timeoutMs}ms`)
}

test.describe.serial('Renovation with non-ASCII filename', () => {
  test.setTimeout(180_000)

  const createdProjects: string[] = []

  test.afterAll(async ({ request }) => {
    for (const id of createdProjects) {
      try {
        await request.delete(`${API}/api/projects/${id}`)
      } catch { /* best effort */ }
    }
  })

  test('Chinese filename PDF completes renovation task without error', async ({ request }) => {
    const pdfPath = path.join(__dirname, 'fixtures', 'test-16-9.pdf')
    const pdfBuffer = fs.readFileSync(pdfPath)

    // Upload with a Chinese filename — this is what triggered the bug
    const res = await request.post(`${API}/api/projects/renovation`, {
      multipart: {
        file: {
          name: '演示文稿.pdf',   // non-ASCII filename
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        },
      },
    })
    expect(res.ok(), `Create renovation project failed: ${res.status()}`).toBeTruthy()

    const body = await res.json()
    const projectId: string = body.data.project_id
    const taskId: string = body.data.task_id
    createdProjects.push(projectId)

    // Wait for background task to finish
    const task = await waitForTask(request, taskId)

    // Before fix: task.status would be 'FAILED' with "No PDF file found for renovation project"
    expect(
      task.status,
      `Task failed with: ${task.error_message}`
    ).toBe('COMPLETED')

    expect(task.error_message ?? null).toBeNull()
  })

  test('ASCII filename PDF still works after fix', async ({ request }) => {
    const pdfPath = path.join(__dirname, 'fixtures', 'test-16-9.pdf')
    const pdfBuffer = fs.readFileSync(pdfPath)

    const res = await request.post(`${API}/api/projects/renovation`, {
      multipart: {
        file: {
          name: 'presentation.pdf',
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        },
      },
    })
    expect(res.ok()).toBeTruthy()

    const body = await res.json()
    const projectId: string = body.data.project_id
    const taskId: string = body.data.task_id
    createdProjects.push(projectId)

    const task = await waitForTask(request, taskId)
    expect(task.status, `Task failed with: ${task.error_message}`).toBe('COMPLETED')
  })
})
