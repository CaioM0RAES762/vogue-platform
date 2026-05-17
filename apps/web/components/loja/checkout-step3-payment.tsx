'use client';

import { useState } from 'react';
import { Lock, QrCode, CreditCard, Barcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CheckoutPayment } from '@/lib/checkout-api';

type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO';

interface Props {
  onNext: (payment: CheckoutPayment) => void;
  onBack: () => void;
}

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; description: string }[] =
  [
    {
      id: 'PIX',
      label: 'PIX',
      icon: <QrCode className="h-5 w-5" />,
      description: 'Aprovação imediata · QR Code válido por 30 minutos',
    },
    {
      id: 'CREDIT_CARD',
      label: 'Cartão de Crédito',
      icon: <CreditCard className="h-5 w-5" />,
      description: 'Parcelamento em até 12x · Integração Sprint 8',
    },
    {
      id: 'DEBIT_CARD',
      label: 'Cartão de Débito',
      icon: <CreditCard className="h-5 w-5" />,
      description: 'Aprovação imediata · Integração Sprint 8',
    },
    {
      id: 'BOLETO',
      label: 'Boleto Bancário',
      icon: <Barcode className="h-5 w-5" />,
      description: 'Vencimento em 3 dias úteis · Integração Sprint 8',
    },
  ];

export function CheckoutStep3Payment({ onNext, onBack }: Props) {
  const [selected, setSelected] = useState<PaymentMethod>('PIX');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!selected) {
      setError('Selecione uma forma de pagamento');
      return;
    }
    onNext({ method: selected });
  }

  return (
    <div className="space-y-4">
      <h2 className="font-playfair text-xl font-bold text-gray-900">Forma de Pagamento</h2>

      <div className="space-y-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setSelected(m.id);
              setError('');
            }}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors',
              selected === m.id
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 hover:border-gray-300',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                selected === m.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500',
              )}
            >
              {m.icon}
            </span>
            <div>
              <p className="font-semibold text-gray-900">{m.label}</p>
              <p className="text-xs text-gray-500">{m.description}</p>
            </div>
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Selo de segurança */}
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <Lock className="h-4 w-4 text-green-600" />
        Pagamento 100% seguro — seus dados são protegidos
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          Voltar
        </Button>
        <Button
          type="button"
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
          onClick={handleSubmit}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
