import { expect, test, type Page } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const FRONTEND_PORT = Number(new URL(BASE_URL).port || '3011')
const BACKEND_URL = `http://localhost:${FRONTEND_PORT + 2000}`

async function mockOutlineRecoveryApis(page: Page, projectId: string) {
  let outlineRequestCount = 0
  const project = {
    id: projectId,
    project_id: projectId,
    creation_type: 'idea',
    idea_prompt: 'API recovery mock project',
    status: 'DRAFT',
    pages: [],
  }

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())

      if (url.pathname === `/api/projects/${projectId}/generate/outline/stream`) {
        outlineRequestCount += 1
        return route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'event: error\ndata: {"message":"401 Unauthorized: invalid API key"}\n\n',
        })
      }

      if (url.pathname === `/api/projects/${projectId}` && request.method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: project }),
        })
      }

      if (url.pathname === '/api/settings' && request.method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ai_provider_format: 'gemini',
              description_generation_mode: 'streaming',
              description_extra_fields: [],
            },
          }),
        })
      }

      if (url.pathname === '/api/settings' && request.method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: JSON.parse(request.postData() || '{}') }),
        })
      }

      if (url.pathname.endsWith('/files')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      })
    }
  )

  return { getOutlineRequestCount: () => outlineRequestCount }
}

test.describe('API error settings recovery', () => {
  test('mock: outline authentication error opens settings and save returns to the editor', async ({ page }) => {
    const projectId = 'mock-api-recovery-outline'
    await mockOutlineRecoveryApis(page, projectId)

    await page.goto('/history')
    await page.evaluate((url) => {
      const currentState = window.history.state || {}
      window.history.pushState(
        {
          ...currentState,
          idx: (currentState.idx ?? 0) + 1,
          key: 'api-recovery-from-history',
          usr: { from: 'history' },
        },
        '',
        url
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    }, `/project/${projectId}/outline`)

    const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible()
    await settingsAction.click()

    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByText('修复 API 配置后返回继续创作')).toBeVisible()
    await expect(page.getByRole('button', { name: '保存并返回' })).toBeVisible()

    await page.getByRole('button', { name: '保存并返回' }).click()

    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/outline$`))
    await expect(page.getByText('编辑大纲', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '检查 API 设置' })).not.toBeVisible()

    await page.locator('header').getByRole('button', { name: '返回' }).click()
    await expect(page).toHaveURL(/\/history$/)
  })

  test('mock: leaving recovery without saving returns without retrying generation', async ({ page }) => {
    const projectId = 'mock-api-recovery-cancel'
    const { getOutlineRequestCount } = await mockOutlineRecoveryApis(page, projectId)

    await page.goto(`/project/${projectId}/outline`)
    await expect(page.getByRole('button', { name: '检查 API 设置' })).toBeVisible()
    expect(getOutlineRequestCount()).toBe(1)

    await page.getByRole('button', { name: '检查 API 设置' }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: '返回编辑器' }).click()

    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/outline$`))
    await expect(page.getByText('编辑大纲', { exact: true })).toBeVisible()
    await page.waitForTimeout(750)
    expect(getOutlineRequestCount()).toBe(1)
  })

  test('integration: description quota error saves real settings and returns to the same project', async ({ page }) => {
    const { projectId } = await seedProjectWithImages(BACKEND_URL, 1)
    let settingsGetCount = 0

    await page.route(
      (url) => url.pathname === '/api/settings',
      async (route) => {
        if (route.request().method() !== 'GET') return route.continue()
        settingsGetCount += 1
        if (settingsGetCount !== 1) return route.continue()

        const response = await route.fetch()
        const body = await response.json()
        body.data = { ...body.data, description_generation_mode: 'streaming' }
        return route.fulfill({ response, json: body })
      }
    )

    await page.route(
      (url) => url.pathname === `/api/projects/${projectId}/generate/descriptions/stream`,
      async (route) => route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'event: error\ndata: {"message":"403 balance is insufficient"}\n\n',
      })
    )

    try {
      await page.goto(`/project/${projectId}/detail`)
      await expect(page.getByText('编辑页面描述', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: '批量生成描述' }).click()
      const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
      await expect(settingsAction).toBeVisible()
      await settingsAction.click()

      await expect(page).toHaveURL(/\/settings$/)
      await expect(page.getByText('修复 API 配置后返回继续创作')).toBeVisible()

      const saveResponse = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.pathname === '/api/settings'
          && response.request().method() === 'PUT'
          && response.status() === 200
      })
      await page.getByRole('button', { name: '保存并返回' }).click()
      await saveResponse

      await expect(page).toHaveURL(new RegExp(`/project/${projectId}/detail$`))
      await expect(page.getByText('编辑页面描述', { exact: true })).toBeVisible()
    } finally {
      await fetch(`${BACKEND_URL}/api/projects/${projectId}`, { method: 'DELETE' })
    }
  })
})
