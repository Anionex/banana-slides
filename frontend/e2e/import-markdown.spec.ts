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

// Unified format fixture (outline + description in one file)
const UNIFIED_MD = `# 项目

## 第 1 页: AI简介

> 章节: 引言

**大纲要点：**
- 什么是人工智能
- AI的历史

**页面描述：**
这是关于AI简介的描述内容。

---

## 第 2 页: AI应用

> 章节: 正文

**大纲要点：**
- 医疗领域
- 教育领域

**页面描述：**
这是关于AI应用的描述内容。

---
`

// Legacy format (no markers) — should still parse
const LEGACY_MD = `# 大纲

## 第 1 页: 旧格式页面
> 章节: 测试
- 要点一
- 要点二
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

  test('import unified markdown on outline page — preserves outline + description', async ({ page }) => {
    const mdPath = writeTempFile('test-unified.md', UNIFIED_MD)

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForSelector('button:has-text("导入")', { timeout: 10_000 })

    const fileInput = page.locator('input[type="file"][accept=".md,.txt"]').first()
    await fileInput.setInputFiles(mdPath)

    await expect(page.locator('text=导入成功').first()).toBeVisible({ timeout: 5_000 })

    expect(addPageCalls).toHaveLength(2)
    // Page 1: outline + description + part
    expect(addPageCalls[0].outline_content.title).toBe('AI简介')
    expect(addPageCalls[0].outline_content.points).toContain('什么是人工智能')
    expect(addPageCalls[0].outline_content.points).toContain('AI的历史')
    expect(addPageCalls[0].part).toBe('引言')
    expect(addPageCalls[0].description_content).toEqual({ text: '这是关于AI简介的描述内容。' })
    // Page 2
    expect(addPageCalls[1].outline_content.title).toBe('AI应用')
    expect(addPageCalls[1].outline_content.points).toContain('医疗领域')
    expect(addPageCalls[1].part).toBe('正文')
    expect(addPageCalls[1].description_content).toEqual({ text: '这是关于AI应用的描述内容。' })
  })

  test('import unified markdown on detail page — same result', async ({ page }) => {
    const mdPath = writeTempFile('test-unified-detail.md', UNIFIED_MD)

    await page.goto(`/project/${PROJECT_ID}/detail`)
    await page.waitForSelector('button:has-text("导入")', { timeout: 10_000 })

    const fileInput = page.locator('input[type="file"][accept=".md,.txt"]').first()
    await fileInput.setInputFiles(mdPath)

    await expect(page.locator('text=导入成功').first()).toBeVisible({ timeout: 5_000 })

    expect(addPageCalls).toHaveLength(2)
    expect(addPageCalls[0].outline_content.title).toBe('AI简介')
    expect(addPageCalls[0].description_content).toEqual({ text: '这是关于AI简介的描述内容。' })
  })

  test('import legacy format still works', async ({ page }) => {
    const mdPath = writeTempFile('test-legacy.md', LEGACY_MD)

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForSelector('button:has-text("导入")', { timeout: 10_000 })

    const fileInput = page.locator('input[type="file"][accept=".md,.txt"]').first()
    await fileInput.setInputFiles(mdPath)

    await expect(page.locator('text=导入成功').first()).toBeVisible({ timeout: 5_000 })

    expect(addPageCalls).toHaveLength(1)
    expect(addPageCalls[0].outline_content.title).toBe('旧格式页面')
    expect(addPageCalls[0].outline_content.points).toContain('要点一')
    expect(addPageCalls[0].part).toBe('测试')
  })

  test('import empty markdown shows error toast', async ({ page }) => {
    const mdPath = writeTempFile('test-empty.md', EMPTY_MD)

    await page.goto(`/project/${PROJECT_ID}/outline`)
    await page.waitForSelector('button:has-text("导入")', { timeout: 10_000 })

    const fileInput = page.locator('input[type="file"][accept=".md,.txt"]').first()
    await fileInput.setInputFiles(mdPath)

    await expect(page.locator('text=文件中未找到有效页面').first()).toBeVisible({ timeout: 5_000 })
    expect(addPageCalls).toHaveLength(0)
  })

  test('export→import round-trip preserves data', async ({ page }) => {
    // Pre-populate project with pages that have outline + description
    const existingPages = [
      {
        id: 'p1', page_id: 'p1', order_index: 0, part: '第一章',
        outline_content: { title: '导论', points: ['背景介绍', '研究目的'] },
        description_content: { text: '这是导论页面的详细描述。' },
        status: 'DESCRIPTION_GENERATED',
      },
      {
        id: 'p2', page_id: 'p2', order_index: 1, part: null,
        outline_content: { title: '方法论', points: ['实验设计'] },
        description_content: { text: '方法论的描述内容。' },
        status: 'DESCRIPTION_GENERATED',
      },
    ]

    // Override project route to return pages
    await page.route(`**/api/projects/${PROJECT_ID}`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProject(existingPages)) }))

    // Use detail page "导出大纲+描述" for full export
    await page.goto(`/project/${PROJECT_ID}/detail`)
    await page.waitForSelector('button:has-text("导出大纲+描述")', { timeout: 10_000 })

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("导出大纲+描述")'),
    ])
    const downloadPath = await download.path()
    const exportedContent = fs.readFileSync(downloadPath!, 'utf-8')

    // Verify exported content has both markers
    expect(exportedContent).toContain('**大纲要点：**')
    expect(exportedContent).toContain('**页面描述：**')
    expect(exportedContent).toContain('导论')
    expect(exportedContent).toContain('背景介绍')
    expect(exportedContent).toContain('这是导论页面的详细描述。')

    // Import the exported file back
    addPageCalls = []
    const reimportPath = writeTempFile('roundtrip.md', exportedContent)
    const fileInput = page.locator('input[type="file"][accept=".md,.txt"]').first()
    await fileInput.setInputFiles(reimportPath)

    await expect(page.locator('text=导入成功').first()).toBeVisible({ timeout: 5_000 })

    // Verify round-trip fidelity
    expect(addPageCalls).toHaveLength(2)
    expect(addPageCalls[0].outline_content.title).toBe('导论')
    expect(addPageCalls[0].outline_content.points).toEqual(['背景介绍', '研究目的'])
    expect(addPageCalls[0].part).toBe('第一章')
    expect(addPageCalls[0].description_content).toEqual({ text: '这是导论页面的详细描述。' })
    expect(addPageCalls[1].outline_content.title).toBe('方法论')
    expect(addPageCalls[1].outline_content.points).toEqual(['实验设计'])
    expect(addPageCalls[1].description_content).toEqual({ text: '方法论的描述内容。' })
    expect(addPageCalls[1].part).toBeUndefined()
  })
})
