'use client';

import { useState, useRef, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Upload, GripVertical, X } from 'lucide-react';
import { adminApi, AdminProductDetail } from '@/lib/admin-api';

const variantSchema = z.object({
  size: z.enum(['PP', 'P', 'M', 'G', 'GG', 'XG', 'UNICO']),
  colorName: z.string().min(1),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
  stock: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(0).default(5),
  price: z.coerce.number().min(0).optional(),
  sku: z.string().optional(),
});

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  description: z.string().min(1, 'Descrição obrigatória'),
  categoryId: z.string().uuid('Selecione uma categoria'),
  price: z.coerce.number().min(0.01, 'Preço obrigatório'),
  promotionalPrice: z.coerce.number().min(0).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).default('DRAFT'),
  isFeatured: z.boolean().default(false),
  isOnSale: z.boolean().default(false),
  sku: z.string().optional(),
  brand: z.string().optional(),
  collection: z.string().optional(),
  composition: z.string().optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  variants: z.array(variantSchema).min(1, 'Adicione ao menos uma variante'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: AdminProductDetail;
  onSubmit: (data: unknown) => Promise<void>;
  productId?: string;
}

const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'UNICO'];

export default function ProductForm({ defaultValues, onSubmit, productId }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<{ id: string; url: string }[]>(
    defaultValues?.images?.map((i) => ({ id: i.id, url: i.url })) ?? [],
  );
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      categoryId: defaultValues?.categoryId ?? '',
      price: defaultValues?.price ?? 0,
      promotionalPrice: defaultValues?.promotionalPrice ?? undefined,
      status: (defaultValues?.status as FormData['status']) ?? 'DRAFT',
      isFeatured: defaultValues?.isFeatured ?? false,
      isOnSale: defaultValues?.isOnSale ?? false,
      sku: defaultValues?.sku ?? '',
      brand: defaultValues?.brand ?? '',
      collection: defaultValues?.collection ?? '',
      composition: defaultValues?.composition ?? '',
      seoTitle: defaultValues?.seoTitle ?? '',
      seoDescription: defaultValues?.seoDescription ?? '',
      variants: defaultValues?.variants?.length
        ? defaultValues.variants.map((v) => ({
            size: v.size as FormData['variants'][0]['size'],
            colorName: v.colorName,
            colorHex: v.colorHex,
            stock: v.stock,
            minStock: v.minStock,
            price: v.price ?? undefined,
            sku: v.sku,
          }))
        : [{ size: 'M', colorName: '', colorHex: '#000000', stock: 0, minStock: 5 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !productId) return;
      try {
        const uploaded = await adminApi.uploadProductImages(productId, Array.from(files));
        setUploadedImages((prev) => [...prev, ...uploaded.map((u: { id: string; url: string }) => ({ id: u.id, url: u.url }))]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erro no upload');
      }
    },
    [productId],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleFormSubmit(data: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        ...data,
        promotionalPrice: data.promotionalPrice || null,
        imageIds: uploadedImages.map((i) => i.id),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Informações básicas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Informações Básicas</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input {...register('name')} className="input-field" placeholder="Ex: Blusa Ciganinha" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
              <textarea
                {...register('description')}
                rows={4}
                className="input-field resize-none"
                placeholder="Descreva o produto…"
              />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço Base (R$) *</label>
                <input {...register('price')} type="number" step="0.01" min="0" className="input-field" />
                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço Promocional</label>
                <input {...register('promotionalPrice')} type="number" step="0.01" min="0" className="input-field" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                <input {...register('categoryId')} className="input-field" placeholder="UUID da categoria" />
                {errors.categoryId && <p className="text-red-500 text-xs mt-1">{errors.categoryId.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input {...register('sku')} className="input-field" placeholder="Gerado automaticamente" />
              </div>
            </div>
          </div>

          {/* Imagens */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Imagens</h3>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={[
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                dragging ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-gray-200 hover:border-[#C9A84C]/50',
                !productId ? 'opacity-50 pointer-events-none' : '',
              ].join(' ')}
            >
              <Upload size={24} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">
                {productId ? 'Arraste imagens ou clique para selecionar' : 'Salve o produto primeiro para fazer upload'}
              </p>
              <p className="text-xs text-gray-400 mt-1">JPEG, PNG ou WebP · max 10 arquivos</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {uploadedImages.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {uploadedImages.map((img, idx) => (
                  <div key={img.id} className="relative group">
                    <img src={img.url} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
                    {idx === 0 && (
                      <span className="absolute bottom-0 left-0 right-0 bg-[#C9A84C] text-white text-[9px] text-center rounded-b-lg py-0.5">
                        Principal
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setUploadedImages((p) => p.filter((i) => i.id !== img.id))}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Variantes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Variantes *</h3>
              <button
                type="button"
                onClick={() => append({ size: 'M', colorName: '', colorHex: '#000000', stock: 0, minStock: 5 })}
                className="flex items-center gap-1 text-sm text-[#C9A84C] hover:underline"
              >
                <Plus size={14} /> Adicionar variante
              </button>
            </div>
            {errors.variants?.root && (
              <p className="text-red-500 text-xs">{errors.variants.root.message}</p>
            )}
            {errors.variants && !Array.isArray(errors.variants) && (
              <p className="text-red-500 text-xs">{(errors.variants as { message?: string }).message}</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-xs text-gray-500 w-6"></th>
                    <th className="text-left py-2 px-2 text-xs text-gray-500">Tamanho</th>
                    <th className="text-left py-2 px-2 text-xs text-gray-500">Cor</th>
                    <th className="text-left py-2 px-2 text-xs text-gray-500 w-10">Hex</th>
                    <th className="text-left py-2 px-2 text-xs text-gray-500">Estoque</th>
                    <th className="text-left py-2 px-2 text-xs text-gray-500">Mín.</th>
                    <th className="text-left py-2 px-2 text-xs text-gray-500">Preço (opt.)</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fields.map((field, idx) => (
                    <tr key={field.id}>
                      <td className="py-2 px-2 text-gray-300"><GripVertical size={14} /></td>
                      <td className="py-2 px-2">
                        <select {...register(`variants.${idx}.size`)} className="input-field py-1 text-xs">
                          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input {...register(`variants.${idx}.colorName`)} className="input-field py-1 text-xs" placeholder="Ex: Preto" />
                      </td>
                      <td className="py-2 px-2">
                        <input {...register(`variants.${idx}.colorHex`)} type="color" className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                      </td>
                      <td className="py-2 px-2">
                        <input {...register(`variants.${idx}.stock`)} type="number" min="0" className="input-field py-1 text-xs w-20" />
                      </td>
                      <td className="py-2 px-2">
                        <input {...register(`variants.${idx}.minStock`)} type="number" min="0" className="input-field py-1 text-xs w-16" />
                      </td>
                      <td className="py-2 px-2">
                        <input {...register(`variants.${idx}.price`)} type="number" step="0.01" min="0" className="input-field py-1 text-xs w-24" placeholder="—" />
                      </td>
                      <td className="py-2 px-2">
                        <button type="button" onClick={() => remove(idx)} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-5">
          {/* Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Status</h3>
            <select {...register('status')} className="input-field">
              <option value="DRAFT">Rascunho</option>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </select>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input {...register('isFeatured')} type="checkbox" className="rounded" />
                Destaque na página inicial
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input {...register('isOnSale')} type="checkbox" className="rounded" />
                Produto em promoção
              </label>
            </div>
          </div>

          {/* Detalhes opcionais */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Detalhes</h3>
            {[
              { name: 'brand', label: 'Marca' },
              { name: 'collection', label: 'Coleção' },
              { name: 'composition', label: 'Composição' },
            ].map(({ name, label }) => (
              <div key={name}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input {...register(name as keyof FormData)} className="input-field text-sm" />
              </div>
            ))}
          </div>

          {/* SEO */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">SEO</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Meta Title (max 70)</label>
              <input {...register('seoTitle')} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Meta Description (max 160)</label>
              <textarea {...register('seoDescription')} rows={3} className="input-field text-sm resize-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#000000] text-[#C9A84C] font-semibold rounded-xl hover:bg-[#111] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Salvando…' : 'Salvar Produto'}
          </button>
        </div>
      </div>
    </form>
  );
}
