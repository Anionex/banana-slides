/**
 * API集成测试：从创建到导出PPT
 * 
 * 这个测试通过直接调用后端API验证完整流程：
 * 1. 创建项目（从想法或文件）
 * 2. 生成大纲
 * 3. 生成描述
 * 4. 生成图片
 * 5. 导出PPT
 * 
 * 注意：此测试需要真实的AI API密钥（GOOGLE_API_KEY）
 * 如果使用mock API key，测试会跳过
 */

import { test, expect, APIRequestContext } from '@playwright/test'

// 辅助函数：等待项目状态变更
async function waitForProjectStatus(
  request: APIRequestContext,
  projectId: string,
  expectedStatus: string,
  timeoutMs: number = 60000
): Promise<void> {
  const startTime = Date.now()
  const checkInterval = 5000 // 每5秒检查一次
  
  while (Date.now() - startTime < timeoutMs) {
    const response = await request.get(`http://localhost:5000/api/projects/${projectId}`)
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    const currentStatus = data.data.status
    
    console.log(`[${new Date().toISOString()}] Project status: ${currentStatus}, waiting for: ${expectedStatus}`)
    
    if (currentStatus === expectedStatus) {
      console.log(`✓ Project reached status: ${expectedStatus}`)
      return
    }
    
    // 检查是否失败
    if (currentStatus === 'FAILED') {
      throw new Error(`Project generation failed. Expected: ${expectedStatus}, Got: ${currentStatus}`)
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }
  
  throw new Error(`Timeout: Project did not reach status ${expectedStatus} within ${timeoutMs}ms`)
}

// 辅助函数：等待任务完成
async function waitForTaskCompletion(
  request: APIRequestContext,
  projectId: string,
  taskId: string,
  timeoutMs: number = 120000
): Promise<void> {
  const startTime = Date.now()
  const checkInterval = 5000
  
  while (Date.now() - startTime < timeoutMs) {
    const response = await request.get(`http://localhost:5000/api/projects/${projectId}/tasks/${taskId}`)
    
    if (!response.ok()) {
      console.warn(`Failed to get task status: ${response.status()}`)
      await new Promise(resolve => setTimeout(resolve, checkInterval))
      continue
    }
    
    const data = await response.json()
    const taskStatus = data.data.status
    
    console.log(`[${new Date().toISOString()}] Task ${taskId} status: ${taskStatus}`)
    
    if (taskStatus === 'COMPLETED') {
      console.log(`✓ Task ${taskId} completed`)
      return
    }
    
    if (taskStatus === 'FAILED') {
      const errorMsg = data.data.error_message || 'Unknown error'
      throw new Error(`Task ${taskId} failed: ${errorMsg}`)
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }
  
  throw new Error(`Timeout: Task ${taskId} did not complete within ${timeoutMs}ms`)
}

// 检查是否配置了真实API key
async function hasRealApiKey(request: APIRequestContext): Promise<boolean> {
  try {
    const response = await request.get('http://localhost:5000/health')
    const data = await response.json()
    // 如果health检查返回API配置信息，可以在这里判断
    // 简单起见，我们假设如果能连接就尝试运行
    return true
  } catch {
    return false
  }
}

test.describe('API集成测试：从想法到导出PPT', () => {
  let projectId: string
  
  test.afterEach(async ({ request }) => {
    // 清理测试项目
    if (projectId) {
      try {
        await request.delete(`http://localhost:5000/api/projects/${projectId}`)
        console.log(`✓ Cleaned up project: ${projectId}`)
      } catch (error) {
        console.warn(`Failed to cleanup project ${projectId}:`, error)
      }
    }
  })
  
  test('API完整流程：创建项目 → 大纲 → 描述 → 图片 → 导出PPT', async ({ request }) => {
    // 设置超时时间为10分钟（真实AI调用需要时间）
    test.setTimeout(600000)
    
    console.log('\n========================================')
    console.log('🚀 开始完整流程E2E测试')
    console.log('========================================\n')
    
    // 步骤1: 创建项目
    console.log('📝 步骤1: 创建项目...')
    const createResponse = await request.post('http://localhost:5000/api/projects', {
      data: {
        creation_type: 'idea',
        idea_prompt: '创建一份关于人工智能基础的简短PPT，包含3页内容：什么是AI、AI的应用、AI的未来'
      }
    })
    
    expect(createResponse.ok()).toBeTruthy()
    const createData = await createResponse.json()
    expect(createData.success).toBe(true)
    expect(createData.data.project_id).toBeTruthy()
    
    projectId = createData.data.project_id
    console.log(`✓ 项目创建成功: ${projectId}\n`)
    
    // 步骤2: 等待大纲生成完成
    console.log('📋 步骤2: 等待大纲生成...')
    await waitForProjectStatus(request, projectId, 'OUTLINE_GENERATED', 90000)
    
    // 验证大纲内容
    const projectResponse = await request.get(`http://localhost:5000/api/projects/${projectId}`)
    const projectData = await projectResponse.json()
    const outline = projectData.data.outline_content
    
    expect(outline).toBeTruthy()
    expect(outline.pages || outline.outline).toBeTruthy()
    console.log(`✓ 大纲生成成功，包含页面数: ${(outline.pages || outline.outline || []).length}\n`)
    
    // 步骤3: 生成描述
    console.log('✍️  步骤3: 开始生成页面描述...')
    const descResponse = await request.post(
      `http://localhost:5000/api/projects/${projectId}/generate/descriptions`,
      {
        data: {
          outline: outline
        }
      }
    )
    
    expect(descResponse.ok()).toBeTruthy()
    const descData = await descResponse.json()
    expect(descData.success).toBe(true)
    
    const descTaskId = descData.data.task_id
    console.log(`  任务ID: ${descTaskId}`)
    
    // 等待描述生成完成
    await waitForTaskCompletion(request, projectId, descTaskId, 180000)
    await waitForProjectStatus(request, projectId, 'DESCRIPTIONS_GENERATED', 10000)
    console.log('✓ 所有页面描述生成完成\n')
    
    // 步骤4: 生成图片
    console.log('🎨 步骤4: 开始生成页面图片...')
    const imageResponse = await request.post(
      `http://localhost:5000/api/projects/${projectId}/generate/images`,
      {
        data: {
          use_template: false,
          aspect_ratio: '16:9',
          resolution: '1080p'
        }
      }
    )
    
    expect(imageResponse.ok()).toBeTruthy()
    const imageData = await imageResponse.json()
    expect(imageData.success).toBe(true)
    
    const imageTaskId = imageData.data.task_id
    console.log(`  任务ID: ${imageTaskId}`)
    
    // 等待图片生成完成（图片生成通常较慢）
    await waitForTaskCompletion(request, projectId, imageTaskId, 300000)
    await waitForProjectStatus(request, projectId, 'COMPLETED', 10000)
    console.log('✓ 所有页面图片生成完成\n')
    
    // 验证所有页面都有图片
    const pagesResponse = await request.get(`http://localhost:5000/api/projects/${projectId}`)
    const pagesData = await pagesResponse.json()
    const pages = pagesData.data.pages || []
    
    expect(pages.length).toBeGreaterThan(0)
    
    for (const page of pages) {
      expect(page.generated_image_path).toBeTruthy()
      expect(page.status).toBe('COMPLETED')
      console.log(`  ✓ 页面 ${page.order_index + 1}: 图片已生成`)
    }
    console.log()
    
    // 步骤5: 导出PPT
    console.log('📦 步骤5: 导出PPT文件...')
    const exportResponse = await request.get(
      `http://localhost:5000/api/projects/${projectId}/export/pptx?filename=e2e-test.pptx`
    )
    
    expect(exportResponse.ok()).toBeTruthy()
    const exportData = await exportResponse.json()
    expect(exportData.success).toBe(true)
    expect(exportData.data.download_url).toBeTruthy()
    expect(exportData.data.download_url).toContain('.pptx')
    
    console.log(`  导出URL: ${exportData.data.download_url}`)
    
    // 步骤6: 验证PPT文件可以下载
    console.log('📥 步骤6: 验证PPT文件可下载...')
    const downloadResponse = await request.get(
      `http://localhost:5000${exportData.data.download_url}`
    )
    
    expect(downloadResponse.ok()).toBeTruthy()
    
    const contentType = downloadResponse.headers()['content-type']
    expect(contentType).toContain('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    
    const pptBuffer = await downloadResponse.body()
    expect(pptBuffer.length).toBeGreaterThan(1000) // PPT文件应该大于1KB
    
    console.log(`✓ PPT文件下载成功，大小: ${(pptBuffer.length / 1024).toFixed(2)} KB\n`)
    
    console.log('========================================')
    console.log('✅ API集成测试通过！')
    console.log('========================================\n')
  })
  
  test('快速测试：仅验证API流程（不等待AI生成）', async ({ request }) => {
    test.setTimeout(60000)
    
    console.log('\n🏃 快速API流程测试（跳过AI生成）\n')
    
    // 创建项目
    const createResponse = await request.post('http://localhost:5000/api/projects', {
      data: {
        creation_type: 'idea',
        idea_prompt: 'API测试项目'
      }
    })
    
    expect(createResponse.ok()).toBeTruthy()
    const createData = await createResponse.json()
    projectId = createData.data.project_id
    
    console.log(`✓ 项目创建: ${projectId}`)
    
    // 获取项目信息
    const getResponse = await request.get(`http://localhost:5000/api/projects/${projectId}`)
    expect(getResponse.ok()).toBeTruthy()
    console.log('✓ 项目查询成功')
    
    // 列出所有项目
    const listResponse = await request.get('http://localhost:5000/api/projects')
    expect(listResponse.ok()).toBeTruthy()
    const listData = await listResponse.json()
    expect(listData.data.projects).toBeTruthy()
    console.log(`✓ 项目列表查询成功，共 ${listData.data.projects.length} 个项目`)
    
    // 删除项目
    const deleteResponse = await request.delete(`http://localhost:5000/api/projects/${projectId}`)
    expect(deleteResponse.ok()).toBeTruthy()
    console.log('✓ 项目删除成功\n')
    
    projectId = '' // 已删除，不需要cleanup
  })
})

test.describe('模板上传和使用', () => {
  let projectId: string
  
  test.afterEach(async ({ request }) => {
    if (projectId) {
      try {
        await request.delete(`http://localhost:5000/api/projects/${projectId}`)
      } catch (error) {
        console.warn(`Failed to cleanup project ${projectId}`)
      }
    }
  })
  
  test('应该能上传模板并使用', async ({ request }) => {
    // 创建项目
    const createResponse = await request.post('http://localhost:5000/api/projects', {
      data: {
        creation_type: 'idea',
        idea_prompt: '模板测试项目'
      }
    })
    
    projectId = (await createResponse.json()).data.project_id
    
    // 上传模板
    const templatePath = './e2e/fixtures/test-template.png'
    const { readFileSync, existsSync } = await import('fs')
    
    if (existsSync(templatePath)) {
      const uploadResponse = await request.post(
        `http://localhost:5000/api/projects/${projectId}/template`,
        {
          multipart: {
            template_image: {
              name: 'test-template.png',
              mimeType: 'image/png',
              buffer: readFileSync(templatePath)
            }
          }
        }
      )
      
      expect(uploadResponse.ok()).toBeTruthy()
      const uploadData = await uploadResponse.json()
      expect(uploadData.success).toBe(true)
      
      console.log('✓ 模板上传成功')
    } else {
      console.warn('⚠ 测试模板文件不存在，跳过上传测试')
      test.skip()
    }
  })
})

