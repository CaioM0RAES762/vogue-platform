import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas que exigem autenticação (qualquer role)
const PROTECTED_PREFIXES = ['/minha-conta', '/checkout'];
// Rotas que exigem ADMIN
const ADMIN_PREFIXES = ['/admin'];
// Rotas de auth: redireciona usuário autenticado para a loja
const AUTH_PREFIXES = ['/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const refreshToken = request.cookies.get('refresh_token');
  const isAuthenticated = !!refreshToken;

  // Usuário autenticado não precisa ver as telas de login/cadastro
  if (AUTH_PREFIXES.some((p) => pathname.startsWith(p)) && isAuthenticated) {
    return NextResponse.redirect(new URL('/loja', request.url));
  }

  // Rotas protegidas de cliente
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rotas de admin — a verificação de role é feita no backend;
  // aqui apenas garantimos que há cookie de sessão
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p)) && !isAuthenticated) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/auth/:path*', '/minha-conta/:path*', '/checkout/:path*', '/admin/:path*'],
};
