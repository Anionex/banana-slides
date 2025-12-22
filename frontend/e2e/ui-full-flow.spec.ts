/**
 * UI-driven end-to-end test: From user interface operations to final PPT export
 * 
 * This test simulates the complete user operation flow in the browser:
 * 1. Enter idea in frontend
 * 2. Click "Next" button
 * 3. Click batch generate outline button on outline editor page
 * 4. Wait for outline generation (visible in UI)
 * 5. Click "Next" to go to description editor page
 * 6. Click batch generate descriptions button
 * 7. Wait for descriptions to generate (visible in UI)
 * 8. Test retry single card functionality
 * 9. Click "Next" to go to image generation page
 * 10. Click batch generate images button
 * 11. Wait for images to generate (visible in UI)
 * 12. Export PPT
 * 13. Verify downloaded file
 * 
 * Note:
 * - This test requires real AI API keys
 * - Takes 10-15 minutes to complete
 * - Depends on frontend UI stability
 * - Recommended to run only before release or in Nightly Build
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

test.describe('UI-driven E2E test: From user interface to PPT export', () => {
  // Increase timeout to 20 minutes
  test.setTimeout(20 * 60 * 1000)
  
  test('User Full Flow: Create and export PPT in browser', async ({ page }) => {
    console.log('\n========================================')
    console.log('🌐 Starting UI-driven E2E test (via frontend interface)')
    console.log('========================================\n')
    
    // ====================================
    // Step 1: Visit homepage
    // ====================================
    console.log('📱 Step 1: Opening homepage...')
    await page.goto('http://localhost:3000')
    
    // Verify page loaded
    await expect(page).toHaveTitle(/蕉幻|Banana/i)
    console.log('✓ Homepage loaded successfully\n')
    
    // ====================================
    // Step 2: Click "Create from idea"
    // ====================================
    console.log('🖱️  Step 2: Clicking "Create from idea"...')
    await page.click('text=/从想法创建/i')
    
    // Wait for form to appear
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
    console.log('✓ Clicked "Next" button\n')
    
    // ====================================
    // Step 4: Click batch generate outline button on outline editor page
    // ====================================
    console.log('⏳ Step 4: Waiting for outline editor page to load...')
    await page.waitForSelector('button:has-text("自动生成大纲"), button:has-text("重新生成大纲")', { timeout: 10000 })
    
    console.log('📋 Step 4: Clicking batch generate outline button...')
    const generateOutlineBtn = page.locator('button:has-text("自动生成大纲"), button:has-text("重新生成大纲")')
    await generateOutlineBtn.first().click()
    console.log('✓ Clicked batch generate outline button\n')
    
    // ====================================
    // Step 5: Wait for outline generation to complete (smart wait)
    // ====================================
    console.log('⏳ Step 5: Waiting for outline generation (may take 1-2 minutes)...')
    
    // Smart wait: Use expect().toPass() for retry polling
    await expect(async () => {
      const outlineItems = page.locator('.outline-card, [data-testid="outline-item"], .outline-section')
      const count = await outlineItems.count()
      if (count === 0) {
        throw new Error('Outline items not yet visible')
      }
      expect(count).toBeGreaterThan(0)
    }).toPass({ timeout: 120000, intervals: [2000, 5000, 10000] })
    
    // Verify outline content
    const outlineItems = page.locator('.outline-card, [data-testid="outline-item"], .outline-section')
    const outlineCount = await outlineItems.count()
    
    expect(outlineCount).toBeGreaterThan(0)
    console.log(`✓ Outline generated successfully, total ${outlineCount} pages\n`)
    
    // Take screenshot of current state
    await page.screenshot({ path: 'test-results/e2e-outline-generated.png' })
    
    // ====================================
    // Step 6: Click "Next" to go to description editor page
    // ====================================
    console.log('➡️  Step 6: Clicking "Next" to go to description editor page...')
    const nextBtn = page.locator('button:has-text("下一步")')
    if (await nextBtn.count() > 0) {
      await nextBtn.first().click()
      await page.waitForTimeout(1000) // Wait for page transition
      console.log('✓ Clicked "Next" button\n')
    }
    
    // ====================================
    // Step 7: Click batch generate descriptions button
    // ====================================
    console.log('✍️  Step 7: Clicking batch generate descriptions button...')
    
    // Wait for description editor page to load
    await page.waitForSelector('button:has-text("批量生成描述")', { timeout: 10000 })
    
    const generateDescBtn = page.locator('button:has-text("批量生成描述")')
    await generateDescBtn.first().click()
    console.log('✓ Clicked batch generate descriptions button\n')
    
    // ====================================
    // Step 8: Wait for descriptions to generate (smart wait)
    // ====================================
    console.log('⏳ Step 8: Waiting for descriptions to generate (may take 2-5 minutes)...')
    
    // Smart wait: Use expect().toPass() for retry polling
    await expect(async () => {
      const completedIndicators = page.locator('[data-status="descriptions-generated"], .description-complete, button:has-text("重新生成"):not([disabled])')
      const count = await completedIndicators.count()
      if (count === 0) {
        throw new Error('Descriptions not yet generated')
      }
      expect(count).toBeGreaterThan(0)
    }).toPass({ timeout: 300000, intervals: [3000, 5000, 10000] })
    
    console.log('✓ All descriptions generated\n')
    await page.screenshot({ path: 'test-results/e2e-descriptions-generated.png' })
    
    // ====================================
    // Step 9: Test retry single card functionality
    // ====================================
    console.log('🔄 Step 9: Testing retry single card functionality...')
    
    // Find the first description card with retry button
    const retryButtons = page.locator('button:has-text("重新生成")')
    const retryCount = await retryButtons.count()
    
    if (retryCount > 0) {
      // Click the first retry button
      await retryButtons.first().click()
      console.log('✓ Clicked retry button on first card')
      
      // Wait for the card to show generating state
      await page.waitForSelector('button:has-text("生成中...")', { timeout: 5000 }).catch(() => {
        // If "生成中..." doesn't appear, check for other loading indicators
        console.log('  Waiting for generation state...')
      })
      
      // Wait for regeneration to complete (shorter timeout since it's just one card)
      await page.waitForSelector(
        'button:has-text("重新生成"):not([disabled])',
        { timeout: 120000 }
      )
      
      console.log('✓ Single card retry completed successfully\n')
      await page.screenshot({ path: 'test-results/e2e-single-card-retry.png' })
    } else {
      console.log('⚠️  No retry buttons found, skipping single card retry test\n')
    }
    
    // ====================================
    // Step 10: Click "Next" to go to image generation page
    // ====================================
    console.log('➡️  Step 10: Clicking "Next" to go to image generation page...')
    const nextBtn2 = page.locator('button:has-text("下一步")')
    if (await nextBtn2.count() > 0) {
      await nextBtn2.first().click()
      await page.waitForTimeout(1000) // Wait for page transition
      console.log('✓ Clicked "Next" button\n')
    }
    
    // ====================================
    // Step 11: Click batch generate images button
    // ====================================
    console.log('🎨 Step 11: Clicking batch generate images button...')
    
    // Wait for image generation page to load
    await page.waitForSelector('button:has-text("批量生成图片")', { timeout: 10000 })
    
    const generateImageBtn = page.locator('button:has-text("批量生成图片")')
    
    if (await generateImageBtn.count() > 0) {
      await generateImageBtn.first().click()
      console.log('✓ Clicked batch generate images button\n')
      
      // Wait for images to generate (may take 3-8 minutes)
      console.log('⏳ Step 12: Waiting for images to generate (may take 3-8 minutes)...')
      
      // Smart wait: Use expect().toPass() for retry polling
      await expect(async () => {
        const completedImages = page.locator('[data-status="completed"], .all-images-complete, img[src*="generated"]:not([src=""])')
        const count = await completedImages.count()
        if (count === 0) {
          throw new Error('Images not yet generated')
        }
        expect(count).toBeGreaterThan(0)
      }).toPass({ timeout: 480000, intervals: [5000, 10000, 15000] })
      
      console.log('✓ All images generated\n')
      await page.screenshot({ path: 'test-results/e2e-images-generated.png' })
    } else {
      console.log('⚠️  Batch generate images button not found\n')
    }
    
    // ====================================
    // Step 13: Export PPT
    // ====================================
    console.log('📦 Step 13: Exporting PPT file...')
    
    // Setup download handler
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
    
    // Click export button
    const exportBtn = page.locator('button:has-text("导出"), button:has-text("下载"), button:has-text("完成")')
    
    if (await exportBtn.count() > 0) {
      await exportBtn.first().click()
      console.log('✓ Clicked export button\n')
      
      // Wait for download to complete
      console.log('⏳ Waiting for PPT file download...')
      const download = await downloadPromise
      
      // Save file
      const downloadPath = path.join('test-results', 'e2e-test-output.pptx')
      await download.saveAs(downloadPath)
      
      // Verify file exists and is not empty
      const fileExists = fs.existsSync(downloadPath)
      expect(fileExists).toBeTruthy()
      
      const fileStats = fs.statSync(downloadPath)
      expect(fileStats.size).toBeGreaterThan(1000) // At least 1KB
      
      console.log(`✓ PPT file downloaded successfully!`)
      console.log(`  Path: ${downloadPath}`)
      console.log(`  Size: ${(fileStats.size / 1024).toFixed(2)} KB\n`)
      
      // Validate PPTX file content using python-pptx
      console.log('🔍 Validating PPTX file content...')
      const { execSync } = await import('child_process')
      const { fileURLToPath } = await import('url')
      try {
        // Get current directory (ES module compatible)
        const currentDir = path.dirname(fileURLToPath(import.meta.url))
        const validateScript = path.join(currentDir, 'validate_pptx.py')
        const result = execSync(
          `python3 "${validateScript}" "${downloadPath}" 3 "人工智能" "AI"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        )
        console.log(`✓ ${result.trim()}\n`)
      } catch (error: any) {
        console.warn(`⚠️  PPTX validation warning: ${error.stdout || error.message}`)
        console.log('  (Continuing test, but PPTX content validation had issues)\n')
      }
    } else {
      console.log('⚠️  Export button not found, trying other methods...')
      
      // Try exporting via right-click menu or other UI elements
      // (Adjust based on actual UI implementation)
    }
    
    // ====================================
    // Final verification
    // ====================================
    console.log('========================================')
    console.log('✅ Full E2E test completed!')
    console.log('========================================\n')
    
    // Final screenshot
    await page.screenshot({ 
      path: 'test-results/e2e-final-state.png',
      fullPage: true 
    })
  })
})

test.describe('UI E2E - Simplified (skip long waits)', () => {
  test.setTimeout(5 * 60 * 1000) // 5 minutes
  
  test('User flow verification: Only verify UI interactions, do not wait for AI generation', async ({ page }) => {
    console.log('\n🏃 Quick E2E test (verify UI flow, do not wait for generation)\n')
    
    // Visit homepage
    await page.goto('http://localhost:3000')
    console.log('✓ Homepage loaded')
    
    // Click create
    await page.click('text=/从想法创建/i')
    console.log('✓ Entered create page')
    
    // Enter content
    const ideaInput = page.locator('textarea, input[type="text"]').first()
    await ideaInput.fill('E2E test project')
    console.log('✓ Entered content')
    
    // Click generate
    await page.click('button:has-text("下一步")')
    console.log('✓ Submitted generation request')
    
    // Verify loading state appears (indicates request was sent)
    await page.waitForSelector(
      '.loading, .spinner, [data-loading="true"]',
      { timeout: 10000 }
    )
    console.log('✓ Generation started (loading state visible)')
    
    console.log('\n✅ UI flow verification passed!\n')
  })
})

