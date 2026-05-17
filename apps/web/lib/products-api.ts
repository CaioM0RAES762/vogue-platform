const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  promotionalPrice: number | null;
  discountPercentage: number | null;
  isNew: boolean;
  isOnSale: boolean;
  primaryImage: string | null;
  thumbnailImage: string | null;
  altText: string;
  availableSizes: string[];
  availableColors: string[];
  category: { name: string; slug: string };
}

export interface ProductVariant {
  id: string;
  size: string;
  colorName: string;
  colorHex: string | null;
  stock: number;
  reservedStock: number;
  minStock: number;
  priceOverride: number | null;
  isActive: boolean;
  sku: string;
}

export interface ProductImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  composition: string | null;
  price: number;
  promotionalPrice: number | null;
  sku: string;
  brand: string | null;
  collection: string | null;
  gender: string | null;
  weight: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  isFeatured: boolean;
  isOnSale: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  category: { id: string; name: string; slug: string };
  related: Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    promotionalPrice: number | null;
    primaryImage: string | null;
    availableSizes: string[];
  }>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
}

export interface CatalogResult {
  data: ProductCard[];
  nextCursor: string | null;
}

export interface ProductFilters {
  cursor?: string;
  limit?: number;
  category?: string;
  sizes?: string[];
  colors?: string[];
  min_price?: number;
  max_price?: number;
  on_sale?: boolean;
  is_new?: boolean;
  in_stock?: boolean;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'best_sellers' | 'relevance';
  q?: string;
}

export interface ShippingOption {
  id: string;
  name: string;
  price: number;
  deliveryTime: string;
  company: string;
}

function buildQuery(filters: ProductFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  });
  return params.toString() ? `?${params.toString()}` : '';
}

export async function getProducts(filters: ProductFilters = {}): Promise<CatalogResult> {
  const res = await fetch(`${API_BASE}/products${buildQuery(filters)}`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) throw new Error('Falha ao carregar produtos');
  return res.json();
}

export async function getProduct(idOrSlug: string): Promise<ProductDetail> {
  const res = await fetch(`${API_BASE}/products/${idOrSlug}`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error('Produto não encontrado');
  return res.json();
}

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/categories`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getShipping(cep: string, productId: string): Promise<ShippingOption[]> {
  const cepClean = cep.replace(/\D/g, '');
  const res = await fetch(
    `${API_BASE}/checkout/shipping-options?cep=${cepClean}&productId=${productId}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return [];
  return res.json();
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
