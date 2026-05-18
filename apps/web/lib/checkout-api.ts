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
    throw new CheckoutApiError(res.status, error.message ?? 'Erro inesperado');
  }

  return res.json() as Promise<T>;
}

export class CheckoutApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CheckoutApiError';
  }
}

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ShippingOption {
  carrier: string;
  service: string;
  price: number;
  days: number;
}

export interface ShippingItem {
  variantId: string;
  quantity: number;
}

export interface CheckoutCustomer {
  name: string;
  email: string;
  cpf: string;
  phone?: string;
}

export interface CheckoutAddress {
  zipCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  recipientName?: string;
}

export interface CheckoutPayment {
  method: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO';
  installments?: number;
  /** Token gerado pelo MP.js — nunca dados brutos do cartão (RN008) */
  cardToken?: string;
  /** ID do método identificado pelo MP.js (visa, master, elo...) */
  paymentMethodId?: string;
}

export interface CreateCheckoutPayload {
  customer: CheckoutCustomer;
  address: CheckoutAddress;
  shipping: ShippingOption;
  payment: CheckoutPayment;
  couponCode?: string;
  sessionId?: string;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  payment: {
    method: string;
    externalId?: string;
    qrCode?: string;
    qrCodeBase64?: string;
    barcode?: string;
    boletoUrl?: string;
    expiresAt?: string;
  };
}

export interface ViaCepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

// ──────────────────────────────────────────────────────────────
// API calls
// ──────────────────────────────────────────────────────────────

export async function getShippingOptions(
  zipCode: string,
  items: ShippingItem[],
): Promise<ShippingOption[]> {
  return request<ShippingOption[]>('/checkout/shipping-options', {
    method: 'POST',
    body: { zipCode, items },
  });
}

export async function createCheckout(
  payload: CreateCheckoutPayload,
): Promise<CheckoutResult> {
  return request<CheckoutResult>('/checkout', {
    method: 'POST',
    body: payload,
  });
}

export async function lookupCep(zipCode: string): Promise<ViaCepResult> {
  return request<ViaCepResult>(`/cep/${zipCode.replace(/\D/g, '')}`);
}
