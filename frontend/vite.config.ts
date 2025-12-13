import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 从项目根目录读取 .env 文件（相对于 frontend 目录的上一级）
  const envDir = path.resolve(__dirname, '..')
  
  // 使用 loadEnv 加载环境变量（第三个参数为空字符串表示加载所有变量，不仅仅是 VITE_ 前缀的）
  const env = loadEnv(mode, envDir, '')
  
  // 读取后端端口，默认 5000
  // 支持从环境变量 PORT 读取（与后端保持一致）
  const backendPort = env.PORT || '5000'
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
      port: 3000,
      host: true, // 监听所有地址
      watch: {
        usePolling: true, // WSL 环境下需要启用轮询
      },
      hmr: {
        overlay: true, // 显示错误覆盖层
      },
      proxy: {
        // API 请求代理到后端（端口从环境变量 PORT 读取）
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
  }
})
