'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

// ─── Validação de CPF (algoritmo dígito verificador) ─────────────────────────
function validateCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calcDigit = (slice: string, factor: number) => {
    const sum = slice.split('').reduce((acc, d) => acc + Number(d) * factor--, 0);
    const rem = (sum * 10) % 11;
    return rem >= 10 ? 0 : rem;
  };
  return (
    calcDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    calcDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

const cadastroSchema = z
  .object({
    name: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
    email: z.string().email('E-mail inválido'),
    cpf: z.string().refine(validateCpf, { message: 'CPF inválido' }),
    phone: z
      .string()
      .min(10, 'Telefone inválido')
      .regex(/^[\d\s\-().+]+$/, 'Telefone inválido'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter ao menos 1 letra maiúscula')
      .regex(/\d/, 'Deve conter ao menos 1 número'),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Aceite dos termos é obrigatório' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type CadastroForm = z.infer<typeof cadastroSchema>;

// ─── Indicador de força de senha ──────────────────────────────────────────────
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z\d]/.test(password)) score++;
  if (score <= 1) return { score, label: 'Muito fraca', color: 'bg-red-500' };
  if (score === 2) return { score, label: 'Fraca', color: 'bg-orange-400' };
  if (score === 3) return { score, label: 'Média', color: 'bg-yellow-400' };
  if (score === 4) return { score, label: 'Forte', color: 'bg-green-500' };
  return { score, label: 'Muito forte', color: 'bg-green-700' };
}

function maskCpf(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

export default function CadastroPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
    mode: 'onChange',
    defaultValues: { acceptTerms: undefined as unknown as true },
  });

  const passwordValue = watch('password') ?? '';
  const strength = useMemo(() => getPasswordStrength(passwordValue), [passwordValue]);

  const onSubmit = async (data: CadastroForm) => {
    setServerError('');
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        cpf: data.cpf.replace(/\D/g, ''),
        phone: data.phone,
        password: data.password,
        acceptTerms: data.acceptTerms,
      });
      router.push('/loja');
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
      <h1 className="font-display text-2xl font-semibold text-center mb-6">Criar conta</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Nome completo
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            {...register('name')}
            className={inputClass(!!errors.name)}
            placeholder="Seu nome completo"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className={inputClass(!!errors.email)}
            placeholder="seu@email.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
            CPF
          </label>
          <input
            id="cpf"
            type="text"
            inputMode="numeric"
            {...register('cpf')}
            onChange={(e) => setValue('cpf', maskCpf(e.target.value), { shouldValidate: true })}
            className={inputClass(!!errors.cpf)}
            placeholder="000.000.000-00"
            maxLength={14}
          />
          {errors.cpf && <p className="mt-1 text-xs text-red-600">{errors.cpf.message}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Telefone <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            {...register('phone')}
            className={inputClass(!!errors.phone)}
            placeholder="(11) 9 0000-0000"
          />
          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Senha
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
          {passwordValue.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1 h-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-colors ${
                      strength.score >= i ? strength.color : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              {strength.label && (
                <p className="text-xs text-gray-500 mt-1">Força da senha: {strength.label}</p>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirmar senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            className={inputClass(!!errors.confirmPassword)}
            placeholder="Repita a senha"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        <div className="flex items-start gap-2">
          <input
            id="acceptTerms"
            type="checkbox"
            {...register('acceptTerms')}
            className="mt-0.5 h-4 w-4 accent-brand-gold"
          />
          <label htmlFor="acceptTerms" className="text-sm text-gray-600">
            Li e concordo com os{' '}
            <a href="/termos" className="text-brand-gold hover:underline">
              Termos de Uso
            </a>{' '}
            e a{' '}
            <a href="/privacidade" className="text-brand-gold hover:underline">
              Política de Privacidade
            </a>
          </label>
        </div>
        {errors.acceptTerms && (
          <p className="text-xs text-red-600">{errors.acceptTerms.message}</p>
        )}

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
          {isSubmitting ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href="/auth/login" className="text-brand-gold hover:underline font-medium">
          Entrar
        </Link>
      </div>
    </div>
  );
}
