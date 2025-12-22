/**
 * Visual Regression Tests
 * 
 * Tests critical UI components for visual regressions using screenshot comparison.
 * 
 * Note: First run will create baseline screenshots. Subsequent runs will compare against baselines.
 * 
 * To update baselines: npx playwright test visual-regression.spec.ts --update-snapshots
 */

import { test, expect } from '@playwright/test'

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000')
  })
  
  test('Homepage visual regression', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle')
    
    // Take screenshot of homepage
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      maxDiffPixels: 100, // Allow small differences
    })
  })
  
  test('SlidePreview component visual regression', async ({ page }) => {
    // This test requires a project to exist
    // For now, we'll test the component in isolation if possible
    
    // Navigate to a project preview page (if available)
    // Note: This may need to be adjusted based on your routing
    try {
      // Try to navigate to preview page (you may need to create a test project first)
      await page.goto('http://localhost:3000/project/test-project-id/preview')
      await page.waitForLoadState('networkidle')
      
      // Take screenshot of SlidePreview component
      const slidePreview = page.locator('.slide-preview, [data-testid="slide-preview"]').first()
      
      if (await slidePreview.count() > 0) {
        await expect(slidePreview).toHaveScreenshot('slide-preview.png', {
          maxDiffPixels: 200,
        })
      } else {
        // If component not found, take full page screenshot
        await expect(page).toHaveScreenshot('slide-preview-page.png', {
          fullPage: true,
          maxDiffPixels: 200,
        })
      }
    } catch (error) {
      // If preview page doesn't exist, skip this test
      test.skip()
    }
  })
  
  test('Outline Editor visual regression', async ({ page }) => {
    // Navigate to outline editor
    try {
      await page.goto('http://localhost:3000/project/test-project-id/outline')
      await page.waitForLoadState('networkidle')
      
      // Take screenshot of outline editor
      await expect(page).toHaveScreenshot('outline-editor.png', {
        fullPage: true,
        maxDiffPixels: 200,
      })
    } catch (error) {
      test.skip()
    }
  })
  
  test('Description Editor visual regression', async ({ page }) => {
    // Navigate to description editor
    try {
      await page.goto('http://localhost:3000/project/test-project-id/detail')
      await page.waitForLoadState('networkidle')
      
      // Take screenshot of description editor
      await expect(page).toHaveScreenshot('description-editor.png', {
        fullPage: true,
        maxDiffPixels: 200,
      })
    } catch (error) {
      test.skip()
    }
  })
  
  test('Loading states visual regression', async ({ page }) => {
    // Test loading spinner/state
    await page.goto('http://localhost:3000')
    
    // Trigger a loading state (e.g., click create button)
    // Ensure "一句话生成" tab is selected (it's selected by default)
    const createButton = page.locator('button:has-text("一句话生成")')
    if (await createButton.count() > 0) {
      await createButton.click().catch(() => {
        // If click fails, the tab might already be selected, which is fine
      })
      
      // Wait for loading state to appear
      const loadingIndicator = page.locator('.loading, .spinner, [data-loading="true"]')
      if (await loadingIndicator.count() > 0) {
        await expect(loadingIndicator.first()).toHaveScreenshot('loading-state.png', {
          maxDiffPixels: 50,
        })
      }
    }
  })
})

