'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProductCard } from '@/components/loja/product-card';
import { ProductGridSkeleton } from '@/components/loja/product-card-skeleton';
import { FilterSidebar, type ActiveFilters } from '@/components/loja/filter-sidebar';
import { FilterDrawer } from '@/components/loja/filter-drawer';
import { getProducts, getCategories, type ProductCard as ProductCardType, type Category } from '@/lib/products-api';
import { Loader2, PackageSearch } from 'lucide-react';

function filtersFromSearch(params: URLSearchParams): ActiveFilters {
  return {
    category: params.get('category') ?? undefined,
    sizes: params.get('sizes')?.split(',').filter(Boolean) ?? [],
    on_sale: params.get('on_sale') === 'true',
    is_new: params.get('is_new') === 'true',
    in_stock: params.get('in_stock') === 'true',
    min_price: params.get('min_price') ? Number(params.get('min_price')) : undefined,
    max_price: params.get('max_price') ? Number(params.get('max_price')) : undefined,
    sort: params.get('sort') ?? undefined,
  };
}

function filtersToSearch(f: ActiveFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.category) p.set('category', f.category);
  if (f.sizes.length) p.set('sizes', f.sizes.join(','));
  if (f.on_sale) p.set('on_sale', 'true');
  if (f.is_new) p.set('is_new', 'true');
  if (f.in_stock) p.set('in_stock', 'true');
  if (f.min_price !== undefined) p.set('min_price', String(f.min_price));
  if (f.max_price !== undefined) p.set('max_price', String(f.max_price));
  if (f.sort) p.set('sort', f.sort);
  return p;
}

export default function ProdutosPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductCardType[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<ActiveFilters>(() => filtersFromSearch(searchParams));
  const [searchText, setSearchText] = useState(searchParams.get('q') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega categorias uma vez
  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  // Carrega produtos quando filtros mudam
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNextCursor(null);

    getProducts({
      ...filters,
      q: searchText || undefined,
      limit: 20,
    })
      .then((res) => {
        if (cancelled) return;
        setProducts(res.data);
        setNextCursor(res.nextCursor);
      })
      .catch(() => { if (!cancelled) setProducts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [filters, searchText]);

  const handleFiltersChange = useCallback((f: ActiveFilters) => {
    setFilters(f);
    const params = filtersToSearch(f);
    if (searchText) params.set('q', searchText);
    router.replace(`/produtos?${params.toString()}`, { scroll: false });
  }, [router, searchText]);

  const handleSearchChange = useCallback((q: string) => {
    setSearchText(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = filtersToSearch(filters);
      if (q) params.set('q', q);
      router.replace(`/produtos?${params.toString()}`, { scroll: false });
    }, 300);
  }, [filters, router]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getProducts({ ...filters, q: searchText || undefined, cursor: nextCursor, limit: 20 });
      setProducts((prev) => [...prev, ...res.data]);
      setNextCursor(res.nextCursor);
    } catch {
      // ignora
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, filters, searchText]);

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-4">Produtos</h1>

        {/* Busca */}
        <input
          type="search"
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar produtos..."
          className="w-full md:max-w-sm border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-black"
          aria-label="Buscar produtos"
        />
      </div>

      <div className="flex gap-8">
        {/* Sidebar desktop */}
        <div className="hidden md:block">
          <FilterSidebar categories={categories} filters={filters} onChange={handleFiltersChange} />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {/* Drawer mobile */}
          <div className="md:hidden">
            <FilterDrawer
              categories={categories}
              filters={filters}
              onChange={handleFiltersChange}
              resultCount={products.length}
            />
          </div>

          {/* Contagem desktop */}
          <div className="hidden md:flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {loading ? 'Carregando...' : `${products.length} produto${products.length !== 1 ? 's' : ''} encontrado${products.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Grid */}
          {loading ? (
            <ProductGridSkeleton count={8} />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <PackageSearch className="w-16 h-16 text-gray-300 mb-4" />
              <h2 className="font-display text-xl font-semibold mb-2">Nenhum produto encontrado</h2>
              <p className="text-gray-500 text-sm mb-6 max-w-sm">
                Tente outros filtros ou termos de busca.
              </p>
              <button
                onClick={() => { handleFiltersChange({ sizes: [], on_sale: false, is_new: false, in_stock: false }); handleSearchChange(''); }}
                className="border border-black px-6 py-2 text-sm font-medium hover:bg-black hover:text-white transition-colors"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Carregar mais */}
              {nextCursor && (
                <div className="flex justify-center mt-12">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 border border-black px-8 py-3 text-sm font-medium hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                  >
                    {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                    Carregar mais
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
