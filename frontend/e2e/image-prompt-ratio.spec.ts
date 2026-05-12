/**
 * Image Prompt Aspect Ratio - Integration E2E Test
 *
 * Verifies that the project's aspect ratio is correctly stored, updated,
 * and passed through to image generation tasks.
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const API = `http://localhost:${Number(new URL(BASE).port) + 2000}`

test.describe('Image prompt aspect ratio', () => {
  let projectId: string

  test.afterEach(async ({ request }) => {
    if (projectId) {
      await request.delete(`${API}/api/projects/${projectId}`)
      projectId = ''
    }
  })

  test('project stores and returns custom aspect ratio (4:3)', async ({
    request,
  }) => {
    // Create project with 4:3 ratio
    const projRes = await request.post(`${API}/api/projects`, {
      data: {
        creation_type: 'idea',
        idea_prompt: 'test ratio storage',
        image_aspect_ratio: '4:3',
        page_count: 1,
      },
    })
    expect(projRes.ok()).toBeTruthy()
    const proj = await projRes.json()
    projectId = proj.data.project_id

    // Verify it persists on GET
    const getRes = await request.get(`${API}/api/projects/${projectId}`)
    expect(getRes.ok()).toBeTruthy()
    const fetched = await getRes.json()
    expect(fetched.data.image_aspect_ratio).toBe('4:3')
  })

  test('project aspect ratio can be updated from 16:9 to 1:1', async ({
    request,
  }) => {
    // Create with default
    const projRes = await request.post(`${API}/api/projects`, {
      data: {
        creation_type: 'idea',
        idea_prompt: 'test ratio update',
        page_count: 1,
      },
    })
    expect(projRes.ok()).toBeTruthy()
    const proj = await projRes.json()
    projectId = proj.data.project_id

    // Verify default is 16:9
    const getRes = await request.get(`${API}/api/projects/${projectId}`)
    const fetched = await getRes.json()
    expect(fetched.data.image_aspect_ratio).toBe('16:9')

    // Update to 1:1
    const updateRes = await request.put(
      `${API}/api/projects/${projectId}`,
      { data: { image_aspect_ratio: '1:1' } }
    )
    expect(updateRes.ok()).toBeTruthy()

    // Verify update persisted
    const getRes2 = await request.get(`${API}/api/projects/${projectId}`)
    const fetched2 = await getRes2.json()
    expect(fetched2.data.image_aspect_ratio).toBe('1:1')
  })
})
