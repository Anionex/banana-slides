/**
 * UI-driven E2E test with Mocked Backend
 * 
 * This test simulates the complete user operation flow but mocks all backend API calls.
 * This allows fast testing (1-2 minutes) without waiting for real AI generation.
 * 
 * Use this for:
 * - Quick UI regression testing
 * - CI/CD pipeline (fast feedback)
 * - Development iteration
 * 
 * For real E2E testing with actual AI, use ui-full-flow.spec.ts
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

test.describe('UI-driven E2E test (Mocked Backend)', () => {
  test.setTimeout(2 * 60 * 1000) // 2 minutes max
  
  test('User Full Flow: Create and export PPT with mocked API', async ({ page }) => {
    console.log('\n========================================')
    console.log('🌐 Starting UI-driven E2E test (Mocked Backend)')
    console.log('========================================\n')
    
    // Mock API responses
    await page.route('**/api/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: 'mock-project-123',
              status: 'DRAFT'
            }
          })
        })
      } else {
        await route.continue()
      }
    })
    
    // Mock outline generation
    await page.route('**/api/projects/*/generate/outline', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { task_id: 'mock-outline-task' }
        })
      })
    })
    
    // Mock project status (outline generated)
    await page.route('**/api/projects/mock-project-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            project_id: 'mock-project-123',
            status: 'OUTLINE_GENERATED',
            outline_content: {
              pages: [
                { title: '什么是AI', order_index: 0 },
                { title: 'AI的应用', order_index: 1 },
                { title: 'AI的未来', order_index: 2 }
              ]
            }
          }
        })
      })
    })
    
    // Mock description generation
    await page.route('**/api/projects/*/generate/descriptions', async (route) => {
      await route.fulfill({
        status: 202,  // 202 Accepted for async operations
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { task_id: 'mock-desc-task' }
        })
      })
    })
    
    // Mock image generation
    await page.route('**/api/projects/*/generate/images', async (route) => {
      await route.fulfill({
        status: 202,  // 202 Accepted for async operations
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { task_id: 'mock-image-task' }
        })
      })
    })
    
    // Mock PPT export
    await page.route('**/api/projects/*/export/pptx**', async (route) => {
      // Create a minimal mock PPTX file
      const mockPptxPath = path.join(__dirname, 'fixtures', 'mock-presentation.pptx')
      
      if (fs.existsSync(mockPptxPath)) {
        const buffer = fs.readFileSync(mockPptxPath)
        await route.fulfill({
          status: 200,
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          body: buffer
        })
      } else {
        // If mock file doesn't exist, return a simple response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              download_url: '/files/mock-project-123/exports/mock-presentation.pptx'
            }
          })
        })
      }
    })
    
    // ====================================
    // Step 1: Visit homepage
    // ====================================
    console.log('📱 Step 1: Opening homepage...')
    await page.goto('http://localhost:3011')
    await expect(page).toHaveTitle(/蕉幻|Banana/i)
    console.log('✓ Homepage loaded successfully\n')
    
    // ====================================
    // Step 2: Ensure "一句话生成" tab is selected (it's selected by default)
    // ====================================
    console.log('🖱️  Step 2: Ensuring "一句话生成" tab is selected...')
    // The "一句话生成" tab is selected by default, but we can click it to ensure it's active
    await page.click('button:has-text("一句话生成")').catch(() => {
      // If click fails, the tab might already be selected, which is fine
    })
    await page.waitForSelector('textarea, input[type="text"]', { timeout: 10000 })
    console.log('✓ Create form displayed\n')
    
    // ====================================
    // Step 3: Enter idea and click "Next"
    // ====================================
    console.log('✍️  Step 3: Entering idea content...')
    const ideaInput = page.locator('textarea, input[type="text"]').first()
    await ideaInput.fill('创建一份关于人工智能基础的简短PPT，包含3页：什么是AI、AI的应用、AI的未来')
    
    console.log('🚀 Clicking "Next" button...')
    await page.click('button:has-text("下一步")')
    
    // Wait for navigation (mocked response should be fast)
    await page.waitForTimeout(1000)
    console.log('✓ Clicked "Next" button\n')
    
    // ====================================
    // Step 4: Verify outline editor page loaded
    // ====================================
    console.log('📋 Step 4: Verifying outline editor page...')
    await page.waitForSelector('button:has-text("自动生成大纲"), button:has-text("重新生成大纲")', { timeout: 10000 })
    console.log('✓ Outline editor page loaded\n')
    
    // ====================================
    // Step 5: Click generate outline (mocked)
    // ====================================
    console.log('📋 Step 5: Clicking batch generate outline button (mocked)...')
    const generateOutlineBtn = page.locator('button:has-text("自动生成大纲"), button:has-text("重新生成大纲")')
    await generateOutlineBtn.first().click()
    
    // Wait for mocked response (should be instant, but UI might need time to update)
    await page.waitForTimeout(2000)
    console.log('✓ Mocked outline generation triggered\n')
    
    // ====================================
    // Step 6: Verify UI shows outline (mocked data)
    // ====================================
    console.log('✅ Step 6: Verifying UI shows outline items...')
    // The UI should show the mocked outline data
    await expect(page.locator('.outline-card, [data-testid="outline-item"], .outline-section').first())
      .toBeVisible({ timeout: 10000 })
    console.log('✓ Outline items visible in UI\n')
    
    // ====================================
    // Step 7: Navigate to description editor
    // ====================================
    console.log('➡️  Step 7: Clicking "Next" to go to description editor...')
    const nextBtn = page.locator('button:has-text("下一步")')
    if (await nextBtn.count() > 0) {
      await nextBtn.first().click()
      await page.waitForTimeout(1000)
      console.log('✓ Navigated to description editor\n')
    }
    
    // ====================================
    // Step 8: Test description generation UI (mocked)
    // ====================================
    console.log('✍️  Step 8: Testing description generation UI (mocked)...')
    await page.waitForSelector('button:has-text("批量生成描述")', { timeout: 10000 })
    const generateDescBtn = page.locator('button:has-text("批量生成描述")')
    await generateDescBtn.first().click()
    await page.waitForTimeout(2000) // Mock response should be fast
    console.log('✓ Mocked description generation triggered\n')
    
    // ====================================
    // Step 9: Navigate to image generation
    // ====================================
    console.log('➡️  Step 9: Navigating to image generation page...')
    const nextBtn2 = page.locator('button:has-text("下一步")')
    if (await nextBtn2.count() > 0) {
      await nextBtn2.first().click()
      await page.waitForTimeout(1000)
      console.log('✓ Navigated to image generation page\n')
    }
    
    // ====================================
    // Step 10: Test image generation UI (mocked)
    // ====================================
    console.log('🎨 Step 10: Testing image generation UI (mocked)...')
    await page.waitForSelector('button:has-text("批量生成图片")', { timeout: 10000 })
    const generateImageBtn = page.locator('button:has-text("批量生成图片")')
    if (await generateImageBtn.count() > 0) {
      await generateImageBtn.first().click()
      await page.waitForTimeout(2000)
      console.log('✓ Mocked image generation triggered\n')
    }
    
    // ====================================
    // Step 11: Test export UI
    // ====================================
    console.log('📦 Step 11: Testing export UI...')
    const exportBtn = page.locator('button:has-text("导出"), button:has-text("下载"), button:has-text("完成")')
    
    if (await exportBtn.count() > 0) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null)
      await exportBtn.first().click()
      
      const download = await downloadPromise
      if (download) {
        const downloadPath = path.join('test-results', 'e2e-mocked-test-output.pptx')
        await download.saveAs(downloadPath)
        console.log(`✓ Mock PPT file downloaded: ${downloadPath}\n`)
      } else {
        console.log('⚠️  Download event not triggered (may be handled differently in UI)\n')
      }
    }
    
    // ====================================
    // Final verification
    // ====================================
    console.log('========================================')
    console.log('✅ Mocked E2E test completed!')
    console.log('========================================\n')
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/e2e-mocked-final-state.png',
      fullPage: true 
    })
  })
})

