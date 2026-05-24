const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function getToken(): string | null {
  return typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
}

async function adminRequest<T>(path: string, options: RequestInit & { body?: unknown } = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = getToken();

  const res = await fetch(`${API_BASE}/admin${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string>),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Erro inesperado' }));
    throw new AdminApiError(res.status, err.message ?? 'Erro inesperado');
  }

  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

export class AdminApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardData {
  kpis: { todaySales: number; todayRevenue: number; monthOrders: number; averageTicket: number };
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
  lowStockAlerts: LowStockAlert[];
  dailyRevenue: { day: string; revenue: number }[];
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  total: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
  status: string;
}

export interface TopProduct {
  variantId: string;
  productName: string;
  sku: string;
  totalQty: number;
  totalRevenue: number;
}

export interface LowStockAlert {
  variantId: string;
  productName: string;
  size: string;
  colorName: string;
  stock: number;
  minStock: number;
}

export interface AdminProduct {
  id: string;
  name: string;
  sku: string;
  status: string;
  price: number;
  promotionalPrice: number | null;
  isOnSale: boolean;
  isFeatured: boolean;
  totalStock: number;
  isLowStock: boolean;
  primaryImage: string | null;
  category: { name: string };
  createdAt: string;
}

export interface AdminProductDetail extends AdminProduct {
  description: string;
  categoryId: string;
  variants: AdminVariant[];
  images: ProductImage[];
  brand?: string;
  collection?: string;
  composition?: string;
  seoTitle?: string;
  seoDescription?: string;
  tags: string[];
}

export interface AdminVariant {
  id: string;
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  stock: number;
  minStock: number;
  price: number | null;
}

export interface ProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
  order: number;
}

export interface InventoryVariant {
  id: string;
  sku: string;
  productName: string;
  category: string;
  size: string;
  colorName: string;
  colorHex: string;
  stock: number;
  minStock: number;
  soldThisMonth: number;
  status: 'AVAILABLE' | 'LOW' | 'OUT_OF_STOCK';
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  total: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
  status: string;
}

export interface AdminOrderDetail extends AdminOrder {
  user: { name: string; email: string; cpf: string; phone: string } | null;
  items: OrderItem[];
  payments: Payment[];
  statusHistory: StatusHistoryEntry[];
  shippingAddress: Record<string, string>;
  shippingMethod: string;
  trackingCode: string | null;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  coupon: { code: string } | null;
  guestName: string | null;
  guestEmail: string | null;
  cancelReason: string | null;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productSnapshot: Record<string, unknown>;
  variant: { size: string; colorName: string; product: { name: string } };
}

export interface Payment {
  id: string;
  method: string;
  status: string;
  amount: number;
  paidAt: string | null;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  notes: string | null;
  createdAt: string;
}

export interface AdminCoupon {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  maxUses: number | null;
  usesCount: number;
  usageCount: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const adminApi = {
  // Dashboard
  getDashboard: () => adminRequest<DashboardData>('/dashboard'),

  // Products
  getProducts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return adminRequest<PaginatedResult<AdminProduct>>(`/products${qs}`);
  },
  getProduct: (id: string) => adminRequest<AdminProductDetail>(`/products/${id}`),
  createProduct: (data: unknown) =>
    adminRequest<AdminProductDetail>('/products', { method: 'POST', body: data }),
  updateProduct: (id: string, data: unknown) =>
    adminRequest<AdminProductDetail>(`/products/${id}`, { method: 'PUT', body: data }),
  deleteProduct: (id: string) =>
    adminRequest<{ message: string }>(`/products/${id}`, { method: 'DELETE' }),
  patchProductStatus: (id: string, status: string) =>
    adminRequest<{ message: string }>(`/products/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),
  uploadProductImages: async (id: string, files: File[]) => {
    const token = getToken();
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    const res = await fetch(`${API_BASE}/admin/products/${id}/images`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Erro' }));
      throw new AdminApiError(res.status, err.message);
    }
    return res.json();
  },
  bulkProducts: (ids: string[], action: 'activate' | 'deactivate' | 'delete') =>
    adminRequest<{ affected: number; action: string }>('/products/bulk', {
      method: 'POST',
      body: { ids, action },
    }),

  // Inventory
  getInventory: () => adminRequest<InventoryVariant[]>('/inventory'),
  updateInventory: (variantId: string, data: { stock: number; minStock?: number }) =>
    adminRequest<InventoryVariant>(`/inventory/${variantId}`, { method: 'PUT', body: data }),
  createMovement: (data: unknown) =>
    adminRequest<unknown>('/inventory/movements', { method: 'POST', body: data }),
  getMovements: (variantId: string) =>
    adminRequest<unknown[]>(`/inventory/${variantId}/movements`),

  // Orders
  getOrders: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return adminRequest<PaginatedResult<AdminOrder>>(`/orders${qs}`);
  },
  getOrder: (id: string) => adminRequest<AdminOrderDetail>(`/orders/${id}`),
  updateOrderStatus: (id: string, data: { status: string; trackingCode?: string; notes?: string }) =>
    adminRequest<unknown>(`/orders/${id}/status`, { method: 'PUT', body: data }),

  // Coupons
  getCoupons: () => adminRequest<AdminCoupon[]>('/coupons'),
  getCoupon: (id: string) => adminRequest<AdminCoupon>(`/coupons/${id}`),
  createCoupon: (data: unknown) =>
    adminRequest<AdminCoupon>('/coupons', { method: 'POST', body: data }),
  updateCoupon: (id: string, data: unknown) =>
    adminRequest<AdminCoupon>(`/coupons/${id}`, { method: 'PUT', body: data }),
  deleteCoupon: (id: string) =>
    adminRequest<{ message: string }>(`/coupons/${id}`, { method: 'DELETE' }),
  patchCouponStatus: (id: string, isActive: boolean) =>
    adminRequest<{ message: string }>(`/coupons/${id}/status`, {
      method: 'PATCH',
      body: { isActive },
    }),
};
