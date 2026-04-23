/**
 * Auth API - authentication related API calls
 * 认证相关 API
 */
import type { Session } from '@supabase/supabase-js';
import { apiClient } from './client';
import { User, AuthTokens, useAuthStore } from '../store/useAuthStore';
import {
  assertSupabaseConfigured,
  clearSupabaseSessionStorage,
  getSupabaseRedirectUrl,
  getSupabaseRememberMe,
  isSupabaseConfigured,
  setSupabaseRememberMe,
  supabase,
} from '../lib/supabase';

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
  user?: User;
  message: string;
  email?: string;
  require_verification?: boolean;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

let requestInterceptorId: number | null = null;
let responseInterceptorId: number | null = null;
let authListenerInitialized = false;

const toAuthTokens = (session: Session): AuthTokens => ({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  token_type: session.token_type || 'Bearer',
  expires_in: session.expires_in || 3600,
});

const readErrorMessage = (error: any, fallback: string): string => {
  return error?.response?.data?.error?.message
    || error?.response?.data?.message
    || error?.message
    || fallback;
};

const fetchCurrentUserWithAccessToken = async (accessToken: string): Promise<User> => {
  const response = await apiClient.get<ApiResponse<{ user: User }>>('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data.data.user;
};

const applyTokensToStore = (tokens: AuthTokens, rememberMe = getSupabaseRememberMe()) => {
  useAuthStore.setState({ rememberMe });
  const currentUser = useAuthStore.getState().user;
  if (currentUser) {
    useAuthStore.getState().login(currentUser, tokens, rememberMe);
  } else {
    useAuthStore.getState().setTokens(tokens);
  }
};

const syncSupabaseSessionToStore = (session: Session | null) => {
  if (!session) {
    return;
  }
  applyTokensToStore(toAuthTokens(session), getSupabaseRememberMe());
};

const setupSupabaseAuthListener = () => {
  if (authListenerInitialized || !isSupabaseConfigured()) {
    return;
  }
  authListenerInitialized = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      clearSupabaseSessionStorage();
      useAuthStore.getState().logout();
      return;
    }

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
      syncSupabaseSessionToStore(session);
    }
  });
};

// ==================== Auth API ====================

export const authApi = {
  /**
   * Register a new user
   */
  register: async (email: string, password: string, username?: string, invitationCode?: string): Promise<RegisterResponse> => {
    if (!isSupabaseConfigured()) {
      const response = await apiClient.post<ApiResponse<RegisterResponse>>('/api/auth/register', {
        email,
        password,
        username,
        invitation_code: invitationCode,
      });
      return response.data.data;
    }

    assertSupabaseConfigured();
    setSupabaseRememberMe(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getSupabaseRedirectUrl('/auth/oidc/callback'),
        data: {
          username,
          invitation_code: invitationCode,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    const session = data.session;
    let user: User | undefined;
    let tokens: AuthTokens | undefined;

    if (session) {
      tokens = toAuthTokens(session);
      user = await fetchCurrentUserWithAccessToken(session.access_token);
    }

    return {
      user,
      email: data.user?.email || email,
      message: session ? '注册成功' : '注册成功，请查收邮箱确认链接',
      require_verification: !session,
      access_token: tokens?.access_token,
      refresh_token: tokens?.refresh_token,
      token_type: tokens?.token_type,
      expires_in: tokens?.expires_in,
    };
  },

  /**
   * Login with email and password
   */
  login: async (email: string, password: string, rememberMe: boolean = false): Promise<LoginResponse> => {
    if (!isSupabaseConfigured()) {
      const response = await apiClient.post<ApiResponse<LoginResponse>>('/api/auth/login', {
        email,
        password,
        remember_me: rememberMe,
      });
      return response.data.data;
    }

    assertSupabaseConfigured();
    setSupabaseRememberMe(rememberMe);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.session) {
      throw new Error('登录失败，未获取到会话');
    }

    const user = await fetchCurrentUserWithAccessToken(data.session.access_token);
    const tokens = toAuthTokens(data.session);

    return {
      user,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      refresh_expires_in: tokens.refresh_expires_in,
    };
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
    if (!isSupabaseConfigured()) {
      const response = await apiClient.post<ApiResponse<AuthTokens>>('/api/auth/refresh', {
        refresh_token: refreshToken,
      });
      return response.data.data;
    }

    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }
    if (!data.session) {
      throw new Error('登录已过期，请重新登录');
    }
    return toAuthTokens(data.session);
  },

  /**
   * Get current user info
   */
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<{ user: User }>>('/api/auth/me');
    return response.data.data.user;
  },

  /**
   * Verify email with code (legacy fallback only)
   */
  verifyEmail: async (email: string, code: string): Promise<LoginResponse> => {
    if (!isSupabaseConfigured()) {
      const response = await apiClient.post<ApiResponse<LoginResponse>>('/api/auth/verify-email', { email, code });
      return response.data.data;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }
    if (!data.session) {
      throw new Error('请点击邮箱中的确认链接完成验证');
    }

    const user = await fetchCurrentUserWithAccessToken(data.session.access_token);
    const tokens = toAuthTokens(data.session);
    return {
      user,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      refresh_expires_in: tokens.refresh_expires_in,
    };
  },

  /**
   * Resend verification email
   */
  resendVerification: async (email: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      await apiClient.post('/api/auth/resend-verification', { email });
      return;
    }

    assertSupabaseConfigured();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getSupabaseRedirectUrl('/auth/oidc/callback'),
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Request password reset
   */
  forgotPassword: async (email: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      await apiClient.post('/api/auth/forgot-password', { email });
      return;
    }

    assertSupabaseConfigured();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getSupabaseRedirectUrl('/reset-password'),
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Reset password with token (Supabase uses the recovery session from the email link)
   */
  resetPassword: async (token: string, password: string): Promise<void> => {
    if (!isSupabaseConfigured() || token) {
      await apiClient.post('/api/auth/reset-password', { token, password });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Change password (requires authentication)
   */
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      await apiClient.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  },
};

// ==================== Token Management ====================

/**
 * Setup axios interceptor to add auth token to requests
 */
export const setupAuthInterceptor = () => {
  setupSupabaseAuthListener();

  if (requestInterceptorId === null) {
    requestInterceptorId = apiClient.interceptors.request.use(
      (config) => {
        const tokens = useAuthStore.getState().tokens;
        if (tokens?.access_token) {
          config.headers.Authorization = `Bearer ${tokens.access_token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  if (responseInterceptorId === null) {
    responseInterceptorId = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config || {};
        const isAuthMutationEndpoint = [
          '/api/auth/login',
          '/api/auth/register',
          '/api/auth/refresh',
        ].some((path) => originalRequest.url?.includes(path));

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthMutationEndpoint) {
          originalRequest._retry = true;

          try {
            const tokens = useAuthStore.getState().tokens;
            const newTokens = await authApi.refreshToken(tokens?.refresh_token || '');
            applyTokensToStore(newTokens, useAuthStore.getState().rememberMe || getSupabaseRememberMe());
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
            return apiClient(originalRequest);
          } catch (refreshError) {
            clearSupabaseSessionStorage();
            useAuthStore.getState().logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        if (error.response?.status === 402) {
          const lang = document.documentElement.lang?.startsWith('zh') ? 'zh' :
                      (localStorage.getItem('i18nextLng')?.startsWith('zh') ? 'zh' : 'en');
          error.friendlyMessage = lang === 'zh'
            ? '积分不足，请前往充值'
            : 'Insufficient credits. Please purchase more.';
          error.showPricingLink = true;
          console.warn('Insufficient credits');
        }

        return Promise.reject(error);
      }
    );
  }
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
 */
export const registerUser = async (email: string, password: string, username?: string, invitationCode?: string) => {
  const data = await authApi.register(email, password, username, invitationCode);

  if (data.access_token && data.refresh_token && data.user) {
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
    email: data.email || data.user?.email || email,
    requireVerification: data.require_verification || false,
  };
};

/**
 * Start Google OAuth login
 */
export const signInWithGoogle = async () => {
  if (!isSupabaseConfigured()) {
    const provider = 'google';
    const response = await fetch(`/api/auth/oidc/login?provider=${provider}`);
    const payload = await response.json();
    if (payload.data?.auth_url && payload.data?.state) {
      sessionStorage.setItem('oidc_state', payload.data.state);
      sessionStorage.setItem('oidc_provider', provider);
      window.location.href = payload.data.auth_url;
      return;
    }
    throw new Error(payload.error?.message || 'Google 登录失败，请重试');
  }

  assertSupabaseConfigured();
  setSupabaseRememberMe(true);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getSupabaseRedirectUrl('/auth/oidc/callback'),
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }
};

/**
 * Logout user
 */
export const logoutUser = async () => {
  try {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
  } finally {
    clearSupabaseSessionStorage();
    useAuthStore.getState().logout();
  }
};

/**
 * Refresh user's credit balance from the server
 * 从服务器刷新用户积分余额（轻量级，仅获取积分信息）
 */
export const refreshCredits = async (): Promise<void> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: { balance: number; used_total: number } }>('/api/payment/credits');
    const { balance, used_total } = response.data.data;
    useAuthStore.getState().updateCredits(balance, used_total);
  } catch (error) {
    console.warn('Failed to refresh credits:', error);
  }
};

/**
 * Check if user is authenticated and refresh user data
 * 每次都会验证 token，不信任存储中的 isAuthenticated
 */
export const checkAuth = async (): Promise<boolean> => {
  const store = useAuthStore.getState();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      if (data.session?.access_token) {
        const tokens = toAuthTokens(data.session);
        const user = await fetchCurrentUserWithAccessToken(data.session.access_token);
        store.login(user, tokens, getSupabaseRememberMe());
        return true;
      }
    } catch (error) {
      console.warn('Supabase session check failed:', readErrorMessage(error, 'unknown error'));
    }
  }

  const tokens = store.loadTokensFromStorage() || store.tokens;
  if (!tokens?.access_token) {
    store.logout();
    return false;
  }

  try {
    const user = await authApi.getCurrentUser();
    const currentState = useAuthStore.getState();
    const latestTokens = currentState.tokens || tokens;
    store.login(user, latestTokens, currentState.rememberMe);
    return true;
  } catch {
    clearSupabaseSessionStorage();
    store.logout();
    return false;
  }
};
