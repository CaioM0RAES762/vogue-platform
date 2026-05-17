'use client';

import Link from 'next/link';
import Image from 'next/image';
import { type ProductCard as ProductCardType, formatPrice } from '@/lib/products-api';

interface ProductCardProps {
  product: ProductCardType;
}

export function ProductCard({ product }: ProductCardProps) {
  const effectivePrice = product.promotionalPrice ?? product.price;

  return (
    <Link href={`/produtos/${product.slug}`} className="group block">
      <div className="relative overflow-hidden bg-gray-100 aspect-[3/4]">
        {product.primaryImage ? (
          <Image
            src={product.thumbnailImage ?? product.primaryImage}
            alt={product.altText}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <span className="text-gray-400 text-xs">Sem imagem</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isNew && (
            <span className="bg-[#C9A84C] text-black text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
              Novo
            </span>
          )}
          {product.isOnSale && product.discountPercentage && (
            <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
              -{product.discountPercentage}%
            </span>
          )}
        </div>

        {/* Hover CTA */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-black bg-opacity-90 py-3 text-center">
          <span className="text-white text-xs font-semibold tracking-widest uppercase">
            Ver detalhes
          </span>
        </div>
      </div>

      <div className="pt-3 pb-1">
        <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wider truncate">
          {product.category.name}
        </p>
        <h3 className="text-sm font-medium text-black leading-snug line-clamp-2 group-hover:text-[#C9A84C] transition-colors">
          {product.name}
        </h3>

        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-base font-semibold text-black">
            {formatPrice(effectivePrice)}
          </span>
          {product.promotionalPrice && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(product.price)}
            </span>
          )}
        </div>

        {/* Tamanhos disponíveis */}
        {product.availableSizes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {product.availableSizes.slice(0, 5).map((s) => (
              <span key={s} className="text-[10px] border border-gray-200 px-1.5 py-0.5 text-gray-600">
                {s === 'UNICO' ? 'Único' : s}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
