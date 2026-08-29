import { expect, test, type Page } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const FRONTEND_PORT = Number(new URL(BASE_URL).port || '3011')
const BACKEND_URL = `http://localhost:${FRONTEND_PORT + 2000}`

async function mockOutlineRecoveryApis(
  page: Page,
  projectId: string,
  pages: Array<Record<string, unknown>> = []
) {
  let outlineRequestCount = 0
  const project = {
    id: projectId,
    project_id: projectId,
    creation_type: 'idea',
    idea_prompt: 'API recovery mock project',
    status: 'DRAFT',
    pages,
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

  test('mock: failed manual outline regeneration restores saved pages before returning', async ({ page }) => {
    const projectId = 'mock-api-recovery-existing-outline'
    const pageId = 'mock-api-recovery-existing-page'
    const { getOutlineRequestCount } = await mockOutlineRecoveryApis(page, projectId, [{
      id: pageId,
      page_id: pageId,
      order_index: 0,
      outline_content: { title: '保留的旧大纲', points: ['旧要点'] },
      status: 'DRAFT',
    }])

    await page.goto(`/project/${projectId}/outline`)
    await expect(page.getByText('保留的旧大纲')).toBeVisible()
    expect(getOutlineRequestCount()).toBe(0)

    await page.getByRole('button', { name: '重新生成大纲' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click()
    const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible()
    expect(getOutlineRequestCount()).toBe(1)
    await settingsAction.click()

    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: '返回编辑器' }).click()

    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/outline$`))
    await expect(page.getByText('保留的旧大纲')).toBeVisible()
    await expect(page.getByRole('button', { name: '重新生成大纲' })).toBeEnabled()
    expect(getOutlineRequestCount()).toBe(1)
  })

  test('mock: delayed outline stream failure on Home returns to its source project', async ({ page }) => {
    const projectId = 'mock-delayed-outline-source'
    const pageId = 'mock-delayed-outline-page'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'OUTLINE_GENERATED',
      pages: [{
        id: pageId,
        page_id: pageId,
        order_index: 0,
        outline_content: { title: '延迟失败前的旧大纲', points: ['旧要点'] },
        status: 'DRAFT',
      }],
    }
    let outlineRequestCount = 0
    let signalOutlineStarted!: () => void
    const outlineStarted = new Promise<void>((resolve) => { signalOutlineStarted = resolve })
    let releaseOutline!: () => void
    const outlineRelease = new Promise<void>((resolve) => { releaseOutline = resolve })

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

        if (
          url.pathname === `/api/projects/${projectId}/generate/outline/stream`
          && request.method() === 'POST'
        ) {
          outlineRequestCount += 1
          signalOutlineStarted()
          await outlineRelease
          return route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            body: 'event: error\ndata: {"message":"401 Unauthorized: invalid API key"}\n\n',
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

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      }
    )

    await page.goto(`/project/${projectId}/outline`)
    await expect(page.getByText('延迟失败前的旧大纲')).toBeVisible()
    await page.getByRole('button', { name: '重新生成大纲' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click()
    await outlineStarted

    await page.evaluate(() => {
      const currentState = window.history.state || {}
      window.history.pushState(
        { ...currentState, idx: (currentState.idx ?? 0) + 1, key: 'outline-failure-home' },
        '',
        '/'
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })
    await expect(page).toHaveURL(/\/$/)

    releaseOutline()
    const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible()
    await settingsAction.click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: '返回编辑器' }).click()

    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/outline$`))
    await expect(page.getByText('延迟失败前的旧大纲')).toBeVisible()
    expect(outlineRequestCount).toBe(1)
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

  test('mock: editor-local recovery toasts return to the project that raised the error', async ({ page }) => {
    const sourceProjectId = 'mock-local-toast-source'
    const otherProjectId = 'mock-local-toast-current'
    const makeProject = (id: string, title: string) => ({
      id,
      project_id: id,
      creation_type: 'idea',
      status: 'DESCRIPTION_GENERATED',
      pages: [{
        id: `${id}-page`,
        page_id: `${id}-page`,
        order_index: 0,
        outline_content: { title, points: ['要点'] },
        description_content: { text: `${title}的描述` },
        status: 'DESCRIPTION_GENERATED',
      }],
    })
    const projects = {
      [sourceProjectId]: makeProject(sourceProjectId, '错误来源项目页面'),
      [otherProjectId]: makeProject(otherProjectId, '当前查看项目页面'),
    }

    await page.addInitScript(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'streaming',
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

        if (
          request.method() === 'POST'
          && (
            url.pathname === `/api/projects/${sourceProjectId}/refine/outline`
            || url.pathname === `/api/projects/${sourceProjectId}/refine/descriptions`
          )
        ) {
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
                description_generation_mode: 'streaming',
                description_extra_fields: [],
              },
            }),
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
          body: JSON.stringify({ success: true, data: [] }),
        })
      }
    )

    const navigateWithinSpa = async (path: string, key: string, usr?: unknown) => {
      await page.evaluate(({ path, key, usr }) => {
        const currentState = window.history.state || {}
        window.history.pushState(
          { ...currentState, idx: (currentState.idx ?? 0) + 1, key, usr },
          '',
          path
        )
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
      }, { path, key, usr })
    }

    await page.goto('/history')
    await navigateWithinSpa(
      `/project/${sourceProjectId}/outline`,
      'local-outline-source-project',
      { from: 'history' }
    )
    const outlineRefineInput = page.getByPlaceholder(/例如：增加一页/).first()
    await outlineRefineInput.fill('触发大纲 API 错误')
    await outlineRefineInput.press('Control+Enter')
    let settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible()

    await navigateWithinSpa(
      `/project/${otherProjectId}/outline`,
      'local-outline-other-project',
      { from: 'other-project' }
    )
    await expect(page.getByText('当前查看项目页面')).toBeVisible()
    await settingsAction.click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: '返回编辑器' }).click()
    await expect(page).toHaveURL(new RegExp(`/project/${sourceProjectId}/outline$`))
    await expect.poll(() => page.evaluate(() => window.history.state?.usr)).toEqual({ from: 'history' })

    await navigateWithinSpa(
      `/project/${sourceProjectId}/detail`,
      'local-detail-source-project',
      { from: 'outline' }
    )
    const detailRefineInput = page.getByPlaceholder(/例如：让描述更详细/).first()
    await detailRefineInput.fill('触发描述 API 错误')
    await detailRefineInput.press('Control+Enter')
    settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible()

    await navigateWithinSpa(
      `/project/${otherProjectId}/detail`,
      'local-detail-other-project',
      { from: 'other-project' }
    )
    await expect(page.getByText('当前查看项目页面')).toBeVisible()
    await settingsAction.click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: '返回编辑器' }).click()
    await expect(page).toHaveURL(new RegExp(`/project/${sourceProjectId}/detail$`))
    await expect.poll(() => page.evaluate(() => window.history.state?.usr)).toEqual({ from: 'outline' })
  })

  test('mock: delayed single-page description failure on Home keeps its source route', async ({ page }) => {
    const projectId = 'mock-delayed-single-page-source'
    const pageId = 'mock-delayed-single-page'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'DESCRIPTION_GENERATED',
      pages: [{
        id: pageId,
        page_id: pageId,
        order_index: 0,
        outline_content: { title: '单页错误来源', points: ['要点'] },
        description_content: { text: '保留的单页旧描述' },
        status: 'DESCRIPTION_GENERATED',
      }],
    }
    let requestCount = 0
    let signalRequestStarted!: () => void
    const requestStarted = new Promise<void>((resolve) => { signalRequestStarted = resolve })
    let releaseRequest!: () => void
    const requestRelease = new Promise<void>((resolve) => { releaseRequest = resolve })

    await page.addInitScript(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'streaming',
      }))
      localStorage.setItem('hasSeenHelpModal', 'true')
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

        if (
          url.pathname === `/api/projects/${projectId}/pages/${pageId}/generate/description`
          && request.method() === 'POST'
        ) {
          requestCount += 1
          signalRequestStarted()
          await requestRelease
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
                description_generation_mode: 'streaming',
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
    await expect(page.getByText('保留的单页旧描述')).toBeVisible()
    await page.getByRole('button', { name: '重新生成' }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click()
    await requestStarted

    await page.evaluate(() => {
      const currentState = window.history.state || {}
      window.history.pushState(
        { ...currentState, idx: (currentState.idx ?? 0) + 1, key: 'single-page-failure-home' },
        '',
        '/'
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })
    await expect(page).toHaveURL(/\/$/)

    releaseRequest()
    const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible()
    await settingsAction.click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: '返回编辑器' }).click()

    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/detail$`))
    await expect(page.getByText('保留的单页旧描述')).toBeVisible()
    expect(requestCount).toBe(1)
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
    let staleSourceGetReturned = false
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
          if (taskFailureReturned && !staleSourceGetReturned) {
            staleSourceGetReturned = true
            signalTaskSyncStarted()
            await taskSyncRelease
            return route.fulfill({
              status: 404,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Stale project response' },
              }),
            })
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

    await page.goto('/history')
    await page.evaluate((url) => {
      const currentState = window.history.state || {}
      window.history.pushState(
        {
          ...currentState,
          idx: (currentState.idx ?? 0) + 1,
          key: 'parallel-error-from-history',
          usr: { from: 'history' },
        },
        '',
        url
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    }, `/project/${projectId}/detail`)
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
    expect(await page.evaluate(() => window.history.state?.usr)).toEqual({ from: 'history' })
  })

  test('mock: recovery action keeps the source route after the toast is shown', async ({ page }) => {
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

  test('mock: delayed provider initialization failure keeps recovery bound to its source project', async ({ page }) => {
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
        description_content: { text: '保留的旧描述' },
        status: 'DESCRIPTION_GENERATED',
      }],
    }
    let sourceProjectGetCount = 0
    let signalDescriptionRequestStarted!: () => void
    const descriptionRequestStarted = new Promise<void>((resolve) => {
      signalDescriptionRequestStarted = resolve
    })
    let releaseDescriptionRequest!: () => void
    const descriptionRequestRelease = new Promise<void>((resolve) => {
      releaseDescriptionRequest = resolve
    })

    await page.addInitScript(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'parallel',
      }))
      localStorage.setItem('hasSeenHelpModal', 'true')
    })
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request()
        const url = new URL(request.url())

        if (url.pathname === `/api/projects/${projectId}` && request.method() === 'GET') {
          sourceProjectGetCount += 1
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: project }),
          })
        }

        if (url.pathname === `/api/projects/${projectId}/generate/descriptions` && request.method() === 'POST') {
          signalDescriptionRequestStarted()
          await descriptionRequestRelease
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
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click()
    await descriptionRequestStarted
    const sourceProjectGetCountBeforeLeaving = sourceProjectGetCount

    await page.evaluate(() => {
      const currentState = window.history.state || {}
      window.history.pushState(
        { ...currentState, idx: (currentState.idx ?? 0) + 1, key: 'provider-init-failure-home' },
        '',
        '/'
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })
    await expect(page).toHaveURL(/\/$/)

    releaseDescriptionRequest()
    const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible()
    expect(sourceProjectGetCount).toBe(sourceProjectGetCountBeforeLeaving)
    await settingsAction.click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: '返回编辑器' }).click()
    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/detail$`))
    await expect(page.getByText('保留的旧描述')).toBeVisible()
    await expect(page.getByRole('button', { name: '批量生成描述' })).toBeEnabled()
    await expect(page.getByRole('button', { name: '生成中...' })).toHaveCount(0)
  })

  test('mock: delayed streaming failure keeps recovery bound to its source project', async ({ page }) => {
    const projectId = 'mock-streaming-description-error'
    const pageId = 'mock-streaming-description-page'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'DESCRIPTION_GENERATED',
      pages: [{
        id: pageId,
        page_id: pageId,
        order_index: 0,
        outline_content: { title: '流式描述页', points: ['要点'] },
        description_content: { text: '保留的流式旧描述' },
        status: 'DESCRIPTION_GENERATED',
      }],
    }
    let sourceProjectGetCount = 0
    let signalStreamStarted!: () => void
    const streamStarted = new Promise<void>((resolve) => {
      signalStreamStarted = resolve
    })
    let releaseStream!: () => void
    const streamRelease = new Promise<void>((resolve) => {
      releaseStream = resolve
    })

    await page.addInitScript(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'streaming',
      }))
      localStorage.setItem('hasSeenHelpModal', 'true')
    })
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request()
        const url = new URL(request.url())

        if (url.pathname === `/api/projects/${projectId}` && request.method() === 'GET') {
          sourceProjectGetCount += 1
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: project }),
          })
        }

        if (
          url.pathname === `/api/projects/${projectId}/generate/descriptions/stream`
          && request.method() === 'POST'
        ) {
          signalStreamStarted()
          await streamRelease
          return route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            body: 'event: error\ndata: {"message":"401 Unauthorized: invalid API key"}\n\n',
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

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      }
    )

    try {
      await page.goto(`/project/${projectId}/detail`)
      await page.getByRole('button', { name: '批量生成描述' }).click()
      await page.getByRole('dialog').getByRole('button', { name: '确定' }).click()
      await streamStarted
      const sourceProjectGetCountBeforeLeaving = sourceProjectGetCount

      await page.evaluate(() => {
        const currentState = window.history.state || {}
        window.history.pushState(
          { ...currentState, idx: (currentState.idx ?? 0) + 1, key: 'streaming-failure-home' },
          '',
          '/'
        )
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
      })
      await expect(page).toHaveURL(/\/$/)

      releaseStream()
      const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
      await expect(settingsAction).toBeVisible()
      expect(sourceProjectGetCount).toBe(sourceProjectGetCountBeforeLeaving)
      await settingsAction.click()
      await expect(page).toHaveURL(/\/settings$/)
      await page.getByRole('button', { name: '返回编辑器' }).click()

      await expect(page).toHaveURL(new RegExp(`/project/${projectId}/detail$`))
      await expect(page.getByText('保留的流式旧描述')).toBeVisible()
      await expect(page.getByRole('button', { name: '批量生成描述' })).toBeEnabled()
      await expect(page.getByRole('button', { name: '生成中...' })).toHaveCount(0)
    } finally {
      releaseStream()
    }
  })

  test('mock: Settings waits for an in-flight editor update before loading its form', async ({ page }) => {
    const projectId = 'mock-settings-waits-for-update'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'OUTLINE_GENERATED',
      pages: [{
        id: `${projectId}-page`,
        page_id: `${projectId}-page`,
        order_index: 0,
        outline_content: { title: '设置快照协调', points: ['等待局部保存'] },
        status: 'DRAFT',
      }],
    }
    const serverSettings: Record<string, unknown> = {
      ai_provider_format: 'gemini',
      description_generation_mode: 'streaming',
      description_extra_fields: ['配图与素材', '版式与重点', '演讲者备注'],
      image_prompt_extra_fields: ['配图与素材', '版式与重点'],
    }
    let settingsPageGetCount = 0
    let signalSaveStarted!: () => void
    const saveStarted = new Promise<void>((resolve) => { signalSaveStarted = resolve })
    let releaseSave!: () => void
    const saveRelease = new Promise<void>((resolve) => { releaseSave = resolve })
    let signalSaveCompleted!: () => void
    const saveCompleted = new Promise<void>((resolve) => { signalSaveCompleted = resolve })

    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true')
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

        if (url.pathname === '/api/settings' && request.method() === 'GET') {
          const referer = request.headers()['referer']
          if (referer && new URL(referer).pathname === '/settings') {
            settingsPageGetCount += 1
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: serverSettings }),
          })
        }

        if (url.pathname === '/api/settings' && request.method() === 'PUT') {
          Object.assign(serverSettings, JSON.parse(request.postData() || '{}'))
          const committedSnapshot = { ...serverSettings }
          signalSaveStarted()
          await saveRelease
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: committedSnapshot }),
          })
          signalSaveCompleted()
          return
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      }
    )

    try {
      await page.goto(`/project/${projectId}/detail`)
      await page.getByRole('button', { name: '描述设置' }).click()
      await page.getByRole('button', { name: '并行', exact: true }).click()
      await page.getByRole('button', { name: '演讲者备注' }).click()

      await page.evaluate(() => {
        const currentState = window.history.state || {}
        window.history.pushState(
          { ...currentState, idx: (currentState.idx ?? 0) + 1, key: 'settings-after-editor-save' },
          '',
          '/settings'
        )
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
      })
      await expect(page).toHaveURL(/\/settings$/)
      await saveStarted
      await page.waitForTimeout(500)
      expect(settingsPageGetCount).toBe(0)

      releaseSave()
      await saveCompleted
      await expect.poll(() => settingsPageGetCount).toBeGreaterThan(0)
      await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible()
      expect(await page.evaluate(() => {
        const cached = sessionStorage.getItem('banana-settings')
        if (!cached) return null
        const settings = JSON.parse(cached)
        return {
          mode: settings.description_generation_mode,
          fields: settings.description_extra_fields,
        }
      })).toEqual({
        mode: 'parallel',
        fields: ['配图与素材', '版式与重点'],
      })
    } finally {
      releaseSave()
    }
  })

  test('mock: reopening DetailEditor waits for its pending settings save before loading', async ({ page }) => {
    const projectId = 'mock-detail-reopen-pending-settings'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'OUTLINE_GENERATED',
      pages: [{
        id: `${projectId}-page`,
        page_id: `${projectId}-page`,
        order_index: 0,
        outline_content: { title: '重新打开编辑器', points: ['等待设置保存'] },
        status: 'DRAFT',
      }],
    }
    const serverSettings: Record<string, unknown> = {
      ai_provider_format: 'gemini',
      description_generation_mode: 'streaming',
      description_extra_fields: [],
      image_prompt_extra_fields: [],
    }
    let settingsGetCount = 0
    let signalSaveStarted!: () => void
    const saveStarted = new Promise<void>((resolve) => { signalSaveStarted = resolve })
    let releaseSave!: () => void
    const saveRelease = new Promise<void>((resolve) => { releaseSave = resolve })

    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true')
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

        if (url.pathname === '/api/settings' && request.method() === 'GET') {
          settingsGetCount += 1
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { ...serverSettings } }),
          })
        }

        if (url.pathname === '/api/settings' && request.method() === 'PUT') {
          const updates = JSON.parse(request.postData() || '{}')
          signalSaveStarted()
          await saveRelease
          Object.assign(serverSettings, updates)
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { ...serverSettings } }),
          })
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      }
    )

    try {
      await page.goto(`/project/${projectId}/detail`)
      await page.getByRole('button', { name: '描述设置' }).click()
      await expect(page.getByRole('button', { name: '流式', exact: true })).toHaveClass(/bg-banana-500/)
      const initialSettingsGetCount = settingsGetCount
      await page.getByRole('button', { name: '并行', exact: true }).click()

      await page.evaluate(() => {
        const currentState = window.history.state || {}
        window.history.pushState(
          { ...currentState, idx: (currentState.idx ?? 0) + 1, key: 'pending-settings-home' },
          '',
          '/'
        )
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
      })
      await saveStarted

      await page.evaluate((path) => {
        const currentState = window.history.state || {}
        window.history.pushState(
          { ...currentState, idx: (currentState.idx ?? 0) + 1, key: 'pending-settings-detail' },
          '',
          path
        )
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
      }, `/project/${projectId}/detail`)
      await page.waitForTimeout(300)
      expect(settingsGetCount).toBe(initialSettingsGetCount)

      releaseSave()
      await expect.poll(() => settingsGetCount).toBeGreaterThan(initialSettingsGetCount)
      await page.getByRole('button', { name: '描述设置' }).click()
      await expect(page.getByRole('button', { name: '并行', exact: true })).toHaveClass(/bg-banana-500/)
    } finally {
      releaseSave()
    }
  })

  test('mock: overlapping partial settings saves are serialized before caching', async ({ page }) => {
    const projectId = 'mock-overlapping-settings-saves'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'OUTLINE_GENERATED',
      pages: [{
        id: `${projectId}-page`,
        page_id: `${projectId}-page`,
        order_index: 0,
        outline_content: { title: '并发设置保存', points: ['以服务端最终状态为准'] },
        status: 'DRAFT',
      }],
    }
    const serverSettings: Record<string, unknown> = {
      ai_provider_format: 'gemini',
      description_generation_mode: 'streaming',
      description_extra_fields: ['配图与素材', '版式与重点', '演讲者备注'],
      image_prompt_extra_fields: ['配图与素材', '版式与重点'],
    }
    let signalFirstSaveStarted!: () => void
    const firstSaveStarted = new Promise<void>((resolve) => { signalFirstSaveStarted = resolve })
    let releaseFirstSave!: () => void
    const firstSaveRelease = new Promise<void>((resolve) => { releaseFirstSave = resolve })
    let signalFirstSaveCompleted!: () => void
    const firstSaveCompleted = new Promise<void>((resolve) => { signalFirstSaveCompleted = resolve })
    let signalSecondSaveCompleted!: () => void
    const secondSaveCompleted = new Promise<void>((resolve) => { signalSecondSaveCompleted = resolve })
    let settingsPutCount = 0
    let parallelRequestCount = 0
    let streamingRequestCount = 0

    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true')
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

        if (url.pathname === '/api/settings' && request.method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: serverSettings }),
          })
        }

        if (url.pathname === '/api/settings' && request.method() === 'PUT') {
          settingsPutCount += 1
          const updates = JSON.parse(request.postData() || '{}')
          if ('description_generation_mode' in updates) {
            Object.assign(serverSettings, updates)
            const committedSnapshot = { ...serverSettings }
            signalFirstSaveStarted()
            await firstSaveRelease
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: committedSnapshot }),
            })
            signalFirstSaveCompleted()
            return
          }

          Object.assign(serverSettings, updates)
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: serverSettings }),
          })
          signalSecondSaveCompleted()
          return
        }

        if (url.pathname === `/api/projects/${projectId}/generate/descriptions` && request.method() === 'POST') {
          parallelRequestCount += 1
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: { message: 'stop after endpoint assertion' } }),
          })
        }

        if (url.pathname === `/api/projects/${projectId}/generate/descriptions/stream` && request.method() === 'POST') {
          streamingRequestCount += 1
          return route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            body: 'event: error\ndata: {"message":"stop after endpoint assertion"}\n\n',
          })
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      }
    )

    try {
      await page.goto(`/project/${projectId}/detail`)
      await page.getByRole('button', { name: '描述设置' }).click()
      await page.getByRole('button', { name: '并行', exact: true }).click()
      await firstSaveStarted

      await page.getByRole('button', { name: '演讲者备注' }).click()
      await page.waitForTimeout(1200)
      expect(settingsPutCount).toBe(1)

      releaseFirstSave()
      await firstSaveCompleted
      await secondSaveCompleted
      expect(settingsPutCount).toBe(2)

      await expect.poll(() => page.evaluate(() => {
        const cached = sessionStorage.getItem('banana-settings')
        if (!cached) return null
        const settings = JSON.parse(cached)
        return {
          mode: settings.description_generation_mode,
          fields: settings.description_extra_fields,
        }
      })).toEqual({
        mode: 'parallel',
        fields: ['配图与素材', '版式与重点'],
      })

      await page.getByRole('button', { name: '批量生成描述' }).click()
      await expect.poll(() => parallelRequestCount).toBe(1)
      expect(streamingRequestCount).toBe(0)
    } finally {
      releaseFirstSave()
    }
  })

  test('mock: a failed background task syncs partial results after returning from Home', async ({ page }) => {
    const projectId = 'mock-failed-task-partial-results'
    const taskId = 'mock-failed-task-partial-results-task'
    const pageId = `${projectId}-page`
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'DESCRIPTION_GENERATED',
      pages: [{
        id: pageId,
        page_id: pageId,
        order_index: 0,
        outline_content: { title: '部分成功结果', points: ['后台已提交'] },
        description_content: { text: '旧描述' },
        status: 'DESCRIPTION_GENERATED',
      }],
    }
    const finalProject = {
      ...project,
      pages: [{
        ...project.pages[0],
        description_content: { text: '后端保留的部分成功描述' },
      }],
    }
    let taskFailureReturned = false
    let signalTaskStarted!: () => void
    const taskStarted = new Promise<void>((resolve) => { signalTaskStarted = resolve })

    await page.addInitScript(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'parallel',
      }))
      localStorage.setItem('hasSeenHelpModal', 'true')
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
            body: JSON.stringify({
              success: true,
              data: taskFailureReturned ? finalProject : project,
            }),
          })
        }

        if (url.pathname === `/api/projects/${projectId}/generate/descriptions` && request.method() === 'POST') {
          signalTaskStarted()
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
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click()
    await taskStarted

    await page.evaluate(() => {
      const currentState = window.history.state || {}
      window.history.pushState(
        { ...currentState, idx: (currentState.idx ?? 0) + 1, key: 'failed-task-home' },
        '',
        '/'
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })
    await expect(page).toHaveURL(/\/$/)

    const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
    await expect(settingsAction).toBeVisible({ timeout: 5000 })
    await settingsAction.click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('button', { name: '返回编辑器' }).click()

    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/detail$`))
    await expect(page.getByText('后端保留的部分成功描述')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: '批量生成描述' })).toBeEnabled()
  })

  test('mock: stale same-project sync cannot unlock an active paid generation request', async ({ page }) => {
    const projectId = 'mock-stale-same-project-sync'
    const pageId = 'mock-stale-same-project-page'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'OUTLINE_GENERATED',
      pages: [{
        id: pageId,
        page_id: pageId,
        order_index: 0,
        outline_content: { title: '旧同步快照页面', points: ['要点'] },
        status: 'DRAFT',
      }],
    }
    const completedProject = {
      ...project,
      status: 'DESCRIPTION_GENERATED',
      pages: [{
        ...project.pages[0],
        description_content: { text: '新生成描述' },
        status: 'DESCRIPTION_GENERATED',
      }],
    }
    let projectGetCount = 0
    let signalStaleSyncStarted!: () => void
    const staleSyncStarted = new Promise<void>((resolve) => { signalStaleSyncStarted = resolve })
    let releaseStaleSync!: () => void
    const staleSyncRelease = new Promise<void>((resolve) => { releaseStaleSync = resolve })
    let generationPostCount = 0
    let signalGenerationStarted!: () => void
    const generationStarted = new Promise<void>((resolve) => { signalGenerationStarted = resolve })
    let releaseGeneration!: () => void
    const generationRelease = new Promise<void>((resolve) => { releaseGeneration = resolve })

    await page.addInitScript(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'streaming',
      }))
      localStorage.setItem('hasSeenHelpModal', 'true')
    })
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request()
        const url = new URL(request.url())

        if (url.pathname === `/api/projects/${projectId}` && request.method() === 'GET') {
          projectGetCount += 1
          if (projectGetCount === 3) {
            signalStaleSyncStarted()
            await staleSyncRelease
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: project }),
          })
        }

        if (
          url.pathname === `/api/projects/${projectId}/generate/descriptions/stream`
          && request.method() === 'POST'
        ) {
          generationPostCount += 1
          signalGenerationStarted()
          await generationRelease
          return route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            body: `event: done\ndata: ${JSON.stringify({ total: 1, pages: completedProject.pages })}\n\n`,
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

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      }
    )

    await page.goto(`/project/${projectId}/detail`)
    await expect(page.getByRole('button', { name: '批量生成描述' })).toBeEnabled()
    await staleSyncStarted

    await page.getByRole('button', { name: '批量生成描述' }).click()
    await generationStarted
    await expect(page.getByRole('button', { name: '生成中...' })).toBeDisabled()

    releaseStaleSync()
    await page.waitForTimeout(150)
    await expect(page.getByRole('button', { name: '生成中...' })).toBeDisabled()
    expect(generationPostCount).toBe(1)

    releaseGeneration()
    await expect(page.getByText('新生成描述')).toBeVisible()
    await expect(page.getByRole('button', { name: '批量生成描述' })).toBeEnabled()
  })

  test('mock: an uncertain parallel task keeps batch generation locked', async ({ page }) => {
    const projectId = 'mock-parallel-task-locked'
    const project = {
      id: projectId,
      project_id: projectId,
      creation_type: 'idea',
      status: 'OUTLINE_GENERATED',
      pages: [{
        id: `${projectId}-page`,
        page_id: `${projectId}-page`,
        order_index: 0,
        outline_content: { title: '仍在确认任务状态', points: ['避免重复计费'] },
        status: 'GENERATING_DESCRIPTION',
      }],
    }
    let generationRequestCount = 0

    await page.addInitScript(() => {
      sessionStorage.setItem('banana-settings', JSON.stringify({
        description_generation_mode: 'parallel',
      }))
      localStorage.setItem('hasSeenHelpModal', 'true')
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
          generationRequestCount += 1
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
    const batchButton = page.getByRole('button', { name: '批量生成描述' })
    await expect(batchButton).toBeDisabled()
    await batchButton.click({ force: true })
    expect(generationRequestCount).toBe(0)
  })

  test('integration: description quota error saves real settings and returns to the same project', async ({ page }) => {
    const { projectId } = await seedProjectWithImages(BACKEND_URL, 1)
    const settingsResponse = await fetch(`${BACKEND_URL}/api/settings`)
    const settingsBody = await settingsResponse.json()
    let streamingRequestCount = 0
    let parallelRequestCount = 0
    let settingsSaved = false
    let settingsGetCount = 0
    let signalStaleSettingsGetStarted!: () => void
    const staleSettingsGetStarted = new Promise<void>((resolve) => {
      signalStaleSettingsGetStarted = resolve
    })
    let signalStaleSettingsGetCompleted!: () => void
    const staleSettingsGetCompleted = new Promise<void>((resolve) => {
      signalStaleSettingsGetCompleted = resolve
    })
    let releaseStaleSettingsGet!: () => void
    const staleSettingsGetRelease = new Promise<void>((resolve) => {
      releaseStaleSettingsGet = resolve
    })

    await page.route(
      (url) => url.pathname === '/api/settings',
      async (route) => {
        const method = route.request().method()
        if (method === 'GET') {
          settingsGetCount += 1
          const isStaleEditorRequest = settingsGetCount === 1
          if (isStaleEditorRequest) {
            signalStaleSettingsGetStarted()
            await staleSettingsGetRelease
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ...settingsBody,
              data: {
                ...settingsBody.data,
                description_generation_mode: settingsSaved ? 'parallel' : 'streaming',
              },
            }),
          })
          if (isStaleEditorRequest) signalStaleSettingsGetCompleted()
          return
        }
        if (method === 'PUT') {
          const response = await route.fetch()
          const body = await response.json()
          body.data = { ...body.data, description_generation_mode: 'parallel' }
          settingsSaved = true
          return route.fulfill({ response, json: body })
        }
        return route.continue()
      }
    )

    await page.route(
      (url) => url.pathname === `/api/projects/${projectId}/generate/descriptions/stream`,
      async (route) => {
        streamingRequestCount += 1
        return route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: 'event: error\ndata: {"message":"403 balance is insufficient"}\n\n',
        })
      }
    )
    await page.route(
      (url) => url.pathname === `/api/projects/${projectId}/generate/descriptions`,
      async (route) => {
        parallelRequestCount += 1
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'AI_SERVICE_ERROR', message: 'API key is invalid' },
          }),
        })
      }
    )

    try {
      await page.goto(`/project/${projectId}/detail`)
      await expect(page.getByText('编辑页面描述', { exact: true })).toBeVisible()
      await staleSettingsGetStarted

      await page.getByRole('button', { name: '批量生成描述' }).click()
      const settingsAction = page.getByRole('button', { name: '检查 API 设置' })
      await expect(settingsAction).toBeVisible()
      await settingsAction.click()

      await expect(page).toHaveURL(/\/settings$/)
      await expect(page.getByText('修复 API 配置后返回继续创作')).toBeVisible()
      expect(await page.evaluate(() => {
        const cached = sessionStorage.getItem('banana-settings')
        return cached ? JSON.parse(cached).description_generation_mode : null
      })).toBe('streaming')

      const saveResponse = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.pathname === '/api/settings'
          && response.request().method() === 'PUT'
          && response.status() === 200
      })
      await page.getByRole('button', { name: '保存并返回' }).click()
      await saveResponse

      await expect(page).toHaveURL(new RegExp(`/project/${projectId}/detail$`))
      expect(await page.evaluate(() => {
        const cached = sessionStorage.getItem('banana-settings')
        return cached ? JSON.parse(cached).description_generation_mode : null
      })).toBe('parallel')
      releaseStaleSettingsGet()
      await staleSettingsGetCompleted
      expect(await page.evaluate(() => {
        const cached = sessionStorage.getItem('banana-settings')
        return cached ? JSON.parse(cached).description_generation_mode : null
      })).toBe('parallel')
      await expect(page.getByText('编辑页面描述', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: '批量生成描述' }).click()
      const confirmDialog = page.getByRole('dialog')
      if (await confirmDialog.isVisible().catch(() => false)) {
        await confirmDialog.getByRole('button', { name: '确定' }).click()
      }
      await expect.poll(() => parallelRequestCount).toBe(1)
      expect(streamingRequestCount).toBe(1)
    } finally {
      releaseStaleSettingsGet()
      await page.unrouteAll({ behavior: 'wait' })
      await fetch(`${BACKEND_URL}/api/projects/${projectId}`, { method: 'DELETE' })
    }
  })
})
