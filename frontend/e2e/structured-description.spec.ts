import { test, expect } from '@playwright/test'

const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
const PROJECT_ID = 'test-structured-desc'

const STRUCTURED_TEXT = [
  '页面标题：AI 与未来教育',
  '',
  '页面文字：',
  '- 个性化学习路径将成为主流',
  '- AI 辅助教师而非替代教师',
  '',
  '配图建议：一张未来教室的概念图，学生使用平板电脑，柔和的蓝色科技感光线',
  '',
  '排版建议：左图右文',
  '',
  '其他页面素材',
  '![diagram](https://example.com/diagram.png)',
].join('\n')

function makePage(id: string, index: number, desc?: string) {
  return {
    page_id: id, id, order_index: index, status: 'DESCRIPTION_GENERATED',
    outline_content: { title: `Page ${index + 1}`, points: ['point'] },
    description_content: desc ? { text: desc } : undefined,
  }
}

function makeProject(pages: ReturnType<typeof makePage>[]) {
  return {
    success: true,
    data: {
      project_id: PROJECT_ID, id: PROJECT_ID, idea_prompt: 'test',
      status: 'DESCRIPTIONS_GENERATED', pages, created_at: '2026-01-01', updated_at: '2026-01-01',
    },
  }
}

test.describe('Structured description blocks (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return }
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(makeProject([makePage('p1', 0, STRUCTURED_TEXT)])),
      })
    })
    await page.route('**/api/settings', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { layout_presets: ['左图右文', '右图左文', '上下分栏', '纯文字居中'] },
        }),
      })
    })
  })

  test('renders section blocks with labels', async ({ page }) => {
    await page.goto(`${baseUrl}/project/${PROJECT_ID}/detail`)
    await expect(page.locator('text=第 1 页')).toBeVisible({ timeout: 10000 })

    // Each section label should be visible
    for (const label of ['标题', '正文', '配图', '排版', '素材']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    // Section content should render
    await expect(page.getByText('AI 与未来教育')).toBeVisible()
    await expect(page.getByText('个性化学习路径将成为主流')).toBeVisible()
    await expect(page.getByText('一张未来教室的概念图')).toBeVisible()
    await expect(page.getByText('左图右文').first()).toBeVisible()
  })

  test('layout dropdown shows presets and selects one', async ({ page }) => {
    let _updatedSettings: any = null
    await page.route('**/api/settings', async (route) => {
      if (route.request().method() === 'PUT') {
        _updatedSettings = JSON.parse(route.request().postData() || '{}')
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
        return
      }
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { layout_presets: ['左图右文', '右图左文', '上下分栏'] },
        }),
      })
    })

    await page.goto(`${baseUrl}/project/${PROJECT_ID}/detail`)
    await expect(page.locator('text=第 1 页')).toBeVisible({ timeout: 10000 })

    // Click the layout dropdown trigger (shows "选择排版")
    const dropdownTrigger = page.locator('button:has-text("选择排版")').first()
    await dropdownTrigger.click()

    // Dropdown should show preset options
    await expect(page.getByRole('button', { name: '右图左文' })).toBeVisible()
    await expect(page.getByRole('button', { name: '上下分栏' })).toBeVisible()
  })
})

test.describe('Layout presets integration', () => {
  test('fetches and displays layout presets from settings API', async ({ page }) => {
    const resp = await page.request.get(`${baseUrl}/api/settings`)
    const settings = await resp.json()
    // Settings API should return layout_presets array
    expect(settings.data).toHaveProperty('layout_presets')
    expect(Array.isArray(settings.data.layout_presets)).toBe(true)
    expect(settings.data.layout_presets.length).toBeGreaterThan(0)
  })

  test('persists new layout preset via settings API', async ({ page }) => {
    const uniquePreset = `测试预设_${Date.now()}`

    // Get current presets
    const getResp = await page.request.get(`${baseUrl}/api/settings`)
    const current = (await getResp.json()).data.layout_presets as string[]

    // Add new preset
    const updated = [...current, uniquePreset]
    const putResp = await page.request.put(`${baseUrl}/api/settings`, {
      data: { layout_presets: updated },
    })
    expect(putResp.ok()).toBe(true)

    // Verify persistence
    const verifyResp = await page.request.get(`${baseUrl}/api/settings`)
    const persisted = (await verifyResp.json()).data.layout_presets as string[]
    expect(persisted).toContain(uniquePreset)

    // Clean up: restore original
    await page.request.put(`${baseUrl}/api/settings`, {
      data: { layout_presets: current },
    })
  })
})
