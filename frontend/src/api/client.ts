import axios from 'axios';

// 开发环境：通过 Vite proxy 转发
// 生产环境：通过 nginx proxy 转发
const API_BASE_URL = '';
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
export const LONG_REQUEST_TIMEOUT_MS = 600000;

// 创建 axios 实例
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
  withCredentials: true,
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 如果请求体是 FormData，删除 Content-Type 让浏览器自动设置
    // 浏览器会自动添加正确的 Content-Type 和 boundary
    config.headers = config.headers || {};
    config.headers['X-Requested-With'] = 'XMLHttpRequest';

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
  const appendTimestamp = (url: string) => {
    if (!timestamp) return url;
    const ts = typeof timestamp === 'string'
      ? new Date(timestamp).getTime()
      : timestamp;
    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(ts))}`;
  };

  // 如果已经是完整URL，只允许同源或本机 /files 资源，避免加载任意外部跟踪 URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
      const isSameOrigin = typeof window !== 'undefined' && url.origin === window.location.origin;
      const isLocalFileRoute = localHosts.has(url.hostname) && url.pathname.startsWith('/files/');
      return (isSameOrigin || isLocalFileRoute) ? appendTimestamp(url.toString()) : '';
    } catch {
      return '';
    }
  }
  // 使用相对路径（确保以 / 开头）
  let url = path.startsWith('/') ? path : '/' + path;
  
  // 添加时间戳参数避免浏览器缓存（仅在提供时间戳时添加）
  return appendTimestamp(url);
};

export default apiClient;

