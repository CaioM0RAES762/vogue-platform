'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { adminApi, AdminOrder, AdminOrderDetail } from '@/lib/admin-api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Aguardando', PAID: 'Pago', PREPARING: 'Em separação',
  SHIPPED: 'Enviado', DELIVERED: 'Entregue', CANCELLED: 'Cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-700 bg-yellow-50', PAID: 'text-blue-700 bg-blue-50',
  PREPARING: 'text-orange-700 bg-orange-50', SHIPPED: 'text-purple-700 bg-purple-50',
  DELIVERED: 'text-green-700 bg-green-50', CANCELLED: 'text-red-700 bg-red-50',
};
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PAID', 'CANCELLED'], PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'], SHIPPED: ['DELIVERED'],
  DELIVERED: [], CANCELLED: [],
};

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

interface StatusModal {
  order: AdminOrderDetail;
  nextStatus: string;
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modal, setModal] = useState<StatusModal | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (statusFilter) params.status = statusFilter;
      if (search) params.q = search;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await adminApi.getOrders(params);
      setOrders(res.data);
      setTotal(res.meta.total);
      setPages(res.meta.pages);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  async function openStatusModal(order: AdminOrder) {
    const detail = await adminApi.getOrder(order.id);
    const nextStatuses = TRANSITIONS[order.status] ?? [];
    if (!nextStatuses.length) return;
    setModal({ order: detail, nextStatus: nextStatuses[0] });
    setTrackingCode('');
    setNotes('');
  }

  async function submitStatus() {
    if (!modal) return;
    setSaving(true);
    try {
      await adminApi.updateOrderStatus(modal.order.id, {
        status: modal.nextStatus,
        trackingCode: trackingCode || undefined,
        notes: notes || undefined,
      });
      setModal(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          className="pl-4 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 flex-1 min-w-[160px]"
          placeholder="Buscar nº pedido, CPF ou e-mail…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40" />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Número', 'Data', 'Cliente', 'Total', 'Pagamento', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">Nenhum pedido encontrado</td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-[140px]">{o.customerName}</p>
                      <p className="text-gray-400 text-xs truncate max-w-[140px]">{o.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold">{fmt(o.total)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{o.paymentMethod ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] ?? ''}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/admin/pedidos/${o.id}`} className="text-xs text-[#C9A84C] hover:underline">
                          Ver
                        </Link>
                        {(TRANSITIONS[o.status]?.length ?? 0) > 0 && (
                          <button
                            onClick={() => openStatusModal(o)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Atualizar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
            <span className="text-gray-500 text-xs">{total} pedidos</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">←</button>
              <span className="px-3 py-1 text-gray-600">{page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">→</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de atualização de status */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Atualizar Status</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Pedido <strong>{modal.order.orderNumber}</strong> · De{' '}
              <strong>{STATUS_LABELS[modal.order.status]}</strong> para:
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Novo Status *</label>
              <select
                value={modal.nextStatus}
                onChange={(e) => setModal({ ...modal, nextStatus: e.target.value })}
                className="input-field"
              >
                {(TRANSITIONS[modal.order.status] ?? []).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {modal.nextStatus === 'SHIPPED' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de Rastreamento *
                </label>
                <input
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  className="input-field"
                  placeholder="Ex: BR123456789BR"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="input-field resize-none text-sm"
                placeholder="Opcional"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={submitStatus}
                disabled={saving || (modal.nextStatus === 'SHIPPED' && !trackingCode.trim())}
                className="flex-1 py-2 bg-[#000000] text-[#C9A84C] rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
