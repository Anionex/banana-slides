import { test, expect } from '@playwright/test'

const getBackendUrl = () => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL
  const frontendUrl = process.env.BASE_URL || 'http://localhost:3011'
  const parsedFrontendUrl = new URL(frontendUrl)
  const frontendPort = parseInt(parsedFrontendUrl.port || '3011', 10)
  return `${parsedFrontendUrl.protocol}//${parsedFrontendUrl.hostname}:${frontendPort + 2000}`
}

test.describe('Markdown import preview', () => {
  test('integration: preview shows appended page count before importing outline markdown', async ({ page }) => {
    const backendUrl = getBackendUrl()
    const createResponse = await fetch(`${backendUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_type: 'idea',
        idea_prompt: 'Markdown import preview test',
      }),
    })
    const created = await createResponse.json()
    const projectId = created.data?.project_id as string
    expect(projectId).toBeTruthy()

    try {
      await fetch(`${backendUrl}/api/projects/${projectId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_index: 0,
          outline_content: { title: '原始页面', points: ['已有内容'] },
        }),
      })

      await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
      await page.goto(`/project/${projectId}/outline`)
      await expect(page.getByText('原始页面')).toBeVisible()

      await page.getByRole('button', { name: /导入\/导出|Import\/Export/ }).click()
      await page.getByRole('button', { name: /^导入$|^Import$/ }).click()

      const markdown = [
        '## 第 1 页: 新增第一页',
        '',
        '这一页介绍导入预览。',
        '',
        '---',
        '',
        '## 第 2 页: 新增第二页',
        '',
        '这一页确认追加页数。',
      ].join('\n')
      await page.getByPlaceholder(/把大纲|Paste outline/).fill(markdown)

      await expect(page.getByText(/将追加 2 页到当前项目|2 page\(s\) will be appended/)).toBeVisible()
      await page.getByRole('button', { name: /导入到项目|Import into Project/ }).click()

      await expect(page.getByText('新增第一页')).toBeVisible()
      await expect(page.getByText('新增第二页')).toBeVisible()

      const projectResponse = await fetch(`${backendUrl}/api/projects/${projectId}`)
      const project = await projectResponse.json()
      const titles = project.data.pages.map((item: { outline_content?: { title?: string } }) => item.outline_content?.title)
      expect(titles).toEqual(expect.arrayContaining(['原始页面', '新增第一页', '新增第二页']))
      expect(project.data.pages).toHaveLength(3)
    } finally {
      await fetch(`${backendUrl}/api/projects/${projectId}`, { method: 'DELETE' })
    }
  })
})
