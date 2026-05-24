'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { accountApi, UserAddress, AccountApiError } from '@/lib/account-api';

const addressSchema = z.object({
  recipientName: z.string().min(2, 'Nome do destinatário obrigatório'),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  street: z.string().min(2, 'Logradouro obrigatório'),
  number: z.string().min(1, 'Número obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, 'Bairro obrigatório'),
  city: z.string().min(2, 'Cidade obrigatória'),
  state: z.string().length(2, 'UF inválida'),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
});

type AddressForm = z.infer<typeof addressSchema>;

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function EnderecosPage() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cepLoading, setCepLoading] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
  });

  const zipCode = watch('zipCode');

  useEffect(() => {
    loadAddresses();
  }, []);

  async function loadAddresses() {
    setLoading(true);
    try {
      const data = await accountApi.getAddresses();
      setAddresses(data);
    } catch {
      setError('Erro ao carregar endereços.');
    } finally {
      setLoading(false);
    }
  }

  async function lookupCep(cep: string) {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setValue('street', data.logradouro || '');
        setValue('neighborhood', data.bairro || '');
        setValue('city', data.localidade || '');
        setValue('state', data.uf || '');
      }
    } catch {
      // silencioso
    } finally {
      setCepLoading(false);
    }
  }

  useEffect(() => {
    if (zipCode && zipCode.replace(/\D/g, '').length === 8) {
      lookupCep(zipCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipCode]);

  function openNewForm() {
    setEditingId(null);
    reset({});
    setShowForm(true);
    setError('');
  }

  function openEditForm(addr: UserAddress) {
    setEditingId(addr.id);
    reset({
      recipientName: addr.recipientName,
      zipCode: addr.zipCode,
      street: addr.street,
      number: addr.number,
      complement: addr.complement ?? '',
      neighborhood: addr.neighborhood,
      city: addr.city,
      state: addr.state,
      label: addr.label ?? '',
      isDefault: addr.isDefault,
    });
    setShowForm(true);
    setError('');
  }

  async function onSubmit(data: AddressForm) {
    setError('');
    try {
      if (editingId) {
        const updated = await accountApi.updateAddress(editingId, data);
        setAddresses((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
      } else {
        const created = await accountApi.createAddress(data as Omit<UserAddress, 'id' | 'createdAt'>);
        setAddresses((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditingId(null);
    } catch (e) {
      setError(e instanceof AccountApiError ? e.message : 'Erro ao salvar endereço.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este endereço?')) return;
    try {
      await accountApi.deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError('Erro ao excluir endereço.');
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const updated = await accountApi.setDefaultAddress(id);
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === updated.id }))
      );
    } catch {
      setError('Erro ao definir endereço padrão.');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-black">Endereços</h2>
        {!showForm && (
          <button
            onClick={openNewForm}
            className="text-sm bg-brand-black text-brand-gold px-4 py-2 rounded hover:bg-gray-800 transition-colors"
          >
            + Novo endereço
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-200 rounded-lg p-5 space-y-4 bg-gray-50">
          <h3 className="font-medium text-brand-black">{editingId ? 'Editar endereço' : 'Novo endereço'}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Identificação (opcional)</label>
              <input {...register('label')} placeholder="Ex: Casa, Trabalho" className="input-field" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome do destinatário *</label>
              <input {...register('recipientName')} className="input-field" />
              {errors.recipientName && <p className="text-xs text-red-600 mt-1">{errors.recipientName.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CEP *</label>
              <div className="relative">
                <input {...register('zipCode')} placeholder="00000-000" className="input-field" />
                {cepLoading && (
                  <div className="absolute right-2 top-2.5 w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              {errors.zipCode && <p className="text-xs text-red-600 mt-1">{errors.zipCode.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número *</label>
              <input {...register('number')} className="input-field" />
              {errors.number && <p className="text-xs text-red-600 mt-1">{errors.number.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Logradouro *</label>
              <input {...register('street')} className="input-field" />
              {errors.street && <p className="text-xs text-red-600 mt-1">{errors.street.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Complemento</label>
              <input {...register('complement')} placeholder="Apto, sala..." className="input-field" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bairro *</label>
              <input {...register('neighborhood')} className="input-field" />
              {errors.neighborhood && <p className="text-xs text-red-600 mt-1">{errors.neighborhood.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cidade *</label>
              <input {...register('city')} className="input-field" />
              {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">UF *</label>
              <select {...register('state')} className="input-field">
                <option value="">Selecione</option>
                {ESTADOS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
              {errors.state && <p className="text-xs text-red-600 mt-1">{errors.state.message}</p>}
            </div>

            <div className="sm:col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isDefault" {...register('isDefault')} className="rounded border-gray-300 text-brand-gold" />
              <label htmlFor="isDefault" className="text-sm text-gray-700">Definir como endereço padrão</label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-brand-black text-brand-gold text-sm font-medium rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-5 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      {addresses.length === 0 && !showForm ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Você ainda não tem endereços cadastrados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`border rounded-lg p-4 relative ${addr.isDefault ? 'border-brand-gold bg-brand-gold/5' : 'border-gray-200'}`}
            >
              {addr.isDefault && (
                <span className="absolute top-2 right-2 text-xs bg-brand-gold text-brand-black font-semibold px-2 py-0.5 rounded">
                  Padrão
                </span>
              )}
              {addr.label && <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{addr.label}</p>}
              <p className="text-sm font-medium text-brand-black">{addr.recipientName}</p>
              <p className="text-sm text-gray-600 mt-0.5">
                {addr.street}, {addr.number}{addr.complement ? `, ${addr.complement}` : ''}
              </p>
              <p className="text-sm text-gray-600">
                {addr.neighborhood} — {addr.city}/{addr.state}
              </p>
              <p className="text-sm text-gray-600">CEP: {addr.zipCode}</p>

              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => openEditForm(addr)}
                  className="text-xs text-brand-gold hover:underline font-medium"
                >
                  Editar
                </button>
                {!addr.isDefault && (
                  <button
                    onClick={() => handleSetDefault(addr.id)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Definir como padrão
                  </button>
                )}
                <button
                  onClick={() => handleDelete(addr.id)}
                  className="text-xs text-red-500 hover:underline ml-auto"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
