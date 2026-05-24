'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, ShoppingBag, DollarSign, Ticket, AlertTriangle } from 'lucide-react';
import { adminApi, DashboardData } from '@/lib/admin-api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Aguardando',
  PAID: 'Pago',
  PREPARING: 'Em separação',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-600 bg-yellow-50',
  PAID: 'text-blue-600 bg-blue-50',
  PREPARING: 'text-orange-600 bg-orange-50',
  SHIPPED: 'text-purple-600 bg-purple-50',
  DELIVERED: 'text-green-600 bg-green-50',
  CANCELLED: 'text-red-600 bg-red-50',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function RevenueChart({ data }: { data: { day: string; revenue: number }[] }) {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const W = 600;
  const H = 160;
  const pad = { left: 50, right: 10, top: 10, bottom: 24 };
  const w = W - pad.left - pad.right;
  const h = H - pad.top - pad.bottom;

  const points = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * w;
    const y = pad.top + (1 - d.revenue / max) * h;
    return `${x},${y}`;
  });

  const fillPoints = [
    `${pad.left},${pad.top + h}`,
    ...points,
    `${pad.left + w},${pad.top + h}`,
  ].join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48">
      <polygon points={fillPoints} fill="#C9A84C" fillOpacity="0.15" />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#C9A84C"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.top + (1 - t) * h;
        return (
          <g key={t}>
            <line x1={pad.left} x2={pad.left + w} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={pad.left - 4} y={y + 4} fontSize="9" textAnchor="end" fill="#9ca3af">
              {fmt(max * t).replace('R$ ', 'R$')}
            </text>
          </g>
        );
      })}
      {data
        .filter((_, i) => i % Math.ceil(data.length / 6) === 0)
        .map((d, i) => {
          const idx = data.indexOf(d);
          const x = pad.left + (idx / Math.max(data.length - 1, 1)) * w;
          return (
            <text key={i} x={x} y={H - 4} fontSize="8" textAnchor="middle" fill="#9ca3af">
              {new Date(d.day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </text>
          );
        })}
    </svg>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl shadow-sm border" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-xl shadow-sm border" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
        Erro ao carregar dashboard: {error}
      </div>
    );
  }

  if (!data) return null;

  const kpiCards = [
    { label: 'Vendas Hoje', value: String(data.kpis.todaySales), icon: ShoppingBag, suffix: 'pedidos' },
    { label: 'Faturamento Hoje', value: fmt(data.kpis.todayRevenue), icon: DollarSign, suffix: '' },
    { label: 'Pedidos do Mês', value: String(data.kpis.monthOrders), icon: TrendingUp, suffix: 'pedidos' },
    { label: 'Ticket Médio', value: fmt(data.kpis.averageTicket), icon: Ticket, suffix: '' },
  ];

  return (
    <div className="space-y-6">
      {/* Atalhos rápidos */}
      <div className="flex gap-3 flex-wrap">
        {[
          { href: '/admin/produtos/novo', label: 'Cadastrar produto' },
          { href: '/admin/pedidos', label: 'Gerenciar pedidos' },
          { href: '/admin/inventario', label: 'Ver inventário' },
          { href: '/admin/relatorios', label: 'Relatórios' },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="px-4 py-2 bg-[#000000] text-[#C9A84C] text-sm rounded-lg hover:bg-[#111] transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon: Icon, suffix }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{label}</p>
              <div className="w-8 h-8 bg-[#C9A84C]/10 rounded-lg flex items-center justify-center">
                <Icon size={16} className="text-[#C9A84C]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#333333] font-display">{value}</p>
            {suffix && <p className="text-gray-400 text-xs mt-1">{suffix}</p>}
          </div>
        ))}
      </div>

      {/* Gráfico e alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-[#333333] mb-4">Faturamento — últimos 30 dias</h3>
          <RevenueChart data={data.dailyRevenue} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-yellow-500" />
            <h3 className="font-semibold text-[#333333]">Alertas de Estoque</h3>
          </div>
          {data.lowStockAlerts.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum alerta no momento.</p>
          ) : (
            <ul className="space-y-2">
              {data.lowStockAlerts.slice(0, 8).map((a) => (
                <li key={a.variantId} className="text-xs border-b border-gray-50 pb-2 last:border-0">
                  <p className="font-medium text-gray-700">{a.productName}</p>
                  <p className="text-gray-500">
                    {a.size} / {a.colorName} —{' '}
                    <span className={a.stock === 0 ? 'text-red-600 font-semibold' : 'text-yellow-600 font-semibold'}>
                      {a.stock} un.
                    </span>{' '}
                    (mín. {a.minStock})
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/inventario" className="text-xs text-[#C9A84C] hover:underline mt-3 block">
            Ver inventário completo →
          </Link>
        </div>
      </div>

      {/* Top 5 produtos */}
      {data.topProducts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-[#333333] mb-4">Top 5 Produtos — últimos 30 dias</h3>
          <div className="space-y-3">
            {data.topProducts.map((p, idx) => {
              const maxQty = data.topProducts[0]?.totalQty ?? 1;
              const pct = (p.totalQty / maxQty) * 100;
              return (
                <div key={p.variantId} className="flex items-center gap-4">
                  <span className="w-5 text-sm font-bold text-gray-400">{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{p.productName}</span>
                      <span className="text-gray-500 text-xs">{p.totalQty} un. · {fmt(p.totalRevenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#C9A84C] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Últimos 10 pedidos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-[#333333]">Últimos Pedidos</h3>
          <Link href="/admin/pedidos" className="text-sm text-[#C9A84C] hover:underline">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Número', 'Cliente', 'Total', 'Pagamento', 'Status', 'Data', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{o.orderNumber}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800 font-medium truncate max-w-[140px]">{o.customerName}</p>
                    <p className="text-gray-400 text-xs truncate max-w-[140px]">{o.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{fmt(o.total)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{o.paymentMethod ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] ?? ''}`}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/pedidos/${o.id}`} className="text-[#C9A84C] hover:underline text-xs">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
