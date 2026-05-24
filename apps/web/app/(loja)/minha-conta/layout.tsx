'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/minha-conta/dados', label: 'Dados Pessoais' },
  { href: '/minha-conta/enderecos', label: 'Endereços' },
  { href: '/minha-conta/pedidos', label: 'Meus Pedidos' },
];

export default function MinhaContaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      router.replace('/auth/login?redirect=/minha-conta/dados');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="font-display text-2xl font-semibold text-brand-black mb-6">Minha Conta</h1>

      {/* Mobile: tabs */}
      <div className="md:hidden flex overflow-x-auto gap-1 mb-6 border-b border-gray-200 pb-0">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-brand-gold text-brand-black'
                  : 'border-transparent text-gray-500 hover:text-brand-black'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="flex gap-8">
        {/* Desktop: sidebar */}
        <aside className="hidden md:block w-52 shrink-0">
          <nav className="sticky top-24 flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2.5 rounded text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-black text-brand-gold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="mt-4 border-t border-gray-200 pt-4">
              <button
                onClick={() => {
                  sessionStorage.removeItem('access_token');
                  router.push('/auth/login');
                }}
                className="w-full px-4 py-2.5 rounded text-sm font-medium text-red-600 hover:bg-red-50 text-left transition-colors"
              >
                Sair
              </button>
            </div>
          </nav>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
