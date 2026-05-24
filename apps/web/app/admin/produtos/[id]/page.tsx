'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProductForm from '../_components/ProductForm';
import { adminApi, AdminProductDetail } from '@/lib/admin-api';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getProduct(id).then(setProduct).finally(() => setLoading(false));
  }, [id]);

  async function handleUpdate(data: unknown) {
    await adminApi.updateProduct(id, data);
    router.push('/admin/produtos');
  }

  if (loading) return <div className="animate-pulse h-96 bg-white rounded-xl" />;
  if (!product) return <p className="text-red-500">Produto não encontrado</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#333333] mb-6">Editar: {product.name}</h2>
      <ProductForm
        defaultValues={product}
        onSubmit={handleUpdate}
        productId={id}
      />
    </div>
  );
}
