import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithOAuth: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}))

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

vi.mock('../lib/supabase', () => ({
  assertSupabaseConfigured: vi.fn(),
  clearSupabaseSessionStorage: vi.fn(),
  getSupabaseRedirectUrl: (path: string) => `http://localhost:3000${path}`,
  getSupabaseRememberMe: () => true,
  isSupabaseConfigured: () => true,
  setSupabaseRememberMe: vi.fn(),
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      signInWithOAuth: supabaseMocks.signInWithOAuth,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signOut: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}))

import { apiClient } from './client'
import { checkAuth, signInWithGoogle } from './auth'
import { useAuthStore } from '../store/useAuthStore'

const mockedClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

describe('authApi with Supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().logout()
  })

  it('hydrates the auth store from an existing Supabase session', async () => {
    supabaseMocks.getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'supabase-access-token',
          refresh_token: 'supabase-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      },
      error: null,
    })
    mockedClient.get.mockResolvedValueOnce({
      data: {
        data: {
          user: {
            id: 'user_123',
            email: 'founder@example.com',
            subscription_plan: 'free',
            credits_balance: 120,
            credits_used_total: 0,
            projects_count: 0,
            storage_used_mb: 0,
            is_active: true,
            email_verified: true,
            created_at: '2026-01-01T00:00:00Z',
          },
        },
      },
    })

    const ok = await checkAuth()

    expect(ok).toBe(true)
    expect(mockedClient.get).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer supabase-access-token',
      }),
    }))
    expect(useAuthStore.getState().user?.email).toBe('founder@example.com')
    expect(useAuthStore.getState().tokens?.refresh_token).toBe('supabase-refresh-token')
  })

  it('starts Google OAuth with the Supabase callback URL', async () => {
    supabaseMocks.signInWithOAuth.mockResolvedValueOnce({ error: null })

    await signInWithGoogle()

    expect(supabaseMocks.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: 'http://localhost:3000/auth/oidc/callback',
      }),
    }))
  })
})
