'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingBag,
  Tag,
  BarChart2,
  LogOut,
} from 'lucide-react';

const navLinks = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/produtos', label: 'Produtos', icon: Package },
  { href: '/admin/inventario', label: 'Inventário', icon: Warehouse },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/cupons', label: 'Cupons', icon: Tag },
  { href: '/admin/relatorios', label: 'Relatórios', icon: BarChart2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    const role = sessionStorage.getItem('user_role');
    if (!token) {
      router.replace('/auth/login?redirect=/admin/dashboard');
      return;
    }
    if (role && role !== 'ADMIN') {
      router.replace('/loja');
    }
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user_role');
    sessionStorage.removeItem('user_name');
    router.replace('/auth/login');
  }

  return (
    <div className="min-h-screen flex bg-[#F5F5F5]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#000000] flex flex-col shrink-0 fixed inset-y-0 left-0 z-30">
        <div className="p-6 border-b border-white/10">
          <span className="font-display text-[#C9A84C] text-lg font-semibold tracking-wide">
            Janaina Modas
          </span>
          <p className="text-gray-500 text-xs mt-1">Painel Administrativo</p>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={[
                      'flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-colors',
                      isActive
                        ? 'text-[#C9A84C] bg-white/10 font-medium'
                        : 'text-gray-400 hover:text-[#C9A84C] hover:bg-white/5',
                    ].join(' ')}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 text-gray-500 hover:text-red-400 transition-colors text-sm w-full"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col ml-64">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shadow-sm sticky top-0 z-20">
          <h1 className="font-semibold text-[#333333]">
            {navLinks.find((l) => pathname === l.href || pathname.startsWith(l.href + '/'))?.label ?? 'Admin'}
          </h1>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
