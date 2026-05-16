export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-gray-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/loja">
            <span className="font-display text-3xl font-bold text-brand-black">
              Janaina <span className="text-brand-gold">Modas</span>
            </span>
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}
