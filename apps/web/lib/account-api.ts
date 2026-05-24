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
    throw new AccountApiError(res.status, error.message ?? 'Erro inesperado');
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class AccountApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AccountApiError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  role: string;
  createdAt: string;
}

export interface UserAddress {
  id: string;
  label?: string;
  recipientName: string;
  zipCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
  createdAt: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: string;
  discountAmount: string;
  shippingAmount: string;
  total: string;
  createdAt: string;
  payments: { method: string; status: string }[];
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  productSnapshot: Record<string, unknown>;
  variant: {
    id: string;
    sku: string;
    size: string;
    colorName: string;
    colorHex?: string;
    product: {
      id: string;
      name: string;
      slug: string;
      images: { url: string; thumbnailUrl: string }[];
    };
  };
}

export interface OrderStatusHistory {
  id: string;
  fromStatus?: string;
  toStatus: string;
  notes?: string;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: string;
  discountAmount: string;
  shippingAmount: string;
  total: string;
  shippingAddress: Record<string, unknown>;
  shippingMethod: string;
  trackingCode?: string;
  estimatedDelivery?: string;
  cancelReason?: string;
  createdAt: string;
  items: OrderItem[];
  payments: { method: string; status: string; paidAt?: string }[];
  statusHistory: OrderStatusHistory[];
}

export interface OrdersResult {
  data: OrderSummary[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const accountApi = {
  // Perfil
  getMe: () => request<UserProfile>('/users/me'),
  updateMe: (data: { name?: string; phone?: string }) =>
    request<UserProfile>('/users/me', { method: 'PUT', body: data }),
  deleteMe: () => request<void>('/users/me', { method: 'DELETE' }),

  // Endereços
  getAddresses: () => request<UserAddress[]>('/users/me/addresses'),
  createAddress: (data: Omit<UserAddress, 'id' | 'createdAt'>) =>
    request<UserAddress>('/users/me/addresses', { method: 'POST', body: data }),
  updateAddress: (id: string, data: Partial<Omit<UserAddress, 'id' | 'createdAt'>>) =>
    request<UserAddress>(`/users/me/addresses/${id}`, { method: 'PUT', body: data }),
  deleteAddress: (id: string) =>
    request<void>(`/users/me/addresses/${id}`, { method: 'DELETE' }),
  setDefaultAddress: (id: string) =>
    request<UserAddress>(`/users/me/addresses/${id}/default`, { method: 'PATCH' }),

  // Pedidos
  getOrders: (params?: { status?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return request<OrdersResult>(`/users/me/orders${query ? `?${query}` : ''}`);
  },
  getOrder: (id: string) => request<OrderDetail>(`/orders/${id}`),
  cancelOrder: (id: string, reason: string) =>
    request<void>(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
};
