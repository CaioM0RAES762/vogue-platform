import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Recuperar senha' };

export default function RecuperarSenhaPage() {
  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h1 className="font-display text-2xl font-semibold text-center mb-6">Recuperar senha</h1>
      {/* Formulário completo será implementado na Sprint 4 */}
      <p className="text-muted-foreground text-center text-sm">
        Recuperação de senha será implementada na Sprint 4.
      </p>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <a href="/auth/login" className="text-brand-gold hover:underline font-medium">
          Voltar ao login
        </a>
      </div>
    </div>
  );
}
