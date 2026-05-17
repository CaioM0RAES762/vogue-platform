'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CheckoutCustomer } from '@/lib/checkout-api';

const schema = z.object({
  name: z.string().min(3, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido'),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<CheckoutCustomer>;
  onNext: (data: CheckoutCustomer) => void;
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

export function CheckoutStep1Customer({ defaultValues, onNext }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {},
  });

  const cpfRaw = watch('cpf') ?? '';

  useEffect(() => {
    if (defaultValues?.cpf) setValue('cpf', defaultValues.cpf);
  }, [defaultValues?.cpf, setValue]);

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue('cpf', formatCpf(e.target.value), { shouldValidate: true });
  }

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <h2 className="font-playfair text-xl font-bold text-gray-900">Dados Pessoais</h2>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Nome completo *</label>
        <Input {...register('name')} placeholder="Maria Silva" autoComplete="name" />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">E-mail *</label>
        <Input
          {...register('email')}
          type="email"
          placeholder="maria@email.com"
          autoComplete="email"
        />
        {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">CPF *</label>
          <Input
            value={formatCpf(cpfRaw)}
            onChange={handleCpfChange}
            placeholder="000.000.000-00"
            inputMode="numeric"
            autoComplete="off"
          />
          {errors.cpf && <p className="text-xs text-red-500">{errors.cpf.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Telefone</label>
          <Input
            {...register('phone')}
            placeholder="(11) 99999-9999"
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
      </div>

      <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white">
        Continuar
      </Button>
    </form>
  );
}
