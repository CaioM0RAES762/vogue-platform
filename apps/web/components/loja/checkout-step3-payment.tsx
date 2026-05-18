'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock, QrCode, CreditCard, Barcode, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CheckoutPayment } from '@/lib/checkout-api';

type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO';

interface CardForm {
  cardNumber: string;
  cardHolderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  installments: number;
}

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
      description: 'Parcelamento em até 12x',
    },
    {
      id: 'DEBIT_CARD',
      label: 'Cartão de Débito',
      icon: <CreditCard className="h-5 w-5" />,
      description: 'Aprovação imediata',
    },
    {
      id: 'BOLETO',
      label: 'Boleto Bancário',
      icon: <Barcode className="h-5 w-5" />,
      description: 'Vencimento em 3 dias úteis',
    },
  ];

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale: string }) => {
      cardForm: (config: {
        amount: string;
        autoMount: boolean;
        iframe: boolean;
        form: {
          id: string;
          cardNumber: { id: string; placeholder: string };
          expirationDate: { id: string; placeholder: string };
          securityCode: { id: string; placeholder: string };
          cardholderName: { id: string; placeholder: string };
          installments: { id: string; label: string };
          identificationType: { id: string; default: string };
          identificationNumber: { id: string; placeholder: string };
          issuer: { id: string; placeholder: string };
        };
        callbacks: {
          onFormMounted: (err: unknown) => void;
          onSubmit: (event: Event) => Promise<void>;
          onFetching: (resource: string) => () => void;
        };
      }) => { unmount: () => void };
    };
  }
}

export function CheckoutStep3Payment({ onNext, onBack }: Props) {
  const [selected, setSelected] = useState<PaymentMethod>('PIX');
  const [error, setError] = useState('');
  const [tokenizing, setTokenizing] = useState(false);
  const [mpReady, setMpReady] = useState(false);
  const cardFormRef = useRef<{ unmount: () => void } | null>(null);

  const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? '';

  // Carrega o SDK MP.js do CDN quando cartão é selecionado
  useEffect(() => {
    if (selected !== 'CREDIT_CARD' && selected !== 'DEBIT_CARD') return;
    if (window.MercadoPago) { setMpReady(true); return; }

    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => setMpReady(true);
    document.head.appendChild(script);

    return () => {
      cardFormRef.current?.unmount();
      cardFormRef.current = null;
    };
  }, [selected]);

  function handleSimpleSubmit() {
    if (!selected) {
      setError('Selecione uma forma de pagamento');
      return;
    }
    onNext({ method: selected });
  }

  async function handleCardSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!window.MercadoPago || !MP_PUBLIC_KEY) {
      setError('SDK Mercado Pago não disponível');
      return;
    }

    setTokenizing(true);
    setError('');

    const form = e.currentTarget;
    const cardNumber = (form.elements.namedItem('cardNumber') as HTMLInputElement)?.value ?? '';
    const cardholderName = (form.elements.namedItem('cardholderName') as HTMLInputElement)?.value ?? '';
    const expirationMonth = (form.elements.namedItem('expirationMonth') as HTMLInputElement)?.value ?? '';
    const expirationYear = (form.elements.namedItem('expirationYear') as HTMLInputElement)?.value ?? '';
    const securityCode = (form.elements.namedItem('securityCode') as HTMLInputElement)?.value ?? '';
    const installments = parseInt((form.elements.namedItem('installments') as HTMLSelectElement)?.value ?? '1');

    try {
      // Tokenização via endpoint MP (RN008 — dados de cartão nunca passam pelo servidor)
      const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
      const tokenResponse = await (mp as unknown as {
        createCardToken: (data: {
          cardNumber: string; cardholderName: string;
          cardExpirationMonth: string; cardExpirationYear: string; securityCode: string;
        }) => Promise<{ id: string; luhn_validation?: boolean; payment_method?: { id: string } }>;
      }).createCardToken({
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardholderName,
        cardExpirationMonth: expirationMonth,
        cardExpirationYear: expirationYear,
        securityCode,
      });

      onNext({
        method: selected,
        cardToken: tokenResponse.id,
        paymentMethodId: tokenResponse.payment_method?.id,
        installments,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar cartão';
      setError(msg);
    } finally {
      setTokenizing(false);
    }
  }

  const isCard = selected === 'CREDIT_CARD' || selected === 'DEBIT_CARD';

  return (
    <div className="space-y-4">
      <h2 className="font-playfair text-xl font-bold text-gray-900">Forma de Pagamento</h2>

      {/* Seleção do método */}
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

      {/* Formulário de cartão — tokenização via MP.js (RN008) */}
      {isCard && (
        <form onSubmit={handleCardSubmit} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-3">
            Seus dados são tokenizados diretamente pelo Mercado Pago e nunca passam pelo nosso servidor.
          </p>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Número do Cartão *
              </label>
              <input
                name="cardNumber"
                type="text"
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                onChange={(e) => {
                  // Máscara simples de cartão
                  const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                  e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nome no Cartão *
              </label>
              <input
                name="cardholderName"
                type="text"
                placeholder="Como está no cartão"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mês *</label>
                <input
                  name="expirationMonth"
                  type="text"
                  inputMode="numeric"
                  placeholder="MM"
                  maxLength={2}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ano *</label>
                <input
                  name="expirationYear"
                  type="text"
                  inputMode="numeric"
                  placeholder="AA"
                  maxLength={2}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">CVV *</label>
                <input
                  name="securityCode"
                  type="text"
                  inputMode="numeric"
                  placeholder="000"
                  maxLength={4}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {selected === 'CREDIT_CARD' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Parcelas</label>
                <select
                  name="installments"
                  defaultValue="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x {n === 1 ? '(sem juros)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
              Voltar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              disabled={tokenizing}
            >
              {tokenizing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </span>
              ) : (
                'Continuar'
              )}
            </Button>
          </div>
        </form>
      )}

      {error && !isCard && <p className="text-xs text-red-500">{error}</p>}

      {/* Selo de segurança */}
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <Lock className="h-4 w-4 text-green-600" />
        Pagamento 100% seguro — seus dados são protegidos
      </div>

      {/* Botões para PIX e Boleto */}
      {!isCard && (
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
            Voltar
          </Button>
          <Button
            type="button"
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={handleSimpleSubmit}
          >
            Continuar
          </Button>
        </div>
      )}
    </div>
  );
}
