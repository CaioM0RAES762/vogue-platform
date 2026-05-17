'use client';

import { useMemo } from 'react';
import type { ProductVariant } from '@/lib/products-api';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedColor: string | null;
  selectedSize: string | null;
  onColorChange: (color: string) => void;
  onSizeChange: (size: string) => void;
}

const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'UNICO'];

export function VariantSelector({
  variants,
  selectedColor,
  selectedSize,
  onColorChange,
  onSizeChange,
}: VariantSelectorProps) {
  const activeVariants = variants.filter((v) => v.isActive);

  // Cores únicas com stock agregado
  const colors = useMemo(() => {
    const map = new Map<string, { hex: string | null; hasStock: boolean }>();
    activeVariants.forEach((v) => {
      const existing = map.get(v.colorName);
      map.set(v.colorName, {
        hex: v.colorHex ?? existing?.hex ?? null,
        hasStock: (existing?.hasStock ?? false) || v.stock > 0,
      });
    });
    return [...map.entries()].map(([name, data]) => ({ name, ...data }));
  }, [activeVariants]);

  // Tamanhos disponíveis para a cor selecionada
  const sizes = useMemo(() => {
    const relevantVariants = selectedColor
      ? activeVariants.filter((v) => v.colorName === selectedColor)
      : activeVariants;

    const map = new Map<string, { stock: number }>();
    relevantVariants.forEach((v) => {
      const existing = map.get(v.size);
      map.set(v.size, { stock: (existing?.stock ?? 0) + v.stock });
    });

    return SIZE_ORDER.filter((s) => map.has(s)).map((s) => ({
      size: s,
      stock: map.get(s)!.stock,
    }));
  }, [activeVariants, selectedColor]);

  // Estoque da variante selecionada
  const selectedVariant = useMemo(() => {
    if (!selectedColor || !selectedSize) return null;
    return activeVariants.find(
      (v) => v.colorName === selectedColor && v.size === selectedSize,
    ) ?? null;
  }, [activeVariants, selectedColor, selectedSize]);

  const LOW_STOCK = 5;

  return (
    <div className="space-y-5">
      {/* Seletor de cor */}
      {colors.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-sm font-medium">Cor:</span>
            {selectedColor && <span className="text-sm text-gray-600">{selectedColor}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map(({ name, hex, hasStock }) => (
              <button
                key={name}
                onClick={() => { onColorChange(name); onSizeChange(''); }}
                disabled={!hasStock}
                aria-label={`Cor ${name}${!hasStock ? ' (esgotada)' : ''}`}
                className={`relative w-9 h-9 rounded-full border-2 transition-all ${
                  selectedColor === name ? 'border-black scale-110' : 'border-transparent hover:border-gray-400'
                } ${!hasStock ? 'opacity-40 cursor-not-allowed' : ''}`}
                style={{ backgroundColor: hex ?? '#ccc' }}
                title={name}
              >
                {!hasStock && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-full h-px bg-gray-600 rotate-45 block" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Seletor de tamanho */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-medium">
            Tamanho: {!selectedSize && <span className="text-gray-400 text-xs font-normal">(obrigatório)</span>}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sizes.map(({ size, stock }) => {
            const outOfStock = stock === 0;
            const isSelected = selectedSize === size;
            return (
              <button
                key={size}
                onClick={() => !outOfStock && onSizeChange(size)}
                disabled={outOfStock}
                aria-pressed={isSelected}
                className={`min-w-[44px] h-10 px-2 text-sm border-2 transition-all font-medium ${
                  isSelected
                    ? 'border-black bg-black text-white'
                    : outOfStock
                    ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                    : 'border-gray-200 text-gray-800 hover:border-black'
                }`}
              >
                {size === 'UNICO' ? 'Único' : size}
              </button>
            );
          })}
        </div>
      </div>

      {/* Aviso de estoque baixo */}
      {selectedVariant && selectedVariant.stock > 0 && selectedVariant.stock <= LOW_STOCK && (
        <p className="text-amber-600 text-sm font-medium">
          ⚠ Apenas {selectedVariant.stock} unidade{selectedVariant.stock > 1 ? 's' : ''} disponível{selectedVariant.stock > 1 ? 'is' : ''}
        </p>
      )}
    </div>
  );
}
