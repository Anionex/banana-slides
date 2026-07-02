/**
 * Mock E2E test: DetailEditor UI modernization.
 *
 * Verifies the redesigned chrome (brand Logo, section-titled toolbar, progress ring,
 * icon-button settings/overflow menus) and the restyled DescriptionCard
 * (page-number badge, always-visible edit/regenerate icon buttons, empty state).
 *
 * These are the user-facing changes of the "更现代、更美观、更友善" redesign —
 * all assertions target behavior that would break if the redesign regressed.
 */
import { test, expect } from '@playwright/test'

const PROJECT_ID = 'mock-proj-detail-redesign'
const DESC_1 = 'Description text for the first page'

function makePage(id: string, index: number, title: string, description?: string) {
  return {
    id,
    page_id: id,
    title,
    sort_order: index,
    order_index: index,
    status: description ? 'DESCRIPTION_GENERATED' : 'DRAFT',
    outline_content: { title, points: [`Point for ${title}`] },
    description_content: description ? { text: description } : null,
    generated_image_path: null,
  }
}

test.describe('DetailEditor redesign', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test.beforeEach(async ({ page }) => {
    // 3 pages: 2 with descriptions, 1 without (drives the 2/3 progress ring + empty state)
    await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            project_id: PROJECT_ID, id: PROJECT_ID,
            status: 'DESCRIPTIONS_GENERATED', creation_type: 'idea',
            pages: [
              makePage('p1', 0, 'Page One', DESC_1),
              makePage('p2', 1, 'Page Two', 'Description text for the second page'),
              makePage('p3', 2, 'Page Three'),
            ],
          },
        }),
      })
    })

    await page.route('**/api/projects/*/files*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    })
  })

  async function gotoDetail(page: import('@playwright/test').Page) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3011'
    await page.goto(`${baseUrl}/project/${PROJECT_ID}/detail`)
    await expect(page.getByText(DESC_1)).toBeVisible({ timeout: 10000 })
  }

  test('header shows brand Logo and section title with progress', async ({ page }) => {
    await gotoDetail(page)

    // Brand logo image (replaces the old 🍌 emoji)
    const logo = page.locator('header img[src="/logo.png"]')
    await expect(logo).toBeVisible()

    // Section-titled toolbar
    await expect(
      page.getByRole('heading', { name: /页面描述|Page Descriptions/ })
    ).toBeVisible()

    // Progress shown as an editorial fraction — 2 of 3 pages completed.
    // Numbers are split across spans, so assert via the accessible label.
    await expect(page.getByLabel(/2 \/ 3/)).toBeVisible()
    // Zero-padded completed count is the banana focal numeral
    await expect(page.getByText('02', { exact: true }).first()).toBeVisible()
  })

  test('settings icon button toggles the requirements popover', async ({ page }) => {
    await gotoDetail(page)

    const settingsBtn = page.getByRole('button', { name: /描述设置|Description Settings/ })
    await expect(settingsBtn).toBeVisible()

    // Popover closed initially
    await expect(page.getByTestId('desc-requirements-textarea')).toHaveCount(0)

    await settingsBtn.click()
    await expect(page.getByTestId('desc-requirements-textarea')).toBeVisible()
  })

  test('overflow menu exposes export and import actions', async ({ page }) => {
    await gotoDetail(page)

    const overflowBtn = page.getByRole('button', { name: /导入|导出|Import|Export/ }).last()
    await overflowBtn.click()

    await expect(page.getByRole('button', { name: /导出描述|Export Descriptions/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /导出大纲|Export Outline/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /导入|Import/ }).last()).toBeVisible()
  })

  test('cards show page-number badges and always-visible icon actions', async ({ page }) => {
    await gotoDetail(page)

    // Zero-padded page-number badges. '01' is unique to a card badge; '02'/'03'
    // also appear in the toolbar progress fraction, so assert the first match.
    await expect(page.getByText('01', { exact: true })).toBeVisible()
    await expect(page.getByText('02', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('03', { exact: true }).first()).toBeVisible()

    // Edit + regenerate are always-visible icon buttons (no hover needed) — mobile-friendly
    const editButtons = page.getByRole('button', { name: /^编辑$|^Edit$/ })
    expect(await editButtons.count()).toBeGreaterThanOrEqual(3)
    await expect(editButtons.first()).toBeVisible()

    const regenButtons = page.getByRole('button', { name: /重新生成|Regenerate/ })
    expect(await regenButtons.count()).toBeGreaterThanOrEqual(3)
    await expect(regenButtons.first()).toBeVisible()
  })

  test('edit icon opens the edit modal', async ({ page }) => {
    await gotoDetail(page)

    await page.getByRole('button', { name: /^编辑$|^Edit$/ }).first().click()
    await expect(
      page.getByText(/编辑页面描述|Edit Descriptions/).first()
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /保存|Save/ })).toBeVisible()
  })

  test('page without description shows the empty state', async ({ page }) => {
    await gotoDetail(page)
    await expect(
      page.getByText(/还没有生成描述|No description generated yet/)
    ).toBeVisible()
  })
})
