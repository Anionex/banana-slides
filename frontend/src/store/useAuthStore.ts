/**
 * Authentication state management using Zustand
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, userApi, User, UserSettings, EffectiveConfig, AuthTokens } from '../api/auth';

interface AuthState {
    // State
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Settings
    settings: UserSettings | null;
    effectiveConfig: EffectiveConfig | null;

    // Actions
    login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
    register: (username: string, email: string, password: string, verificationCode: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshAccessToken: () => Promise<boolean>;
    fetchCurrentUser: () => Promise<void>;
    setTokensFromOAuth: (accessToken: string, refreshToken: string) => Promise<void>;

    // Settings actions
    fetchSettings: () => Promise<void>;
    updateSettings: (data: Partial<UserSettings>) => Promise<void>;
    resetSetting: (key: string) => Promise<void>;

    // Utils
    clearError: () => void;
    setError: (error: string) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            // Initial state
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            settings: null,
            effectiveConfig: null,

            // Login with email and password
            login: async (email: string, password: string, rememberMe = false) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await authApi.login({ email, password, remember_me: rememberMe });
                    set({
                        user: response.user,
                        accessToken: response.access_token,
                        refreshToken: response.refresh_token,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                    // Fetch settings after login
                    get().fetchSettings();
                } catch (error: any) {
                    const message = error.response?.data?.error || 'Login failed';
                    set({ error: message, isLoading: false });
                    throw new Error(message);
                }
            },

            // Register new user
            register: async (username: string, email: string, password: string, verificationCode: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await authApi.register({ username, email, password, verification_code: verificationCode });
                    set({
                        user: response.user,
                        accessToken: response.access_token,
                        refreshToken: response.refresh_token,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                    // Fetch settings after registration
                    get().fetchSettings();
                } catch (error: any) {
                    const message = error.response?.data?.error || 'Registration failed';
                    set({ error: message, isLoading: false });
                    throw new Error(message);
                }
            },

            // Logout
            logout: async () => {
                try {
                    await authApi.logout();
                } catch (error) {
                    // Ignore logout errors
                }
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                    settings: null,
                    effectiveConfig: null,
                });
            },

            // Refresh access token
            refreshAccessToken: async () => {
                const { refreshToken } = get();
                if (!refreshToken) return false;

                try {
                    const response = await authApi.refresh(refreshToken);
                    set({ accessToken: response.access_token });
                    return true;
                } catch (error) {
                    // Refresh failed, logout
                    set({
                        user: null,
                        accessToken: null,
                        refreshToken: null,
                        isAuthenticated: false,
                        settings: null,
                        effectiveConfig: null,
                    });
                    return false;
                }
            },

            // Fetch current user info
            fetchCurrentUser: async () => {
                const { accessToken } = get();
                if (!accessToken) return;

                set({ isLoading: true });
                try {
                    const response = await authApi.getCurrentUser();
                    set({ user: response.user, isAuthenticated: true, isLoading: false });
                } catch (error: any) {
                    if (error.response?.status === 401) {
                        // Token expired, try refresh
                        const refreshed = await get().refreshAccessToken();
                        if (refreshed) {
                            // Retry fetch
                            try {
                                const response = await authApi.getCurrentUser();
                                set({ user: response.user, isAuthenticated: true, isLoading: false });
                            } catch {
                                set({ isLoading: false });
                            }
                        } else {
                            set({ isLoading: false });
                        }
                    } else {
                        set({ isLoading: false });
                    }
                }
            },

            // Set tokens from OAuth callback
            setTokensFromOAuth: async (accessToken: string, refreshToken: string) => {
                set({ accessToken, refreshToken, isAuthenticated: true });
                await get().fetchCurrentUser();
                get().fetchSettings();
            },

            // Fetch user settings
            fetchSettings: async () => {
                try {
                    const response = await userApi.getSettings();
                    set({
                        settings: response.settings,
                        effectiveConfig: response.effective_config,
                    });
                } catch (error) {
                    console.error('Failed to fetch settings:', error);
                }
            },

            // Update user settings
            updateSettings: async (data) => {
                try {
                    const response = await userApi.updateSettings(data);
                    set({
                        settings: response.settings,
                        effectiveConfig: response.effective_config,
                    });
                } catch (error: any) {
                    const message = error.response?.data?.error || 'Failed to update settings';
                    set({ error: message });
                    throw new Error(message);
                }
            },

            // Reset a specific setting
            resetSetting: async (key: string) => {
                try {
                    const response = await userApi.resetSetting(key);
                    set({
                        settings: response.settings,
                        effectiveConfig: response.effective_config,
                    });
                } catch (error: any) {
                    const message = error.response?.data?.error || 'Failed to reset setting';
                    set({ error: message });
                    throw new Error(message);
                }
            },

            // Clear error
            clearError: () => set({ error: null }),

            // Set error
            setError: (error: string) => set({ error }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
