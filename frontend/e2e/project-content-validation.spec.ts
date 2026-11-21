import { test, expect } from '@playwright/test'

test.describe('Project content validation', () => {
  test('rejects whitespace-only API input and prevents the same submission in the UI', async ({ page, request }) => {
    const response = await request.post('/api/projects', {
      data: { creation_type: 'outline', outline_text: '  \n\t ' },
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error.message).toContain('outline_text')

    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
    await page.goto('/')
    await page.getByRole('button', { name: /从大纲生成|From Outline/ }).click()
    await page.getByRole('textbox').fill('  \n\t ')

    await expect(page.getByRole('button', { name: /下一步|Next/ })).toBeDisabled()
  })

  test('stores normalized content for a valid real API request', async ({ request }) => {
    const createResponse = await request.post('/api/projects', {
      data: {
        creation_type: 'idea',
        idea_prompt: '  AI 产品发布会  ',
        template_style: '  极简商务风  ',
      },
    })
    expect(createResponse.status()).toBe(201)
    const created = await createResponse.json()

    const projectResponse = await request.get(`/api/projects/${created.data.project_id}`)
    expect(projectResponse.status()).toBe(200)
    const project = await projectResponse.json()
    expect(project.data.idea_prompt).toBe('AI 产品发布会')
    expect(project.data.template_style).toBe('极简商务风')
  })
})
