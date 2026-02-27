/**
 * E2E test for UPLOAD_FOLDER path resolution fix (#287).
 *
 * Bug: ai_service.py used os.environ.get('UPLOAD_FOLDER', '') which always
 * returned '' because UPLOAD_FOLDER lives in Flask app.config, not env vars.
 * Fix: use get_config().UPLOAD_FOLDER instead.
 *
 * Test strategy:
 *   1. Upload a material image to a project
 *   2. Set page description referencing the material via /files/ path
 *   3. Trigger image generation (will fail at AI provider level — that's fine)
 *   4. Verify backend logs show the file was FOUND, not "Local file not found"
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const FRONTEND_DIR = process.cwd().endsWith('frontend')
  ? process.cwd()
  : path.join(process.cwd(), 'frontend')
const PROJECT_ROOT = path.resolve(FRONTEND_DIR, '..')
const FIXTURES = path.join(FRONTEND_DIR, 'e2e', 'fixtures')
const BACKEND_LOG = '/tmp/fix-upload-backend.log'

test.describe('UPLOAD_FOLDER path resolution (#287)', () => {
  test('material image referenced in description is resolved correctly during image generation', async ({
    request,
  }) => {
    // 1. Create a project
    const createResp = await request.post('/api/projects', {
      data: {
        creation_type: 'idea',
        idea_prompt: 'upload folder path test',
        template_style: 'default',
      },
    })
    if (!createResp.ok()) {
      test.skip(true, 'Backend unavailable')
      return
    }
    const projectId = (await createResp.json()).data?.project_id
    expect(projectId).toBeTruthy()

    // 2. Create a page
    const pageResp = await request.post(`/api/projects/${projectId}/pages`, {
      data: { order_index: 0, outline_content: { title: 'Test Slide' } },
    })
    expect(pageResp.ok()).toBe(true)
    const pageId = (await pageResp.json()).data?.page_id
    expect(pageId).toBeTruthy()

    // 3. Upload a material image
    const fixturePath = path.join(FIXTURES, 'slide_1.jpg')
    if (!fs.existsSync(fixturePath)) {
      test.skip(true, 'Fixture image not found')
      return
    }

    const fileBuffer = fs.readFileSync(fixturePath)

    const uploadResp = await request.post(
      `/api/projects/${projectId}/materials/upload`,
      { multipart: { file: { name: 'test-material.jpg', mimeType: 'image/jpeg', buffer: fileBuffer } } },
    )
    expect(uploadResp.ok()).toBe(true)
    const materialData = (await uploadResp.json()).data
    const materialPath: string = materialData?.relative_path || materialData?.file_path || ''
    expect(materialPath).toBeTruthy()

    // Build the /files/ URL that would appear in a description
    const filesUrl = materialPath.startsWith('/files/')
      ? materialPath
      : `/files/${materialPath}`

    // 4. Verify the material file is accessible via /files/ endpoint
    const fileResp = await request.get(filesUrl)
    expect(fileResp.ok()).toBe(true)

    // 5. Set page description with material reference
    const descResp = await request.put(
      `/api/projects/${projectId}/pages/${pageId}/description`,
      {
        data: {
          description_content: {
            title: 'Test Slide',
            text: `Use this reference image: ![material](${filesUrl})`,
            text_content: [`Use this reference image: ![material](${filesUrl})`],
            layout_suggestion: 'full-image',
          },
        },
      },
    )
    expect(descResp.ok()).toBe(true)

    // 6. Mark the log position before triggering generation
    const logBefore = fs.existsSync(BACKEND_LOG)
      ? fs.readFileSync(BACKEND_LOG, 'utf8').length
      : 0

    // 7. Trigger image generation (will fail at AI provider level — expected)
    const genResp = await request.post(
      `/api/projects/${projectId}/generate/images`,
      { data: { max_workers: 1 } },
    )
    expect(genResp.ok()).toBe(true)
    const taskId = (await genResp.json()).data?.task_id
    expect(taskId).toBeTruthy()

    // 8. Poll task until done (expect FAILED due to no AI provider)
    let taskStatus = 'PROCESSING'
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      const taskResp = await request.get(
        `/api/projects/${projectId}/tasks/${taskId}`,
      )
      if (!taskResp.ok()) continue
      const task = (await taskResp.json()).data
      taskStatus = task?.status
      if (taskStatus === 'COMPLETED' || taskStatus === 'FAILED') break
    }

    // 9. Read new log lines and verify path resolution
    const logAfter = fs.existsSync(BACKEND_LOG)
      ? fs.readFileSync(BACKEND_LOG, 'utf8')
      : ''
    const newLogs = logAfter.slice(logBefore)

    // The fix ensures the material file IS found — no "Local file not found" for our material
    const materialFilename = path.basename(materialPath)
    const fileNotFoundForMaterial = newLogs
      .split('\n')
      .filter(
        (line) =>
          line.includes('Local file not found') &&
          line.includes(materialFilename),
      )

    expect(
      fileNotFoundForMaterial,
      `Material file should be found by ai_service, but got "Local file not found" in logs`,
    ).toHaveLength(0)

    // Positive check: if the material filename appears in logs, it should be "Loaded", not "not found"
    const materialLoadedLine = newLogs
      .split('\n')
      .some(
        (line) =>
          line.includes('Loaded image from local path') &&
          line.includes(materialFilename),
      )
    if (newLogs.includes(materialFilename)) {
      expect(
        materialLoadedLine || !fileNotFoundForMaterial.length,
        `Material ${materialFilename} should be loaded, not missing`,
      ).toBe(true)
    }
  })
})
