'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import { useCartStore } from '@/store/cart-store';
import { cn } from '@/lib/utils';

interface Props {
  shippingPrice?: number;
}

function currency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CheckoutSummary({ shippingPrice }: Props) {
  const { cart } = useCartStore();
  const [collapsed, setCollapsed] = useState(false);

  const subtotal = cart?.subtotal ?? 0;
  const discount = cart?.discount ?? 0;
  const shipping = shippingPrice ?? 0;
  const total = subtotal - discount + shipping;
  const itemCount = cart?.items?.length ?? 0;

  return (
    <aside className="rounded-xl border bg-gray-50 p-4 shadow-sm">
      {/* Header colapsável em mobile */}
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 font-semibold text-gray-900">
          <ShoppingBag className="h-5 w-5 text-amber-500" />
          Resumo do pedido
          <span className="text-sm font-normal text-gray-500">({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Itens */}
      <div className={cn('mt-4 space-y-3', collapsed && 'hidden')}>
        {cart?.items?.map((item: {
          id: string;
          variant: {
            size: string;
            colorName: string;
            product: {
              name: string;
              images: Array<{ thumbnailUrl: string }>;
            };
          };
          quantity: number;
          unitPrice: number;
        }) => (
          <div key={item.id} className="flex gap-3">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200">
              {item.variant.product.images?.[0]?.thumbnailUrl && (
                <Image
                  src={item.variant.product.images[0].thumbnailUrl}
                  alt={item.variant.product.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              )}
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-white">
                {item.quantity}
              </span>
            </div>
            <div className="flex flex-1 items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 line-clamp-1">
                  {item.variant.product.name}
                </p>
                <p className="text-xs text-gray-500">
                  {item.variant.size} / {item.variant.colorName}
                </p>
              </div>
              <span className="text-sm font-semibold">
                {currency(item.unitPrice * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Totais */}
      <div className="mt-4 space-y-1 border-t pt-3">
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
          <span>{shipping > 0 ? currency(shipping) : <span className="text-gray-400">—</span>}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span>
          <span className="text-amber-600">{currency(total)}</span>
        </div>
      </div>
    </aside>
  );
}
