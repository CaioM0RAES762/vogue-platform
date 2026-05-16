export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header será implementado na Sprint 5 */}
      <header className="h-16 bg-brand-black flex items-center justify-between px-6 sticky top-0 z-50">
        <span className="font-display text-brand-gold text-xl font-semibold tracking-wide">
          Janaina Modas
        </span>
        <nav className="hidden md:flex items-center gap-6">
          <a href="/loja" className="text-white hover:text-brand-gold transition-colors text-sm">
            Início
          </a>
          <a
            href="/loja/produtos"
            className="text-white hover:text-brand-gold transition-colors text-sm"
          >
            Produtos
          </a>
        </nav>
        <div className="flex items-center gap-4">
          <a href="/auth/login" className="text-white hover:text-brand-gold transition-colors text-sm">
            Entrar
          </a>
          <a
            href="/loja/carrinho"
            className="text-white hover:text-brand-gold transition-colors text-sm"
          >
            Carrinho (0)
          </a>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer será implementado na Sprint 5 */}
      <footer className="bg-brand-black text-white py-12 mt-auto">
        <div className="container mx-auto px-6 text-center">
          <p className="font-display text-brand-gold text-lg mb-2">Janaina Modas</p>
          <p className="text-gray-400 text-sm">Moda feminina com estilo e elegância</p>
        </div>
      </footer>
    </div>
  );
}
