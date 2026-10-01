import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/client';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'placement' | 'hod' | 'proctor';
  department_id?: number | null;
  departmentId?: number | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  institutionName?: string;
  institutionCode?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  institution: {
    name: string;
    code: string;
    defaultDepartmentCode: string;
    academicYear: string;
  } | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      institution: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login(email, password);
          const { user, accessToken, refreshToken } = res.data;

          const formattedUser: User = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role.toLowerCase() as any,
            departmentId: user.departmentId || user.department_id,
            departmentName: user.departmentName || user.department_name,
            departmentCode: user.departmentCode || user.department_code,
          };

          set({
            user: formattedUser,
            token: accessToken,
            refreshToken: refreshToken || null,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (err: any) {
          const errMsg = err.response?.data?.error || err.message || 'Login failed. Please check credentials.';
          set({ isLoading: false, error: errMsg });
          return false;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch (e) {}
        set({ user: null, token: null, refreshToken: null });
      },

      fetchCurrentUser: async () => {
        try {
          const res = await authApi.getMe();
          if (res.data?.user) {
            const user = res.data.user;
            set({
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role.toLowerCase() as any,
                departmentId: user.department_id,
                departmentName: user.department_name,
                departmentCode: user.department_code,
              },
              institution: res.data.institution || get().institution
            });
          }
        } catch (err) {}
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'codetrack-auth-v2',
      partialize: (s) => ({ user: s.user, token: s.token, refreshToken: s.refreshToken, institution: s.institution })
    }
  )
);
