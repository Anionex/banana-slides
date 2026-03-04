import { test, expect } from '@playwright/test'

const PROJECT_ID = 'mock-null-outline'

const mockProject = {
  project_id: PROJECT_ID,
  status: 'OUTLINE_GENERATED',
  idea_prompt: 'Test project',
  pages: [
    {
      page_id: 'page-1',
      order_index: 0,
      outline_content: { title: 'Normal Page', points: ['Point A', 'Point B'] },
      status: 'DRAFT',
    },
    {
      page_id: 'page-2',
      order_index: 1,
      outline_content: null,
      status: 'DRAFT',
    },
  ],
  created_at: '2025-01-01T00:00:00',
  updated_at: '2025-01-01T00:00:00',
}

test.describe('OutlineCard null outline_content', () => {
  test('renders without crash when outline_content is null', async ({ page }) => {
    await page.route('**/api/projects/' + PROJECT_ID, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockProject }),
      })
    })

    // Navigate to outline editor
    await page.goto(`/project/${PROJECT_ID}/outline`)

    // The normal page should render its title
    await expect(page.getByText('Normal Page')).toBeVisible()

    // Page 2 (null outline) should render without crashing — check page number label
    await expect(page.getByText(/Page 2|第 2 页/)).toBeVisible()
  })
})
