import axios from 'axios';

/**
 * 获取 API 基础 URL
 * - Electron 桌面模式：从 URL 参数获取动态端口
 * - Web 开发模式：使用 Vite proxy
 * - Web 生产模式：使用 nginx proxy
 */
function getApiBaseUrl(): string {
  // 检查是否在 Electron 环境中
  const isElectron = !!(window as any).electronAPI?.isElectron;
  
  if (isElectron) {
    // Electron 模式：从 URL 参数或 electronAPI 获取端口
    const params = new URLSearchParams(window.location.search);
    const backendPort = params.get('backendPort') || 
                        (window as any).electronAPI?.getBackendPort?.() || 
                        '5000';
    console.log(`[Electron Mode] Using backend port: ${backendPort}`);
    return `http://localhost:${backendPort}`;
  }
  
  // Web 模式：使用代理（空字符串表示相对路径）
  return '';
}

const API_BASE_URL = getApiBaseUrl();

// 创建 axios 实例
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5分钟超时（AI生成可能很慢）
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 如果请求体是 FormData，删除 Content-Type 让浏览器自动设置
    // 浏览器会自动添加正确的 Content-Type 和 boundary
    if (config.data instanceof FormData) {
      // 不设置 Content-Type，让浏览器自动处理
      if (config.headers) {
        delete config.headers['Content-Type'];
      }
    } else if (config.headers && !config.headers['Content-Type']) {
      // 对于非 FormData 请求，默认设置为 JSON
      config.headers['Content-Type'] = 'application/json';
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 统一错误处理
    if (error.response) {
      // 服务器返回错误状态码
      console.error('API Error:', error.response.data);
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('Network Error:', error.request);
    } else {
      // 其他错误
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// 图片URL处理工具
// Web 模式：使用相对路径，通过代理转发到后端
// Electron 模式：使用完整的后端 URL
export const getImageUrl = (path?: string, timestamp?: string | number): string => {
  if (!path) return '';
  // 如果已经是完整URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // 确保路径以 / 开头
  let url = path.startsWith('/') ? path : '/' + path;
  
  // Electron 模式：添加后端基础 URL
  const isElectron = !!(window as any).electronAPI?.isElectron;
  if (isElectron) {
    const params = new URLSearchParams(window.location.search);
    const backendPort = params.get('backendPort') || '5000';
    url = `http://localhost:${backendPort}${url}`;
  }
  
  // 添加时间戳参数避免浏览器缓存（仅在提供时间戳时添加）
  if (timestamp) {
    const ts = typeof timestamp === 'string' 
      ? new Date(timestamp).getTime() 
      : timestamp;
    url += `?v=${ts}`;
  }
  
  return url;
};

export default apiClient;

