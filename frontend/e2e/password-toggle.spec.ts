import { test, expect } from '@playwright/test'

const toggle = (id: string) => `${id} + button`

test.describe('Password visibility toggle', () => {
  test('login page - toggle password visibility', async ({ page }) => {
    await page.goto('/login')
    const input = page.locator('#password')
    const btn = page.locator(toggle('#password'))

    await expect(input).toHaveAttribute('type', 'password')
    await btn.click()
    await expect(input).toHaveAttribute('type', 'text')
    await btn.click()
    await expect(input).toHaveAttribute('type', 'password')
  })

  test('register page - toggle both password fields', async ({ page }) => {
    await page.goto('/register')
    for (const id of ['#password', '#confirmPassword']) {
      const input = page.locator(id)
      const btn = page.locator(toggle(id))

      await expect(input).toHaveAttribute('type', 'password')
      await btn.click()
      await expect(input).toHaveAttribute('type', 'text')
      await btn.click()
      await expect(input).toHaveAttribute('type', 'password')
    }
  })

  test('reset password page - toggle both password fields', async ({ page }) => {
    await page.goto('/reset-password?token=test')
    for (const id of ['#password', '#confirmPassword']) {
      const input = page.locator(id)
      const btn = page.locator(toggle(id))

      await expect(input).toHaveAttribute('type', 'password')
      await btn.click()
      await expect(input).toHaveAttribute('type', 'text')
      await btn.click()
      await expect(input).toHaveAttribute('type', 'password')
    }
  })
})
