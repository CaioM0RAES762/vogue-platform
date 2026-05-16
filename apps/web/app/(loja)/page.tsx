export default function LojaHomePage() {
  return (
    <div>
      {/* Banner hero — será implementado na Sprint 5 */}
      <section className="bg-brand-black text-white py-24 text-center">
        <h1 className="font-display text-4xl md:text-6xl font-bold mb-4">
          Nova Coleção{' '}
          <span className="text-brand-gold">Verão 2025</span>
        </h1>
        <p className="text-gray-300 text-lg mb-8 max-w-xl mx-auto">
          Elegância e estilo para cada momento do seu dia.
        </p>
        <a
          href="/loja/produtos"
          className="inline-block bg-brand-gold text-black font-semibold px-8 py-3 hover:opacity-90 transition-opacity"
        >
          Ver Coleção
        </a>
      </section>

      {/* Catálogo de produtos — será implementado na Sprint 5 */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="font-display text-3xl font-semibold text-center mb-12">
          Destaques
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-brand-gray-light aspect-[3/4] animate-pulse rounded"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
