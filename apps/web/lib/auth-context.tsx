'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type AuthResponse } from './api';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (data: { email: string; password: string }) => Promise<AuthResponse>;
  register: (data: {
    name: string;
    email: string;
    cpf: string;
    phone: string;
    password: string;
    acceptTerms: boolean;
  }) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  setAuth: (response: AuthResponse) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setAuth = useCallback((response: AuthResponse) => {
    setAccessToken(response.accessToken);
    setUser(response.user);
    sessionStorage.setItem('access_token', response.accessToken);
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    sessionStorage.removeItem('access_token');
  }, []);

  // Tenta renovar o token ao carregar a página via cookie HttpOnly
  useEffect(() => {
    authApi
      .refresh()
      .then(setAuth)
      .catch(() => clearAuth())
      .finally(() => setIsLoading(false));
  }, [setAuth, clearAuth]);

  const login = useCallback(
    async (data: { email: string; password: string }) => {
      const response = await authApi.login(data);
      setAuth(response);
      return response;
    },
    [setAuth],
  );

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      cpf: string;
      phone: string;
      password: string;
      acceptTerms: boolean;
    }) => {
      const response = await authApi.register(data);
      setAuth(response);
      return response;
    },
    [setAuth],
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => null);
    clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
