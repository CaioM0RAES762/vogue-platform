'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { accountApi, OrderDetail, AccountApiError } from '@/lib/account-api';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Aguardando pagamento',
  PAID: 'Pago',
  PREPARING: 'Em separação',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const CANCELLABLE = ['PENDING', 'PAID'];

type ShippingAddress = {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  recipientName?: string;
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    if (!id) return;
    accountApi.getOrder(id)
      .then(setOrder)
      .catch((e) => setError(e instanceof AccountApiError ? e.message : 'Erro ao carregar pedido.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCancel() {
    if (cancelReason.trim().length < 5) {
      setCancelError('Informe um motivo com ao menos 5 caracteres.');
      return;
    }
    setCancelling(true);
    setCancelError('');
    try {
      await accountApi.cancelOrder(id, cancelReason.trim());
      setOrder((prev) => prev ? { ...prev, status: 'CANCELLED', cancelReason: cancelReason.trim() } : prev);
      setShowCancelForm(false);
    } catch (e) {
      setCancelError(e instanceof AccountApiError ? e.message : 'Erro ao cancelar pedido.');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-red-600 mb-4">{error || 'Pedido não encontrado.'}</p>
        <Link href="/minha-conta/pedidos" className="text-sm text-brand-gold hover:underline">
          Voltar para pedidos
        </Link>
      </div>
    );
  }

  const addr = order.shippingAddress as ShippingAddress;
  const canCancel = CANCELLABLE.includes(order.status);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/minha-conta/pedidos" className="text-xs text-gray-500 hover:text-brand-gold mb-1 inline-block">
            ← Voltar para pedidos
          </Link>
          <h2 className="text-lg font-semibold text-brand-black font-mono">{order.orderNumber}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Realizado em {new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      {/* Itens */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-brand-black">Itens do pedido</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {order.items.map((item) => {
            const snap = item.productSnapshot as Record<string, unknown>;
            const imgUrl = item.variant.product.images[0]?.thumbnailUrl;
            const name = (snap.name as string) ?? item.variant.product.name;
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                {imgUrl ? (
                  <img src={imgUrl} alt={name} className="w-14 h-14 object-cover rounded border border-gray-100" />
                ) : (
                  <div className="w-14 h-14 bg-gray-100 rounded border border-gray-100 flex items-center justify-center text-gray-300 text-xs">
                    Sem imagem
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-black truncate">{name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Tamanho: {item.variant.size} | Cor: {item.variant.colorName}
                  </p>
                  <p className="text-xs text-gray-500">Qtd: {item.quantity}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-brand-black">
                    {Number(item.totalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {Number(item.unitPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / un
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totais */}
        <div className="border-t border-gray-200 px-4 py-3 space-y-1 bg-gray-50">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{Number(order.subtotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Desconto</span>
              <span>− {Number(order.discountAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>Frete ({order.shippingMethod})</span>
            <span>{Number(order.shippingAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-brand-black border-t border-gray-200 pt-1 mt-1">
            <span>Total</span>
            <span>{Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Endereço de entrega */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-brand-black mb-2">Endereço de entrega</h3>
          <p className="text-sm text-gray-700">{addr.recipientName}</p>
          <p className="text-sm text-gray-600">
            {addr.street}, {addr.number}{addr.complement ? `, ${addr.complement}` : ''}
          </p>
          <p className="text-sm text-gray-600">
            {addr.neighborhood} — {addr.city}/{addr.state}
          </p>
          <p className="text-sm text-gray-600">CEP: {addr.zipCode}</p>

          {order.trackingCode && (
            <div className="mt-3 p-2 bg-indigo-50 rounded border border-indigo-100">
              <p className="text-xs font-semibold text-indigo-700">Código de rastreamento</p>
              <p className="text-sm font-mono text-indigo-800 mt-0.5">{order.trackingCode}</p>
            </div>
          )}
          {order.estimatedDelivery && (
            <p className="text-xs text-gray-500 mt-2">
              Previsão de entrega: {new Date(order.estimatedDelivery).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>

        {/* Pagamento */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-brand-black mb-2">Pagamento</h3>
          {order.payments.map((p, i) => (
            <div key={i} className="text-sm text-gray-600 space-y-0.5">
              <p>Método: <span className="font-medium text-brand-black">{p.method}</span></p>
              <p>Status: <span className="font-medium text-brand-black">{p.status}</span></p>
              {p.paidAt && (
                <p>Pago em: {new Date(p.paidAt).toLocaleString('pt-BR')}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Histórico de status */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-brand-black mb-3">Histórico do pedido</h3>
        <ol className="relative border-l border-gray-200 ml-2 space-y-4">
          {order.statusHistory.map((h) => (
            <li key={h.id} className="ml-4">
              <div className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-brand-gold border-2 border-white" />
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-brand-black">
                  {STATUS_LABEL[h.toStatus] ?? h.toStatus}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(h.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              {h.notes && <p className="text-xs text-gray-500 mt-0.5">{h.notes}</p>}
            </li>
          ))}
        </ol>
      </div>

      {/* Cancelamento */}
      {canCancel && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-brand-black mb-2">Cancelar pedido</h3>
          {!showCancelForm ? (
            <button
              onClick={() => setShowCancelForm(true)}
              className="text-sm text-red-600 border border-red-300 rounded px-4 py-2 hover:bg-red-50 transition-colors"
            >
              Solicitar cancelamento
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Motivo do cancelamento *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Descreva o motivo do cancelamento (mínimo 5 caracteres)..."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
                {cancelError && <p className="text-xs text-red-600 mt-1">{cancelError}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {cancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
                </button>
                <button
                  onClick={() => { setShowCancelForm(false); setCancelReason(''); setCancelError(''); }}
                  className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {order.status === 'CANCELLED' && order.cancelReason && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <span className="font-medium">Motivo do cancelamento:</span> {order.cancelReason}
        </div>
      )}
    </div>
  );
}
