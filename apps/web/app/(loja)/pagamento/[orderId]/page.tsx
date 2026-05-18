'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, ShoppingBag } from 'lucide-react';
import { paymentsApi, PaymentStatusResponse } from '@/lib/payments-api';
import { PixPayment } from '@/components/loja/pix-payment';
import { BoletoPayment } from '@/components/loja/boleto-payment';

const POLL_INTERVAL_MS = 5_000; // D-03

export default function PaymentPage() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = params.orderId;

  const [data, setData] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dados passados via query string (vindos do checkout — evita chamada extra na primeira renderização)
  const qrCodeBase64 = searchParams.get('qrCodeBase64');
  const qrCode = searchParams.get('qrCode');
  const barcode = searchParams.get('barcode');
  const boletoUrl = searchParams.get('boletoUrl');
  const expiresAt = searchParams.get('expiresAt');
  const method = searchParams.get('method') ?? '';

  async function fetchStatus() {
    try {
      const result = await paymentsApi.getOrderStatus(orderId);
      setData(result);

      if (result.orderStatus === 'PAID') {
        stopPolling();
        // Redireciona para tela de confirmação (D-03)
        router.replace(`/pedido-confirmado?orderId=${orderId}`);
        return;
      }

      if (result.orderStatus === 'CANCELLED') {
        stopPolling();
      }
    } catch {
      setError('Não foi possível verificar o status do pagamento.');
    } finally {
      setLoading(false);
    }
  }

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => {
    fetchStatus();

    intervalRef.current = setInterval(() => {
      fetchStatus();
    }, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [orderId]);

  const orderStatus = data?.orderStatus ?? 'PENDING';
  const paymentData = data?.payment;
  const effectiveQrCode = paymentData?.qrCode ?? qrCode;
  const effectiveQrCodeBase64 = paymentData?.qrCodeBase64 ?? qrCodeBase64;
  const effectiveBarcode = paymentData?.barcode ?? barcode;
  const effectiveExpiresAt = paymentData?.expiresAt ?? expiresAt;
  const effectiveMethod = paymentData?.method ?? method;

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  if (orderStatus === 'CANCELLED') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <XCircle className="w-16 h-16 text-red-500" />
        <h1 className="text-2xl font-bold text-gray-900">Pagamento expirado</h1>
        <p className="text-gray-500 text-center max-w-sm">
          O prazo para pagamento expirou e seu pedido foi cancelado.
        </p>
        <button
          onClick={() => router.push('/produtos')}
          className="mt-4 px-6 py-3 bg-[#C9A84C] text-white rounded-lg font-medium hover:bg-[#b8973e] transition-colors"
        >
          Continuar comprando
        </button>
      </div>
    );
  }

  if (orderStatus === 'PAID') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h1 className="text-2xl font-bold text-gray-900">Pagamento confirmado!</h1>
        <p className="text-gray-500">Redirecionando para a confirmação...</p>
        <Loader2 className="w-5 h-5 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <ShoppingBag className="w-6 h-6 text-[#C9A84C]" />
          <h1 className="text-xl font-bold text-gray-900">Finalizar Pagamento</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {/* Status de polling */}
          <div className="flex items-center gap-2 mb-6 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Verificando pagamento automaticamente...
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* PIX */}
          {(effectiveMethod === 'PIX' || (!effectiveMethod && effectiveQrCode)) && (
            <PixPayment
              qrCode={effectiveQrCode}
              qrCodeBase64={effectiveQrCodeBase64}
              expiresAt={effectiveExpiresAt}
            />
          )}

          {/* Boleto */}
          {effectiveMethod === 'BOLETO' && (
            <BoletoPayment
              barcode={effectiveBarcode}
              boletoUrl={boletoUrl}
              expiresAt={effectiveExpiresAt}
            />
          )}

          {/* Cartão (aguardando confirmação automática) */}
          {(effectiveMethod === 'CREDIT_CARD' || effectiveMethod === 'DEBIT_CARD') && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-10 h-10 animate-spin text-[#C9A84C]" />
              <p className="text-gray-600 font-medium">Processando seu pagamento...</p>
              <p className="text-sm text-gray-400 text-center">
                Aguarde enquanto confirmamos a transação.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Pedido #{orderId.slice(-8).toUpperCase()} — Se tiver dúvidas, entre em contato conosco.
        </p>
      </div>
    </main>
  );
}
