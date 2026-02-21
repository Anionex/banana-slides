/**
 * E2E test: Import outline / description from Markdown files
 */
import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

test.use({ baseURL: process.env.BASE_URL || 'http://localhost:3000' })

const PROJECT_ID = 'mock-import-proj'

const mockProject = (pages: any[] = []) => ({
  success: true,
  data: {
    id: PROJECT_ID, project_id: PROJECT_ID, title: 'Test',
    status: 'OUTLINE_GENERATED', creation_type: 'idea',
    idea_prompt: 'test', pages,
  }
})

const mockSettings = () => ({
  success: true,
  data: { ai_provider_format: 'gemini', google_api_key: 'fake' }
})

// Markdown fixtures
const OUTLINE_MD = `# 大纲

## 第 1 页: AI简介
> 章节: 引言
- 什么是人工智能
- AI的历史

## 第 2 页: AI应用
> 章节: 正文
- 医疗领域
- 教育领域
`

const DESCRIPTION_MD = `# 页面描述

## 第 1 页: AI简介
> 章节: 引言
> 布局建议: 左图右文
这是关于AI简介的描述内容。

---

## 第 2 页: AI应用
> 章节: 正文
这是关于AI应用的描述内容。
`

const EMPTY_MD = `# 空文件
没有任何页面内容
`

test.describe('Import Markdown (mocked)', () => {
  test.setTimeout(60_000)

  let addPageCalls: any[]
  let projectPages: any[]

  test.beforeEach(async ({ page }) => {
    addPageCalls = []
    projectPages = []

    await page.route('**/api/settings', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSettings()) }))

    await page.route('**/api/access-code/check', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { required: false } }) }))

    await page.route('**/api/user-templates', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }))

    await page.route(`**/api/reference-files/project/${PROJECT_ID}`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { files: [] } }) }))

    // Project endpoint: returns current pages state
    await page.route(`**/api/projects/${PROJECT_ID}`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProject(projectPages)) }))

    // Add page endpoint: capture calls and grow projectPages
    await page.route(`**/api/projects/${PROJECT_ID}/pages`, async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        addPageCalls.push(body)
        const newPage = {
          id: `page-${addPageCalls.length}`,
          page_id: `page-${addPageCalls.length}`,
          order_index: body.order_index ?? projectPages.length,
          outline_content: body.outline_content || { title: '', points: [] },
          description_content: body.description_content || null,
          part: body.part || null,
          status: 'DRAFT',
        }
        projectPages.push(newPage)
        await route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: newPage })
        })
      } else {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { pages: projectPages } })
        })
      }
    })
  })

  function writeTempFile(name: string, content: string): string {
    const filePath = path.join('/tmp', name)
    fs.writeFileSync(filePath, content, 'utf-8')
    return filePath
  }

  test('import outline appends pages and shows success toast', async ({ page }) => {
    const mdPath = writeTempFile('test-outline.md', OUTLINE_MD)

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForSelector('button:has-text("导入大纲")', { timeout: 10_000 })

    const fileInput = page.locator('input[type="file"][accept=".md,.txt"]').first()
    await fileInput.setInputFiles(mdPath)

    // Wait for success toast
    const toast = page.locator('text=导入成功')
    await expect(toast.first()).toBeVisible({ timeout: 5_000 })

    // Verify 2 addPage calls were made
    expect(addPageCalls).toHaveLength(2)
    expect(addPageCalls[0].outline_content.title).toBe('AI简介')
    expect(addPageCalls[0].outline_content.points).toContain('什么是人工智能')
    expect(addPageCalls[0].part).toBe('引言')
    expect(addPageCalls[1].outline_content.title).toBe('AI应用')
  })

  test('import empty markdown shows error toast', async ({ page }) => {
    const mdPath = writeTempFile('test-empty.md', EMPTY_MD)

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForSelector('button:has-text("导入大纲")', { timeout: 10_000 })

    const fileInput = page.locator('input[type="file"][accept=".md,.txt"]').first()
    await fileInput.setInputFiles(mdPath)

    const toast = page.locator('text=文件中未找到有效页面')
    await expect(toast.first()).toBeVisible({ timeout: 5_000 })

    expect(addPageCalls).toHaveLength(0)
  })

  test('import descriptions appends pages and shows success toast', async ({ page }) => {
    const mdPath = writeTempFile('test-descriptions.md', DESCRIPTION_MD)

    await page.goto(`/project/${PROJECT_ID}/detail`)
    await page.waitForSelector('button:has-text("导入描述")', { timeout: 10_000 })

    const fileInput = page.locator('input[type="file"][accept=".md,.txt"]').first()
    await fileInput.setInputFiles(mdPath)

    const toast = page.locator('text=导入成功')
    await expect(toast.first()).toBeVisible({ timeout: 5_000 })

    expect(addPageCalls).toHaveLength(2)
    expect(addPageCalls[0].outline_content.title).toBe('AI简介')
    expect(addPageCalls[0].description_content.layout_suggestion).toBe('左图右文')
    expect(addPageCalls[1].outline_content.title).toBe('AI应用')
  })
})
