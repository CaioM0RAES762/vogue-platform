const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token =
    typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;

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
    throw new CartApiError(res.status, error.message ?? 'Erro inesperado');
  }

  return res.json() as Promise<T>;
}

export class CartApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CartApiError';
  }
}

// ──────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────

export interface CartVariant {
  id: string;
  size: string;
  colorName: string;
  colorHex: string | null;
  stock: number;
  reservedStock: number;
}

export interface CartProduct {
  name: string;
  slug: string;
  primaryImage: string | null;
}

export interface CartItem {
  id: string;
  variant: CartVariant;
  product: CartProduct;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface CartCoupon {
  code: string;
  type: 'FIXED' | 'PERCENTAGE';
  value: number;
}

export interface Cart {
  id: string | null;
  items: CartItem[];
  coupon: CartCoupon | null;
  subtotal: number;
  discount: number;
  total: number;
}

// ──────────────────────────────────────────────────────
// API client
// ──────────────────────────────────────────────────────

export const cartApi = {
  getCart: () => request<Cart>('/cart'),

  addItem: (variantId: string, quantity: number) =>
    request<Cart>('/cart/items', {
      method: 'POST',
      body: { variantId, quantity },
    }),

  updateItem: (itemId: string, quantity: number) =>
    request<Cart>(`/cart/items/${itemId}`, {
      method: 'PUT',
      body: { quantity },
    }),

  removeItem: (itemId: string) =>
    request<Cart>(`/cart/items/${itemId}`, { method: 'DELETE' }),

  clearCart: () => request<Cart>('/cart', { method: 'DELETE' }),

  applyCoupon: (code: string) =>
    request<Cart>('/cart/coupon', { method: 'POST', body: { code } }),

  removeCoupon: () => request<Cart>('/cart/coupon', { method: 'DELETE' }),
};
