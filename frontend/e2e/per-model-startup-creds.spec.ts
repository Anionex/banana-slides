/**
 * Integration E2E test for issue #284:
 * Per-model API credentials must be loaded into app.config on backend startup.
 *
 * Strategy: save per-model settings → restart backend → verify startup logs
 * contain the loaded credentials, proving _load_settings_to_config() works.
 */
import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const backendPort = (() => {
  const m = (process.env.BASE_URL ?? '').match(/:(\d+)$/)
  // backend base=5000, frontend base=3000, same offset → backend = frontend + 2000
  return m ? Number(m[1]) + 2000 : 5000
})()
const BACKEND_URL = `http://localhost:${backendPort}`
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const LOG_FILE = path.join('/tmp', `startup-creds-backend-${process.pid}.log`)

function restartBackend() {
  // Kill existing backend
  try {
    execSync(`lsof -ti:${backendPort} | xargs kill -9 2>/dev/null`, { timeout: 5000 })
  } catch { /* may already be dead */ }
  execSync('sleep 1')
  // Truncate log so we only see fresh startup output
  execSync(`truncate -s 0 ${LOG_FILE}`)
  // Start backend fresh
  execSync(
    `cd ${PROJECT_ROOT}/backend && nohup uv run python app.py >> ${LOG_FILE} 2>&1 &`,
    { timeout: 10000 },
  )
  // Wait for backend to be ready
  for (let i = 0; i < 20; i++) {
    try {
      execSync(`curl -sf --noproxy localhost ${BACKEND_URL}/api/settings`, { timeout: 3000 })
      return
    } catch { execSync('sleep 1') }
  }
  throw new Error('Backend did not start within 20s')
}

// Clean up after all tests: reset settings and remove temp log
test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await page.goto('/settings')
  await page.getByRole('button', { name: /重置/ }).click()
  await page.getByRole('button', { name: /确定重置/ }).click()
  await expect(page.locator('text=已重置').or(page.locator('text=reset'))).toBeVisible({ timeout: 5000 })
  await page.close()
  try { execSync(`rm -f ${LOG_FILE}`) } catch { /* ignore */ }
})

test.describe('Per-model API credentials loaded on startup (#284)', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(60_000)

  test('saved per-model credentials appear in startup logs after restart', async ({ request }) => {
    // 1. Save per-model settings via API (through Vite proxy)
    const payload = {
      text_model_source: 'openai',
      text_api_base_url: 'https://startup-test.example.com/v1',
      text_api_key: 'sk-startup-test-key-284',
    }
    const saveRes = await request.put('/api/settings', { data: payload })
    expect(saveRes.ok()).toBeTruthy()

    // 2. Restart backend
    restartBackend()

    // 3. Read startup logs and verify per-model credentials were loaded
    const logs = execSync(`cat ${LOG_FILE}`).toString()

    expect(logs).toContain('Loaded TEXT_API_BASE from settings: https://startup-test.example.com/v1')
    expect(logs).toContain('Loaded TEXT_API_KEY from settings')
    expect(logs).toContain('Loaded TEXT_MODEL_SOURCE from settings: openai')
  })

  test('settings page shows correct values after backend restart', async ({ page }) => {
    // Navigate to settings — backend was restarted in previous test
    await page.goto('/settings')

    // Find the text model group (first one with a select)
    const textGroup = page.locator('.space-y-4 > div').filter({ has: page.locator('select') }).nth(0)

    // Verify provider is still openai
    await expect(textGroup.locator('select')).toHaveValue('openai')

    // Verify API Base URL persisted
    const baseUrlInput = textGroup.locator('input[type="text"]').nth(1)
    await expect(baseUrlInput).toHaveValue('https://startup-test.example.com/v1')

    // Verify API Key shows placeholder indicating it's set
    const apiKeyInput = textGroup.locator('input[type="password"]')
    const placeholder = await apiKeyInput.getAttribute('placeholder')
    expect(placeholder).toMatch(/长度|length/i)
  })
})
