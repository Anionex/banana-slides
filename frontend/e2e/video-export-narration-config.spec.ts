import { test, expect } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

const FRONTEND_URL = process.env.BASE_URL || 'http://127.0.0.1:3011'
const frontendUrl = new URL(FRONTEND_URL)
const BACKEND_URL = process.env.BACKEND_URL || `${frontendUrl.protocol}//${frontendUrl.hostname}:${Number(frontendUrl.port || 3011) + 2000}`

test.describe('Video export narration config', () => {
  test('sends narration strategy from the final export panel', async ({ page }) => {
    const projectId = 'mock-video-export-config'
    let exportPayload: any = null

    await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
      const url = new URL(route.request().url())

      if (url.pathname === `/api/projects/${projectId}/export/video`) {
        exportPayload = route.request().postDataJSON()
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { task_id: 'video-task-1' } }),
        })
      }

      if (url.pathname === `/api/projects/${projectId}/tasks/video-task-1`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              task_id: 'video-task-1',
              status: 'RUNNING',
              progress: { total: 100, completed: 20 },
            },
          }),
        })
      }

      if (url.pathname === `/api/projects/${projectId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: projectId,
              id: projectId,
              idea_prompt: 'Nvidia annual report and roadmap',
              status: 'COMPLETED',
              template_style: 'default',
              export_allow_partial: true,
              pages: [
                {
                  id: 'p1',
                  page_id: 'p1',
                  order_index: 0,
                  generated_image_path: '/files/mock/1.png',
                  outline_content: { title: 'Revenue breakout', points: ['AI', 'Data center'] },
                  description_content: { text: 'Revenue keeps accelerating.' },
                  status: 'COMPLETED',
                },
              ],
            },
          }),
        })
      }

      if (url.pathname === '/api/settings') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
      }
      if (url.pathname === '/api/output-language') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { language: 'zh' } }) })
      }
      if (url.pathname === '/api/user-templates') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { templates: [] } }) })
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
    })

    await page.route('**/files/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(100) })
    })

    await page.goto(`/project/${projectId}/preview`)
    await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 })

    await page.locator('button:has-text("导出")').first().click()
    await page.locator('button:has-text("导出为讲解视频")').click()

    await page.locator('select').nth(0).selectOption('confident corporate executive')
    await page.locator('select').nth(1).selectOption('potential investors and venture capitalists')
    await page.locator('select').nth(2).selectOption('inspiring, passionate, and persuasive')
    await page.locator('button:has-text("高级配置")').click()
    await page.locator('input[type="text"]').fill('our company 2025 annual financial report and 2026 strategic plan')
    await page.locator('input[type="number"]').nth(0).fill('80')
    await page.locator('input[type="number"]').nth(1).fill('140')
    await page.locator('button:has-text("开始导出")').click()

    await expect.poll(() => exportPayload).not.toBeNull()
    expect(exportPayload.generate_narration).toBe(true)
    expect(exportPayload.presentation_topic).toBe('our company 2025 annual financial report and 2026 strategic plan')
    expect(exportPayload.narration_config).toMatchObject({
      speaker_persona: 'confident corporate executive',
      target_audience: 'potential investors and venture capitalists',
      speech_tone: 'inspiring, passionate, and persuasive',
      presentation_topic: 'our company 2025 annual financial report and 2026 strategic plan',
      min_words: 80,
      max_words: 140,
    })
  })

  test('shows preparation state and blocks the dialog when settings cannot load', async ({ page }) => {
    const projectId = 'mock-video-settings-failure'
    let settingsRequests = 0
    let failSettings = false
    let releaseSettingsFailure!: () => void
    const settingsFailureGate = new Promise<void>((resolve) => {
      releaseSettingsFailure = resolve
    })

    await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
      const url = new URL(route.request().url())

      if (url.pathname === `/api/projects/${projectId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: projectId,
              id: projectId,
              status: 'IMAGES_GENERATED',
              template_style: 'default',
              pages: [{
                id: 'p1',
                page_id: 'p1',
                order_index: 0,
                generated_image_path: '/files/mock/1.png',
                outline_content: { title: 'Settings failure regression' },
                status: 'COMPLETED',
              }],
            },
          }),
        })
      }

      if (url.pathname === '/api/settings') {
        settingsRequests += 1
        if (!failSettings) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: {} }),
          })
        }

        await settingsFailureGate
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { message: 'settings unavailable' } }),
        })
      }

      if (url.pathname === '/api/output-language') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { language: 'zh' } }) })
      }
      if (url.pathname === '/api/user-templates') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { templates: [] } }) })
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
    })

    await page.route('**/files/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(100) })
    })

    await page.goto(`/project/${projectId}/preview`)
    await expect(page.getByText('Settings failure regression')).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(settingsRequests).toBeGreaterThan(0)
    failSettings = true

    await page.locator('button:has-text("导出")').first().click()
    await page.getByRole('button', { name: '导出为讲解视频' }).click()

    const loadingButton = page.getByRole('button', { name: '正在加载视频设置...' })
    await expect(loadingButton).toBeVisible()
    await expect(loadingButton).toBeDisabled()
    await page.locator('button:has-text("导出")').first().click()
    releaseSettingsFailure()

    await expect(page.getByRole('heading', { name: '讲解视频导出设置' })).toBeHidden()
    await expect(page.getByText('无法加载视频导出设置，请重试后再导出')).toBeHidden()

    await page.locator('button:has-text("导出")').first().click()
    const retryButton = page.getByRole('button', { name: '导出为讲解视频' })
    await expect(retryButton).toBeEnabled()
    await retryButton.click()
    await expect(page.getByText('无法加载视频导出设置，请重试后再导出')).toBeVisible()
    await expect(page.getByRole('heading', { name: '讲解视频导出设置' })).toBeHidden()
    await expect(page.getByRole('button', { name: '导出为讲解视频' })).toBeEnabled()
  })

  test('shows an ElevenLabs error and initializes the first voice on retry', async ({ page }) => {
    const projectId = 'mock-video-voices-failure'
    let voiceRequests = 0

    await page.addInitScript(() => {
      window.localStorage.setItem('elevenLabsEnabled', 'true')
      window.localStorage.setItem('elevenLabsVoiceId', 'stale-voice-id')
    })
    await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
      const url = new URL(route.request().url())

      if (url.pathname === `/api/projects/${projectId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: projectId,
              id: projectId,
              status: 'IMAGES_GENERATED',
              template_style: 'default',
              pages: [{
                id: 'p1',
                page_id: 'p1',
                order_index: 0,
                generated_image_path: '/files/mock/1.png',
                outline_content: { title: 'Voice failure regression' },
                status: 'COMPLETED',
              }],
            },
          }),
        })
      }

      if (url.pathname === '/api/settings') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { elevenlabs_api_key_length: 8, output_language: 'zh' },
          }),
        })
      }
      if (url.pathname === '/api/settings/elevenlabs-voices') {
        voiceRequests += 1
        if (voiceRequests > 1) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { voices: [{ id: 'zh-voice-1', name: '测试中文音色', languages: ['zh'] }] },
            }),
          })
        }
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: '音色服务暂不可用，请稍后重试' }),
        })
      }
      if (url.pathname === '/api/output-language') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { language: 'zh' } }) })
      }
      if (url.pathname === '/api/user-templates') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { templates: [] } }) })
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })
    })
    await page.route('**/files/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(100) })
    })

    await page.goto(`/project/${projectId}/preview`)
    await expect(page.getByText('Voice failure regression')).toBeVisible()

    await page.locator('button:has-text("导出")').first().click()
    await page.getByRole('button', { name: '导出为讲解视频' }).click()

    await expect(page.getByText('音色服务暂不可用，请稍后重试')).toBeVisible()
    await expect(page.getByRole('heading', { name: '讲解视频导出设置' })).toBeVisible()

    await page.getByRole('button', { name: '取消' }).click()
    await page.locator('button:has-text("导出")').first().click()
    await page.getByRole('button', { name: '导出为讲解视频' }).click()

    const selects = page.locator('select')
    await expect(selects).toHaveCount(4)
    await expect(selects.nth(3)).toHaveValue('zh-voice-1')
  })

  test('real backend loads settings before opening the video export panel', async ({ page }) => {
    const { projectId } = await seedProjectWithImages(BACKEND_URL, 1)

    try {
      await page.goto(`/project/${projectId}/preview`)
      await expect(page.getByText('Slide 1')).toBeVisible()

      await page.locator('button:has-text("导出")').first().click()
      await page.getByRole('button', { name: '导出为讲解视频' }).click()

      await expect(page.getByRole('heading', { name: '讲解视频导出设置' })).toBeVisible()
    } finally {
      try {
        await fetch(`${BACKEND_URL}/api/projects/${projectId}`, { method: 'DELETE' })
      } catch (error) {
        console.warn('Failed to clean up video export E2E project:', error)
      }
    }
  })
})
