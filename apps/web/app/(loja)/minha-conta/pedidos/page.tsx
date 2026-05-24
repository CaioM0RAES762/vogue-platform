'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { accountApi, OrderSummary, AccountApiError } from '@/lib/account-api';

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

const METHOD_LABEL: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BOLETO: 'Boleto',
};

const ORDER_STATUSES = ['', 'PENDING', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export default function PedidosPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  async function loadOrders() {
    setLoading(true);
    setError('');
    try {
      const result = await accountApi.getOrders({
        status: statusFilter || undefined,
        page,
        limit: 10,
      });
      setOrders(result.data);
      setTotalPages(result.meta.totalPages);
    } catch (e) {
      setError(e instanceof AccountApiError ? e.message : 'Erro ao carregar pedidos.');
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-brand-black">Meus Pedidos</h2>

        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-gold"
        >
          <option value="">Todos os status</option>
          {ORDER_STATUSES.slice(1).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Nenhum pedido encontrado.</p>
          <Link href="/loja/produtos" className="mt-4 inline-block text-sm text-brand-gold hover:underline">
            Explorar a loja
          </Link>
        </div>
      ) : (
        <>
          {/* Tabela desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="py-3 pr-4">Nº Pedido</th>
                  <th className="py-3 pr-4">Data</th>
                  <th className="py-3 pr-4">Pagamento</th>
                  <th className="py-3 pr-4">Total</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 font-mono font-medium text-brand-black">{order.orderNumber}</td>
                    <td className="py-3 pr-4 text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {order.payments[0] ? METHOD_LABEL[order.payments[0].method] ?? order.payments[0].method : '—'}
                    </td>
                    <td className="py-3 pr-4 font-medium">
                      {Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/minha-conta/pedidos/${order.id}`}
                        className="text-brand-gold hover:underline text-xs font-medium"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-brand-black text-sm">{order.orderNumber}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</span>
                  <span className="font-medium text-brand-black">
                    {Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <Link
                  href={`/minha-conta/pedidos/${order.id}`}
                  className="block text-right text-xs text-brand-gold hover:underline font-medium"
                >
                  Ver detalhes →
                </Link>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
