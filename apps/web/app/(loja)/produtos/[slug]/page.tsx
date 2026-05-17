'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { ProductGallery } from '@/components/loja/product-gallery';
import { VariantSelector } from '@/components/loja/variant-selector';
import { ShippingSimulator } from '@/components/loja/shipping-simulator';
import { ProductCard } from '@/components/loja/product-card';
import { ProductCardSkeleton } from '@/components/loja/product-card-skeleton';
import { getProduct, formatPrice, type ProductDetail } from '@/lib/products-api';

export default function ProdutoDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getProduct(slug)
      .then((p) => {
        setProduct(p);
        // Pré-seleciona primeira cor disponível
        const firstVariant = p.variants.find((v) => v.isActive && v.stock > 0);
        if (firstVariant) setSelectedColor(firstVariant.colorName);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const selectedVariant = product?.variants.find(
    (v) => v.colorName === selectedColor && v.size === selectedSize && v.isActive,
  ) ?? null;

  const maxQty = selectedVariant?.stock ?? 1;

  const handleColorChange = useCallback((color: string) => {
    setSelectedColor(color);
    setSelectedSize('');
    setQuantity(1);
  }, []);

  const handleSizeChange = useCallback((size: string) => {
    setSelectedSize(size);
    setQuantity(1);
  }, []);

  const handleQtyChange = useCallback((delta: number) => {
    setQuantity((q) => Math.max(1, Math.min(q + delta, maxQty)));
  }, [maxQty]);

  if (loading) return <ProductDetailSkeleton />;
  if (notFound || !product) return <NotFound />;

  const effectivePrice = selectedVariant?.priceOverride ?? product.promotionalPrice ?? product.price;
  const originalPrice = product.price;
  const hasPromo = effectivePrice < originalPrice;
  const discountPct = hasPromo ? Math.round((1 - effectivePrice / originalPrice) * 100) : 0;
  const canAddToCart = !!selectedSize && (selectedVariant?.stock ?? 0) > 0;

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 mb-6" aria-label="Breadcrumb">
        <Link href="/produtos" className="hover:text-black transition-colors">Produtos</Link>
        <span>/</span>
        <Link href={`/produtos?category=${product.category.slug}`} className="hover:text-black transition-colors">
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-black truncate">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-14">
        {/* Galeria */}
        <ProductGallery images={product.images} productName={product.name} />

        {/* Info */}
        <div>
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{product.category.name}</p>
            <h1 className="font-display text-2xl md:text-3xl font-semibold leading-tight">{product.name}</h1>
            {product.sku && <p className="text-xs text-gray-400 mt-1">SKU: {product.sku}</p>}
          </div>

          {/* Preço */}
          <div className="flex items-baseline gap-3 mb-5">
            <span className="text-2xl font-bold text-black">{formatPrice(effectivePrice)}</span>
            {hasPromo && (
              <>
                <span className="text-sm text-gray-400 line-through">{formatPrice(originalPrice)}</span>
                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
                  -{discountPct}%
                </span>
              </>
            )}
          </div>

          {/* Seletor de variante */}
          <div className="mb-6">
            <VariantSelector
              variants={product.variants}
              selectedColor={selectedColor}
              selectedSize={selectedSize}
              onColorChange={handleColorChange}
              onSizeChange={handleSizeChange}
            />
          </div>

          {/* Quantidade */}
          {selectedSize && (
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-medium">Quantidade:</span>
              <div className="flex items-center border border-gray-200">
                <button
                  onClick={() => handleQtyChange(-1)}
                  disabled={quantity <= 1}
                  aria-label="Diminuir quantidade"
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-12 text-center text-sm font-medium">{quantity}</span>
                <button
                  onClick={() => handleQtyChange(1)}
                  disabled={quantity >= maxQty}
                  aria-label="Aumentar quantidade"
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              disabled={!canAddToCart}
              className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-3.5 px-6 font-semibold text-sm hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={!selectedSize ? 'Selecione um tamanho para continuar' : 'Adicionar ao carrinho'}
            >
              <ShoppingBag className="w-4 h-4" />
              {!selectedSize ? 'Selecione um tamanho' : 'Adicionar ao carrinho'}
            </button>
            <button
              disabled={!canAddToCart}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-[#C9A84C] text-[#C9A84C] py-3.5 px-6 font-semibold text-sm hover:bg-[#C9A84C] hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4" />
              Comprar agora
            </button>
          </div>

          {/* Simulação de frete */}
          <div className="mb-6">
            <ShippingSimulator productId={product.id} />
          </div>

          {/* Descrição colapsável */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => setDescriptionOpen((o) => !o)}
              className="flex items-center justify-between w-full py-4 text-sm font-medium hover:text-[#C9A84C] transition-colors"
            >
              Descrição do produto
              {descriptionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {descriptionOpen && (
              <div className="pb-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {product.description}
                {product.composition && (
                  <p className="mt-3 text-gray-500">
                    <strong>Composição:</strong> {product.composition}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Política de troca */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => setPolicyOpen((o) => !o)}
              className="flex items-center justify-between w-full py-4 text-sm font-medium hover:text-[#C9A84C] transition-colors"
            >
              Política de troca e devolução
              {policyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {policyOpen && (
              <p className="pb-4 text-sm text-gray-600 leading-relaxed">
                Você tem até 30 dias corridos após o recebimento para solicitar troca ou devolução.
                O produto deve estar sem uso, com etiquetas originais e na embalagem original.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Produtos relacionados */}
      {product.related.length > 0 && (
        <section className="mt-16 border-t border-gray-100 pt-12">
          <h2 className="font-display text-2xl font-semibold mb-8">Você também pode gostar</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {product.related.slice(0, 4).map((r) => (
              <ProductCard
                key={r.id}
                product={{
                  ...r,
                  discountPercentage: r.promotionalPrice
                    ? Math.round((1 - r.promotionalPrice / r.price) * 100)
                    : null,
                  isNew: false,
                  isOnSale: !!r.promotionalPrice,
                  thumbnailImage: r.primaryImage,
                  altText: r.name,
                  availableColors: [],
                  category: product.category,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="container mx-auto px-6 py-8 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-48 mb-6" />
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-[4/5] bg-gray-200 rounded" />
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="container mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold mb-4">Produto não encontrado</h1>
      <p className="text-gray-500 mb-8">O produto que você procura não existe ou foi removido.</p>
      <Link
        href="/produtos"
        className="inline-block bg-black text-white px-8 py-3 text-sm font-semibold hover:bg-gray-900 transition-colors"
      >
        Ver todos os produtos
      </Link>
    </div>
  );
}
