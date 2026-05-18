'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ShoppingBag, Package } from 'lucide-react';
import Link from 'next/link';

export default function OrderConfirmedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNumber = searchParams.get('orderNumber');
  const orderId = searchParams.get('orderId');

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Pedido Confirmado!
          </h1>

          {orderNumber && (
            <p className="text-gray-500 mb-6">
              Pedido <span className="font-semibold text-gray-900">{orderNumber}</span>
            </p>
          )}

          <p className="text-gray-500 text-sm mb-8">
            Seu pagamento foi confirmado com sucesso. Em breve você receberá um
            e-mail com os detalhes do pedido e informações de envio.
          </p>

          <div className="flex flex-col gap-3">
            {orderId && (
              <Link
                href={`/minha-conta/pedidos/${orderId}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#C9A84C] hover:bg-[#b8973e] text-white rounded-lg font-medium transition-colors"
              >
                <Package className="w-4 h-4" />
                Acompanhar pedido
              </Link>
            )}

            <Link
              href="/produtos"
              className="flex items-center justify-center gap-2 w-full py-3 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              Continuar comprando
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
