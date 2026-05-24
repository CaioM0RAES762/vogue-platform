'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight, CheckSquare } from 'lucide-react';
import { adminApi, AdminProduct } from '@/lib/admin-api';

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', DRAFT: 'Rascunho' };
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-700 bg-green-50',
  INACTIVE: 'text-gray-500 bg-gray-100',
  DRAFT: 'text-yellow-700 bg-yellow-50',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProdutosPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      const res = await adminApi.getProducts(params);
      setProducts(res.data);
      setTotal(res.meta.total);
      setPages(res.meta.pages);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === products.length ? new Set() : new Set(products.map((p) => p.id)),
    );
  }

  async function bulkAction(action: 'activate' | 'deactivate' | 'delete') {
    if (!selected.size) return;
    if (action === 'delete' && !confirm(`Excluir ${selected.size} produto(s)?`)) return;
    setActionLoading(true);
    try {
      await adminApi.bulkProducts([...selected], action);
      setSelected(new Set());
      load();
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleStatus(p: AdminProduct) {
    const next = p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await adminApi.patchProductStatus(p.id, next);
    load();
  }

  async function deleteProduct(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return;
    await adminApi.deleteProduct(id);
    load();
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
              placeholder="Buscar por nome ou SKU…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
            <option value="DRAFT">Rascunho</option>
          </select>
        </div>
        <Link
          href="/admin/produtos/novo"
          className="flex items-center gap-2 px-4 py-2 bg-[#000000] text-[#C9A84C] text-sm rounded-lg hover:bg-[#111] transition-colors shrink-0"
        >
          <Plus size={15} />
          Novo Produto
        </Link>
      </div>

      {/* Ações em lote */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-lg px-4 py-2 text-sm">
          <CheckSquare size={15} className="text-[#C9A84C]" />
          <span className="font-medium">{selected.size} selecionado(s)</span>
          <div className="flex gap-2 ml-2">
            {[
              { label: 'Ativar', action: 'activate' as const },
              { label: 'Inativar', action: 'deactivate' as const },
              { label: 'Excluir', action: 'delete' as const, danger: true },
            ].map(({ label, action, danger }) => (
              <button
                key={action}
                disabled={actionLoading}
                onClick={() => bulkAction(action)}
                className={`px-3 py-1 rounded text-xs font-medium ${danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#000000] text-[#C9A84C] hover:bg-[#111]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === products.length && products.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                {['Produto', 'SKU', 'Categoria', 'Preço', 'Estoque', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.primaryImage ? (
                          <img src={p.primaryImage} alt={p.name} className="w-10 h-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 shrink-0" />
                        )}
                        <span className="font-medium text-gray-800 truncate max-w-[160px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.category.name}</td>
                    <td className="px-4 py-3 font-semibold">
                      {p.promotionalPrice ? (
                        <span>
                          <span className="text-gray-400 line-through text-xs mr-1">{fmt(p.price)}</span>
                          {fmt(p.promotionalPrice)}
                        </span>
                      ) : (
                        fmt(p.price)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={p.isLowStock ? 'text-yellow-600 font-semibold' : 'text-gray-700'}>
                        {p.totalStock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? ''}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/produtos/${p.id}`} className="text-gray-400 hover:text-[#C9A84C]">
                          <Pencil size={15} />
                        </Link>
                        <button
                          onClick={() => toggleStatus(p)}
                          className="text-gray-400 hover:text-blue-500"
                          title={p.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}
                        >
                          {p.status === 'ACTIVE' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button
                          onClick={() => deleteProduct(p.id, p.name)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
            <span className="text-gray-500 text-xs">{total} produtos</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                ←
              </button>
              <span className="px-3 py-1 text-gray-600">
                {page} / {pages}
              </span>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
