import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
