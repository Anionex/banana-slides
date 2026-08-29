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
    const { getOutlineRequestCount } = await mockOutlineRecoveryApis(page, projectId)

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
    expect(getOutlineRequestCount()).toBe(1)
    await settingsAction.click()

    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByText('修复 API 配置后返回继续创作')).toBeVisible()
    await expect(page.getByRole('button', { name: '保存并返回' })).toBeVisible()

    await page.getByRole('button', { name: '保存并返回' }).click()

    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/outline$`))
    await expect(page.getByText('编辑大纲', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '检查 API 设置' })).not.toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/\/history$/)

    await page.goto(`/project/${projectId}/outline`)
    await expect(page.getByRole('button', { name: '检查 API 设置' })).toBeVisible()
    expect(getOutlineRequestCount()).toBe(2)
  })

  test('mock: browser Back from recovery returns without retrying generation', async ({ page }) => {
    const projectId = 'mock-api-recovery-cancel'
    const { getOutlineRequestCount } = await mockOutlineRecoveryApis(page, projectId)

    await page.goto(`/project/${projectId}/outline`)
    await expect(page.getByRole('button', { name: '检查 API 设置' })).toBeVisible()
    expect(getOutlineRequestCount()).toBe(1)

    await page.getByRole('button', { name: '检查 API 设置' }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.goBack()

    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/outline$`))
    await expect(page.getByText('编辑大纲', { exact: true })).toBeVisible()
    await page.waitForTimeout(750)
    expect(getOutlineRequestCount()).toBe(1)
  })

  test('mock: stale application access code does not offer API settings recovery', async ({ page }) => {
    const projectId = 'mock-stale-access-code'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      idea_prompt: 'Stale access code project',
      status: 'DRAFT',
      pages: [],
    }

    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request()
        const url = new URL(request.url())

        if (url.pathname === `/api/projects/${projectId}/generate/outline/stream`) {
          return route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Access code required' }),
          })
        }

        if (url.pathname === `/api/projects/${projectId}` && request.method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: project }),
          })
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: {} }),
        })
      }
    )

    await page.goto(`/project/${projectId}/outline`)

    await expect(page.getByText('访问口令已失效，请刷新页面后重新验证。')).toBeVisible()
    await expect(page.getByRole('button', { name: '检查 API 设置' })).toHaveCount(0)
  })

  test('mock: background parallel failure returns to the task project after switching projects', async ({ page }) => {
    const projectId = 'mock-parallel-description-error'
    const otherProjectId = 'mock-parallel-current-project'
    const pageId = 'mock-parallel-page'
    const taskId = 'mock-parallel-task'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'OUTLINE_GENERATED',
      pages: [{
        id: pageId,
        page_id: pageId,
        order_index: 0,
        outline_content: { title: '并行描述页', points: ['要点'] },
        status: 'DRAFT',
      }],
    }
    const otherProject = {
      ...project,
      id: otherProjectId,
      project_id: otherProjectId,
      pages: [{
        ...project.pages[0],
        id: 'mock-parallel-current-page',
        page_id: 'mock-parallel-current-page',
        outline_content: { title: '当前查看的另一个项目', points: ['不要绑定到这里'] },
      }],
    }
    let taskFailureReturned = false
    let signalTaskSyncStarted!: () => void
    const taskSyncStarted = new Promise<void>((resolve) => { signalTaskSyncStarted = resolve })
    let releaseTaskSync!: () => void
    const taskSyncRelease = new Promise<void>((resolve) => { releaseTaskSync = resolve })

    await page.addInitScript(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'parallel',
      }))
    })
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request()
        const url = new URL(request.url())

        if (url.pathname === `/api/projects/${projectId}` && request.method() === 'GET') {
          if (taskFailureReturned) {
            signalTaskSyncStarted()
            await taskSyncRelease
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: project }),
          })
        }

        if (url.pathname === `/api/projects/${otherProjectId}` && request.method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: otherProject }),
          })
        }

        if (url.pathname === `/api/projects/${projectId}/generate/descriptions` && request.method() === 'POST') {
          return route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { task_id: taskId } }),
          })
        }

        if (url.pathname === `/api/projects/${projectId}/tasks/${taskId}`) {
          taskFailureReturned = true
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                task_id: taskId,
                status: 'FAILED',
                progress: { total: 1, completed: 0, failed: 1 },
                error_message: 'API quota or balance is insufficient',
              },
            }),
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
                description_generation_mode: 'parallel',
                description_extra_fields: [],
              },
            }),
          })
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      }
    )

    await page.goto(`/project/${projectId}/detail`)
    await page.getByRole('button', { name: '批量生成描述' }).click()
    await taskSyncStarted

    await page.evaluate((url) => {
      const currentState = window.history.state || {}
      window.history.pushState(
        {
          ...currentState,
          idx: (currentState.idx ?? 0) + 1,
          key: 'parallel-error-other-project',
        },
        '',
        url
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    }, `/project/${otherProjectId}/detail`)
    await expect(page).toHaveURL(new RegExp(`/project/${otherProjectId}/detail$`))
    await expect.poll(
      () => page.evaluate(() => localStorage.getItem('currentProjectId'))
    ).toBe(otherProjectId)

    releaseTaskSync()

    const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible({ timeout: 5000 })
    expect(await page.evaluate(() => localStorage.getItem('currentProjectId'))).toBe(otherProjectId)
    await settingsAction.click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: '返回编辑器' }).click()
    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/detail$`))
  })

  test('mock: recovery action reads the route at click time after the toast is shown', async ({ page }) => {
    const projectId = 'mock-stale-toast-source'
    const otherProjectId = 'mock-stale-toast-current'
    const taskId = 'mock-stale-toast-task'
    const makeProject = (id: string, title: string) => ({
      id,
      project_id: id,
      creation_type: 'idea',
      status: 'OUTLINE_GENERATED',
      pages: [{
        id: `${id}-page`,
        page_id: `${id}-page`,
        order_index: 0,
        outline_content: { title, points: ['要点'] },
        status: 'DRAFT',
      }],
    })
    const projects = {
      [projectId]: makeProject(projectId, '错误来源项目'),
      [otherProjectId]: makeProject(otherProjectId, 'Toast 后切换的项目'),
    }

    await page.addInitScript(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'parallel',
      }))
    })
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request()
        const url = new URL(request.url())

        for (const [id, project] of Object.entries(projects)) {
          if (url.pathname === `/api/projects/${id}` && request.method() === 'GET') {
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: project }),
            })
          }
        }

        if (url.pathname === `/api/projects/${projectId}/generate/descriptions` && request.method() === 'POST') {
          return route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { task_id: taskId } }),
          })
        }

        if (url.pathname === `/api/projects/${projectId}/tasks/${taskId}`) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                task_id: taskId,
                status: 'FAILED',
                progress: { total: 1, completed: 0, failed: 1 },
                error_message: 'API key is invalid',
              },
            }),
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
                description_generation_mode: 'parallel',
                description_extra_fields: [],
              },
            }),
          })
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      }
    )

    await page.goto(`/project/${projectId}/detail`)
    await page.getByRole('button', { name: '批量生成描述' }).click()
    const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible({ timeout: 5000 })

    await page.evaluate((url) => {
      const currentState = window.history.state || {}
      window.history.pushState(
        { ...currentState, idx: (currentState.idx ?? 0) + 1, key: 'stale-toast-other-project' },
        '',
        url
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    }, `/project/${otherProjectId}/detail`)
    await expect.poll(
      () => page.evaluate(() => localStorage.getItem('currentProjectId'))
    ).toBe(otherProjectId)

    await settingsAction.click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: '返回编辑器' }).click()
    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/detail$`))
  })

  test('mock: provider initialization failure before task creation offers settings recovery', async ({ page }) => {
    const projectId = 'mock-parallel-provider-init-error'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'OUTLINE_GENERATED',
      pages: [{
        id: `${projectId}-page`,
        page_id: `${projectId}-page`,
        order_index: 0,
        outline_content: { title: '未配置 API Key', points: ['要点'] },
        status: 'DRAFT',
      }],
    }

    await page.addInitScript(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'parallel',
      }))
    })
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request()
        const url = new URL(request.url())

        if (url.pathname === `/api/projects/${projectId}` && request.method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: project }),
          })
        }

        if (url.pathname === `/api/projects/${projectId}/generate/descriptions` && request.method() === 'POST') {
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { code: 'AI_SERVICE_ERROR', message: 'API key is invalid' },
            }),
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
                description_generation_mode: 'parallel',
                description_extra_fields: [],
              },
            }),
          })
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      }
    )

    await page.goto(`/project/${projectId}/detail`)
    await page.getByRole('button', { name: '批量生成描述' }).click()
    const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible()
    await settingsAction.click()
    await expect(page).toHaveURL(/\/settings$/)
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
      await page.unrouteAll({ behavior: 'wait' })
      await fetch(`${BACKEND_URL}/api/projects/${projectId}`, { method: 'DELETE' })
    }
  })
})
