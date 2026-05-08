import axios from 'axios';
import { useAdminStore } from '@/store/useAdminStore';
import { useUserStore } from '@/store/useUserStore';

// 开发环境：通过 Vite proxy 转发
// 生产环境：通过 nginx proxy 转发
const API_BASE_URL = '';

// 创建 axios 实例
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5分钟超时（AI生成可能很慢）
});

const getStoredUserAccessToken = (): string | null => {
  try {
    const userState = localStorage.getItem('feiye-user');
    return JSON.parse(userState || 'null')?.state?.accessToken ?? null;
  } catch {
    return null;
  }
};

const getStoredAdminAccessToken = (): string | null => {
  try {
    const adminState = localStorage.getItem('feiye-admin');
    return JSON.parse(adminState || 'null')?.state?.accessToken ?? null;
  } catch {
    return null;
  }
};

const getStoredUserRefreshToken = (): string | null => {
  try {
    const userState = localStorage.getItem('feiye-user');
    return JSON.parse(userState || 'null')?.state?.refreshToken ?? null;
  } catch {
    return null;
  }
};

const getStoredAdminRefreshToken = (): string | null => {
  try {
    const adminState = localStorage.getItem('feiye-admin');
    return JSON.parse(adminState || 'null')?.state?.refreshToken ?? null;
  } catch {
    return null;
  }
};

const getPreferredAccessToken = (requestUrl?: string): string | null => {
  const isAdminRoute = requestUrl?.startsWith('/api/admin/');
  const userToken = getStoredUserAccessToken();
  const adminToken = getStoredAdminAccessToken();

  if (isAdminRoute) {
    return adminToken || userToken;
  }

  return userToken || adminToken;
};

type AuthStoreKind = 'user' | 'admin';

const getPreferredAuthStoreKind = (requestUrl?: string): AuthStoreKind | null => {
  const isAdminRoute = requestUrl?.startsWith('/api/admin/');
  const hasUserToken = !!getStoredUserAccessToken();
  const hasAdminToken = !!getStoredAdminAccessToken();

  if (isAdminRoute) {
    if (hasAdminToken) return 'admin';
    if (hasUserToken) return 'user';
    return null;
  }

  if (hasUserToken) return 'user';
  if (hasAdminToken) return 'admin';
  return null;
};

const getRefreshTokenForStore = (kind: AuthStoreKind): string | null =>
  kind === 'user' ? getStoredUserRefreshToken() : getStoredAdminRefreshToken();

const updateTokensForStore = (kind: AuthStoreKind, accessToken: string, refreshToken: string) => {
  if (kind === 'user') {
    useUserStore.setState({ accessToken, refreshToken });
    return;
  }
  useAdminStore.setState({ accessToken, refreshToken });
};

const clearAuthStore = (kind: AuthStoreKind) => {
  if (kind === 'user') {
    const userStore = useUserStore.getState();
    userStore.logout();
    userStore.openLoginModal();
    return;
  }
  useAdminStore.getState().logout();
};

let refreshPromise: Promise<string | null> | null = null;

const tryRefreshAccessToken = async (kind: AuthStoreKind): Promise<string | null> => {
  const refreshToken = getRefreshTokenForStore(kind);
  if (!refreshToken) {
    clearAuthStore(kind);
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', { refresh_token: refreshToken }, { baseURL: API_BASE_URL, timeout: 300000 })
      .then((response) => {
        const accessToken = response.data?.data?.access_token as string | undefined;
        const nextRefreshToken = response.data?.data?.refresh_token as string | undefined;
        if (!accessToken || !nextRefreshToken) {
          throw new Error('Token refresh response is incomplete');
        }
        updateTokensForStore(kind, accessToken, nextRefreshToken);
        return accessToken;
      })
      .catch(() => {
        clearAuthStore(kind);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // Attach access code header for backend enforcement
    const accessCode = localStorage.getItem('banana-access-code');
    if (accessCode && config.headers) {
      config.headers['X-Access-Code'] = accessCode;
    }

    // Attach JWT token: admin token takes priority for /api/admin/* routes
    try {
      const token = getPreferredAccessToken(config.url);
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // ignore parse errors
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
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || '';
    const hasAnyToken = !!getPreferredAccessToken(requestUrl);
    const authStoreKind = getPreferredAuthStoreKind(requestUrl);
    const originalRequest = error?.config;

    const isExpectedAnonymousAuthFailure =
      !hasAnyToken &&
      (status === 401 || status === 403) &&
      (
        requestUrl.startsWith('/api/projects') ||
        requestUrl.startsWith('/api/user-templates') ||
        requestUrl.startsWith('/api/user/profile') ||
        requestUrl.startsWith('/api/reference-files') ||
        requestUrl.startsWith('/api/materials')
      );

    if (isExpectedAnonymousAuthFailure) {
      return Promise.reject(error);
    }

    if (status === 401 && originalRequest && !originalRequest._retry && authStoreKind) {
      originalRequest._retry = true;
      return tryRefreshAccessToken(authStoreKind).then((nextAccessToken) => {
        if (!nextAccessToken) {
          return Promise.reject(error);
        }

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers['Authorization'] = `Bearer ${nextAccessToken}`;
        return apiClient(originalRequest);
      });
    }

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
  
  // 添加时间戳参数避免浏览器缓存（仅在提供时间戳时添加）
  if (timestamp) {
    const ts = typeof timestamp === 'string' 
      ? new Date(timestamp).getTime() 
      : timestamp;
    url += `?v=${ts}`;
  }

  if (url.startsWith('/files/')) {
    const accessToken = getPreferredAccessToken(url);
    if (accessToken) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}access_token=${encodeURIComponent(accessToken)}`;
    }
  }
  
  return url;
};

export const getProtectedDownloadUrl = (path?: string): string => {
  if (!path) return '';

  const accessToken = getPreferredAccessToken(path);

  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const absoluteUrl = new URL(path);
      if (absoluteUrl.pathname.startsWith('/files/') && accessToken && !absoluteUrl.searchParams.get('access_token')) {
        absoluteUrl.searchParams.set('access_token', accessToken);
      }
      return absoluteUrl.toString();
    } catch {
      return path;
    }
  }

  let url = path.startsWith('/') ? path : `/${path}`;

  if (url.startsWith('/files/') && accessToken) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}access_token=${encodeURIComponent(accessToken)}`;
  }

  return url;
};

export default apiClient;
