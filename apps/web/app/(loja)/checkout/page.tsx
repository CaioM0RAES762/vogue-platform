'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

import { CheckoutProgress } from '@/components/loja/checkout-progress';
import { CheckoutStep1Customer } from '@/components/loja/checkout-step1-customer';
import { CheckoutStep2Delivery } from '@/components/loja/checkout-step2-delivery';
import { CheckoutStep3Payment } from '@/components/loja/checkout-step3-payment';
import { CheckoutStep4Review } from '@/components/loja/checkout-step4-review';
import { CheckoutSummary } from '@/components/loja/checkout-summary';
import { createCheckout } from '@/lib/checkout-api';
import { useCartStore } from '@/store/cart-store';
import { useAuth } from '@/context/auth-context';
import type {
  CheckoutCustomer,
  CheckoutAddress,
  CheckoutPayment,
  ShippingOption,
  CheckoutResult,
} from '@/lib/checkout-api';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { fetchCart } = useCartStore();

  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState<CheckoutCustomer | null>(null);
  const [address, setAddress] = useState<CheckoutAddress | null>(null);
  const [shipping, setShipping] = useState<ShippingOption | null>(null);
  const [payment, setPayment] = useState<CheckoutPayment | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Pré-preenche dados do usuário logado
  const defaultCustomer: Partial<CheckoutCustomer> = user
    ? { name: user.name, email: user.email, cpf: user.cpf }
    : {};

  // ─────────────────────────────────────────────
  // Handlers das etapas
  // ─────────────────────────────────────────────

  function handleStep1(data: CheckoutCustomer) {
    setCustomer(data);
    setStep(2);
  }

  function handleStep2(addr: CheckoutAddress, ship: ShippingOption) {
    setAddress(addr);
    setShipping(ship);
    setStep(3);
  }

  function handleStep3(pay: CheckoutPayment) {
    setPayment(pay);
    setStep(4);
  }

  async function handleConfirm() {
    if (!customer || !address || !shipping || !payment) return;
    setLoading(true);
    setError('');

    try {
      const res = await createCheckout({
        customer,
        address,
        shipping,
        payment,
      });
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao finalizar pedido';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────
  // Tela de sucesso
  // ─────────────────────────────────────────────

  if (result) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <CheckCircle className="h-20 w-20 text-green-500" />
        <div>
          <h1 className="font-playfair text-3xl font-bold text-gray-900">
            Pedido realizado com sucesso!
          </h1>
          <p className="mt-2 text-gray-600">
            Número do pedido:{' '}
            <span className="font-bold text-amber-600">#{result.orderNumber}</span>
          </p>
          {result.payment.method === 'PIX' && result.payment.expiresAt && (
            <p className="mt-1 text-sm text-gray-500">
              Você receberá as instruções de pagamento por e-mail.
            </p>
          )}
          {result.payment.method === 'BOLETO' && (
            <p className="mt-1 text-sm text-gray-500">
              Seu boleto será enviado por e-mail. Vencimento em 3 dias úteis.
            </p>
          )}
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/minha-conta/pedidos')}
            className="rounded-lg border border-amber-500 px-6 py-3 text-amber-600 hover:bg-amber-50"
          >
            Acompanhar Pedido
          </button>
          <button
            onClick={() => router.push('/')}
            className="rounded-lg bg-amber-500 px-6 py-3 text-white hover:bg-amber-600"
          >
            Continuar Comprando
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Layout: 65% formulário + 35% resumo
  // ─────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header de checkout sem menu de categorias */}
      <div className="mb-8">
        <h1 className="font-playfair text-2xl font-bold text-gray-900">Finalizar Compra</h1>
      </div>

      {/* Barra de progresso */}
      <div className="mb-8">
        <CheckoutProgress currentStep={step} />
      </div>

      {/* Grid: formulário + resumo */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        {/* Formulário da etapa atual */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <CheckoutStep1Customer
              defaultValues={defaultCustomer}
              onNext={handleStep1}
            />
          )}

          {step === 2 && (
            <CheckoutStep2Delivery
              onNext={handleStep2}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <CheckoutStep3Payment
              onNext={handleStep3}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && customer && address && shipping && payment && (
            <CheckoutStep4Review
              customer={customer}
              address={address}
              shipping={shipping}
              payment={payment}
              onConfirm={handleConfirm}
              onBack={() => setStep(3)}
              loading={loading}
            />
          )}
        </div>

        {/* Resumo colapsável */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <CheckoutSummary shippingPrice={shipping?.price} />
        </div>
      </div>
    </div>
  );
}
