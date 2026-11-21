import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const FRONTEND_DIR = process.cwd().endsWith('frontend') ? process.cwd() : path.join(process.cwd(), 'frontend')
const PROJECT_ROOT = path.resolve(FRONTEND_DIR, '..')
const DB_PATH = path.join(PROJECT_ROOT, 'backend', 'instance', 'database.db')
const UPLOADS = path.join(PROJECT_ROOT, 'uploads')
const FIXTURE_IMAGE = path.join(FRONTEND_DIR, 'e2e', 'fixtures', 'slide_1.jpg')

function sql(query: string) {
  execSync(`sqlite3 -cmd ".timeout 5000" "${DB_PATH}" "${query.replace(/"/g, '\\"')}"`)
}

function sqlEscape(value: string) {
  return value.replace(/'/g, "''")
}

test('associating a parsed reference file imports document images into project materials', async ({ request }) => {
  const projectResp = await request.post('/api/projects', {
    data: { creation_type: 'idea', idea_prompt: '文档图片自动入库 E2E' },
  })
  expect(projectResp.ok()).toBeTruthy()
  const projectId = (await projectResp.json()).data.project_id as string

  const extractId = `e2e_${Date.now()}`
  const imageDir = path.join(UPLOADS, 'mineru_files', extractId, 'images')
  fs.mkdirSync(imageDir, { recursive: true })
  fs.copyFileSync(FIXTURE_IMAGE, path.join(imageDir, 'doc-chart-original-name.jpg'))

  const referenceFileId = crypto.randomUUID()
  const markdown = `文档内容\n![文档图表](/files/mineru/${extractId}/images/doc-chart-original-name.jpg)\n`
  sql(`
    INSERT INTO reference_files (
      id, project_id, filename, file_path, file_size, file_type, parse_status,
      markdown_content, created_at, updated_at
    ) VALUES (
      '${referenceFileId}', NULL, 'report.pdf', 'reference_files/report.pdf', 123, 'pdf',
      'completed', '${sqlEscape(markdown)}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `)

  const associateResp = await request.post(`/api/reference-files/${referenceFileId}/associate`, {
    data: { project_id: projectId },
  })
  expect(associateResp.ok()).toBeTruthy()

  const materialsResp = await request.get(`/api/projects/${projectId}/materials`)
  expect(materialsResp.ok()).toBeTruthy()
  const materials = (await materialsResp.json()).data.materials
  expect(materials).toHaveLength(1)
  expect(materials[0].caption).toBe('文档图表')
  expect(materials[0].original_filename).toBe('doc-chart-original-name.jpg')
  expect(materials[0].url).toContain(`/files/${projectId}/materials/parsed_`)

  const fileResp = await request.get(materials[0].url)
  expect(fileResp.ok()).toBeTruthy()
  expect(fileResp.headers()['content-type']).toContain('image')

  const duplicateResp = await request.post(`/api/reference-files/${referenceFileId}/associate`, {
    data: { project_id: projectId },
  })
  expect(duplicateResp.ok()).toBeTruthy()
  const afterDuplicate = (await (await request.get(`/api/projects/${projectId}/materials`)).json()).data.materials
  expect(afterDuplicate).toHaveLength(1)
})
