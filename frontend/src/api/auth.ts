/**
 * Authentication API endpoints
 */
import { apiClient } from './client';

// Types
export interface User {
    id: string;
    username: string;
    email?: string;
    avatar_url: string | null;
    role: string;
    oauth_provider: string | null;
    is_active?: boolean;
    created_at: string;
    updated_at?: string;
}

export interface UserSettings {
    id: string;
    user_id: string;
    google_api_base: string | null;
    mineru_api_base: string | null;
    image_caption_model: string | null;
    max_description_workers: number | null;
    max_image_workers: number | null;
    has_google_api_key: boolean;
    has_mineru_token: boolean;
    created_at: string;
    updated_at: string;
}

export interface EffectiveConfig {
    google_api_key: { is_set: boolean; source: 'user' | 'system' };
    google_api_base: { value: string; source: 'user' | 'system' };
    mineru_token: { is_set: boolean; source: 'user' | 'system' };
    mineru_api_base: { value: string; source: 'user' | 'system' };
    image_caption_model: { value: string; source: 'user' | 'system' };
    max_description_workers: { value: number; source: 'user' | 'system' };
    max_image_workers: { value: number; source: 'user' | 'system' };
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

export interface LoginRequest {
    email: string;
    password: string;
    remember_me?: boolean;
}

export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    verification_code: string;
}

export interface SendCodeRequest {
    email: string;
    code_type: 'register' | 'reset_password';
}

export interface ResetPasswordRequest {
    email: string;
    verification_code: string;
    new_password: string;
}

export interface UpdateSettingsRequest {
    google_api_key?: string;
    google_api_base?: string;
    mineru_token?: string;
    mineru_api_base?: string;
    image_caption_model?: string;
    max_description_workers?: number;
    max_image_workers?: number;
}

// API Functions

export const authApi = {
    /**
     * Register a new user
     */
    register: async (data: RegisterRequest): Promise<{ user: User } & AuthTokens> => {
        const response = await apiClient.post('/api/auth/register', data);
        return response.data;
    },

    /**
     * Login with email and password
     */
    login: async (data: LoginRequest): Promise<{ user: User } & AuthTokens> => {
        const response = await apiClient.post('/api/auth/login', data);
        return response.data;
    },

    /**
     * Logout current user
     */
    logout: async (): Promise<void> => {
        await apiClient.post('/api/auth/logout');
    },

    /**
     * Refresh access token
     */
    refresh: async (refreshToken: string): Promise<{ access_token: string; token_type: string }> => {
        const response = await apiClient.post('/api/auth/refresh', null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
        });
        return response.data;
    },

    /**
     * Get current authenticated user
     */
    getCurrentUser: async (): Promise<{ user: User }> => {
        const response = await apiClient.get('/api/auth/me');
        return response.data;
    },

    /**
     * Get Google OAuth URL
     */
    getGoogleAuthUrl: (): string => {
        return '/api/auth/google';
    },

    /**
     * Get GitHub OAuth URL
     */
    getGitHubAuthUrl: (): string => {
        return '/api/auth/github';
    },

    /**
     * Send verification code to email
     */
    sendVerificationCode: async (data: SendCodeRequest): Promise<{ message: string; expires_in: number }> => {
        const response = await apiClient.post('/api/auth/send-code', data);
        return response.data;
    },

    /**
     * Verify a verification code (pre-check)
     */
    verifyCode: async (email: string, code: string, codeType: string): Promise<{ valid: boolean; error?: string }> => {
        const response = await apiClient.post('/api/auth/verify-code', {
            email,
            code,
            code_type: codeType,
        });
        return response.data;
    },

    /**
     * Reset password using verification code
     */
    resetPassword: async (data: ResetPasswordRequest): Promise<{ message: string }> => {
        const response = await apiClient.post('/api/auth/reset-password', data);
        return response.data;
    },
};

export const userApi = {
    /**
     * Get user profile
     */
    getProfile: async (): Promise<{ user: User }> => {
        const response = await apiClient.get('/api/user/profile');
        return response.data;
    },

    /**
     * Update user profile
     */
    updateProfile: async (data: { username?: string; avatar_url?: string }): Promise<{ user: User }> => {
        const response = await apiClient.put('/api/user/profile', data);
        return response.data;
    },

    /**
     * Change password
     */
    changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
        await apiClient.put('/api/user/password', {
            old_password: oldPassword,
            new_password: newPassword,
        });
    },

    /**
     * Get user settings
     */
    getSettings: async (): Promise<{ settings: UserSettings; effective_config: EffectiveConfig }> => {
        const response = await apiClient.get('/api/user/settings');
        return response.data;
    },

    /**
     * Update user settings
     */
    updateSettings: async (data: UpdateSettingsRequest): Promise<{ settings: UserSettings; effective_config: EffectiveConfig }> => {
        const response = await apiClient.put('/api/user/settings', data);
        return response.data;
    },

    /**
     * Reset a specific setting to system default
     */
    resetSetting: async (key: string): Promise<{ settings: UserSettings; effective_config: EffectiveConfig }> => {
        const response = await apiClient.delete(`/api/user/settings/${key}`);
        return response.data;
    },
};
