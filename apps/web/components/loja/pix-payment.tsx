'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Check, Clock } from 'lucide-react';

interface PixPaymentProps {
  qrCodeBase64: string | null;
  qrCode: string | null;
  expiresAt: string | null;
}

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) return;

    function calc() {
      return Math.max(0, Math.floor((new Date(expiresAt!).getTime() - Date.now()) / 1000));
    }

    setRemaining(calc());
    const id = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining > 0 && remaining < 5 * 60;
  const isExpired = remaining === 0 && !!expiresAt;

  return { minutes, seconds, isUrgent, isExpired, remaining };
}

export function PixPayment({ qrCodeBase64, qrCode, expiresAt }: PixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const { minutes, seconds, isUrgent, isExpired } = useCountdown(expiresAt);

  async function handleCopy() {
    if (!qrCode) return;
    await navigator.clipboard.writeText(qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const countdownColor = isUrgent ? 'text-red-600' : 'text-gray-700';
  const countdownBg = isUrgent ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200';

  if (isExpired) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 font-semibold text-lg">PIX expirado</p>
        <p className="text-gray-500 mt-2 text-sm">
          O tempo para pagamento expirou. Seu pedido foi cancelado automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Contador regressivo */}
      {expiresAt && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${countdownBg}`}>
          <Clock className={`w-4 h-4 ${countdownColor}`} />
          <span className={`font-mono font-semibold text-lg ${countdownColor}`}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          {isUrgent && (
            <span className="text-red-600 text-sm font-medium">— Conclua agora!</span>
          )}
        </div>
      )}

      {/* QR Code */}
      {qrCodeBase64 ? (
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
          <img
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt="QR Code PIX"
            className="w-48 h-48 sm:w-56 sm:h-56"
          />
        </div>
      ) : (
        <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center">
          <span className="text-gray-400 text-sm">QR Code indisponível</span>
        </div>
      )}

      <p className="text-sm text-gray-500 text-center max-w-xs">
        Escaneie o QR Code com o app do seu banco ou use o código abaixo
      </p>

      {/* Código copia-e-cola */}
      {qrCode && (
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="flex-1 text-xs font-mono text-gray-700 break-all line-clamp-2">
              {qrCode}
            </p>
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#C9A84C] hover:bg-[#b8973e] text-white text-xs font-medium rounded-md transition-colors"
              title="Copiar código PIX"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copiar
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </span>
        Pagamento 100% seguro via Banco Central do Brasil
      </div>
    </div>
  );
}
