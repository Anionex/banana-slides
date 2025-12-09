import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase 配置
// 请在 Supabase 控制台获取这些值：https://supabase.com/dashboard
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 检查配置是否完整
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// 创建 Supabase 客户端（仅在配置完整时）
let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // 自动刷新 token
      autoRefreshToken: true,
      // 持久化会话到 localStorage
      persistSession: true,
      // 检测会话变化
      detectSessionInUrl: true,
    },
  });
}

// 导出 Supabase 客户端（可能为 null）
export const supabase = supabaseInstance;

// 导出类型
export type { User, Session } from '@supabase/supabase-js';
