import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Criar conta' };

export default function CadastroPage() {
  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h1 className="font-display text-2xl font-semibold text-center mb-6">Criar conta</h1>
      {/* Formulário completo será implementado na Sprint 4 */}
      <p className="text-muted-foreground text-center text-sm">
        Cadastro será implementado na Sprint 4.
      </p>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <a href="/auth/login" className="text-brand-gold hover:underline font-medium">
          Entrar
        </a>
      </div>
    </div>
  );
}
