'use client';

import { useState } from 'react';
import { Truck, Loader2 } from 'lucide-react';
import { formatPrice } from '@/lib/products-api';

interface ShippingOption {
  id: string;
  name: string;
  price: number;
  deliveryTime: string;
  company: string;
}

interface ShippingSimulatorProps {
  productId: string;
}

const CEP_RE = /^\d{5}-?\d{3}$/;

export function ShippingSimulator({ productId }: ShippingSimulatorProps) {
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simulate() {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) {
      setError('CEP inválido — informe 8 dígitos');
      return;
    }

    setLoading(true);
    setError(null);
    setOptions(null);

    try {
      const res = await fetch(
        `/api/shipping?cep=${clean}&productId=${productId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const data: ShippingOption[] = await res.json();
      if (data.length === 0) {
        setError('Nenhuma opção de frete disponível para este CEP');
      } else {
        setOptions(data);
      }
    } catch {
      // Fallback visual para desenvolvimento sem backend
      setOptions([
        { id: '1', name: 'PAC', price: 18.9, deliveryTime: '5–8 dias úteis', company: 'Correios' },
        { id: '2', name: 'SEDEX', price: 32.5, deliveryTime: '2–3 dias úteis', company: 'Correios' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleCepChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setCep(formatted);
    if (options) setOptions(null);
    if (error) setError(null);
  }

  return (
    <div className="border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Truck className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium">Simular frete</span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={cep}
          onChange={(e) => handleCepChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && simulate()}
          placeholder="00000-000"
          maxLength={9}
          className="flex-1 border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
          aria-label="CEP para simulação de frete"
        />
        <button
          onClick={simulate}
          disabled={loading || !CEP_RE.test(cep)}
          className="px-4 py-2 bg-black text-white text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Calcular
        </button>
      </div>

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

      {options && (
        <div className="mt-3 space-y-2">
          {options.map((opt) => (
            <div key={opt.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
              <div>
                <p className="font-medium">{opt.name} — {opt.company}</p>
                <p className="text-xs text-gray-500">{opt.deliveryTime}</p>
              </div>
              <span className="font-semibold text-black">
                {opt.price === 0 ? 'Grátis' : formatPrice(opt.price)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
