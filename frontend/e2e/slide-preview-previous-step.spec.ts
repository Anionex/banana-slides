import { test, expect, type Page } from '@playwright/test'

const PROJECT_ID = 'preview-previous-step-mock'

function mockProject() {
  return {
    id: PROJECT_ID,
    project_id: PROJECT_ID,
    project_title: '上一步按钮测试项目',
    status: 'COMPLETED',
    template_mode: 'single',
    image_aspect_ratio: '16:9',
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-01T10:00:00.000Z',
    pages: [
      {
        id: 'page-1',
        page_id: 'page-1',
        order_index: 0,
        status: 'COMPLETED',
        generated_image_path: `/files/mock/1.png`,
        generated_image_url: `/files/mock/1.png`,
        outline_content: { title: '第一页标题', points: ['要点一'] },
        description_content: { text: '第一页描述' },
        created_at: '2026-08-01T10:00:00.000Z',
        updated_at: '2026-08-01T10:00:00.000Z',
      },
    ],
  }
}

async function mockPreview(page: Page) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/api/access-code/check') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { enabled: false } }),
      })
    }

    if (url.pathname === '/api/settings') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ai_provider_format: 'gemini',
            image_resolution: '2K',
            enable_image_quality_control: false,
          },
        }),
      })
    }

    if (url.pathname === '/api/output-language') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { language: 'zh' } }),
      })
    }

    if (url.pathname === `/api/projects/${PROJECT_ID}`) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockProject() }),
      })
    }

    if (url.pathname === '/api/user-templates') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { templates: [] } }),
      })
    }

    if (
      url.pathname.includes('/image-versions') ||
      url.pathname.includes('/materials') ||
      url.pathname.includes('/voices')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })

  await page.route('**/files/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(128) })
  })
}

test.describe('SlidePreview previous-step navigation (mock)', () => {
  test('desktop: explicit previous-step button returns to the description editor', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${PROJECT_ID}/preview`)
    await page.waitForLoadState('networkidle')

    const previousStep = page.getByTestId('preview-previous-step')
    await expect(previousStep).toBeVisible()
    await expect(previousStep).toContainText(/上一步|Previous/)

    await previousStep.click()
    await expect(page).toHaveURL(new RegExp(`/project/${PROJECT_ID}/detail$`))
    await expect(page.getByText('第一页描述')).toBeVisible()
  })

  test('mobile: previous-step button stays reachable and returns to the description editor', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockPreview(page)
    await page.goto(`/project/${PROJECT_ID}/preview`)
    await page.waitForLoadState('networkidle')

    const previousStep = page.getByTestId('preview-previous-step')
    await expect(previousStep).toBeVisible()

    await previousStep.click()
    await expect(page).toHaveURL(new RegExp(`/project/${PROJECT_ID}/detail$`))
    await expect(page.getByText('第一页描述')).toBeVisible()
  })

  test('regression: header back button still returns to the description editor from a direct visit', async ({ page }) => {
    await mockPreview(page)
    await page.goto(`/project/${PROJECT_ID}/preview`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /返回|Back/ }).click()
    await expect(page).toHaveURL(new RegExp(`/project/${PROJECT_ID}/detail$`))
    await expect(page.getByText('第一页描述')).toBeVisible()
  })
})
