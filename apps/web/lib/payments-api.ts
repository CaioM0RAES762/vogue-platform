const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function request<T>(path: string, options: RequestInit & { body?: unknown } = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
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
    const error = await res.json().catch(() => ({ message: 'Erro inesperado' }));
    throw new Error((error as { message?: string }).message ?? 'Erro inesperado');
  }

  return res.json() as Promise<T>;
}

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO';
export type OrderStatus = 'PENDING' | 'PAID' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface PaymentStatusResponse {
  orderId: string;
  orderStatus: OrderStatus;
  expiresAt: string | null;
  payment: {
    status: string;
    method: PaymentMethod;
    qrCode: string | null;
    qrCodeBase64: string | null;
    barcode: string | null;
    expiresAt: string | null;
  } | null;
}

export const paymentsApi = {
  getOrderStatus: (orderId: string) =>
    request<PaymentStatusResponse>(`/payments/orders/${orderId}/status`),
};
