import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: {
    default: 'Janaina Modas',
    template: '%s | Janaina Modas',
  },
  description: 'Moda feminina com estilo e elegância',
  keywords: ['moda feminina', 'roupas', 'vestidos', 'blusas'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
