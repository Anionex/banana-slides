import { test, expect } from '@playwright/test';
import { seedProjectWithImages } from './helpers/seed-project';

test.describe('MaterialModal Component', () => {
  let baseURL: string;
  let projectId: string;

  test.beforeAll(async () => {
    baseURL = process.env.BASE_URL || 'http://localhost:5173';
    const seeded = await seedProjectWithImages(baseURL, 2);
    projectId = seeded.projectId;
  });

  test('Select mode: can select and confirm materials', async ({ page }) => {
    // 导航到预览页面
    await page.goto(`${baseURL}/project/${projectId}/preview`);
    await page.waitForLoadState('networkidle');

    // Mock 素材列表 API
    await page.route('**/api/materials*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            materials: [
              {
                id: 'mat1',
                filename: 'test1.jpg',
                url: '/uploads/test1.jpg',
                created_at: '2024-01-01T00:00:00Z',
              },
              {
                id: 'mat2',
                filename: 'test2.jpg',
                url: '/uploads/test2.jpg',
                created_at: '2024-01-02T00:00:00Z',
              },
            ],
          },
        }),
      });
    });

    // 打开素材选择器（假设有一个按钮触发）
    // 注：实际按钮位置需要根据页面结构调整
    const selectButton = page.getByText('从素材库选择').first();
    if (await selectButton.isVisible()) {
      await selectButton.click();
    }

    // 验证模态框打开，标题为"选择素材"
    await expect(page.getByRole('heading', { name: '选择素材' })).toBeVisible();

    // 选择第一个素材
    const firstMaterial = page.locator('.aspect-video').first();
    await firstMaterial.click();

    // 验证选中状态
    await expect(firstMaterial).toHaveClass(/border-banana-500/);

    // 点击确认按钮
    const confirmButton = page.getByRole('button', { name: /确定/ });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // 验证模态框关闭
    await expect(page.getByRole('heading', { name: '选择素材' })).not.toBeVisible();
  });

  test('Manage mode: can browse and manage materials', async ({ page }) => {
    // 导航到首页
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');

    // Mock 素材列表 API
    await page.route('**/api/materials*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            materials: [
              {
                id: 'mat1',
                filename: 'test1.jpg',
                url: '/uploads/test1.jpg',
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
          },
        }),
      });
    });

    // 打开素材中心（假设首页有素材中心按钮）
    const materialCenterButton = page.getByText('素材中心').first();
    if (await materialCenterButton.isVisible()) {
      await materialCenterButton.click();
    }

    // 验证模态框打开，标题为"素材中心"
    await expect(page.getByRole('heading', { name: '素材中心' })).toBeVisible();

    // 选择素材
    const material = page.locator('.aspect-video').first();
    await material.click();

    // 验证选中状态
    await expect(material).toHaveClass(/border-banana-500/);

    // 验证有批量下载按钮（管理模式特有）
    await expect(page.getByRole('button', { name: /下载/ })).toBeVisible();

    // 关闭模态框
    await page.getByRole('button', { name: '关闭' }).click();

    // 验证模态框关闭
    await expect(page.getByRole('heading', { name: '素材中心' })).not.toBeVisible();
  });
});
