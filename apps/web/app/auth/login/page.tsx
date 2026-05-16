import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h1 className="font-display text-2xl font-semibold text-center mb-6">Entrar na conta</h1>
      {/* Formulário completo será implementado na Sprint 4 */}
      <p className="text-muted-foreground text-center text-sm">
        Autenticação será implementada na Sprint 4.
      </p>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Não tem conta?{' '}
        <a href="/auth/cadastro" className="text-brand-gold hover:underline font-medium">
          Cadastre-se
        </a>
      </div>
    </div>
  );
}
