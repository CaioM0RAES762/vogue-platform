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

      // Redirecionar para tela de pagamento com dados do MP (D-03)
      const params = new URLSearchParams({ method: res.payment.method });
      if (res.payment.qrCodeBase64) params.set('qrCodeBase64', res.payment.qrCodeBase64);
      if (res.payment.qrCode) params.set('qrCode', res.payment.qrCode);
      if (res.payment.barcode) params.set('barcode', res.payment.barcode);
      if (res.payment.boletoUrl) params.set('boletoUrl', res.payment.boletoUrl);
      if (res.payment.expiresAt) params.set('expiresAt', res.payment.expiresAt);

      router.push(`/pagamento/${res.orderId}?${params.toString()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao finalizar pedido';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Tela de sucesso não é mais exibida aqui — redirecionamos para /pagamento/:orderId
  if (result) return null;

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
