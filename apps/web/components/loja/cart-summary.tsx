'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tag, X, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/lib/products-api';
import { useCartStore } from '@/store/cart-store';
import type { Cart } from '@/lib/cart-api';

interface CartSummaryProps {
  cart: Cart;
}

export function CartSummary({ cart }: CartSummaryProps) {
  const router = useRouter();
  const { applyCoupon, removeCoupon, loading } = useCartStore();

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);

  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<
    { carrier: string; service: string; price: number; days: number }[]
  >([]);
  const [selectedShipping, setSelectedShipping] = useState<{
    price: number;
    label: string;
  } | null>(null);

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponError(null);
    setCouponSuccess(false);
    setCouponLoading(true);
    try {
      await applyCoupon(couponCode.trim());
      setCouponSuccess(true);
      setCouponCode('');
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : 'Cupom inválido');
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleRemoveCoupon() {
    setCouponError(null);
    setCouponSuccess(false);
    await removeCoupon();
  }

  async function handleCepSearch() {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length !== 8) return;
    setCepLoading(true);
    setShippingOptions([]);
    setSelectedShipping(null);
    try {
      const API_BASE =
        process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
      const items = cart.items.map((i) => ({
        variant_id: i.variant.id,
        quantity: i.quantity,
      }));
      const res = await fetch(`${API_BASE}/checkout/shipping-options`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip_code: cleaned, items }),
      });
      if (res.ok) {
        const data = await res.json() as {
          carrier: string;
          service: string;
          price: number;
          days: number;
        }[];
        setShippingOptions(data);
      }
    } catch {
      // fallback — shipping options will be empty
    } finally {
      setCepLoading(false);
    }
  }

  const total = cart.total + (selectedShipping?.price ?? 0);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-4 sticky top-24">
      <h2 className="text-white font-semibold text-lg">Resumo do pedido</h2>

      {/* Subtotal */}
      <div className="flex justify-between text-sm text-zinc-400">
        <span>Subtotal</span>
        <span className="text-white">{formatPrice(cart.subtotal)}</span>
      </div>

      {/* Desconto */}
      {cart.discount > 0 && (
        <div className="flex justify-between text-sm text-emerald-400">
          <span>Desconto</span>
          <span>- {formatPrice(cart.discount)}</span>
        </div>
      )}

      {/* Frete */}
      {selectedShipping && (
        <div className="flex justify-between text-sm text-zinc-400">
          <span>Frete ({selectedShipping.label})</span>
          <span className="text-white">{formatPrice(selectedShipping.price)}</span>
        </div>
      )}

      <hr className="border-zinc-800" />

      {/* Total */}
      <div className="flex justify-between text-white font-bold text-lg">
        <span>Total</span>
        <span className="text-[#C9A84C]">{formatPrice(total)}</span>
      </div>

      {/* Cupom */}
      <div className="space-y-2">
        {cart.coupon ? (
          <div className="flex items-center justify-between bg-emerald-950 border border-emerald-700 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <Tag className="w-4 h-4" />
              <span className="font-mono font-semibold">{cart.coupon.code}</span>
              <span className="text-emerald-300 text-xs">
                {cart.coupon.type === 'PERCENTAGE'
                  ? `${cart.coupon.value}% de desconto`
                  : `- ${formatPrice(cart.coupon.value)}`}
              </span>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="text-emerald-500 hover:text-red-400 transition-colors"
              aria-label="Remover cupom"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Código do cupom"
              value={couponCode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setCouponCode(e.target.value.toUpperCase());
                setCouponError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-sm h-9 font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700 h-9 px-3 shrink-0"
              onClick={handleApplyCoupon}
              disabled={couponLoading || !couponCode.trim()}
            >
              {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
            </Button>
          </div>
        )}

        {couponError && (
          <p className="text-red-400 text-xs">{couponError}</p>
        )}
        {couponSuccess && !cart.coupon && (
          <p className="text-emerald-400 text-xs">Cupom aplicado!</p>
        )}
      </div>

      {/* CEP / Frete */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="00000-000"
              value={cep}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                setCep(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCepSearch()}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-sm h-9 pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700 h-9 px-3 shrink-0"
            onClick={handleCepSearch}
            disabled={cepLoading || cep.replace(/\D/g, '').length !== 8}
          >
            {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calcular'}
          </Button>
        </div>

        {shippingOptions.length > 0 && (
          <div className="space-y-1.5">
            {shippingOptions.map((opt, i) => {
              const label = `${opt.carrier} ${opt.service}`;
              const isSelected = selectedShipping?.label === label;
              return (
                <button
                  key={i}
                  onClick={() =>
                    setSelectedShipping(isSelected ? null : { price: opt.price, label })
                  }
                  className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                    isSelected
                      ? 'bg-[#C9A84C]/10 border border-[#C9A84C]/40 text-[#C9A84C]'
                      : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <span>
                    {opt.carrier} {opt.service} · {opt.days} dias úteis
                  </span>
                  <span className="font-semibold">{formatPrice(opt.price)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA */}
      <Button
        className="w-full bg-[#C9A84C] hover:bg-[#B8962E] text-black font-semibold h-11"
        onClick={() => router.push('/checkout')}
        disabled={loading || cart.items.length === 0}
      >
        Finalizar compra
      </Button>

      <Button
        variant="ghost"
        className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800 h-9 text-sm"
        onClick={() => router.push('/produtos')}
      >
        Continuar comprando
      </Button>
    </div>
  );
}
