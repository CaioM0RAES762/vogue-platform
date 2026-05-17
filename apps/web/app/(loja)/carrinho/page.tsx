'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartItemCard } from '@/components/loja/cart-item-card';
import { CartSummary } from '@/components/loja/cart-summary';
import { useCartStore } from '@/store/cart-store';
import type { CartItem } from '@/lib/cart-api';

export default function CarrinhoPage() {
  const { cart, loading, fetchCart, clearCart } = useCartStore();

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <main className="min-h-screen bg-black text-white py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">
            Meu Carrinho
            {!isEmpty && (
              <span className="ml-2 text-sm font-normal text-zinc-400">
                ({cart.items.reduce((s: number, i) => s + i.quantity, 0)} ite
                {cart.items.reduce((s: number, i) => s + i.quantity, 0) === 1 ? 'm' : 'ns'})
              </span>
            )}
          </h1>

          {!isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-red-400 hover:bg-transparent gap-1.5"
              onClick={() => clearCart()}
              disabled={loading}
            >
              <Trash2 className="w-4 h-4" />
              Limpar carrinho
            </Button>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && !cart && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-28 bg-zinc-900 rounded-xl animate-pulse"
                />
              ))}
            </div>
            <div className="h-96 bg-zinc-900 rounded-xl animate-pulse" />
          </div>
        )}

        {/* Empty state */}
        {!loading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center">
              <ShoppingBag className="w-12 h-12 text-zinc-600" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-2">
                Seu carrinho está vazio
              </h2>
              <p className="text-zinc-400 text-sm">
                Explore nossa coleção e adicione peças incríveis ao carrinho.
              </p>
            </div>
            <Link href="/produtos">
              <Button className="bg-[#C9A84C] hover:bg-[#B8962E] text-black font-semibold px-8">
                Explorar a loja
              </Button>
            </Link>
          </div>
        )}

        {/* Cart content */}
        {!loading && !isEmpty && cart && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Items list */}
            <div className="lg:col-span-2">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
                {cart.items.map((item: CartItem) => (
                  <CartItemCard key={item.id} item={item} />
                ))}
              </div>

              {/* Continue shopping */}
              <div className="mt-4">
                <Link href="/produtos">
                  <Button
                    variant="ghost"
                    className="text-zinc-400 hover:text-white hover:bg-zinc-900 gap-2 pl-0"
                  >
                    ← Continuar comprando
                  </Button>
                </Link>
              </div>
            </div>

            {/* Summary sidebar */}
            <div>
              <CartSummary cart={cart} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
