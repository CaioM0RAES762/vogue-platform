'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { Category } from '@/lib/products-api';
import { FilterSidebar, type ActiveFilters } from './filter-sidebar';

interface FilterDrawerProps {
  categories: Category[];
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
  resultCount?: number;
}

export function FilterDrawer({ categories, filters, onChange, resultCount }: FilterDrawerProps) {
  const [open, setOpen] = useState(false);

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
    <>
      {/* Botão trigger */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 border border-black px-4 py-2 text-sm font-medium hover:bg-black hover:text-white transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtrar
          {activeCount > 0 && (
            <span className="ml-1 bg-[#C9A84C] text-black text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </button>
        {resultCount !== undefined && (
          <p className="text-sm text-gray-500">{resultCount} produtos</p>
        )}
      </div>

      {/* Overlay + Drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-80 max-w-full bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-sm uppercase tracking-wider">Filtros</h2>
              <button onClick={() => setOpen(false)} aria-label="Fechar filtros">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FilterSidebar
                categories={categories}
                filters={filters}
                onChange={(f) => { onChange(f); setOpen(false); }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
