'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { accountApi, UserProfile, AccountApiError } from '@/lib/account-api';

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(255),
  phone: z.string().min(10, 'Telefone inválido').max(20),
});

type ProfileForm = z.infer<typeof profileSchema>;

function formatCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export default function DadosPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    accountApi.getMe()
      .then((data) => {
        setProfile(data);
        reset({ name: data.name, phone: data.phone });
      })
      .catch(() => setError('Erro ao carregar perfil.'))
      .finally(() => setLoading(false));
  }, [reset]);

  async function onSubmit(data: ProfileForm) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await accountApi.updateMe(data);
      setProfile(updated);
      setEditing(false);
      setSuccess('Dados atualizados com sucesso!');
    } catch (e) {
      setError(e instanceof AccountApiError ? e.message : 'Erro ao salvar dados.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await accountApi.deleteMe();
      sessionStorage.removeItem('access_token');
      window.location.href = '/';
    } catch {
      setError('Erro ao excluir conta. Tente novamente.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-black">Dados Pessoais</h2>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setSuccess(''); setError(''); }}
            className="text-sm text-brand-gold hover:underline font-medium"
          >
            Editar
          </button>
        )}
      </div>

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input
              {...register('name')}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              {...register('phone')}
              type="tel"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
            {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">E-mail (não editável)</label>
            <input value={profile?.email} disabled className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 text-gray-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">CPF (não editável)</label>
            <input
              value={profile ? formatCpf(profile.cpf.replace(/\D/g, '')) : ''}
              disabled
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 text-gray-400"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-brand-black text-brand-gold text-sm font-medium rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); reset({ name: profile?.name, phone: profile?.phone }); }}
              className="px-5 py-2 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Nome completo', value: profile?.name },
            { label: 'E-mail', value: profile?.email },
            { label: 'CPF', value: profile ? formatCpf(profile.cpf.replace(/\D/g, '')) : '' },
            { label: 'Telefone', value: profile?.phone },
          ].map(({ label, value }) => (
            <div key={label} className="border border-gray-100 rounded p-3">
              <dt className="text-xs text-gray-500 mb-1">{label}</dt>
              <dd className="text-sm font-medium text-brand-black">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Zona de perigo — exclusão LGPD */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-red-700 mb-2">Excluir minha conta</h3>
        <p className="text-xs text-gray-500 mb-3">
          Seus dados pessoais serão anonimizados (LGPD — RN023). Pedidos são mantidos por 5 anos conforme exigência legal.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-red-600 border border-red-300 rounded px-4 py-2 hover:bg-red-50 transition-colors"
          >
            Solicitar exclusão de conta
          </button>
        ) : (
          <div className="p-4 bg-red-50 border border-red-200 rounded space-y-3">
            <p className="text-sm text-red-800 font-medium">Tem certeza? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Sim, excluir minha conta'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
