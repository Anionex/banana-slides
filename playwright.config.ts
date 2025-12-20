import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E测试配置
 * 
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // 测试目录
  testDir: './e2e',
  
  // 测试文件匹配模式
  // 注意：ui-full-flow.spec.ts 被排除，因为它是UI驱动的完整E2E测试（10-20分钟）
  // 只在发布前或Nightly Build中运行，不在PR阶段运行
  // 要运行UI E2E测试，请明确指定文件名：npx playwright test ui-full-flow.spec.ts
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/ui-full-flow.spec.ts'],  // 排除UI驱动的完整E2E测试
  
  // 并行运行测试
  fullyParallel: true,
  
  // CI环境下失败立即停止
  forbidOnly: !!process.env.CI,
  
  // 失败重试次数
  retries: process.env.CI ? 2 : 0,
  
  // 并行worker数量
  workers: process.env.CI ? 1 : undefined,
  
  // 测试报告
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],
  
  // 全局设置
  use: {
    // 基础URL
    baseURL: 'http://localhost:3000',
    
    // 截图设置
    screenshot: 'only-on-failure',
    
    // 视频设置
    video: 'retain-on-failure',
    
    // 追踪设置
    trace: 'retain-on-failure',
    
    // 超时设置
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  
  // 全局超时
  timeout: 60000,
  
  // 预期超时
  expect: {
    timeout: 10000,
  },
  
  // 项目配置（多浏览器测试）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 可选：添加更多浏览器
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  
  // 本地开发时启动服务
  webServer: process.env.CI ? undefined : {
    command: 'docker-compose up -d && sleep 10',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})

