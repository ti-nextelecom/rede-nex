import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { apiGet, apiPost, apiPut } from './apiClient';

type LoginResult = {
  user: User & {
    must_change_password?: boolean;
    role_name?: string;
    department_name?: string;
  };
};

type AuthContextValue = {
  user: LoginResult['user'] | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  uploadCover: (file: File) => Promise<void>;
  updateProfile: (input: Partial<Pick<User, 'name' | 'email' | 'phone' | 'position' | 'bio' | 'google_ical_url' | 'photo_url'>>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type ApiResponse<T> = { data?: T };

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResult['user'] | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const response = await apiGet<ApiResponse<LoginResult['user']>>('/auth/me');
    setUser(response.data ?? null);
  }

  useEffect(() => {
    refreshUser()
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;

    let stopped = false;
    const beat = () => {
      if (!stopped) apiPost('/auth/heartbeat', {}).catch(() => undefined);
    };

    beat();
    const interval = window.setInterval(beat, 45000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    window.addEventListener('focus', beat);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', beat);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  async function login(email: string, password: string) {
    const response = await apiPost<ApiResponse<LoginResult>>('/auth/login', { email, password });
    if (!response.data) throw new Error('Login inválido');
    setUser(response.data.user);
  }

  async function logout() {
    await apiPost('/auth/logout', {}).catch(() => undefined);
    setUser(null);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await apiPost('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    await refreshUser();
  }

  async function uploadAvatar(file: File) {
    const data = await readFileAsDataUrl(file);
    await apiPost('/users/me/avatar', { file_name: file.name, file_type: file.type, data });
    await refreshUser();
  }

  async function uploadCover(file: File) {
    const data = await readFileAsDataUrl(file);
    await apiPost('/users/me/cover', { file_name: file.name, file_type: file.type, data });
    await refreshUser();
  }

  async function updateProfile(input: Partial<Pick<User, 'name' | 'email' | 'phone' | 'position' | 'bio' | 'google_ical_url' | 'photo_url'>>) {
    const response = await apiPut<ApiResponse<LoginResult['user']>>('/users/me', input);
    if (response.data) setUser(response.data);
  }

  const value: AuthContextValue = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    changePassword,
    uploadAvatar,
    uploadCover,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return context;
}
