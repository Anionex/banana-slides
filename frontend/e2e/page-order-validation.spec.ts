import { test, expect } from '@playwright/test'

const getBackendUrl = () => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL
  const frontendUrl = process.env.BASE_URL || 'http://localhost:3011'
  const parsedFrontendUrl = new URL(frontendUrl)
  const frontendPort = parseInt(parsedFrontendUrl.port || '3011', 10)
  return `${parsedFrontendUrl.protocol}//${parsedFrontendUrl.hostname}:${frontendPort + 2000}`
}

test.describe('Page order validation', () => {
  test('single-page create rejects invalid order_index before saving', async () => {
    const backendUrl = getBackendUrl()
    const createResponse = await fetch(`${backendUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_type: 'idea',
        idea_prompt: 'Page order validation E2E',
      }),
    })
    const created = await createResponse.json()
    const projectId = created.data?.project_id as string
    expect(projectId).toBeTruthy()

    try {
      const invalidResponse = await fetch(`${backendUrl}/api/projects/${projectId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_index: '1',
          outline_content: { title: 'Invalid page order', points: ['should fail'] },
        }),
      })
      const invalid = await invalidResponse.json()
      expect(invalidResponse.status).toBe(400)
      expect(invalid.error?.message).toBe('order_index must be a non-negative integer')

      const validResponse = await fetch(`${backendUrl}/api/projects/${projectId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_index: 0,
          outline_content: { title: 'Valid page order', points: ['should save'] },
        }),
      })
      const valid = await validResponse.json()
      expect(validResponse.status).toBe(201)
      expect(valid.data?.order_index).toBe(0)
      expect(valid.data?.outline_content?.title).toBe('Valid page order')
    } finally {
      await fetch(`${backendUrl}/api/projects/${projectId}`, { method: 'DELETE' })
    }
  })
})
