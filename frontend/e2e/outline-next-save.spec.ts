import { expect, test, type Page, type Route } from '@playwright/test'

const PROJECT_ID = 'outline-next-save'

const project = {
  id: PROJECT_ID,
  project_id: PROJECT_ID,
  title: 'Outline save guard',
  status: 'OUTLINE_GENERATED',
  creation_type: 'idea',
  idea_prompt: 'Original idea',
  pages: [
    {
      id: 'page-1',
      page_id: 'page-1',
      project_id: PROJECT_ID,
      order_index: 0,
      outline_content: { title: 'First page', points: ['Key point'] },
      status: 'DRAFT',
    },
  ],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

async function setupProjectRoutes(page: Page, saveRoute: (route: Route) => Promise<void>) {
  await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'))

  await page.route(`**/api/projects/${PROJECT_ID}`, async (route) => {
    if (route.request().method() === 'PUT') {
      await saveRoute(route)
      return
    }

    await route.fulfill({ json: { success: true, data: project } })
  })
  await page.route(`**/api/reference-files/project/${PROJECT_ID}`, route =>
    route.fulfill({ json: { success: true, data: { files: [] } } })
  )
}

async function changeSourceAndContinue(page: Page) {
  await page.goto(`/project/${PROJECT_ID}/outline`)
  const sourceEditor = page.locator('main [contenteditable="true"]:visible').first()
  await expect(sourceEditor).toBeVisible()
  await sourceEditor.fill('Updated idea that must be saved')
  await page.getByRole('button', { name: /下一步|Next/ }).click()
}

test.describe('Outline Next save guard', () => {
  test('stays in the outline editor and explains the unsaved change when saving fails', async ({ page }) => {
    let saveAttempts = 0
    await setupProjectRoutes(page, async (route) => {
      saveAttempts += 1
      await route.fulfill({
        status: 500,
        json: { success: false, error: { message: 'Temporary save failure' } },
      })
    })

    await changeSourceAndContinue(page)

    await expect(page).toHaveURL(new RegExp(`/project/${PROJECT_ID}/outline$`))
    await expect(page.getByText(/当前修改尚未保存|current changes have not been saved/i)).toBeVisible()
    expect(saveAttempts).toBe(1)
  })

  test('navigates only after the changed source input is saved successfully', async ({ page }) => {
    let savedPayload: Record<string, unknown> | undefined
    await setupProjectRoutes(page, async (route) => {
      savedPayload = route.request().postDataJSON()
      await route.fulfill({
        json: {
          success: true,
          data: { ...project, ...savedPayload },
        },
      })
    })

    await changeSourceAndContinue(page)

    await expect(page).toHaveURL(new RegExp(`/project/${PROJECT_ID}/detail$`))
    expect(savedPayload).toEqual({ idea_prompt: 'Updated idea that must be saved' })
  })

  test('integration: saves the changed source through the real backend before navigating', async ({ page, request }) => {
    const createResponse = await request.post('/api/projects', {
      data: { creation_type: 'idea', idea_prompt: 'Integration original idea' },
    })
    expect(createResponse.ok()).toBeTruthy()
    const created = await createResponse.json()
    const projectId = created.data.project_id as string

    try {
      const pageResponse = await request.post(`/api/projects/${projectId}/pages`, {
        data: {
          order_index: 0,
          outline_content: { title: 'Integration page', points: ['Real backend'] },
        },
      })
      expect(pageResponse.ok()).toBeTruthy()

      await page.goto(`/project/${projectId}/outline`)
      const sourceEditor = page.locator('main [contenteditable="true"]:visible').first()
      await expect(sourceEditor).toBeVisible()
      await sourceEditor.fill('Persisted through the real backend')
      await page.getByRole('button', { name: /下一步|Next/ }).click()
      await expect(page).toHaveURL(new RegExp(`/project/${projectId}/detail$`))

      const projectResponse = await request.get(`/api/projects/${projectId}`)
      expect(projectResponse.ok()).toBeTruthy()
      const persisted = await projectResponse.json()
      expect(persisted.data.idea_prompt).toBe('Persisted through the real backend')
    } finally {
      await request.delete(`/api/projects/${projectId}`)
    }
  })
})
