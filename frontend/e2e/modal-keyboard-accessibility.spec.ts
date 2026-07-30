import { expect, type Page, test } from '@playwright/test'

async function verifyMaterialCenterKeyboardFlow(page: Page) {
  const trigger = page.getByRole('button', { name: '素材中心' }).first()
  await trigger.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: '素材中心' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toBeFocused()

  await page.keyboard.press('Tab')
  const headerClose = dialog.getByRole('button', { name: '关闭' }).first()
  await expect(headerClose).toBeFocused()

  const footerClose = dialog.getByRole('button', { name: '关闭' }).last()
  await footerClose.focus()
  await page.keyboard.press('Tab')
  await expect(headerClose).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
}

async function mockHomeApi(page: Page) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const pathname = new URL(route.request().url()).pathname
    let data: Record<string, unknown> = {}

    if (pathname === '/api/access-code/check') data = { enabled: false }
    if (pathname === '/api/materials') data = { materials: [], count: 0 }
    if (pathname === '/api/projects') data = { projects: [], total: 0 }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    })
  })
}

test.describe('Shared modal keyboard accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hasSeenHelpModal', 'true')
      localStorage.setItem('banana-slides-language', 'zh')
    })
  })

  test('mock: traps focus and restores the trigger', async ({ page }) => {
    await mockHomeApi(page)

    await page.goto('/')
    await verifyMaterialCenterKeyboardFlow(page)
  })

  test('help dialog exposes the current guide page as its accessible name', async ({ page }) => {
    await mockHomeApi(page)
    await page.goto('/')

    await page.getByRole('button', { name: '帮助' }).first().click()
    const firstPage = page.getByRole('dialog', { name: '快速开始' })
    await expect(firstPage).toBeVisible()

    await firstPage.getByRole('button', { name: '下一页' }).click()
    await expect(page.getByRole('dialog', { name: '功能介绍' })).toBeVisible()
  })

  test('integration: works with the real material-center API', async ({ page }) => {
    await page.goto('/')
    await verifyMaterialCenterKeyboardFlow(page)
  })
})
