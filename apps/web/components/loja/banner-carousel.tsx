'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Banner {
  id: number;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  bg: string;
}

const BANNERS: Banner[] = [
  {
    id: 1,
    title: 'Nova Coleção',
    subtitle: 'Verão 2025',
    cta: 'Ver Coleção',
    href: '/produtos?sort=newest',
    bg: 'from-black via-zinc-900 to-black',
  },
  {
    id: 2,
    title: 'Ofertas Especiais',
    subtitle: 'Até 50% de desconto',
    cta: 'Ver Promoções',
    href: '/produtos?on_sale=true',
    bg: 'from-zinc-900 via-stone-800 to-zinc-900',
  },
  {
    id: 3,
    title: 'Looks Exclusivos',
    subtitle: 'Peças únicas para você',
    cta: 'Explorar',
    href: '/produtos',
    bg: 'from-black via-neutral-900 to-black',
  },
];

const INTERVAL_MS = 5000;

export function BannerCarousel() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((c) => (c + 1) % BANNERS.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + BANNERS.length) % BANNERS.length), []);

  useEffect(() => {
    const id = setInterval(next, INTERVAL_MS);
    return () => clearInterval(id);
  }, [next]);

  const banner = BANNERS[current];

  return (
    <section className={`relative bg-gradient-to-r ${banner.bg} text-white py-24 md:py-32 overflow-hidden transition-all duration-700`}>
      <div className="container mx-auto px-6 text-center relative z-10">
        <p className="text-[#C9A84C] uppercase tracking-[0.3em] text-xs font-semibold mb-3 transition-opacity">
          {banner.subtitle}
        </p>
        <h1 className="font-display text-4xl md:text-6xl font-bold mb-6">{banner.title}</h1>
        <Link
          href={banner.href}
          className="inline-block bg-[#C9A84C] text-black font-semibold px-10 py-3.5 hover:bg-[#b8973b] transition-colors tracking-wider uppercase text-sm"
        >
          {banner.cta}
        </Link>
      </div>

      {/* Setas */}
      <button
        onClick={prev}
        aria-label="Banner anterior"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white bg-opacity-10 hover:bg-opacity-20 transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      <button
        onClick={next}
        aria-label="Próximo banner"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white bg-opacity-10 hover:bg-opacity-20 transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>

      {/* Pontos */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {BANNERS.map((b, i) => (
          <button
            key={b.id}
            onClick={() => setCurrent(i)}
            aria-label={`Ir para banner ${i + 1}`}
            className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-[#C9A84C] w-6' : 'bg-white bg-opacity-50'}`}
          />
        ))}
      </div>
    </section>
  );
}
