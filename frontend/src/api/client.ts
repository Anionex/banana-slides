import axios from 'axios';
import { isDesktop } from '@/utils';

const DESKTOP_BACKEND_PORT_STORAGE_KEY = '__desktop_backend_port__';

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function parsePort(value: unknown): number {
  return Number.parseInt(String(value ?? ''), 10);
}

function resolveDesktopBackendPort(): number {
  const rawPort = (window as any).electronAPI?.getBackendPort?.();
  const port = parsePort(rawPort);
  if (isValidPort(port)) {
    sessionStorage.setItem(DESKTOP_BACKEND_PORT_STORAGE_KEY, String(port));
    return port;
  }

  const cachedPort = parsePort(sessionStorage.getItem(DESKTOP_BACKEND_PORT_STORAGE_KEY));
  if (isValidPort(cachedPort)) {
    return cachedPort;
  }

  throw new Error('Desktop backend port is unavailable');
}

// 桌面模式：从 URL query param 同步读取后端端口，避免异步竞态
if (isDesktop) {
  (window as any).__BACKEND_PORT__ = resolveDesktopBackendPort();
}

export function getBaseURL(): string {
  if (!isDesktop) return '';
  const port = (window as any).__BACKEND_PORT__;
  if (!isValidPort(port)) {
    throw new Error('Desktop backend port is unavailable');
  }
  return `http://127.0.0.1:${port}`;
}

// 统一下载入口：desktop 走原生保存对话框，web 走 window.open
export function triggerDownload(relativeOrAbsoluteUrl: string, filename?: string): void {
  if (isDesktop) {
    const url = relativeOrAbsoluteUrl.startsWith('http')
      ? relativeOrAbsoluteUrl
      : `${getBaseURL()}${relativeOrAbsoluteUrl}`;
    (window as any).electronAPI.downloadFile(url, filename || url.split('/').pop() || 'download');
  } else {
    window.open(relativeOrAbsoluteUrl, '_blank');
  }
}

// 创建 axios 实例
export const apiClient = axios.create({
  timeout: 300000, // 5分钟超时（AI生成可能很慢）
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    const hasAbsoluteBaseURL = typeof config.baseURL === 'string' && /^https?:\/\//i.test(config.baseURL);
    const hasAbsoluteRequestURL = typeof config.url === 'string' && /^https?:\/\//i.test(config.url);
    if (!hasAbsoluteBaseURL && !hasAbsoluteRequestURL) {
      config.baseURL = getBaseURL();
    }

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
