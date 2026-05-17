'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi, ApiError } from '@/lib/api';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter ao menos 1 letra maiúscula')
      .regex(/\d/, 'Deve conter ao menos 1 número'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

function RedefinirSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  if (!token) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <p className="text-red-600 text-sm mb-4">Link de redefinição inválido ou expirado.</p>
        <Link href="/auth/recuperar-senha" className="text-brand-gold hover:underline text-sm">
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="font-display text-xl font-semibold mb-3">Senha redefinida!</h1>
        <p className="text-sm text-gray-600 mb-6">
          Sua senha foi atualizada com sucesso. Faça login para continuar.
        </p>
        <button
          onClick={() => router.push('/auth/login')}
          className="bg-brand-black text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
        >
          Ir para o login
        </button>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await authApi.resetPassword(token, data.password);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Erro ao conectar. Tente novamente.');
      }
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full border rounded-md px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-brand-gold ${
      hasError ? 'border-red-500' : 'border-gray-300'
    }`;

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h1 className="font-display text-2xl font-semibold text-center mb-2">Nova senha</h1>
      <p className="text-center text-sm text-gray-500 mb-6">Escolha uma nova senha segura.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Nova senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            className={inputClass(!!errors.password)}
            placeholder="Mínimo 8 caracteres"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirmar nova senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            className={inputClass(!!errors.confirmPassword)}
            placeholder="Repita a nova senha"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="w-full bg-brand-black text-white py-2.5 rounded-md font-medium text-sm transition hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Salvando...' : 'Redefinir senha'}
        </button>
      </form>
    </div>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense>
      <RedefinirSenhaForm />
    </Suspense>
  );
}
