'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductImage } from '@/lib/products-api';

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-[4/5] bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400 text-sm">Sem imagens</span>
      </div>
    );
  }

  const prev = () => setSelected((s) => (s - 1 + images.length) % images.length);
  const next = () => setSelected((s) => (s + 1) % images.length);

  return (
    <div className="flex gap-3">
      {/* Thumbnails verticais */}
      {images.length > 1 && (
        <div className="hidden md:flex flex-col gap-2 w-16">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setSelected(i)}
              className={`relative aspect-square overflow-hidden border-2 transition-colors ${
                i === selected ? 'border-black' : 'border-transparent hover:border-gray-300'
              }`}
            >
              <Image
                src={img.thumbnailUrl}
                alt={img.altText ?? productName}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Imagem principal */}
      <div className="flex-1 relative">
        <div className="relative aspect-[4/5] overflow-hidden group">
          <Image
            src={images[selected].url}
            alt={images[selected].altText ?? productName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={selected === 0}
          />

          {/* Setas mobile */}
          {images.length > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Imagem anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 md:hidden z-10 p-1.5 bg-white bg-opacity-80 rounded-full shadow"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={next}
                aria-label="Próxima imagem"
                className="absolute right-2 top-1/2 -translate-y-1/2 md:hidden z-10 p-1.5 bg-white bg-opacity-80 rounded-full shadow"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Indicador mobile */}
        {images.length > 1 && (
          <div className="md:hidden flex justify-center gap-1.5 mt-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                aria-label={`Imagem ${i + 1}`}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === selected ? 'bg-black' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
