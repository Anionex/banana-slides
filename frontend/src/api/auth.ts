/**
 * Auth API - authentication related API calls
 * 认证相关 API
 */
import { apiClient } from './client';
import { User, AuthTokens, useAuthStore } from '../store/useAuthStore';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

interface LoginResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in?: number;
}

interface RegisterResponse {
  user: User;
  message: string;
  require_verification?: boolean;
  // 只有开发模式跳过验证时才有 tokens
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

// ==================== Auth API ====================

export const authApi = {
  /**
   * Register a new user
   */
  register: async (email: string, password: string, username?: string): Promise<RegisterResponse> => {
    const response = await apiClient.post<ApiResponse<RegisterResponse>>('/api/auth/register', {
      email,
      password,
      username,
    });
    return response.data.data;
  },

  /**
   * Login with email and password
   */
  login: async (email: string, password: string, rememberMe: boolean = false): Promise<LoginResponse> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/api/auth/login', {
      email,
      password,
      remember_me: rememberMe,
    });
    return response.data.data;
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await apiClient.post<ApiResponse<AuthTokens>>('/api/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data.data;
  },

  /**
   * Get current user info
   */
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<{ user: User }>>('/api/auth/me');
    return response.data.data.user;
  },

  /**
   * Verify email with token
   */
  verifyEmail: async (token: string): Promise<void> => {
    await apiClient.post('/api/auth/verify-email', { token });
  },

  /**
   * Resend verification email
   */
  resendVerification: async (email: string): Promise<void> => {
    await apiClient.post('/api/auth/resend-verification', { email });
  },

  /**
   * Request password reset
   */
  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/api/auth/forgot-password', { email });
  },

  /**
   * Reset password with token
   */
  resetPassword: async (token: string, password: string): Promise<void> => {
    await apiClient.post('/api/auth/reset-password', { token, password });
  },

  /**
   * Change password (requires authentication)
   */
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/api/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};

// ==================== Token Management ====================

/**
 * Setup axios interceptor to add auth token to requests
 */
export const setupAuthInterceptor = () => {
  // Request interceptor - add auth token
  apiClient.interceptors.request.use(
    (config) => {
      const tokens = useAuthStore.getState().tokens;
      if (tokens?.access_token) {
        config.headers.Authorization = `Bearer ${tokens.access_token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle 401 and token refresh
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Skip refresh logic for auth endpoints to prevent infinite loop
      const isAuthEndpoint = originalRequest.url?.includes('/api/auth/');
      
      // If 401 and not already retried and not an auth endpoint
      if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
        originalRequest._retry = true;

        const tokens = useAuthStore.getState().tokens;
        
        if (tokens?.refresh_token) {
          try {
            // Try to refresh token
            const newTokens = await authApi.refreshToken(tokens.refresh_token);
            useAuthStore.getState().setTokens(newTokens);
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
            return apiClient(originalRequest);
          } catch (refreshError) {
            // Refresh failed, logout user
            useAuthStore.getState().logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        } else {
          // No refresh token, logout
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      }

      // Handle insufficient credits error
      if (error.response?.status === 402) {
        // Could show a modal or redirect to payment page
        console.warn('Insufficient credits');
      }

      return Promise.reject(error);
    }
  );
};

// ==================== Auth Helpers ====================

/**
 * Login and store tokens
 */
export const loginUser = async (email: string, password: string, rememberMe: boolean = false) => {
  const data = await authApi.login(email, password, rememberMe);
  useAuthStore.getState().login(data.user, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
    refresh_expires_in: data.refresh_expires_in,
  }, rememberMe);
  return data.user;
};

/**
 * Register user
 * 注意：生产模式下注册后不会自动登录，需要先验证邮箱
 */
export const registerUser = async (email: string, password: string, username?: string) => {
  const data = await authApi.register(email, password, username);
  
  // 只有当返回了 tokens 时才自动登录（开发模式跳过验证时）
  if (data.access_token && data.refresh_token) {
    useAuthStore.getState().login(data.user, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type || 'Bearer',
      expires_in: data.expires_in || 3600,
    });
  }
  
  return { 
    user: data.user, 
    message: data.message,
    requireVerification: data.require_verification || false
  };
};

/**
 * Logout user
 */
export const logoutUser = () => {
  useAuthStore.getState().logout();
};

/**
 * Check if user is authenticated and refresh user data
 * 每次都会验证 token，不信任存储中的 isAuthenticated
 */
export const checkAuth = async (): Promise<boolean> => {
  const store = useAuthStore.getState();
  
  // 首先从 storage 加载 tokens（支持 localStorage 和 sessionStorage）
  const tokens = store.loadTokensFromStorage() || store.tokens;
  
  // 没有 token，直接登出
  if (!tokens?.access_token) {
    store.logout();
    return false;
  }
  
  try {
    // 验证 token 并获取用户信息
    const user = await authApi.getCurrentUser();
    // 验证成功，设置用户和认证状态（保持原有的 rememberMe 设置）
    store.login(user, tokens, store.rememberMe);
    return true;
  } catch (error) {
    // token 无效，清除所有状态
    store.logout();
    return false;
  }
};
