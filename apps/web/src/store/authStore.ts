import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'user';
  is_online: boolean;
  last_seen: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  setAuth: (token: string, user: AuthUser) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) =>
        set({ accessToken: token, user, isAuthenticated: true }),

      setAccessToken: (token) =>
        set({ accessToken: token }),

      logout: () =>
        set({ accessToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'kc-auth',
      // accessToken dahil persist et — sayfa yenilendiğinde oturum korunsun
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
