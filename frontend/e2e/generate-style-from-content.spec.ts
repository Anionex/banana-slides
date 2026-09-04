import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3011';

test.describe('Generate Style from Content E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hasSeenHelpModal', 'true'));
  });

  test('generates style from home content input and applies to text area', async ({ page }) => {
    // Mock the backend generate-style-from-content API
    await page.route((url) => url.pathname.startsWith('/api/generate-style-from-content'), async (route) => {
      const json = {
        success: true,
        message: 'Success',
        data: {
          style_description: '视觉描述：医疗极简科技风。\n配色与材质：背景纯白（#FFFFFF），强调色医疗蓝（#0284C7）。\n内容与排版：现代无衬线体，模块化网格。\n插图与渲染要求：矢量线稿插画。',
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(json),
      });
    });

    await page.goto(BASE_URL);

    // Turn on "使用文字描述风格" (checkbox toggle)
    const toggle = page.getByText(/使用文字描述风格|Use text description for style/);
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();

    // Try clicking "根据内容生成风格" without inputting content first
    const generateStyleBtn = page.getByRole('button', { name: /根据内容生成风格|Generate from content/i });
    await expect(generateStyleBtn).toBeVisible();
    await generateStyleBtn.click();

    // Verify error toast for empty content
    await expect(page.locator('text=请先输入 PPT 主题或内容，再根据内容生成风格').or(page.locator('text=Please enter PPT topic or content first'))).toBeVisible();

    // Now type some content in the main idea/outline input (the first textbox on page)
    const contentInput = page.getByRole('textbox').first();
    await contentInput.fill('智慧医疗AI辅助诊断系统技术方案与落地实践');

    // Click "根据内容生成风格" again
    await generateStyleBtn.click();

    // Verify success toast
    await expect(page.locator('text=风格生成成功').or(page.locator('text=Style generated successfully'))).toBeVisible();

    // Verify that the style textarea now has the generated style description
    const styleTextarea = page.locator('textarea[placeholder*="例如：简约商务风格"], textarea[placeholder*="Describe your desired PPT style"]');
    await expect(styleTextarea).toHaveValue(/视觉描述：医疗极简科技风/);
  });
});



