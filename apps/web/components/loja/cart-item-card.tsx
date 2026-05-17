'use client';

import Image from 'next/image';
import { Minus, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/products-api';
import { useCartStore } from '@/store/cart-store';
import type { CartItem } from '@/lib/cart-api';

interface CartItemCardProps {
  item: CartItem;
}

const LOW_STOCK_THRESHOLD = 3;

export function CartItemCard({ item }: CartItemCardProps) {
  const { updateItem, removeItem, loading } = useCartStore();

  const available = item.variant.stock - item.variant.reservedStock;
  const isLowStock = available > 0 && available <= LOW_STOCK_THRESHOLD;

  async function handleQuantityChange(delta: number) {
    const next = item.quantity + delta;
    if (next < 1 || next > available) return;
    await updateItem(item.id, next);
  }

  async function handleRemove() {
    await removeItem(item.id);
  }

  return (
    <div className="flex gap-4 py-4 border-b border-zinc-800 last:border-0">
      {/* Thumbnail */}
      <div className="relative w-20 h-24 flex-shrink-0 rounded-md overflow-hidden bg-zinc-900">
        {item.product.primaryImage ? (
          <Image
            src={item.product.primaryImage}
            alt={item.product.name}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <span className="text-xs">Sem foto</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-white text-sm leading-tight truncate">
          {item.product.name}
        </h3>
        <p className="text-zinc-400 text-xs mt-0.5">
          {item.variant.colorName} · {item.variant.size}
        </p>
        <p className="text-[#C9A84C] font-semibold text-sm mt-1">
          {formatPrice(item.unitPrice)}
        </p>

        {isLowStock && (
          <div className="flex items-center gap-1 mt-1.5 text-amber-400 text-xs">
            <AlertTriangle className="w-3 h-3" />
            <span>Apenas {available} unidade{available > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Quantity + Remove */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white"
              onClick={() => handleQuantityChange(-1)}
              disabled={loading || item.quantity <= 1}
              aria-label="Diminuir quantidade"
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="text-white text-sm w-6 text-center">
              {item.quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white"
              onClick={() => handleQuantityChange(1)}
              disabled={loading || item.quantity >= available}
              aria-label="Aumentar quantidade"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-white text-sm font-semibold">
              {formatPrice(item.subtotal)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-transparent"
              onClick={handleRemove}
              disabled={loading}
              aria-label="Remover item"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
