/**
 * Auth Store - manages user authentication state
 * 认证状态管理
 * 
 * 支持"记住我"功能：
 * - rememberMe=true: token 存在 localStorage（浏览器关闭后保留）
 * - rememberMe=false: token 存在 sessionStorage（浏览器关闭后清除）
 */
import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  username?: string;
  avatar_url?: string;
  subscription_plan: string;
  subscription_expires_at?: string;
  credits_balance: number;
  credits_used_total: number;
  projects_count: number;
  storage_used_mb: number;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in?: number;
}

interface AuthState {
  // State
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  rememberMe: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  login: (user: User, tokens: AuthTokens, rememberMe?: boolean) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  updateCredits: (balance: number, usedTotal?: number) => void;
  setLoading: (loading: boolean) => void;
  loadTokensFromStorage: () => AuthTokens | null;
}

// Storage keys
const STORAGE_KEY = 'banana-slides-auth-tokens';
const REMEMBER_KEY = 'banana-slides-remember-me';

// Helper functions for storage
const getStorage = (rememberMe: boolean): Storage => {
  return rememberMe ? localStorage : sessionStorage;
};

const saveTokensToStorage = (tokens: AuthTokens | null, rememberMe: boolean) => {
  const storage = getStorage(rememberMe);
  if (tokens) {
    storage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    localStorage.setItem(REMEMBER_KEY, String(rememberMe));
  } else {
    // Clear from both storages
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }
};

const loadTokensFromStorage = (): { tokens: AuthTokens | null; rememberMe: boolean } => {
  // First check if we should use localStorage or sessionStorage
  const rememberMe = localStorage.getItem(REMEMBER_KEY) === 'true';
  
  // Try to load from the appropriate storage
  const storage = getStorage(rememberMe);
  const tokensJson = storage.getItem(STORAGE_KEY);
  
  if (tokensJson) {
    try {
      return { tokens: JSON.parse(tokensJson), rememberMe };
    } catch {
      return { tokens: null, rememberMe: false };
    }
  }
  
  // Fallback: check the other storage (in case of migration)
  const otherStorage = rememberMe ? sessionStorage : localStorage;
  const otherTokensJson = otherStorage.getItem(STORAGE_KEY);
  
  if (otherTokensJson) {
    try {
      return { tokens: JSON.parse(otherTokensJson), rememberMe: !rememberMe };
    } catch {
      return { tokens: null, rememberMe: false };
    }
  }
  
  return { tokens: null, rememberMe: false };
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  // Initial state
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,  // Start with loading=true until auth check completes
  rememberMe: false,
  
  // Actions
  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user 
  }),
  
  setTokens: (tokens) => {
    const { rememberMe } = get();
    saveTokensToStorage(tokens, rememberMe);
    set({ tokens });
  },
  
  login: (user, tokens, rememberMe = false) => {
    saveTokensToStorage(tokens, rememberMe);
    set({
      user,
      tokens,
      isAuthenticated: true,
      isLoading: false,
      rememberMe,
    });
  },
  
  logout: () => {
    saveTokensToStorage(null, false);
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      rememberMe: false,
    });
  },
  
  updateUser: (updates) => set((state) => ({
    user: state.user ? { ...state.user, ...updates } : null,
  })),
  
  updateCredits: (balance, usedTotal) => set((state) => ({
    user: state.user ? {
      ...state.user,
      credits_balance: balance,
      credits_used_total: usedTotal ?? state.user.credits_used_total,
    } : null,
  })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  // Load tokens from storage (called on app init)
  loadTokensFromStorage: () => {
    const { tokens, rememberMe } = loadTokensFromStorage();
    if (tokens) {
      set({ tokens, rememberMe });
    }
    return tokens;
  },
}));

// Selector hooks for convenience
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useCreditsBalance = () => useAuthStore((state) => state.user?.credits_balance ?? 0);
