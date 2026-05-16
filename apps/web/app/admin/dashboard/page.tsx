import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-8">Dashboard</h2>

      {/* KPI cards — serão implementados na Sprint 10 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {['Vendas Hoje', 'Pedidos Pendentes', 'Produtos Ativos', 'Estoque Baixo'].map((label) => (
          <div key={label} className="bg-white rounded-lg shadow-sm p-6 border border-border">
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="font-display text-2xl font-bold mt-1 text-brand-black">—</p>
          </div>
        ))}
      </div>

      {/* Gráfico de faturamento — será implementado na Sprint 10 */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-border">
        <h3 className="font-semibold mb-4">Faturamento — últimos 30 dias</h3>
        <div className="h-48 bg-brand-gray-light rounded flex items-center justify-center text-muted-foreground text-sm">
          Gráfico será implementado na Sprint 10
        </div>
      </div>
    </div>
  );
}
