'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError('');
    try {
      const response = await login(data);
      if (response.user.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/loja');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Erro ao conectar. Tente novamente.');
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h1 className="font-display text-2xl font-semibold text-center mb-6">Entrar na conta</h1>

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
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            className={`w-full border rounded-md px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-brand-gold ${
              errors.password ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Link href="/auth/recuperar-senha" className="text-sm text-brand-gold hover:underline">
            Esqueci minha senha
          </Link>
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
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Não tem conta?{' '}
        <Link href="/auth/cadastro" className="text-brand-gold hover:underline font-medium">
          Cadastre-se
        </Link>
      </div>
    </div>
  );
}
