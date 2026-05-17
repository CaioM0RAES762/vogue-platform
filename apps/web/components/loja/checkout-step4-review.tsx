'use client';

import { useState } from 'react';
import { Loader2, MapPin, Package, Truck, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  CheckoutCustomer,
  CheckoutAddress,
  CheckoutPayment,
  ShippingOption,
} from '@/lib/checkout-api';
import { useCartStore } from '@/store/cart-store';
import { cn } from '@/lib/utils';

interface Props {
  customer: CheckoutCustomer;
  address: CheckoutAddress;
  shipping: ShippingOption;
  payment: CheckoutPayment;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  loading: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  BOLETO: 'Boleto Bancário',
};

function currency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CheckoutStep4Review({
  customer,
  address,
  shipping,
  payment,
  onConfirm,
  onBack,
  loading,
}: Props) {
  const { cart } = useCartStore();
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);

  const subtotal = cart?.subtotal ?? 0;
  const discount = cart?.discount ?? 0;
  const total = subtotal - discount + shipping.price;

  async function handleConfirm() {
    if (!agreed) {
      setAgreeError(true);
      return;
    }
    await onConfirm();
  }

  return (
    <div className="space-y-5">
      <h2 className="font-playfair text-xl font-bold text-gray-900">Revisão do Pedido</h2>

      {/* Itens */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Package className="h-4 w-4" />
          Itens ({cart?.items?.length ?? 0})
        </div>
        {cart?.items?.map((item: {
          id: string;
          variant: { size: string; colorName: string; product: { name: string } };
          quantity: number;
          unitPrice: number;
        }) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-gray-700">
              {item.variant.product.name} — {item.variant.size} / {item.variant.colorName} ×{' '}
              {item.quantity}
            </span>
            <span className="font-medium">{currency(item.unitPrice * item.quantity)}</span>
          </div>
        ))}
      </section>

      {/* Endereço */}
      <section className="space-y-1 rounded-lg bg-gray-50 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <MapPin className="h-4 w-4" />
          Endereço de Entrega
        </div>
        <p className="text-sm text-gray-600">
          {address.street}, {address.number}
          {address.complement ? ` — ${address.complement}` : ''}
        </p>
        <p className="text-sm text-gray-600">
          {address.neighborhood} — {address.city}/{address.state}
        </p>
        <p className="text-sm text-gray-600">CEP: {address.zipCode}</p>
      </section>

      {/* Frete */}
      <section className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
        <Truck className="h-4 w-4 text-gray-400" />
        <div className="flex flex-1 justify-between text-sm">
          <span className="text-gray-700">
            {shipping.carrier} — {shipping.service} ({shipping.days} dias úteis)
          </span>
          <span className="font-medium">{currency(shipping.price)}</span>
        </div>
      </section>

      {/* Pagamento */}
      <section className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
        <CreditCard className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-700">{METHOD_LABELS[payment.method]}</span>
      </section>

      {/* Totais */}
      <div className="space-y-1 border-t pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span>{currency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Desconto</span>
            <span>- {currency(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Frete</span>
          <span>{currency(shipping.price)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span>
          <span className="text-amber-600">{currency(total)}</span>
        </div>
      </div>

      {/* Aceite dos termos */}
      <label className={cn('flex cursor-pointer items-start gap-2 text-sm', agreeError && 'text-red-500')}>
        <input
          type="checkbox"
          className="mt-0.5 accent-amber-500"
          checked={agreed}
          onChange={(e) => {
            setAgreed(e.target.checked);
            if (e.target.checked) setAgreeError(false);
          }}
        />
        Li e aceito os{' '}
        <a href="/termos" target="_blank" className="underline hover:text-amber-600">
          termos de uso
        </a>{' '}
        e a{' '}
        <a href="/privacidade" target="_blank" className="underline hover:text-amber-600">
          política de privacidade
        </a>
        .
      </label>
      {agreeError && (
        <p className="text-xs text-red-500">Você precisa aceitar os termos para continuar.</p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack} disabled={loading}>
          Voltar
        </Button>
        <Button
          type="button"
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-60"
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando…
            </span>
          ) : (
            'Finalizar Pedido'
          )}
        </Button>
      </div>
    </div>
  );
}
