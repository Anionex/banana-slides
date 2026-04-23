import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const SUPABASE_SESSION_STORAGE_KEY = 'banana-slides-supabase-auth';
export const SUPABASE_REMEMBER_ME_KEY = 'banana-slides-remember-me';

const browserStorage = (): { local: Storage | null; session: Storage | null } => {
  if (typeof window === 'undefined') {
    return { local: null, session: null };
  }
  return { local: window.localStorage, session: window.sessionStorage };
};

const getRememberMe = (): boolean => {
  const { local } = browserStorage();
  return local?.getItem(SUPABASE_REMEMBER_ME_KEY) === 'true';
};

const getPreferredStorage = (): Storage | null => {
  const { local, session } = browserStorage();
  return getRememberMe() ? local : session;
};

const getFallbackStorage = (): Storage | null => {
  const { local, session } = browserStorage();
  return getRememberMe() ? session : local;
};

const hybridStorage: SupportedStorage = {
  getItem(key: string) {
    const preferred = getPreferredStorage();
    const fallback = getFallbackStorage();
    return preferred?.getItem(key) ?? fallback?.getItem(key) ?? null;
  },
  setItem(key: string, value: string) {
    const preferred = getPreferredStorage();
    const fallback = getFallbackStorage();
    preferred?.setItem(key, value);
    fallback?.removeItem(key);
  },
  removeItem(key: string) {
    const { local, session } = browserStorage();
    local?.removeItem(key);
    session?.removeItem(key);
  },
};

export const isSupabaseConfigured = (): boolean => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const setSupabaseRememberMe = (rememberMe: boolean) => {
  const { local } = browserStorage();
  if (!local) {
    return;
  }
  local.setItem(SUPABASE_REMEMBER_ME_KEY, String(rememberMe));
};

export const getSupabaseRememberMe = (): boolean => getRememberMe();

export const clearSupabaseSessionStorage = () => {
  hybridStorage.removeItem(SUPABASE_SESSION_STORAGE_KEY);
};

export const getSupabaseRedirectUrl = (path: string) => {
  if (typeof window === 'undefined') {
    return path;
  }
  return `${window.location.origin}${path}`;
};

const fallbackUrl = SUPABASE_URL || 'http://127.0.0.1:54321';
const fallbackAnonKey = SUPABASE_ANON_KEY || 'supabase-anon-key-not-configured';

export const supabase = createClient(fallbackUrl, fallbackAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: hybridStorage,
    storageKey: SUPABASE_SESSION_STORAGE_KEY,
  },
});

export const assertSupabaseConfigured = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  }
};
