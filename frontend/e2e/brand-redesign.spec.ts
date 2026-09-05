import { test, expect, type Page } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenHelpModal', 'true')
    localStorage.setItem('i18nextLng', 'zh')
  })
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

test.describe('Brand redesign - mock UI', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page)
    await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: { success: true, data: { enabled: false, templates: [], projects: [], total: 0 } } }))
  })

  test('all creation modes preserve input and submit the original API contract', async ({ page }) => {
    let payload: Record<string, unknown> = {}
    await page.route(url => url.pathname === '/api/projects', async route => {
      if (route.request().method() === 'POST') {
        payload = route.request().postDataJSON()
        return route.fulfill({ status: 400, json: { success: false, error: { message: '测试：保留输入' } } })
      }
      return route.fallback()
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('不必套版')
    const editor = page.locator('[contenteditable="true"]').first()
    await editor.fill('一份关于城市公共空间的演示')
    for (const [label, type, field] of [['写个想法', 'idea', 'idea_prompt'], ['粘贴大纲', 'outline', 'outline_text'], ['输入逐页内容', 'descriptions', 'description_text']]) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(editor).toContainText('城市公共空间')
      await page.getByRole('button', { name: '下一步', exact: true }).click()
      await expect.poll(() => payload.creation_type).toBe(type)
      expect(payload[field]).toBe('一份关于城市公共空间的演示')
      await expect(page.getByRole('button', { name: '下一步', exact: true })).toBeEnabled()
    }
    await page.getByRole('button', { name: '翻新旧稿', exact: true }).click()
    await expect(page.getByText('点击或拖拽上传 PDF / PPTX 文件')).toBeVisible()
    await expect(page.getByRole('button', { name: '下一步', exact: true })).toBeDisabled()
    await page.locator('input[type="file"][accept=".pdf,.pptx,.ppt"]').setInputFiles({ name: 'existing.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') })
    await expect(page.getByText('existing.pdf')).toBeVisible()
    await expect(page.getByRole('button', { name: '下一步', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '写个想法', exact: true }).click()
    await expect(editor).toContainText('城市公共空间')
  })

  test('recent projects distinguish loading failure, retry, and empty results', async ({ page }) => {
    let fail = true
    await page.route(url => url.pathname === '/api/projects', route => fail ? route.fulfill({ status: 503, json: { success: false } }) : route.fulfill({ json: { success: true, data: { projects: [], total: 0 } } }))
    await page.goto('/')
    await expect(page.getByText('暂时无法加载最近项目')).toBeVisible()
    await expect(page.getByText('你的下一份演示，从上方开始。')).toHaveCount(0)
    fail = false
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await expect(page.getByText('你的下一份演示，从上方开始。')).toBeVisible()
    await page.getByRole('link', { name: '全部项目', exact: true }).click()
    await expect(page).toHaveURL(/\/history$/)
  })

  test('style reference scroll does not mutate the route; style modes stay usable', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '找找风格灵感' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('#creation-style')).toBeInViewport()
    await page.getByRole('button', { name: '矢量插画', exact: true }).click()
    await expect(page.getByRole('button', { name: '矢量插画', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('使用文字描述风格', { exact: true }).check()
    await expect(page.getByRole('heading', { name: '预设模板', exact: true })).toHaveCount(0)
    await page.getByLabel('使用文字描述风格', { exact: true }).uncheck()
    await expect(page.getByRole('heading', { name: '预设模板', exact: true })).toBeVisible()
    await page.getByLabel('每页独立模板', { exact: false }).check()
    await expect(page.getByLabel('每页独立模板', { exact: false })).toBeChecked()
  })

  for (const width of [375, 768, 1440]) {
    test(`responsive, dark theme and reduced motion at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await noOverflow(page)
      expect(await page.locator('.studio-hero-copy').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
      await page.screenshot({ path: testInfo.outputPath(`home-light-${width}.png`), fullPage: true })
      await page.getByRole('button', { name: '主题模式', exact: true }).click()
      if (width >= 640) await page.getByRole('button', { name: '深色', exact: true }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
      await page.reload()
      await expect(page.locator('html')).toHaveClass(/dark/)
      await noOverflow(page)
      await page.screenshot({ path: testInfo.outputPath(`home-dark-${width}.png`), fullPage: true })
      if (width === 1440) {
        await page.getByRole('button', { name: '帮助', exact: true }).click()
        const issueLink = page.locator('a[href="https://github.com/Anionex/banana-slides/issues"]')
        await expect(issueLink).toBeVisible()
        await issueLink.hover()
        await expect(issueLink).toHaveCSS('color', 'rgb(245, 212, 88)')
        await page.getByRole('button', { name: '关闭', exact: true }).click()
        await expect(issueLink).toHaveCount(0)
      }
      if (width < 640) await page.getByLabel('更多工具', { exact: true }).click()
      await page.getByRole('button', { name: 'EN', exact: true }).click()
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Beyond templates')
      if (width < 640) {
        await expect(page.locator('.studio-mobile-menu')).not.toHaveAttribute('open', '')
        await page.getByLabel('More tools', { exact: true }).click()
        await page.getByRole('button', { name: '中', exact: true }).focus()
        await page.keyboard.press('Escape')
        await expect(page.locator('.studio-mobile-menu')).not.toHaveAttribute('open', '')
        await expect(page.getByLabel('More tools', { exact: true })).toBeFocused()
      }
      await noOverflow(page)
    })
  }

  test('landing showcase changes only on request and creation link works', async ({ page }) => {
    await page.goto('/landing')
    const selected = page.locator('.studio-showcase button[aria-pressed="true"]')
    await expect(selected).toHaveText('01')
    await page.getByRole('button', { name: '下一个案例', exact: true }).click()
    await expect(selected).toHaveText('02')
    await page.getByRole('button', { name: '上一个案例', exact: true }).click()
    await expect(selected).toHaveText('01')
    await page.getByRole('button', { name: '查看案例 4', exact: true }).click()
    await expect(selected).toHaveText('04')
    await noOverflow(page)
    await page.getByRole('button', { name: '开始创作', exact: true }).first().click()
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('Brand redesign - real backend', () => {
  test.beforeEach(async ({ page }) => { await setup(page) })

  test('blank creation and recent-project navigation persist through reload', async ({ page, request }) => {
    let projectId = ''
    try {
      await page.goto('/')
      const created = page.waitForResponse(response => new URL(response.url()).pathname === '/api/projects' && response.request().method() === 'POST')
      await page.getByRole('button', { name: '或从空白项目开始' }).click()
      projectId = (await (await created).json()).data.project_id
      await expect(page).toHaveURL(new RegExp(`/project/${projectId}/outline`))
      await expect(page.locator('.studio-stages [aria-current="step"]')).toContainText('梳理大纲')
      const title = `品牌验收 ${projectId.slice(0, 8)}`
      expect((await request.put(`/api/projects/${projectId}`, { data: { project_title: title } })).ok()).toBeTruthy()
      await page.goto('/')
      await page.getByRole('link', { name: `继续编辑 ${title}`, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/project/${projectId}/outline`))
      await page.reload()
      await expect(page.locator('.studio-project-name')).toContainText(title)
    } finally {
      if (projectId) expect((await request.delete(`/api/projects/${projectId}`)).ok()).toBeTruthy()
    }
  })

  test('editor context, saved edits, preview, library and settings work together', async ({ page, request, baseURL }, testInfo) => {
    const { projectId, pageIds } = await seedProjectWithImages(baseURL!, 2)
    try {
      for (const pageId of pageIds) expect((await request.put(`/api/projects/${projectId}/pages/${pageId}`, { data: { description_content: { text: '一页关于品牌表达的演示' } } })).ok()).toBeTruthy()
      await page.goto(`/project/${projectId}/outline`)
      await expect(page.locator('.studio-stages [aria-current="step"]')).toContainText('梳理大纲')
      await page.getByRole('button', { name: '下一步', exact: true }).click()
      await expect(page.locator('.studio-stages [aria-current="step"]')).toContainText('编写内容')
      await page.screenshot({ path: testInfo.outputPath('detail.png'), fullPage: true })
      await page.goto(`/project/${projectId}/preview`)
      await expect(page.locator('.studio-stages [aria-current="step"]')).toContainText('设计与导出')
      const titleInput = page.getByTestId('drawer-title-input')
      await expect(titleInput).toBeVisible()
      await titleInput.fill('改到想要的那一版')
      await expect(page.getByTestId('drawer-save-state')).toContainText('已保存')
      await page.reload()
      await expect(titleInput).toHaveValue('改到想要的那一版')
      await noOverflow(page)
      await page.screenshot({ path: testInfo.outputPath('preview.png'), fullPage: true })
      await page.goto('/')
      await page.getByRole('link', { name: '继续编辑 改到想要的那一版', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/project/${projectId}/preview`))
      await expect(titleInput).toHaveValue('改到想要的那一版')
      await page.goto('/history')
      await expect(page.getByRole('heading', { name: '改到想要的那一版', exact: true })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('history.png'), fullPage: true })
      await page.goto('/settings')
      await expect(page.locator('h1')).toBeVisible()
      await noOverflow(page)
    } finally {
      expect((await request.delete(`/api/projects/${projectId}`)).ok()).toBeTruthy()
    }
  })
})
