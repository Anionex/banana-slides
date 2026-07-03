/**
 * E2E (real backend): after uploading a template image, the "Analyzing" badge
 * must auto-refresh to a terminal state ("Analyzed" / "Analysis failed")
 * without a manual page reload.
 *
 * Regression guard: handleReanalyze polled + refreshed, but the first upload
 * did not — so the badge stuck on "Analyzing" until the user reloaded. The fix
 * polls the analyze task inside the store's uploadTemplateAsset and refreshes
 * the library when it finishes. On the old code this test times out on the
 * terminal-state assertion; with the fix it passes.
 */
import { test, expect } from '@playwright/test'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011'
const BACKEND_URL = BASE_URL.replace(/:\d+$/, (m) => `:${parseInt(m.slice(1)) + 2000}`)

async function createMultiProject(): Promise<string> {
  const resp = await fetch(`${BACKEND_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_type: 'idea',
      idea_prompt: 'analyze autorefresh e2e',
      template_style: 'default',
    }),
  })
  const json = await resp.json()
  const projectId = json.data.project_id
  await fetch(`${BACKEND_URL}/api/projects/${projectId}/template-mode`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'multi' }),
  })
  return projectId
}

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))
})

test('uploaded template badge auto-refreshes off "Analyzing" without manual reload', async ({
  page,
}) => {
  const projectId = await createMultiProject()

  await page.goto(`${BASE_URL}/project/${projectId}/template-setup`)
  await page.waitForLoadState('networkidle')

  // Upload a real template image through the hidden image file input.
  const fixture = path.resolve('e2e/fixtures/slide_1.jpg')
  await page.setInputFiles('input[type="file"][accept*="image"]', fixture)

  // The asset card (and its analyzing badge) appears.
  await expect(
    page.getByText(/解析中|Analyzing|已解析|Analyzed|解析失败|Analysis failed/).first()
  ).toBeVisible({ timeout: 15000 })

  // Crucially: WITHOUT reloading the page, the background poll must move the
  // badge to a terminal state. On the pre-fix code this never happens.
  await expect(
    page.getByText(/已解析|Analyzed|解析失败|Analysis failed/).first()
  ).toBeVisible({ timeout: 120000 })
})
