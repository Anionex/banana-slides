import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserInfo {
  id: number;
  phone: string | null;
  username: string | null;
  role: 'user' | 'internal' | 'admin';
  points: number;
  is_active: boolean;
  created_at: string;
  subscription?: {
    id: number;
    plan: string;
    status: string;
    start_date: string;
    end_date: string;
  } | null;
}

interface UserStore {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  loginModalOpen: boolean;

  setAuth: (user: UserInfo, accessToken: string, refreshToken: string) => void;
  setUser: (user: UserInfo) => void;
  logout: () => void;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  requireAuth: () => boolean; // returns true if authenticated, opens modal if not
  isAdmin: () => boolean;
  isInternalUser: () => boolean;
  canAccessAdminConsole: () => boolean;
  usesPrivateSettings: () => boolean;
  canAccessSettingsPage: () => boolean;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      loginModalOpen: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, loginModalOpen: false }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null }),

      openLoginModal: () => set({ loginModalOpen: true }),
      closeLoginModal: () => set({ loginModalOpen: false }),

      requireAuth: () => {
        const { user } = get();
        if (user) return true;
        set({ loginModalOpen: true });
        return false;
      },

      isAdmin: () => get().user?.role === 'admin',
      isInternalUser: () => get().user?.role === 'internal',
      canAccessAdminConsole: () => get().user?.role === 'admin',
      usesPrivateSettings: () => get().user?.role === 'internal',
      canAccessSettingsPage: () =>
        get().user?.role === 'admin' || get().user?.role === 'internal',
    }),
    {
      name: 'feiye-user',
      partialState: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    } as any,
  ),
);
