'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { adminApi, AdminCoupon } from '@/lib/admin-api';

type CouponType = 'PERCENTAGE' | 'FIXED';

export default function CuponsPage() {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [type, setType] = useState<CouponType>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getCoupons();
      setCoupons(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setCode(''); setType('PERCENTAGE'); setValue(''); setMaxDiscount('');
    setMinOrder(''); setMaxUses(''); setValidFrom(''); setValidUntil('');
    setError(null);
  }

  async function handleCreate() {
    if (!code.trim() || !value) { setError('Código e valor são obrigatórios'); return; }
    setSaving(true);
    setError(null);
    try {
      await adminApi.createCoupon({
        code: code.toUpperCase(),
        type,
        value: Number(value),
        maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
        minOrderValue: minOrder ? Number(minOrder) : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
      });
      resetForm();
      setShowForm(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar cupom');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: AdminCoupon) {
    await adminApi.patchCouponStatus(c.id, !c.isActive);
    load();
  }

  async function deleteCoupon(c: AdminCoupon) {
    if (!confirm(`Excluir cupom "${c.code}"?`)) return;
    try {
      await adminApi.deleteCoupon(c.id);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  }

  function fmtValue(c: AdminCoupon) {
    return c.type === 'PERCENTAGE' ? `${c.value}%` : Number(c.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">{coupons.length} cupon(s)</span>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#000000] text-[#C9A84C] text-sm rounded-lg hover:bg-[#111] transition-colors"
        >
          <Plus size={15} /> Novo Cupom
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Código', 'Tipo', 'Valor', 'Mín. Pedido', 'Usos', 'Max Usos', 'Válido até', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">Nenhum cupom cadastrado</td>
                </tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{c.code}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.type === 'PERCENTAGE' ? 'Percentual' : 'Fixo'}
                    </td>
                    <td className="px-4 py-3 font-semibold">{fmtValue(c)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.minOrderValue ? Number(c.minOrderValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.usesCount ?? c.usageCount}</td>
                    <td className="px-4 py-3 text-gray-500">{c.maxUses ?? '∞'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.validUntil ? new Date(c.validUntil).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                        {c.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(c)}
                          className="text-gray-400 hover:text-blue-500"
                          title={c.isActive ? 'Desativar' : 'Ativar'}
                        >
                          {c.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={() => deleteCoupon(c)} className="text-gray-400 hover:text-red-500">
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
      </div>

      {/* Formulário lateral */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Novo Cupom</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="input-field uppercase"
                  placeholder="Ex: VERAO20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select value={type} onChange={(e) => setType(e.target.value as CouponType)} className="input-field">
                  <option value="PERCENTAGE">Percentual (%)</option>
                  <option value="FIXED">Valor Fixo (R$)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
                <input
                  type="number"
                  min="0"
                  step={type === 'PERCENTAGE' ? '1' : '0.01'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="input-field"
                  placeholder={type === 'PERCENTAGE' ? '20' : '10.00'}
                />
              </div>

              {type === 'PERCENTAGE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desconto máximo (R$)</label>
                  <input type="number" min="0" step="0.01" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} className="input-field" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pedido mínimo (R$)</label>
                <input type="number" min="0" step="0.01" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className="input-field" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Máx. usos total</label>
                <input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="input-field" placeholder="Ilimitado" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Válido a partir de</label>
                <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="input-field" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Válido até</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input-field" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-2 bg-[#000000] text-[#C9A84C] rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Criando…' : 'Criar Cupom'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
