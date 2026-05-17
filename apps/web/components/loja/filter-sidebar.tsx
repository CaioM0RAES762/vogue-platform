'use client';

import { useCallback } from 'react';
import type { Category } from '@/lib/products-api';

const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG'];
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'newest', label: 'Mais recentes' },
  { value: 'best_sellers', label: 'Mais vendidos' },
];

export interface ActiveFilters {
  category?: string;
  sizes: string[];
  on_sale: boolean;
  is_new: boolean;
  in_stock: boolean;
  min_price?: number;
  max_price?: number;
  sort?: string;
}

interface FilterSidebarProps {
  categories: Category[];
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
}

export function FilterSidebar({ categories, filters, onChange }: FilterSidebarProps) {
  const toggle = useCallback(
    <K extends keyof ActiveFilters>(key: K, value: ActiveFilters[K]) => {
      onChange({ ...filters, [key]: value });
    },
    [filters, onChange],
  );

  const toggleSize = useCallback(
    (size: string) => {
      const next = filters.sizes.includes(size)
        ? filters.sizes.filter((s) => s !== size)
        : [...filters.sizes, size];
      onChange({ ...filters, sizes: next });
    },
    [filters, onChange],
  );

  const clear = useCallback(() => {
    onChange({ sizes: [], on_sale: false, is_new: false, in_stock: false });
  }, [onChange]);

  const activeCount = [
    filters.category,
    ...filters.sizes,
    filters.on_sale,
    filters.is_new,
    filters.in_stock,
    filters.min_price,
    filters.max_price,
  ].filter(Boolean).length;

  return (
    <aside className="w-64 flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-sm uppercase tracking-wider">Filtros</h2>
        {activeCount > 0 && (
          <button onClick={clear} className="text-xs text-[#C9A84C] hover:underline">
            Limpar ({activeCount})
          </button>
        )}
      </div>

      {/* Ordenação */}
      <FilterSection title="Ordenar por">
        <select
          value={filters.sort ?? 'relevance'}
          onChange={(e) => toggle('sort', e.target.value)}
          className="w-full border border-gray-200 text-sm py-1.5 px-2 focus:outline-none focus:border-black"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </FilterSection>

      {/* Categoria */}
      {categories.length > 0 && (
        <FilterSection title="Categoria">
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="category"
                checked={!filters.category}
                onChange={() => toggle('category', undefined)}
                className="accent-black"
              />
              <span className="text-sm">Todas</span>
            </label>
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  checked={filters.category === cat.slug}
                  onChange={() => toggle('category', cat.slug)}
                  className="accent-black"
                />
                <span className="text-sm">{cat.name}</span>
                <span className="text-xs text-gray-400 ml-auto">({cat.productCount})</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Tamanhos */}
      <FilterSection title="Tamanho">
        <div className="flex flex-wrap gap-2">
          {SIZES.map((size) => (
            <button
              key={size}
              onClick={() => toggleSize(size)}
              className={`w-10 h-9 text-xs border transition-colors ${
                filters.sizes.includes(size)
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 text-gray-700 hover:border-black'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Faixa de preço */}
      <FilterSection title="Faixa de preço">
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Mín"
            value={filters.min_price ?? ''}
            min={0}
            onChange={(e) => toggle('min_price', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-gray-200 text-sm py-1.5 px-2 focus:outline-none focus:border-black"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="number"
            placeholder="Máx"
            value={filters.max_price ?? ''}
            min={0}
            onChange={(e) => toggle('max_price', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-gray-200 text-sm py-1.5 px-2 focus:outline-none focus:border-black"
          />
        </div>
      </FilterSection>

      {/* Toggles */}
      <FilterSection title="Disponibilidade">
        <div className="space-y-2">
          <ToggleFilter label="Apenas em estoque" checked={filters.in_stock} onChange={(v) => toggle('in_stock', v)} />
          <ToggleFilter label="Apenas promoções" checked={filters.on_sale} onChange={(v) => toggle('on_sale', v)} />
          <ToggleFilter label="Apenas novidades" checked={filters.is_new} onChange={(v) => toggle('is_new', v)} />
        </div>
      </FilterSection>
    </aside>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ToggleFilter({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-black' : 'bg-gray-200'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
