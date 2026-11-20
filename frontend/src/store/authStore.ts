import { create } from 'zustand';
import { api, setMemoryToken } from '../services/api';
import { User, ApiResponse, LoginResponseData } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.post<ApiResponse<LoginResponseData>>('/auth/login', {
      email,
      password,
    });

    const { user, tokens } = res.data.data;
    setMemoryToken(tokens.accessToken);
    sessionStorage.setItem('pravaah_rt', tokens.refreshToken);

    set({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      setMemoryToken(null);
      sessionStorage.removeItem('pravaah_rt');
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  initAuth: async () => {
    const refreshToken = sessionStorage.getItem('pravaah_rt');
    if (!refreshToken) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const refreshRes = await api.post<ApiResponse<{ tokens: { accessToken: string; refreshToken?: string } }>>(
        '/auth/refresh',
        { refreshToken }
      );

      const newAccessToken = refreshRes.data.data.tokens.accessToken;
      setMemoryToken(newAccessToken);

      if (refreshRes.data.data.tokens.refreshToken) {
        sessionStorage.setItem('pravaah_rt', refreshRes.data.data.tokens.refreshToken);
      }

      // Fetch current profile
      const meRes = await api.get<ApiResponse<{ user: User }>>('/auth/me');
      set({
        user: meRes.data.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      setMemoryToken(null);
      sessionStorage.removeItem('pravaah_rt');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
