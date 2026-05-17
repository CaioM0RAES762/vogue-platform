'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi, ApiError } from '@/lib/api';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
});
type FormData = z.infer<typeof schema>;

export default function RecuperarSenhaPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await authApi.forgotPassword(data.email);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Erro ao conectar. Tente novamente.');
      }
    }
  };

  if (sent) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-4xl mb-4">✉️</div>
        <h1 className="font-display text-xl font-semibold mb-3">Verifique seu e-mail</h1>
        <p className="text-sm text-gray-600 mb-6">
          Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha em
          breve.
        </p>
        <Link href="/auth/login" className="text-brand-gold hover:underline text-sm font-medium">
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h1 className="font-display text-2xl font-semibold text-center mb-2">Recuperar senha</h1>
      <p className="text-center text-sm text-gray-500 mb-6">
        Informe seu e-mail e enviaremos as instruções.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className={`w-full border rounded-md px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-brand-gold ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="seu@email.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
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
          {isSubmitting ? 'Enviando...' : 'Enviar instruções'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <Link href="/auth/login" className="text-brand-gold hover:underline font-medium">
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
