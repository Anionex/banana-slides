/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Compute a deterministic port from the worktree directory name.
 * Must match the algorithm in backend/app.py `_compute_worktree_port`.
 */
function computeWorktreePort(basePort: number): number {
  const basename = path.basename(path.resolve(__dirname, '..'))
  const hashHex = crypto.createHash('md5').update(basename).digest('hex').substring(0, 8)
  const offset = parseInt(hashHex, 16) % 500
  return basePort + offset
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 从项目根目录读取 .env 文件（相对于 frontend 目录的上一级）
  const envDir = path.resolve(__dirname, '..')

  // 使用 loadEnv 加载环境变量（第三个参数为空字符串表示加载所有变量，不仅仅是 VITE_ 前缀的）
  const env = loadEnv(mode, envDir, '')

  // 端口：优先读 env，否则按 worktree 目录名自动计算
  const backendPort = env.BACKEND_PORT || String(computeWorktreePort(5000))
  const frontendPort = Number(env.FRONTEND_PORT) || computeWorktreePort(3000)
  const backendUrl = `http://localhost:${backendPort}`
  
  return {
    envDir,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: frontendPort,
      host: true, // 监听所有地址
      watch: {
        usePolling: true, // WSL 环境下需要启用轮询
      },
      hmr: {
        overlay: true, // 显示错误覆盖层
      },
      proxy: {
        // API 请求代理到后端（端口从环境变量 BACKEND_PORT 读取）
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        // 文件服务代理到后端
        '/files': {
          target: backendUrl,
          changeOrigin: true,
        },
        // 健康检查代理到后端
        '/health': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    // Vitest 测试配置
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/tests/setup.ts',
      include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
      exclude: ['node_modules', 'dist'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/tests/',
          '**/*.d.ts',
          '**/*.config.*',
        ],
      },
    },
  }
})
