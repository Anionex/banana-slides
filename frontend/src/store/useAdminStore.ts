import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminUser {
  id: number;
  username: string | null;
  phone: string | null;
  role: string;
}

interface AdminStore {
  admin: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (admin: AdminUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set, get) => ({
      admin: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (admin, accessToken, refreshToken) =>
        set({ admin, accessToken, refreshToken }),

      logout: () => set({ admin: null, accessToken: null, refreshToken: null }),

      isAuthenticated: () => !!get().accessToken && !!get().admin,
    }),
    { name: 'feiye-admin' } as any,
  ),
);
