import { Suspense } from 'react';
import Link from 'next/link';
import { BannerCarousel } from '@/components/loja/banner-carousel';
import { ProductCard } from '@/components/loja/product-card';
import { ProductGridSkeleton } from '@/components/loja/product-card-skeleton';
import { getProducts, getCategories } from '@/lib/products-api';

async function FeaturedProducts() {
  const [featured, newest] = await Promise.all([
    getProducts({ in_stock: true, sort: 'relevance', limit: 8 }),
    getProducts({ is_new: true, sort: 'newest', limit: 4 }),
  ]);

  return (
    <>
      {/* Destaques */}
      <section className="container mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-10">
          <h2 className="font-display text-3xl font-semibold">Destaques</h2>
          <Link href="/produtos" className="text-sm text-[#C9A84C] hover:underline tracking-wider">
            Ver todos →
          </Link>
        </div>

        {featured.data.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-2">Nenhum produto disponível</p>
            <p className="text-sm">Volte em breve para novidades!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {featured.data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* Banner intermediário */}
      <section className="bg-black text-white py-16 text-center">
        <p className="text-[#C9A84C] uppercase tracking-[0.3em] text-xs font-semibold mb-3">
          Frete grátis acima de R$ 299
        </p>
        <h2 className="font-display text-3xl font-semibold mb-6">Aproveite nossa seleção especial</h2>
        <Link
          href="/produtos?on_sale=true"
          className="inline-block border border-[#C9A84C] text-[#C9A84C] px-10 py-3 text-sm font-semibold hover:bg-[#C9A84C] hover:text-black transition-colors tracking-wider uppercase"
        >
          Ver Promoções
        </Link>
      </section>

      {/* Novidades */}
      {newest.data.length > 0 && (
        <section className="container mx-auto px-6 py-16">
          <div className="flex items-end justify-between mb-10">
            <h2 className="font-display text-3xl font-semibold">Novidades</h2>
            <Link href="/produtos?is_new=true" className="text-sm text-[#C9A84C] hover:underline tracking-wider">
              Ver tudo →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {newest.data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

async function CategoryStrip() {
  const categories = await getCategories();
  if (categories.length === 0) return null;

  return (
    <section className="container mx-auto px-6 py-8">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/produtos?category=${cat.slug}`}
            className="flex-shrink-0 border border-gray-200 px-5 py-2 text-sm hover:border-black hover:bg-black hover:text-white transition-all whitespace-nowrap"
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function LojaHomePage() {
  return (
    <div>
      <BannerCarousel />

      <Suspense fallback={null}>
        <CategoryStrip />
      </Suspense>

      <Suspense fallback={
        <section className="container mx-auto px-6 py-16">
          <div className="h-10 bg-gray-200 rounded w-48 mb-10 animate-pulse" />
          <ProductGridSkeleton count={8} />
        </section>
      }>
        <FeaturedProducts />
      </Suspense>

      {/* Diferenciais */}
      <section className="border-t border-gray-100 py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: '🚚', title: 'Entrega Rápida', desc: 'Enviamos em até 24h' },
              { icon: '🔒', title: 'Pagamento Seguro', desc: 'Ambiente 100% protegido' },
              { icon: '↩️', title: 'Troca Fácil', desc: 'Até 30 dias para troca' },
              { icon: '💎', title: 'Qualidade Premium', desc: 'Tecidos selecionados' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="p-4">
                <p className="text-3xl mb-2">{icon}</p>
                <p className="font-semibold text-sm mb-1">{title}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
