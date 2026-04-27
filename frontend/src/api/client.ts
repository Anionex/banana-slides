import axios from 'axios';
import { isDesktop } from '@/utils';

let backendPortPromise: Promise<number> | null = null;

if (isDesktop) {
  backendPortPromise = (window as any).electronAPI.getBackendPort().then((port: number) => {
    (window as any).__BACKEND_PORT__ = port;
    return port;
  }).catch(() => {
    (window as any).__BACKEND_PORT__ = 5000;
    return 5000;
  });
}

export function getBaseURL(): string {
  if (!isDesktop) return '';
  const port = (window as any).__BACKEND_PORT__ || 5000;
  return `http://localhost:${port}`;
}

// 创建 axios 实例
export const apiClient = axios.create({
  timeout: 300000, // 5分钟超时（AI生成可能很慢）
});

// 请求拦截器
apiClient.interceptors.request.use(
  async (config) => {
    if (isDesktop && !(window as any).__BACKEND_PORT__ && backendPortPromise) {
      await backendPortPromise;
    }

    config.baseURL = getBaseURL();

    // Attach access code header for backend enforcement
    const accessCode = localStorage.getItem('banana-access-code');
    if (accessCode && config.headers) {
      config.headers['X-Access-Code'] = accessCode;
    }

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
// 使用相对路径，通过代理转发到后端
export const getImageUrl = (path?: string, timestamp?: string | number): string => {
  if (!path) return '';
  // 如果已经是完整URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // 使用相对路径（确保以 / 开头）
  let url = path.startsWith('/') ? path : '/' + path;

  if (isDesktop) {
    url = `${getBaseURL()}${url}`;
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
