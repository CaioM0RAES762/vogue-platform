'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { lookupCep, getShippingOptions, type ShippingOption, type CheckoutAddress } from '@/lib/checkout-api';
import { useCartStore } from '@/store/cart-store';
import { cn } from '@/lib/utils';

const schema = z.object({
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  street: z.string().min(1, 'Logradouro obrigatório'),
  number: z.string().min(1, 'Número obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, 'Bairro obrigatório'),
  city: z.string().min(1, 'Cidade obrigatória'),
  state: z.string().length(2, 'UF inválida'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onNext: (address: CheckoutAddress, shipping: ShippingOption) => void;
  onBack: () => void;
}

export function CheckoutStep2Delivery({ onNext, onBack }: Props) {
  const { cart } = useCartStore();
  const [cepLoading, setCepLoading] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [shippingError, setShippingError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const zipCode = watch('zipCode') ?? '';

  async function handleCepBlur() {
    const clean = zipCode.replace(/\D/g, '');
    if (clean.length !== 8) return;

    setCepLoading(true);
    try {
      const data = await lookupCep(clean);
      setValue('street', data.logradouro ?? '');
      setValue('neighborhood', data.bairro ?? '');
      setValue('city', data.localidade ?? '');
      setValue('state', data.uf ?? '');

      await loadShippingOptions(clean);
    } catch {
      // CEP inválido — usuário preenche manualmente
    } finally {
      setCepLoading(false);
    }
  }

  async function loadShippingOptions(cep: string) {
    if (!cart?.items?.length) return;
    setShippingLoading(true);
    setShippingError('');
    setShippingOptions([]);
    setSelectedShipping(null);

    try {
      const items = cart.items.map((i: { variant: { id: string }; quantity: number }) => ({
        variantId: i.variant.id,
        quantity: i.quantity,
      }));
      const options = await getShippingOptions(cep, items);
      setShippingOptions(options);
    } catch {
      setShippingError('Não foi possível calcular o frete. Tente novamente.');
    } finally {
      setShippingLoading(false);
    }
  }

  function handleZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setValue('zipCode', formatted, { shouldValidate: true });
  }

  function onSubmit(data: FormData) {
    if (!selectedShipping) {
      setShippingError('Selecione uma opção de frete');
      return;
    }
    onNext(data as CheckoutAddress, selectedShipping);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="font-playfair text-xl font-bold text-gray-900">Endereço de Entrega</h2>

      {/* CEP */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-sm font-medium text-gray-700">CEP *</label>
          <div className="relative">
            <Input
              value={zipCode}
              onChange={handleZipChange}
              onBlur={handleCepBlur}
              placeholder="00000-000"
              inputMode="numeric"
            />
            {cepLoading && (
              <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>
          {errors.zipCode && <p className="text-xs text-red-500">{errors.zipCode.message}</p>}
        </div>
      </div>

      {/* Endereço */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Logradouro *</label>
        <Input {...register('street')} placeholder="Av. Paulista" />
        {errors.street && <p className="text-xs text-red-500">{errors.street.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Número *</label>
          <Input {...register('number')} placeholder="1578" />
          {errors.number && <p className="text-xs text-red-500">{errors.number.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Complemento</label>
          <Input {...register('complement')} placeholder="Apto 12" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Bairro *</label>
        <Input {...register('neighborhood')} placeholder="Bela Vista" />
        {errors.neighborhood && (
          <p className="text-xs text-red-500">{errors.neighborhood.message}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-1">
          <label className="text-sm font-medium text-gray-700">Cidade *</label>
          <Input {...register('city')} placeholder="São Paulo" />
          {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">UF *</label>
          <Input {...register('state')} placeholder="SP" maxLength={2} className="uppercase" />
          {errors.state && <p className="text-xs text-red-500">{errors.state.message}</p>}
        </div>
      </div>

      {/* Opções de frete */}
      {shippingLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculando frete…
        </div>
      )}

      {shippingOptions.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-gray-700">Opções de Frete *</legend>
          {shippingOptions.map((opt) => {
            const key = `${opt.carrier}-${opt.service}`;
            const selected = selectedShipping === opt;
            return (
              <label
                key={key}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors',
                  selected ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="shipping"
                    className="accent-amber-500"
                    checked={selected}
                    onChange={() => {
                      setSelectedShipping(opt);
                      setShippingError('');
                    }}
                  />
                  <Truck className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium">
                    {opt.carrier} — {opt.service}
                  </span>
                  <span className="text-xs text-gray-500">({opt.days} dias úteis)</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {opt.price === 0
                    ? 'Grátis'
                    : opt.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {shippingError && <p className="text-xs text-red-500">{shippingError}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
          Continuar
        </Button>
      </div>
    </form>
  );
}
