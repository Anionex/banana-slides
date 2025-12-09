import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '@/store/useAuthStore';

// 将 Supabase 用户转换为应用用户格式
const convertSupabaseUser = (supabaseUser: SupabaseUser): User => {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    username: supabaseUser.user_metadata?.username ||
              supabaseUser.user_metadata?.name ||
              supabaseUser.email?.split('@')[0] ||
              'User',
    avatar_url: supabaseUser.user_metadata?.avatar_url,
    auth_provider: (supabaseUser.app_metadata?.provider as 'email' | 'google' | 'github') || 'email',
    preferred_language: supabaseUser.user_metadata?.preferred_language,
  };
};

export interface SupabaseAuthResponse {
  success: boolean;
  data?: {
    user: User;
    tokens: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  };
  error?: string;
}

// 注册（邮箱 + 密码）
export const supabaseRegister = async (
  email: string,
  password: string,
  username: string
): Promise<SupabaseAuthResponse> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase 未配置' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
      // 不发送确认邮件（需要在 Supabase 控制台关闭 email confirmation）
      emailRedirectTo: undefined,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data.user || !data.session) {
    return { success: false, error: '注册失败，请检查 Supabase 设置是否已关闭邮箱验证' };
  }

  return {
    success: true,
    data: {
      user: convertSupabaseUser(data.user),
      tokens: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in || 3600,
      },
    },
  };
};

// 登录（邮箱 + 密码）
export const supabaseLogin = async (
  email: string,
  password: string
): Promise<SupabaseAuthResponse> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase 未配置' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data.user || !data.session) {
    return { success: false, error: '登录失败' };
  }

  return {
    success: true,
    data: {
      user: convertSupabaseUser(data.user),
      tokens: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in || 3600,
      },
    },
  };
};

// 登出
export const supabaseLogout = async (): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase 未配置' };
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
};

// OAuth 登录（Google/GitHub）
export const supabaseOAuthLogin = async (
  provider: 'google' | 'github'
): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase 未配置' };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
};

// 获取当前会话
export const supabaseGetSession = async (): Promise<SupabaseAuthResponse> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase 未配置' };
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data.session) {
    return { success: false, error: '未登录' };
  }

  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return { success: false, error: '获取用户信息失败' };
  }

  return {
    success: true,
    data: {
      user: convertSupabaseUser(userData.user),
      tokens: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in || 3600,
      },
    },
  };
};

// 刷新令牌
export const supabaseRefreshToken = async (): Promise<SupabaseAuthResponse> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase 未配置' };
  }

  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data.session || !data.user) {
    return { success: false, error: '刷新令牌失败' };
  }

  return {
    success: true,
    data: {
      user: convertSupabaseUser(data.user),
      tokens: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in || 3600,
      },
    },
  };
};

// 更新用户资料
export const supabaseUpdateProfile = async (
  updates: { username?: string; avatar_url?: string; preferred_language?: string }
): Promise<SupabaseAuthResponse> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase 未配置' };
  }

  const { data, error } = await supabase.auth.updateUser({
    data: updates,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data.user) {
    return { success: false, error: '更新失败' };
  }

  // 获取当前会话
  const sessionResult = await supabaseGetSession();
  if (!sessionResult.success || !sessionResult.data) {
    return { success: false, error: '获取会话失败' };
  }

  return {
    success: true,
    data: {
      user: convertSupabaseUser(data.user),
      tokens: sessionResult.data.tokens,
    },
  };
};

// 监听认证状态变化
export const onAuthStateChange = (
  callback: (event: string, session: any) => void
) => {
  if (!isSupabaseConfigured() || !supabase) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }

  return supabase.auth.onAuthStateChange(callback);
};

// 重置密码（发送重置邮件）
export const supabaseResetPassword = async (
  email: string
): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase 未配置' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth?mode=reset`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
};

// 更新密码
export const supabaseUpdatePassword = async (
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase 未配置' };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
};
