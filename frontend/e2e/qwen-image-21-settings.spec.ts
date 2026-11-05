import { expect, test } from '@playwright/test'

test('real backend saves and reloads Qwen Image 2.1 settings', async ({ page }) => {
  await page.goto('/settings')
  const imageModel = page.getByPlaceholder('留空使用环境变量配置 (如: imagen-3.0-generate-001)')
  const imageSource = page.getByTestId('image_model_source-select')
  const originalModel = await imageModel.inputValue()
  const originalSource = await imageSource.inputValue()

  try {
    await imageModel.fill('qwen-image-2.1')
    await imageSource.selectOption('qwen')
    await page.getByRole('button', { name: '保存设置' }).click()
    await expect(page.getByText('设置保存成功')).toBeVisible()

    await page.reload()
    await expect(imageModel).toHaveValue('qwen-image-2.1')
    await expect(imageSource).toHaveValue('qwen')
  } finally {
    await imageModel.fill(originalModel)
    await imageSource.selectOption(originalSource)
    await page.getByRole('button', { name: '保存设置' }).click()
    await expect(page.getByText('设置保存成功')).toBeVisible()
  }
})
