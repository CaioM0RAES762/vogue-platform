const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Erro inesperado' }));
    throw new ApiError(res.status, error.message ?? 'Erro inesperado');
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; role: string; name: string };
}

export const authApi = {
  register: (data: {
    name: string;
    email: string;
    cpf: string;
    phone: string;
    password: string;
    acceptTerms: boolean;
  }) => request<AuthResponse>('/auth/register', { method: 'POST', body: data }),

  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: data }),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  refresh: () => request<AuthResponse>('/auth/refresh', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    }),
};
