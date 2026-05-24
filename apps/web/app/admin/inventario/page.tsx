'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, X, Plus } from 'lucide-react';
import { adminApi, InventoryVariant } from '@/lib/admin-api';

const STATUS_CONFIG = {
  AVAILABLE: { label: 'Disponível', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  LOW: { label: 'Estoque Baixo', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  OUT_OF_STOCK: { label: 'Esgotado', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

interface EditingRow {
  id: string;
  stock: number;
  minStock: number;
}

interface MovementModal {
  variantId: string;
  productName: string;
  size: string;
  colorName: string;
  currentStock: number;
}

export default function InventarioPage() {
  const [variants, setVariants] = useState<InventoryVariant[]>([]);
  const [filtered, setFiltered] = useState<InventoryVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditingRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<MovementModal | null>(null);
  const [movType, setMovType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [movQty, setMovQty] = useState('');
  const [movReason, setMovReason] = useState('');
  const [movNote, setMovNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getInventory();
      setVariants(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = variants;
    if (statusFilter) list = list.filter((v) => v.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.productName.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q),
      );
    }
    setFiltered(list);
  }, [variants, statusFilter, search]);

  async function saveInline() {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.updateInventory(editing.id, { stock: editing.stock, minStock: editing.minStock });
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function submitMovement() {
    if (!modal || !movReason.trim() || !movQty) return;
    setSaving(true);
    try {
      await adminApi.createMovement({
        variantId: modal.variantId,
        type: movType,
        quantity: Number(movQty),
        reason: movReason,
        notes: movNote || undefined,
      });
      setModal(null);
      setMovQty('');
      setMovReason('');
      setMovNote('');
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="pl-4 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 flex-1 max-w-xs"
          placeholder="Buscar produto ou SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="AVAILABLE">Disponível</option>
          <option value="LOW">Estoque Baixo</option>
          <option value="OUT_OF_STOCK">Esgotado</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['SKU', 'Produto', 'Categoria', 'Tam.', 'Cor', 'Estoque', 'Mín.', 'Vendidos/mês', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={10} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">Nenhuma variante encontrada</td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const isEditing = editing?.id === v.id;
                  const cfg = STATUS_CONFIG[v.status];
                  return (
                    <tr key={v.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.sku}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate">{v.productName}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{v.category}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{v.size}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-gray-200 shrink-0"
                            style={{ backgroundColor: v.colorHex }}
                          />
                          <span className="text-xs text-gray-600">{v.colorName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editing.stock}
                            onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })}
                            className="w-20 px-2 py-1 border border-[#C9A84C] rounded text-sm focus:outline-none"
                          />
                        ) : (
                          <span
                            className={`font-semibold ${v.stock === 0 ? 'text-red-600' : v.status === 'LOW' ? 'text-yellow-600' : 'text-green-700'}`}
                          >
                            {v.stock}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editing.minStock}
                            onChange={(e) => setEditing({ ...editing, minStock: Number(e.target.value) })}
                            className="w-16 px-2 py-1 border border-[#C9A84C] rounded text-sm focus:outline-none"
                          />
                        ) : (
                          <span className="text-gray-500">{v.minStock}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{v.soldThisMonth}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button onClick={saveInline} disabled={saving} className="text-green-500 hover:text-green-700">
                                <Check size={15} />
                              </button>
                              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-red-500">
                                <X size={15} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setEditing({ id: v.id, stock: v.stock, minStock: v.minStock })}
                              className="text-xs text-[#C9A84C] hover:underline"
                            >
                              Editar
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setModal({
                                variantId: v.id,
                                productName: v.productName,
                                size: v.size,
                                colorName: v.colorName,
                                currentStock: v.stock,
                              })
                            }
                            className="text-gray-400 hover:text-[#C9A84C]"
                            title="Registrar movimentação"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de movimentação */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Registrar Movimentação</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              {modal.productName} · {modal.size} / {modal.colorName} · Estoque atual: <strong>{modal.currentStock}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <div className="flex gap-3">
                {(['ENTRY', 'EXIT'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={movType === t}
                      onChange={() => setMovType(t)}
                      className="text-[#C9A84C]"
                    />
                    {t === 'ENTRY' ? 'Entrada' : 'Saída'}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
              <input
                type="number"
                min="1"
                value={movQty}
                onChange={(e) => setMovQty(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
              <input
                value={movReason}
                onChange={(e) => setMovReason(e.target.value)}
                className="input-field"
                placeholder="Ex: Reposição de estoque"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
              <input
                value={movNote}
                onChange={(e) => setMovNote(e.target.value)}
                className="input-field"
                placeholder="NF, fornecedor, etc."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitMovement}
                disabled={saving || !movReason.trim() || !movQty}
                className="flex-1 py-2 bg-[#000000] text-[#C9A84C] rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
