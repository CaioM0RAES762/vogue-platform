'use client';

import { useRouter } from 'next/navigation';
import ProductForm from '../_components/ProductForm';
import { adminApi } from '@/lib/admin-api';

export default function NovoProductPage() {
  const router = useRouter();

  async function handleCreate(data: unknown) {
    await adminApi.createProduct(data);
    router.push('/admin/produtos');
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#333333] mb-6">Novo Produto</h2>
      <ProductForm onSubmit={handleCreate} />
    </div>
  );
}
