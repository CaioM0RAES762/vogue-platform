import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Painel Admin',
    template: '%s | Admin — Janaina Modas',
  },
};

const navLinks = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/inventario', label: 'Inventário' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/cupons', label: 'Cupons' },
  { href: '/admin/relatorios', label: 'Relatórios' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-brand-gray-light">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-black flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <span className="font-display text-brand-gold text-lg font-semibold">
            Janaina Modas
          </span>
          <p className="text-gray-500 text-xs mt-1">Painel Administrativo</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="block px-4 py-2.5 rounded text-gray-400 hover:text-brand-gold hover:bg-white/5 transition-colors text-sm"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10">
          <a
            href="/auth/login"
            className="block px-4 py-2 text-gray-500 hover:text-red-400 transition-colors text-sm"
          >
            Sair
          </a>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-border flex items-center px-6 shadow-sm">
          <h1 className="font-semibold text-brand-black">Administração</h1>
          {/* Proteção por role ADMIN será implementada na Sprint 4 */}
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
